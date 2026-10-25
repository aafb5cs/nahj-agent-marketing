package db_test

import (
	"context"
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

	ran, err := db.Migrate(ctx, tdb.DSN, migrations.Files)
	if err != nil {
		t.Fatal(err)
	}
	if len(ran) != 0 {
		t.Fatalf("second run applied %v, want nothing", ran)
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
