package db

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jmoiron/sqlx"
)

// Migrate applies every *.sql file in fsys that is not yet recorded in
// schema_migrations, in file-name order. MySQL commits DDL implicitly, so each
// file should be safe to re-run (CREATE TABLE IF NOT EXISTS and similar).
// It returns the versions it applied.
func Migrate(ctx context.Context, dsn string, fsys fs.FS) ([]string, error) {
	cfg, err := normalize(dsn, true)
	if err != nil {
		return nil, err
	}
	conn, err := sqlx.ConnectContext(ctx, "mysql", cfg.FormatDSN())
	if err != nil {
		return nil, fmt.Errorf("migrate: connect: %w", err)
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version VARCHAR(64) NOT NULL PRIMARY KEY,
		applied_at DATETIME(3) NOT NULL
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`); err != nil {
		return nil, fmt.Errorf("migrate: schema_migrations: %w", err)
	}

	var done []string
	if err := conn.SelectContext(ctx, &done, `SELECT version FROM schema_migrations`); err != nil {
		return nil, fmt.Errorf("migrate: read applied: %w", err)
	}
	applied := map[string]bool{}
	for _, v := range done {
		applied[v] = true
	}

	names, err := fs.Glob(fsys, "*.sql")
	if err != nil {
		return nil, err
	}
	sort.Strings(names)

	var ran []string
	for _, name := range names {
		version := strings.TrimSuffix(name, ".sql")
		if applied[version] {
			continue
		}
		body, err := fs.ReadFile(fsys, name)
		if err != nil {
			return ran, err
		}
		if _, err := conn.ExecContext(ctx, string(body)); err != nil {
			return ran, fmt.Errorf("migrate: %s: %w", name, err)
		}
		if _, err := conn.ExecContext(ctx,
			`INSERT INTO schema_migrations (version, applied_at) VALUES (?, UTC_TIMESTAMP(3))`, version); err != nil {
			return ran, fmt.Errorf("migrate: record %s: %w", name, err)
		}
		ran = append(ran, version)
	}
	return ran, nil
}
