// Package idempotency makes every state-changing request safe to retry.
//
// The client sends an Idempotency-Key header. The first request with a key
// runs; its response is stored in the operations table. A repeat with the same
// key and the same body gets the stored response. A repeat with a different
// body is rejected. A timeout is resolved by GET /operations/{key}, never by
// sending the command again with a new key.
package idempotency

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/identity"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/db"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
)

// Header is the request header carrying the key.
const Header = "Idempotency-Key"

// MaxBody is the largest request body the middleware buffers.
const MaxBody = 1 << 20

// RunningTimeout is how long a "running" operation blocks retries. After it,
// the operation is treated as failed and the key can be retried.
const RunningTimeout = 2 * time.Minute

var validKey = regexp.MustCompile(`^[A-Za-z0-9_\-:]{8,64}$`)

// Operation is a stored command outcome.
type Operation struct {
	Key         string        `db:"idempotency_key" json:"key"`
	Actor       string        `db:"actor" json:"-"`
	Command     string        `db:"command" json:"command"`
	RequestHash []byte        `db:"request_hash" json:"-"`
	Status      string        `db:"status" json:"status"`
	HTTPStatus  sql.NullInt64 `db:"http_status" json:"-"`
	Response    []byte        `db:"response" json:"-"` // JSON; nil while running
	CreatedAt   time.Time     `db:"created_at" json:"createdAt"`
	CompletedAt sql.NullTime  `db:"completed_at" json:"-"`
}

// Store reads and writes the operations table.
type Store struct {
	db  *sqlx.DB
	clk clock.Clock
}

// NewStore builds the store.
func NewStore(conn *sqlx.DB, clk clock.Clock) *Store { return &Store{db: conn, clk: clk} }

type beginResult int

const (
	beginNew beginResult = iota
	beginReplay
	beginConflict
	beginInProgress
)

// begin claims the key, or reports what already happened with it.
func (s *Store) begin(ctx context.Context, key, actor, command string, hash []byte) (beginResult, *Operation, error) {
	now := s.clk.Now()
	_, err := s.db.ExecContext(ctx, `INSERT INTO operations
		(idempotency_key, actor, command, request_hash, status, created_at) VALUES (?, ?, ?, ?, 'running', ?)`,
		key, actor, command, hash, now)
	if err == nil {
		return beginNew, nil, nil
	}
	if !db.IsDuplicate(err) {
		return 0, nil, err
	}
	op, err := s.Get(ctx, key)
	if err != nil {
		return 0, nil, err
	}
	if op.Actor != actor || op.Command != command || !bytes.Equal(op.RequestHash, hash) {
		return beginConflict, op, nil
	}
	switch op.Status {
	case "done":
		return beginReplay, op, nil
	case "running":
		if now.Sub(op.CreatedAt) < RunningTimeout {
			return beginInProgress, op, nil
		}
	}
	// failed, or running too long: let this request run again.
	res, err := s.db.ExecContext(ctx, `UPDATE operations SET status = 'running', created_at = ?, http_status = NULL, response = NULL, completed_at = NULL
		WHERE idempotency_key = ? AND status = ?`, now, key, op.Status)
	if err != nil {
		return 0, nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return beginInProgress, op, nil // another retry took it first
	}
	return beginNew, nil, nil
}

func (s *Store) finish(ctx context.Context, key, status string, httpStatus int, body []byte) error {
	var resp any
	if json.Valid(body) {
		resp = string(body)
	}
	_, err := s.db.ExecContext(ctx, `UPDATE operations SET status = ?, http_status = ?, response = ?, completed_at = ?
		WHERE idempotency_key = ?`, status, httpStatus, resp, s.clk.Now(), key)
	return err
}

// Get loads an operation by key.
func (s *Store) Get(ctx context.Context, key string) (*Operation, error) {
	var op Operation
	err := s.db.GetContext(ctx, &op, `SELECT idempotency_key, actor, command, request_hash, status, http_status, response, created_at, completed_at
		FROM operations WHERE idempotency_key = ?`, key)
	if err != nil {
		return nil, err
	}
	return &op, nil
}

// Middleware enforces idempotency on POST, PUT, PATCH and DELETE.
// Responses with status 5xx are stored as "failed" so the client can retry
// with the same key; 2xx-4xx are stored and replayed exactly.
func Middleware(s *Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		default:
			c.Next()
			return
		}
		key := c.GetHeader(Header)
		if !validKey.MatchString(key) {
			httpx.Fail(c, httpx.ErrIdempotencyKey)
			return
		}
		body, err := io.ReadAll(io.LimitReader(c.Request.Body, MaxBody+1))
		if err != nil || len(body) > MaxBody {
			httpx.Fail(c, httpx.ErrBadRequest)
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(body))

		actor := "anonymous"
		if p := identity.FromContext(c); p != nil {
			actor = p.AccountID
		}
		command := c.Request.Method + " " + c.FullPath()
		h := sha256.New()
		h.Write([]byte(command + "\n" + c.Request.URL.RawQuery + "\n"))
		h.Write(body)
		hash := h.Sum(nil)

		ctx := c.Request.Context()
		res, op, err := s.begin(ctx, key, actor, command, hash)
		if err != nil {
			httpx.FailInternal(c, err)
			return
		}
		switch res {
		case beginConflict:
			httpx.Fail(c, httpx.ErrIdempotencyConflict)
			return
		case beginInProgress:
			httpx.Fail(c, httpx.ErrOperationInProgress)
			return
		case beginReplay:
			c.Header("Idempotent-Replay", "true")
			c.Data(int(op.HTTPStatus.Int64), "application/json; charset=utf-8", op.Response)
			c.Abort()
			return
		}

		rec := &recorder{ResponseWriter: c.Writer}
		c.Writer = rec
		c.Next()

		status := rec.Status()
		outcome := "done"
		if status >= 500 {
			outcome = "failed"
		}
		// Store the outcome even if the client has gone away.
		if err := s.finish(context.WithoutCancel(ctx), key, outcome, status, rec.buf.Bytes()); err != nil {
			_ = c.Error(err)
		}
	}
}

// LookupHandler serves GET /operations/:key for the caller's own operations.
func LookupHandler(s *Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		p := identity.FromContext(c)
		op, err := s.Get(c.Request.Context(), c.Param("key"))
		if errors.Is(err, sql.ErrNoRows) || (err == nil && (p == nil || op.Actor != p.AccountID)) {
			httpx.Fail(c, httpx.ErrNotFound)
			return
		}
		if err != nil {
			httpx.FailInternal(c, err)
			return
		}
		out := gin.H{"key": op.Key, "command": op.Command, "status": op.Status, "createdAt": op.CreatedAt}
		if op.Status == "done" {
			out["httpStatus"] = op.HTTPStatus.Int64
			out["response"] = json.RawMessage(op.Response)
		}
		httpx.OK(c, http.StatusOK, out)
	}
}

type recorder struct {
	gin.ResponseWriter
	buf bytes.Buffer
}

func (r *recorder) Write(b []byte) (int, error) {
	r.buf.Write(b)
	return r.ResponseWriter.Write(b)
}

func (r *recorder) WriteString(s string) (int, error) {
	r.buf.WriteString(s)
	return r.ResponseWriter.WriteString(s)
}
