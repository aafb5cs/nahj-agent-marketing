package ops_test

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/ops"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/testutil"
)

var t0 = time.Date(2026, 10, 25, 8, 0, 0, 0, time.UTC)

type jobRow struct {
	Status    string    `db:"status"`
	Attempts  int       `db:"attempts"`
	RunAt     time.Time `db:"run_at"`
	LastError *string   `db:"last_error"`
}

func readJob(t *testing.T, tdb *testutil.DB, key string) jobRow {
	t.Helper()
	var r jobRow
	if err := tdb.GetContext(context.Background(), &r, `SELECT status, attempts, run_at, last_error FROM jobs WHERE job_key = ?`, key); err != nil {
		t.Fatal(err)
	}
	return r
}

func TestEnqueueDeduplicatesByKey(t *testing.T) {
	tdb := testutil.NewDB(t)
	clk := clock.NewFake(t0)
	ctx := context.Background()
	created, err := ops.Enqueue(ctx, tdb, clk, "grant.create", "grant:unit:1", map[string]any{"unit": 1}, time.Time{})
	if err != nil || !created {
		t.Fatalf("first enqueue: created=%v err=%v", created, err)
	}
	created, err = ops.Enqueue(ctx, tdb, clk, "grant.create", "grant:unit:1", map[string]any{"unit": 1}, time.Time{})
	if err != nil || created {
		t.Fatalf("second enqueue: created=%v err=%v, want false", created, err)
	}
	var n int
	_ = tdb.GetContext(ctx, &n, `SELECT COUNT(*) FROM jobs`)
	if n != 1 {
		t.Fatalf("jobs = %d, want 1", n)
	}
}

func TestWorkerRunsDueJobsOnly(t *testing.T) {
	tdb := testutil.NewDB(t)
	clk := clock.NewFake(t0)
	ctx := context.Background()
	_, _ = ops.Enqueue(ctx, tdb, clk, "k", "now", nil, time.Time{})
	_, _ = ops.Enqueue(ctx, tdb, clk, "k", "later", nil, t0.Add(30*time.Minute))

	var ran []string
	w := &ops.Worker{DB: tdb.DB, Clock: clk, ID: "w1"}
	w.Register("k", func(_ context.Context, j ops.Job) error { ran = append(ran, j.Key); return nil })

	if n, err := w.RunOnce(ctx); err != nil || n != 1 {
		t.Fatalf("RunOnce = %d, %v; want 1", n, err)
	}
	if readJob(t, tdb, "now").Status != "done" || readJob(t, tdb, "later").Status != "queued" {
		t.Fatal("only the due job should be done")
	}
	clk.Advance(31 * time.Minute)
	if n, _ := w.RunOnce(ctx); n != 1 {
		t.Fatal("later job should run after its time")
	}
	if fmt.Sprint(ran) != "[now later]" {
		t.Fatalf("ran = %v", ran)
	}
}

func TestWorkerRetriesWithBackoffThenFails(t *testing.T) {
	tdb := testutil.NewDB(t)
	clk := clock.NewFake(t0)
	ctx := context.Background()
	_, _ = ops.Enqueue(ctx, tdb, clk, "flaky", "f1", nil, time.Time{})

	w := &ops.Worker{DB: tdb.DB, Clock: clk, ID: "w1", MaxAttempts: 3}
	w.Register("flaky", func(context.Context, ops.Job) error { return errors.New("provider timeout") })

	_, _ = w.RunOnce(ctx)
	r := readJob(t, tdb, "f1")
	if r.Status != "queued" || r.Attempts != 1 || !r.RunAt.Equal(t0.Add(5*time.Second)) {
		t.Fatalf("after 1st failure: %+v", r)
	}
	if n, _ := w.RunOnce(ctx); n != 0 {
		t.Fatal("job must wait for its backoff")
	}
	clk.Advance(5 * time.Second)
	_, _ = w.RunOnce(ctx)
	r = readJob(t, tdb, "f1")
	if r.Attempts != 2 || !r.RunAt.Equal(clk.Now().Add(10*time.Second)) {
		t.Fatalf("after 2nd failure: %+v", r)
	}
	clk.Advance(10 * time.Second)
	_, _ = w.RunOnce(ctx)
	r = readJob(t, tdb, "f1")
	if r.Status != "failed" || r.Attempts != 3 || r.LastError == nil || *r.LastError != "provider timeout" {
		t.Fatalf("after max attempts: %+v", r)
	}
}

