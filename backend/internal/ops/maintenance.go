package ops

import (
	"context"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/jmoiron/sqlx"
)

// KindMaintenance cleans up expired technical rows.
const KindMaintenance = "ops.maintenance"

// Maintenance deletes expired sessions, old rate-limit windows, old idempotency
// records and finished jobs. Business data is never deleted here.
type Maintenance struct {
	DB    *sqlx.DB
	Clock clock.Clock
}

// Retention periods for technical rows.
const (
	keepSessions   = 30 * 24 * time.Hour // after expiry or revocation
	keepRateLimits = 24 * time.Hour
	keepOperations = 30 * 24 * time.Hour
	keepDoneJobs   = 14 * 24 * time.Hour
)

// Handle implements Handler.
func (m *Maintenance) Handle(ctx context.Context, _ Job) error {
	now := m.Clock.Now()
	stmts := []struct {
		q   string
		arg time.Time
	}{
		{`DELETE FROM sessions WHERE COALESCE(revoked_at, expires_at) < ? LIMIT 10000`, now.Add(-keepSessions)},
		{`DELETE FROM rate_limits WHERE window_start < ? LIMIT 10000`, now.Add(-keepRateLimits)},
		{`DELETE FROM operations WHERE created_at < ? AND status <> 'running' LIMIT 10000`, now.Add(-keepOperations)},
		{`DELETE FROM jobs WHERE status = 'done' AND done_at < ? LIMIT 10000`, now.Add(-keepDoneJobs)},
	}
	for _, s := range stmts {
		if _, err := m.DB.ExecContext(ctx, s.q, s.arg); err != nil {
			return err
		}
	}
	return nil
}

// Scheduler enqueues recurring jobs. Each run gets a key based on its time
// slot, so several workers scheduling at once still create one job per slot.
type Scheduler struct {
	DB    *sqlx.DB
	Clock clock.Clock
	Every map[string]time.Duration // kind -> interval
}

// Tick enqueues every recurring job whose current slot has no job yet.
func (s *Scheduler) Tick(ctx context.Context) error {
	now := s.Clock.Now()
	for kind, every := range s.Every {
		slot := now.Truncate(every)
		key := kind + ":" + slot.Format("20060102T150405")
		if _, err := Enqueue(ctx, s.DB, s.Clock, kind, key, nil, slot); err != nil {
			return err
		}
	}
	return nil
}

// Run ticks every minute until ctx is cancelled.
func (s *Scheduler) Run(ctx context.Context) {
	t := time.NewTicker(time.Minute)
	defer t.Stop()
	_ = s.Tick(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			_ = s.Tick(ctx)
		}
	}
}
