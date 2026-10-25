// Package ops runs background work from the jobs table: the outbox (calls to
// providers, nahj_backend, email) and scheduled work (deadlines, maturity,
// reconciliation). Several worker instances can run safely: jobs are claimed
// with SELECT ... FOR UPDATE SKIP LOCKED.
package ops

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/db"
	"github.com/jmoiron/sqlx"
)

// Job is one unit of background work.
type Job struct {
	ID       uint64    `db:"id"`
	Kind     string    `db:"kind"`
	Key      string    `db:"job_key"`
	Payload  []byte    `db:"payload"` // JSON; nil when the job has no payload
	RunAt    time.Time `db:"run_at"`
	Attempts int       `db:"attempts"`
}

// Enqueue adds a job inside the caller's transaction, so the job exists only
// if the business change commits. key deduplicates: enqueueing the same key
// twice keeps the first job. It reports whether a new job was created.
func Enqueue(ctx context.Context, ext sqlx.ExecerContext, clk clock.Clock, kind, key string, payload any, runAt time.Time) (bool, error) {
	var body any
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return false, fmt.Errorf("ops: payload: %w", err)
		}
		body = string(b)
	}
	if runAt.IsZero() {
		runAt = clk.Now()
	}
	res, err := ext.ExecContext(ctx, `INSERT INTO jobs (kind, job_key, payload, run_at, status, created_at)
		VALUES (?, ?, ?, ?, 'queued', ?)
		ON DUPLICATE KEY UPDATE id = id`, kind, key, body, runAt.UTC(), clk.Now())
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n == 1, nil
}

// Handler processes one job. Returning nil marks it done. Returning an error
// retries it with backoff; wrap with Permanent to fail it at once.
type Handler func(ctx context.Context, j Job) error

type permanent struct{ err error }

func (p permanent) Error() string { return p.err.Error() }
func (p permanent) Unwrap() error { return p.err }

// Permanent marks an error that retrying cannot fix.
func Permanent(err error) error { return permanent{err} }

// Worker claims and runs jobs.
type Worker struct {
	DB          *sqlx.DB
	Clock       clock.Clock
	Log         *slog.Logger
	ID          string
	Batch       int
	Poll        time.Duration
	Lease       time.Duration // how long a claimed job is reserved
	MaxAttempts int

	handlers map[string]Handler
}

// Register adds a handler for kind.
func (w *Worker) Register(kind string, h Handler) {
	if w.handlers == nil {
		w.handlers = map[string]Handler{}
	}
	w.handlers[kind] = h
}

func (w *Worker) defaults() {
	if w.Batch <= 0 {
		w.Batch = 20
	}
	if w.Poll <= 0 {
		w.Poll = time.Second
	}
	if w.Lease <= 0 {
		w.Lease = 2 * time.Minute
	}
	if w.MaxAttempts <= 0 {
		w.MaxAttempts = 20
	}
	if w.Log == nil {
		w.Log = slog.Default()
	}
}

// Run processes jobs until ctx is cancelled.
func (w *Worker) Run(ctx context.Context) error {
	w.defaults()
	w.Log.Info("worker started", "worker_id", w.ID)
	for {
		n, err := w.RunOnce(ctx)
		if err != nil && !errors.Is(err, context.Canceled) {
			w.Log.Error("worker batch failed", "error", err.Error())
		}
		if ctx.Err() != nil {
			w.Log.Info("worker stopped", "worker_id", w.ID)
			return nil
		}
		if n == 0 {
			select {
			case <-ctx.Done():
				w.Log.Info("worker stopped", "worker_id", w.ID)
				return nil
			case <-time.After(w.Poll):
			}
		}
	}
}

// RunOnce claims one batch of due jobs and runs them. It returns how many it ran.
func (w *Worker) RunOnce(ctx context.Context) (int, error) {
	w.defaults()
	jobs, err := w.claim(ctx)
	if err != nil {
		return 0, err
	}
	for _, j := range jobs {
		w.run(ctx, j)
	}
	return len(jobs), nil
}