func TestPermanentErrorAndUnknownKindFailAtOnce(t *testing.T) {
	tdb := testutil.NewDB(t)
	clk := clock.NewFake(t0)
	ctx := context.Background()
	_, _ = ops.Enqueue(ctx, tdb, clk, "bad", "p1", nil, time.Time{})
	_, _ = ops.Enqueue(ctx, tdb, clk, "nobody-handles-this", "u1", nil, time.Time{})

	w := &ops.Worker{DB: tdb.DB, Clock: clk, ID: "w1"}
	w.Register("bad", func(context.Context, ops.Job) error { return ops.Permanent(errors.New("invalid account")) })
	_, _ = w.RunOnce(ctx)

	for _, k := range []string{"p1", "u1"} {
		if r := readJob(t, tdb, k); r.Status != "failed" || r.Attempts != 1 {
			t.Fatalf("%s: %+v, want failed after 1 attempt", k, r)
		}
	}
}

func TestExpiredLeaseIsReclaimed(t *testing.T) {
	tdb := testutil.NewDB(t)
	clk := clock.NewFake(t0)
	ctx := context.Background()
	_, _ = ops.Enqueue(ctx, tdb, clk, "k", "crash", nil, time.Time{})
	// A worker claimed it and died.
	if _, err := tdb.ExecContext(ctx, `UPDATE jobs SET status = 'running', locked_by = 'dead', locked_until = ? WHERE job_key = 'crash'`, t0.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	w := &ops.Worker{DB: tdb.DB, Clock: clk, ID: "w2"}
	w.Register("k", func(context.Context, ops.Job) error { return nil })
	if n, _ := w.RunOnce(ctx); n != 0 {
		t.Fatal("a job with a live lease must not be taken")
	}
	clk.Advance(2 * time.Minute)
	if n, _ := w.RunOnce(ctx); n != 1 || readJob(t, tdb, "crash").Status != "done" {
		t.Fatal("expired lease should be reclaimed and run")
	}
}

func TestConcurrentWorkersRunEachJobOnce(t *testing.T) {
	tdb := testutil.NewDB(t)
	clk := clock.NewFake(t0)
	ctx := context.Background()
	const jobs = 60
	for i := 0; i < jobs; i++ {
		_, _ = ops.Enqueue(ctx, tdb, clk, "count", fmt.Sprintf("c%d", i), nil, time.Time{})
	}
	var mu sync.Mutex
	seen := map[string]int{}
	var total atomic.Int64
	handler := func(_ context.Context, j ops.Job) error {
		mu.Lock()
		seen[j.Key]++
		mu.Unlock()
		total.Add(1)
		return nil
	}
	var wg sync.WaitGroup
	for w := 0; w < 4; w++ {
		wk := &ops.Worker{DB: tdb.DB, Clock: clk, ID: fmt.Sprintf("w%d", w), Batch: 5}
		wk.Register("count", handler)
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				n, err := wk.RunOnce(ctx)
				if err != nil {
					t.Error(err)
					return
				}
				if n == 0 {
					return
				}
			}
		}()
	}
	wg.Wait()
	if total.Load() != jobs || len(seen) != jobs {
		t.Fatalf("ran %d jobs over %d keys, want %d each", total.Load(), len(seen), jobs)
	}
	for k, n := range seen {
		if n != 1 {
			t.Fatalf("job %s ran %d times", k, n)
		}
	}
}

func TestSchedulerCreatesOneJobPerSlot(t *testing.T) {
	tdb := testutil.NewDB(t)
	clk := clock.NewFake(t0.Add(3 * time.Minute))
	ctx := context.Background()
	s := &ops.Scheduler{DB: tdb.DB, Clock: clk, Every: map[string]time.Duration{ops.KindMaintenance: 10 * time.Minute}}
	for i := 0; i < 3; i++ { // three workers ticking in the same slot
		if err := s.Tick(ctx); err != nil {
			t.Fatal(err)
		}
	}
	clk.Advance(10 * time.Minute)
	_ = s.Tick(ctx)
	var n int
	_ = tdb.GetContext(ctx, &n, `SELECT COUNT(*) FROM jobs WHERE kind = ?`, ops.KindMaintenance)
	if n != 2 {
		t.Fatalf("maintenance jobs = %d, want 2 (one per slot)", n)
	}
}

func TestBackoff(t *testing.T) {
	want := []time.Duration{5 * time.Second, 10 * time.Second, 20 * time.Second}
	for i, w := range want {
		if got := ops.Backoff(i + 1); got != w {
			t.Fatalf("Backoff(%d) = %v, want %v", i+1, got, w)
		}
	}
	if ops.Backoff(30) != time.Hour {
		t.Fatal("backoff must cap at one hour")
	}
}
