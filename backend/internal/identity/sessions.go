package identity

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"errors"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/ids"
	"github.com/jmoiron/sqlx"
)

// Session is a signed-in web session. Only a hash of the cookie is stored.
type Session struct {
	IDHash     []byte    `db:"id_hash"`
	AccountID  string    `db:"account_id"`
	AuthTime   time.Time `db:"auth_time"`
	CreatedAt  time.Time `db:"created_at"`
	LastSeenAt time.Time `db:"last_seen_at"`
	ExpiresAt  time.Time `db:"expires_at"`
}

// ErrNoSession means the cookie is unknown, expired or revoked.
var ErrNoSession = errors.New("identity: no valid session")

// Sessions stores web sessions in the sessions table.
type Sessions struct {
	db  *sqlx.DB
	clk clock.Clock
	key []byte
	ttl time.Duration
}

// NewSessions builds the store. key signs CSRF tokens.
func NewSessions(db *sqlx.DB, clk clock.Clock, key []byte, ttl time.Duration) *Sessions {
	return &Sessions{db: db, clk: clk, key: key, ttl: ttl}
}

// Create starts a session and returns the cookie value to send to the browser.
func (s *Sessions) Create(ctx context.Context, accountID string, authTime time.Time, ip, userAgent string) (string, *Session, error) {
	raw := ids.RandomBytes(32)
	cookie := base64.RawURLEncoding.EncodeToString(raw)
	now := s.clk.Now()
	sess := &Session{
		IDHash:     hashCookie(cookie),
		AccountID:  accountID,
		AuthTime:   authTime.UTC().Truncate(time.Millisecond),
		CreatedAt:  now,
		LastSeenAt: now,
		ExpiresAt:  now.Add(s.ttl),
	}
	csrf := s.csrfFor(sess.IDHash)
	_, err := s.db.ExecContext(ctx, `INSERT INTO sessions
		(id_hash, account_id, csrf_hash, auth_time, created_at, last_seen_at, expires_at, ip, user_agent)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sess.IDHash, accountID, sha(csrf), sess.AuthTime, now, now, sess.ExpiresAt, truncate(ip, 45), truncate(userAgent, 255))
	if err != nil {
		return "", nil, err
	}
	return cookie, sess, nil
}

// Lookup returns the live session for a cookie value.
func (s *Sessions) Lookup(ctx context.Context, cookie string) (*Session, error) {
	if cookie == "" {
		return nil, ErrNoSession
	}
	var sess Session
	err := s.db.GetContext(ctx, &sess, `SELECT id_hash, account_id, auth_time, created_at, last_seen_at, expires_at
		FROM sessions WHERE id_hash = ? AND revoked_at IS NULL AND expires_at > ?`, hashCookie(cookie), s.clk.Now())
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNoSession
	}
	if err != nil {
		return nil, err
	}
	// Record activity at most every five minutes to keep writes low.
	if now := s.clk.Now(); now.Sub(sess.LastSeenAt) > 5*time.Minute {
		_, _ = s.db.ExecContext(ctx, `UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?`, now, sess.IDHash)
		sess.LastSeenAt = now
	}
	return &sess, nil
}

// Revoke ends one session.
func (s *Sessions) Revoke(ctx context.Context, idHash []byte) error {
	_, err := s.db.ExecContext(ctx, `UPDATE sessions SET revoked_at = ? WHERE id_hash = ? AND revoked_at IS NULL`, s.clk.Now(), idHash)
	return err
}

// RevokeAll ends every session of an account (staff disabled, "sign out everywhere").
func (s *Sessions) RevokeAll(ctx context.Context, accountID string) (int64, error) {
	res, err := s.db.ExecContext(ctx, `UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL`, s.clk.Now(), accountID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// CSRFToken returns the token the web app must send in X-CSRF-Token.
// It is derived from the session, so it can be returned again after a reload.
func (s *Sessions) CSRFToken(idHash []byte) string { return s.csrfFor(idHash) }

// VerifyCSRF checks a token in constant time.
func (s *Sessions) VerifyCSRF(idHash []byte, token string) bool {
	if token == "" {
		return false
	}
	return hmac.Equal([]byte(s.csrfFor(idHash)), []byte(token))
}

func (s *Sessions) csrfFor(idHash []byte) string {
	m := hmac.New(sha256.New, s.key)
	m.Write([]byte("csrf:"))
	m.Write(idHash)
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func hashCookie(cookie string) []byte { return sha(cookie) }

func sha(v string) []byte {
	h := sha256.Sum256([]byte(v))
	return h[:]
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}
