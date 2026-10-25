package identity

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/jmoiron/sqlx"
)

// Staff is an active Nahj staff member.
type Staff struct {
	ID           uint64       `json:"id"`
	DisplayName  string       `json:"displayName"`
	Capabilities []Capability `json:"capabilities"`
}

// Capability is one permission in one market ("*" for all markets).
type Capability struct {
	Cap    string `json:"cap"`
	Market string `json:"market"`
}

// StaffStore reads the staff table.
type StaffStore struct {
	db  *sqlx.DB
	clk clock.Clock
}

// NewStaffStore builds the store.
func NewStaffStore(db *sqlx.DB, clk clock.Clock) *StaffStore { return &StaffStore{db: db, clk: clk} }

// Active returns the account's staff record, or nil if the account is not
// active staff. It is read on every request, so disabling staff takes effect
// immediately.
func (s *StaffStore) Active(ctx context.Context, accountID string) (*Staff, error) {
	var row struct {
		ID           uint64          `db:"id"`
		DisplayName  string          `db:"display_name"`
		Capabilities json.RawMessage `db:"capabilities"`
		LastActiveAt sql.NullTime    `db:"last_active_at"`
	}
	err := s.db.GetContext(ctx, &row, `SELECT id, display_name, capabilities, last_active_at
		FROM staff WHERE account_id = ? AND status = 'active'`, accountID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	st := &Staff{ID: row.ID, DisplayName: row.DisplayName}
	if err := json.Unmarshal(row.Capabilities, &st.Capabilities); err != nil {
		return nil, errors.New("identity: staff capabilities are not valid JSON")
	}
	if now := s.clk.Now(); !row.LastActiveAt.Valid || now.Sub(row.LastActiveAt.Time) > 5*time.Minute {
		_, _ = s.db.ExecContext(ctx, `UPDATE staff SET last_active_at = ? WHERE id = ?`, now, row.ID)
	}
	return st, nil
}
