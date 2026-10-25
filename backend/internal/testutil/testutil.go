// Package testutil gives integration tests a real, empty MySQL schema and
// signed Keycloak-style tokens.
//
// Set MK_TEST_MYSQL_DSN to a server DSN without a database, for example
//
//	MK_TEST_MYSQL_DSN="root:root@tcp(127.0.0.1:3306)/"
//
// Each test gets its own schema (mkt_<random>), migrated and dropped afterwards.
// Without the variable, database tests are skipped.
package testutil

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/hex"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/db"
	"github.com/aafb5cs/nahj-agent-marketing/backend/migrations"
	"github.com/go-jose/go-jose/v4"
	"github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
)

// DB is a migrated test schema.
type DB struct {
	*sqlx.DB
	DSN    string
	Schema string
}

// NewDB creates, migrates and (on cleanup) drops a schema for one test.
func NewDB(t *testing.T) *DB {
	t.Helper()
	base := os.Getenv("MK_TEST_MYSQL_DSN")
	if base == "" {
		t.Skip("MK_TEST_MYSQL_DSN not set; skipping database test")
	}
	ctx := context.Background()
	cfg, err := mysql.ParseDSN(base)
	if err != nil {
		t.Fatalf("MK_TEST_MYSQL_DSN: %v", err)
	}
	schema := "mkt_" + strings.ToLower(hex.EncodeToString(randBytes(5)))
	cfg.DBName = ""
	admin, err := sqlx.Open("mysql", cfg.FormatDSN())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := admin.ExecContext(ctx, "CREATE DATABASE `"+schema+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"); err != nil {
		admin.Close()
		t.Fatalf("create schema: %v", err)
	}
	t.Cleanup(func() {
		_, _ = admin.ExecContext(context.Background(), "DROP DATABASE IF EXISTS `"+schema+"`")
		admin.Close()
	})

	cfg.DBName = schema
	dsn := cfg.FormatDSN()
	if _, err := db.Migrate(ctx, dsn, migrations.Files); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	conn, err := db.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return &DB{DB: conn, DSN: dsn, Schema: schema}
}

// Issuer is the issuer used for test tokens.
const Issuer = "https://sso.test/auth/realms/nahj"

// TokenSigner signs Keycloak-style access tokens for tests.
type TokenSigner struct {
	Key    *rsa.PrivateKey
	signer jose.Signer
}

// NewTokenSigner creates a fresh RSA key.
func NewTokenSigner(t *testing.T) *TokenSigner {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	s, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: key}, (&jose.SignerOptions{}).WithType("JWT"))
	if err != nil {
		t.Fatal(err)
	}
	return &TokenSigner{Key: key, signer: s}
}

// Sign returns a compact JWT for sub, issued by azp, valid for ttl.
func (ts *TokenSigner) Sign(t *testing.T, sub, azp string, authTime time.Time, ttl time.Duration) string {
	t.Helper()
	now := time.Now()
	claims := map[string]any{
		"iss": Issuer, "sub": sub, "azp": azp, "aud": "account",
		"iat": now.Unix(), "exp": now.Add(ttl).Unix(), "auth_time": authTime.Unix(),
	}
	b, _ := json.Marshal(claims)
	obj, err := ts.signer.Sign(b)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := obj.CompactSerialize()
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func randBytes(n int) []byte {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return b
}
