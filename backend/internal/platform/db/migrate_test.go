package db_test

import (
	"context"
	"sync"
	"testing"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/db"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/testutil"
	"github.com/aafb5cs/nahj-agent-marketing/backend/migrations"
)

func TestMigrateCreatesAllTablesAndIsRepeatable(t *testing.T) {
	tdb := testutil.NewDB(t) // already migrated once
	ctx := context.Background()

	var tables int
	if err := tdb.GetContext(ctx, &tables, `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ?`, tdb.Schema); err != nil {
		t.Fatal(err)
	}
	if tables != 32 { // 31 marketplace tables + schema_migrations
		t.Fatalf("tables = %d, want 32", tables)
	}

	res, err := db.Migrate(ctx, tdb.DSN, migrations.Files)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Applied) != 0 || len(res.AlreadyApplied) != 1 {
		t.Fatalf("second run: %+v, want nothing applied and 1 already applied", res)
	}
}

// Two deploys starting together must not both apply the same migration.
func TestConcurrentMigrateAppliesOnce(t *testing.T) {
	tdb := testutil.NewEmptyDB(t)
	ctx := context.Background()
	const runs = 4
	results := make(chan db.MigrateResult, runs)
	errs := make(chan error, runs)
	var wg sync.WaitGroup
	for i := 0; i < runs; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := db.Migrate(ctx, tdb.DSN, migrations.Files)
			if err != nil {
				errs <- err
				return
			}
			results <- res
		}()
	}
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		t.Fatalf("concurrent migrate failed: %v", err)
	}
	applied := 0
	for r := range results {
		applied += len(r.Applied)
	}
	if applied != 1 {
		t.Fatalf("migration applied %d times across %d runs, want exactly 1", applied, runs)
	}
	var recorded int
	_ = tdb.GetContext(ctx, &recorded, `SELECT COUNT(*) FROM schema_migrations`)
	if recorded != 1 {
		t.Fatalf("schema_migrations rows = %d, want 1", recorded)
	}
}

func TestWithTxRollsBackOnError(t *testing.T) {
	tdb := testutil.NewDB(t)
	ctx := context.Background()
	err := db.WithTx(ctx, tdb.DB, func(tx *sqlxTx) error {
		if _, err := tx.ExecContext(ctx, `INSERT INTO rate_limits (bucket_key, window_start, hits) VALUES ('k', UTC_TIMESTAMP(3), 1)`); err != nil {
			return err
		}
		return errBoom
	})
	if err != errBoom {
		t.Fatalf("err = %v, want boom", err)
	}
	var n int
	_ = tdb.GetContext(ctx, &n, `SELECT COUNT(*) FROM rate_limits`)
	if n != 0 {
		t.Fatalf("rows = %d, want 0 after rollback", n)
	}
}

func TestIsDuplicate(t *testing.T) {
	tdb := testutil.NewDB(t)
	ctx := context.Background()
	q := `INSERT INTO rate_limits (bucket_key, window_start, hits) VALUES ('dup', '2026-01-01 00:00:00', 1)`
	if _, err := tdb.ExecContext(ctx, q); err != nil {
		t.Fatal(err)
	}
	_, err := tdb.ExecContext(ctx, q)
	if !db.IsDuplicate(err) {
		t.Fatalf("IsDuplicate(%v) = false", err)
	}
}
