// Package audit writes the append-only record of who did what.
// Records never contain passwords, one-time codes, tokens, full bank numbers
// or raw activation codes: values pass through Redact first.
package audit

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/jmoiron/sqlx"
)

// Actor types.
const (
	ActorCustomer = "customer"
	ActorSeller   = "seller"
	ActorStaff    = "staff"
	ActorSystem   = "system"
	ActorService  = "service"
)

// Outcomes.
const (
	OutcomeOK     = "ok"
	OutcomeDenied = "denied"
	OutcomeFailed = "failed"
)

// Event is one audit record.
type Event struct {
	ActorType  string
	ActorID    string
	Capability string
	Action     string
	EntityType string
	EntityID   string
	Reason     string
	Before     map[string]any
	After      map[string]any
	Outcome    string
	CommandRef string
	ApproverID *uint64
	RequestID  string
}

// Writer records audit events. Pass the business transaction as ext so the
// record commits or rolls back with the change it describes.
type Writer struct {
	clk clock.Clock
}

// NewWriter builds a writer.
func NewWriter(clk clock.Clock) *Writer { return &Writer{clk: clk} }

// Record inserts e.
func (w *Writer) Record(ctx context.Context, ext sqlx.ExecerContext, e Event) error {
	if e.Outcome == "" {
		e.Outcome = OutcomeOK
	}
	_, err := ext.ExecContext(ctx, `INSERT INTO audit_events
		(occurred_at, actor_type, actor_id, capability, action, entity_type, entity_id, reason,
		 before_redacted, after_redacted, outcome, command_ref, approver_id, request_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		w.clk.Now(), e.ActorType, e.ActorID, nullStr(e.Capability), e.Action, e.EntityType, e.EntityID, nullStr(e.Reason),
		toJSON(e.Before), toJSON(e.After), e.Outcome, nullStr(e.CommandRef), e.ApproverID, nullStr(e.RequestID))
	return err
}

// sensitive lists key fragments whose values are never stored.
var sensitive = []string{"password", "secret", "token", "otp", "totp", "pin", "code_plain", "activation_code", "account_number", "card", "cvv"}

// Redact returns a copy of m with sensitive values replaced by "[redacted]",
// at any depth.
func Redact(m map[string]any) map[string]any {
	if m == nil {
		return nil
	}
	out := make(map[string]any, len(m))
	for k, v := range m {
		if isSensitive(k) {
			out[k] = "[redacted]"
			continue
		}
		switch t := v.(type) {
		case map[string]any:
			out[k] = Redact(t)
		case []any:
			arr := make([]any, len(t))
			for i, x := range t {
				if mm, ok := x.(map[string]any); ok {
					arr[i] = Redact(mm)
				} else {
					arr[i] = x
				}
			}
			out[k] = arr
		default:
			out[k] = v
		}
	}
	return out
}

func isSensitive(k string) bool {
	k = strings.ToLower(k)
	for _, s := range sensitive {
		if strings.Contains(k, s) {
			return true
		}
	}
	return false
}

func toJSON(m map[string]any) any {
	if m == nil {
		return nil
	}
	b, err := json.Marshal(Redact(m))
	if err != nil {
		return nil
	}
	return string(b)
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}