// claim reserves due jobs: queued ones whose time has come, and running ones
// whose lease expired (their worker died).
func (w *Worker) claim(ctx context.Context) ([]Job, error) {
	now := w.Clock.Now()
	var jobs []Job
	err := db.WithTx(ctx, w.DB, func(tx *sqlx.Tx) error {
		if err := tx.SelectContext(ctx, &jobs, `SELECT id, kind, job_key, payload, run_at, attempts FROM jobs
			WHERE (status = 'queued' AND run_at <= ?) OR (status = 'running' AND locked_until < ?)
			ORDER BY run_at, id LIMIT ? FOR UPDATE SKIP LOCKED`, now, now, w.Batch); err != nil {
			return err
		}
		if len(jobs) == 0 {
			return nil
		}
		ids := make([]uint64, len(jobs))
		for i, j := range jobs {
			ids[i] = j.ID
		}
		q, args, err := sqlx.In(`UPDATE jobs SET status = 'running', locked_by = ?, locked_until = ? WHERE id IN (?)`,
			w.ID, now.Add(w.Lease), ids)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, q, args...)
		return err
	})
	return jobs, err
}

func (w *Worker) run(ctx context.Context, j Job) {
	h, ok := w.handlers[j.Kind]
	var err error
	if !ok {
		err = Permanent(fmt.Errorf("no handler for job kind %q", j.Kind))
	} else {
		err = safeCall(ctx, h, j)
	}
	now := w.Clock.Now()
	// Finish even if ctx is being cancelled, so the job is not left running.
	fctx := context.WithoutCancel(ctx)
	if err == nil {
		_, uerr := w.DB.ExecContext(fctx, `UPDATE jobs SET status = 'done', done_at = ?, locked_by = NULL, locked_until = NULL, last_error = NULL
			WHERE id = ? AND locked_by = ?`, now, j.ID, w.ID)
		w.logResult(j, nil, uerr)
		return
	}
	attempts := j.Attempts + 1
	var perm permanent
	if errors.As(err, &perm) || attempts >= w.MaxAttempts {
		_, uerr := w.DB.ExecContext(fctx, `UPDATE jobs SET status = 'failed', attempts = ?, last_error = ?, locked_by = NULL, locked_until = NULL
			WHERE id = ? AND locked_by = ?`, attempts, trim(err.Error()), j.ID, w.ID)
		w.logResult(j, err, uerr)
		return
	}
	_, uerr := w.DB.ExecContext(fctx, `UPDATE jobs SET status = 'queued', attempts = ?, last_error = ?, run_at = ?, locked_by = NULL, locked_until = NULL
		WHERE id = ? AND locked_by = ?`, attempts, trim(err.Error()), now.Add(Backoff(attempts)), j.ID, w.ID)
	w.logResult(j, err, uerr)
}

func (w *Worker) logResult(j Job, jobErr, updateErr error) {
	if updateErr != nil {
		w.Log.Error("job state update failed", "job_id", j.ID, "kind", j.Kind, "error", updateErr.Error())
	}
	if jobErr != nil {
		w.Log.Warn("job failed", "job_id", j.ID, "kind", j.Kind, "attempt", j.Attempts+1, "error", jobErr.Error())
		return
	}
	w.Log.Debug("job done", "job_id", j.ID, "kind", j.Kind)
}

// Backoff is the wait before attempt n+1: 5s, 10s, 20s ... capped at 1 hour.
func Backoff(attempts int) time.Duration {
	d := 5 * time.Second
	for i := 1; i < attempts && d < time.Hour; i++ {
		d *= 2
	}
	if d > time.Hour {
		d = time.Hour
	}
	return d
}

func safeCall(ctx context.Context, h Handler, j Job) (err error) {
	defer func() {
		if p := recover(); p != nil {
			err = fmt.Errorf("panic: %v", p)
		}
	}()
	return h(ctx, j)
}

func trim(s string) string {
	if len(s) > 255 {
		return s[:255]
	}
	return s
}

// Stats is a summary for monitoring.
type Stats struct {
	Queued       int          `db:"queued"`
	Failed       int          `db:"failed"`
	OldestQueued sql.NullTime `db:"oldest_queued"`
}

// ReadStats returns queue counts, used by the health endpoint and alerts.
func ReadStats(ctx context.Context, conn *sqlx.DB) (Stats, error) {
	var s Stats
	err := conn.GetContext(ctx, &s, `SELECT
		COALESCE(SUM(status = 'queued'), 0) AS queued,
		COALESCE(SUM(status = 'failed'), 0) AS failed,
		MIN(CASE WHEN status = 'queued' THEN run_at END) AS oldest_queued
		FROM jobs WHERE status IN ('queued', 'failed')`)
	return s, err
}
