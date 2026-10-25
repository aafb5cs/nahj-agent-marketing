package db

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

// MigrateResult says what one migrate run found and did.
type MigrateResult struct {
	AlreadyApplied []string // versions recorded before this run
	Applied        []string // versions this run applied
}

// LockWait is how long migrate waits for another migrate on the same schema.
const LockWait = 60 * time.Second

// ErrMigrateLocked means another migrate held the lock for longer than LockWait.
var ErrMigrateLocked = errors.New("migrate: another migration is running on this schema")

// Migrate applies every *.sql file in fsys that is not yet recorded in
// schema_migrations, in file-name order.
//
// Only one process migrates a schema at a time: the run holds a MySQL advisory
// lock (GET_LOCK) named after the schema, so two deploys starting together
// cannot apply the same file twice. MySQL commits DDL implicitly, so each file
// should be safe to re-run (CREATE TABLE IF NOT EXISTS and similar).
func Migrate(ctx context.Context, dsn string, fsys fs.FS) (MigrateResult, error) {
	var res MigrateResult
	cfg, err := normalize(dsn, true)
	if err != nil {
		return res, err
	}
	pool, err := sqlx.ConnectContext(ctx, "mysql", cfg.FormatDSN())
	if err != nil {
		return res, fmt.Errorf("migrate: connect: %w", err)
	}
	defer pool.Close()

	// The lock belongs to a connection, so everything runs on this one.
	conn, err := pool.Connx(ctx)
	if err != nil {
		return res, fmt.Errorf("migrate: connection: %w", err)
	}
	defer conn.Close()

	lockName := "migrate:" + cfg.DBName
	var got *int
	if err := conn.GetContext(ctx, &got, `SELECT GET_LOCK(?, ?)`, lockName, int(LockWait/time.Second)); err != nil {
		return res, fmt.Errorf("migrate: lock: %w", err)
	}
	if got == nil || *got != 1 {
		return res, ErrMigrateLocked
	}
	defer conn.ExecContext(context.WithoutCancel(ctx), `SELECT RELEASE_LOCK(?)`, lockName)

	if _, err := conn.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version VARCHAR(64) NOT NULL PRIMARY KEY,
		applied_at DATETIME(3) NOT NULL
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`); err != nil {
		return res, fmt.Errorf("migrate: schema_migrations: %w", err)
	}

	// Read what is applied only after taking the lock.
	if err := conn.SelectContext(ctx, &res.AlreadyApplied, `SELECT version FROM schema_migrations ORDER BY version`); err != nil {
		return res, fmt.Errorf("migrate: read applied: %w", err)
	}
	applied := map[string]bool{}
	for _, v := range res.AlreadyApplied {
		applied[v] = true
	}

	names, err := fs.Glob(fsys, "*.sql")
	if err != nil {
		return res, err
	}
	sort.Strings(names)

	for _, name := range names {
		version := strings.TrimSuffix(name, ".sql")
		if applied[version] {
			continue
		}
		body, err := fs.ReadFile(fsys, name)
		if err != nil {
			return res, err
		}
		if err := execAll(ctx, conn, string(body)); err != nil {
			return res, fmt.Errorf("migrate: %s: %w", name, err)
		}
		if _, err := conn.ExecContext(ctx,
			`INSERT INTO schema_migrations (version, applied_at) VALUES (?, UTC_TIMESTAMP(3))`, version); err != nil {
			return res, fmt.Errorf("migrate: record %s: %w", name, err)
		}
		res.Applied = append(res.Applied, version)
	}
	return res, nil
}

// execAll runs a multi-statement script and reads every result, so an error
// in any statement (not only the first) is reported.
func execAll(ctx context.Context, conn *sqlx.Conn, script string) error {
	rows, err := conn.QueryContext(ctx, script)
	if err != nil {
		return err
	}
	defer rows.Close()
	for {
		for rows.Next() {
		}
		if !rows.NextResultSet() {
			break
		}
	}
	return rows.Err()
}
