// Package ratelimit counts attempts in fixed time windows, stored in MySQL so
// every API instance shares the same counters (no Redis in V1).
package ratelimit

import (
	"context"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/db"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
)

// Limiter checks and counts attempts.
type Limiter struct {
	db  *sqlx.DB
	clk clock.Clock
}

// New builds a limiter.
func New(conn *sqlx.DB, clk clock.Clock) *Limiter { return &Limiter{db: conn, clk: clk} }

// Allow counts one attempt for key and reports whether it is within limit for
// the current window. When it is not, retryAfter says when the window ends.
func (l *Limiter) Allow(ctx context.Context, key string, limit int, window time.Duration) (ok bool, retryAfter time.Duration, err error) {
	now := l.clk.Now()
	start := now.Truncate(window)
	var hits int
	err = db.WithTx(ctx, l.db, func(tx *sqlx.Tx) error {
		if _, err := tx.ExecContext(ctx, `INSERT INTO rate_limits (bucket_key, window_start, hits) VALUES (?, ?, 1)
			ON DUPLICATE KEY UPDATE hits = hits + 1`, key, start); err != nil {
			return err
		}
		return tx.GetContext(ctx, &hits, `SELECT hits FROM rate_limits WHERE bucket_key = ? AND window_start = ?`, key, start)
	})
	if err != nil {
		return false, 0, err
	}
	if hits > limit {
		return false, start.Add(window).Sub(now), nil
	}
	return true, 0, nil
}

// Purge deletes windows that ended before cutoff. Run by the maintenance job.
func (l *Limiter) Purge(ctx context.Context, cutoff time.Time) (int64, error) {
	res, err := l.db.ExecContext(ctx, `DELETE FROM rate_limits WHERE window_start < ? LIMIT 10000`, cutoff)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// Middleware limits a route. keyFn builds the bucket key (for example
// "redeem:acct:"+accountID); an empty key skips the check.
func (l *Limiter) Middleware(limit int, window time.Duration, keyFn func(*gin.Context) string) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := keyFn(c)
		if key == "" {
			c.Next()
			return
		}
		ok, retry, err := l.Allow(c.Request.Context(), key, limit, window)
		if err != nil {
			httpx.FailInternal(c, err)
			return
		}
		if !ok {
			httpx.Fail(c, httpx.ErrRateLimited.WithRetryAfter(retry))
			return
		}
		c.Next()
	}
}
