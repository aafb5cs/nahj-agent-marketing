// Package db opens the MySQL connection and runs transactions.
package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
)

// Open connects to MySQL with the settings every query relies on:
// parsed times, UTC on both sides, and utf8mb4.
func Open(ctx context.Context, dsn string) (*sqlx.DB, error) {
	cfg, err := normalize(dsn, false)
	if err != nil {
		return nil, err
	}
	conn, err := sqlx.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, fmt.Errorf("db: open: %w", err)
	}
	conn.SetMaxOpenConns(20)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := conn.PingContext(pingCtx); err != nil {
		conn.Close()
		return nil, fmt.Errorf("db: ping: %w", err)
	}
	return conn, nil
}

func normalize(dsn string, multiStatements bool) (*mysql.Config, error) {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return nil, fmt.Errorf("db: invalid DSN: %w", err)
	}
	cfg.ParseTime = true
	cfg.Loc = time.UTC
	cfg.Collation = "utf8mb4_0900_ai_ci"
	cfg.MultiStatements = multiStatements
	if cfg.Params == nil {
		cfg.Params = map[string]string{}
	}
	cfg.Params["time_zone"] = "'+00:00'"
	return cfg, nil
}

// WithTx runs fn in one transaction. It commits when fn returns nil and rolls
// back otherwise, including on panic.
func WithTx(ctx context.Context, conn *sqlx.DB, fn func(tx *sqlx.Tx) error) (err error) {
	tx, err := conn.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("db: begin: %w", err)
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
		if err != nil {
			_ = tx.Rollback()
		}
	}()
	if err = fn(tx); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("db: commit: %w", err)
	}
	return nil
}

// IsDuplicate reports whether err is a unique-key violation (MySQL 1062).
func IsDuplicate(err error) bool {
	var me *mysql.MySQLError
	return errors.As(err, &me) && me.Number == 1062
}
