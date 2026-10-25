package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/api"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/audit"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/idempotency"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/identity"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/httpx"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/ratelimit"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/testutil"
	"github.com/gin-gonic/gin"
)

const appClient = "nahj" // azp of the Android app's Keycloak client

type env struct {
	t        *testing.T
	db       *testutil.DB
	clk      *clock.Fake
	srv      http.Handler
	groups   api.Groups
	sessions *identity.Sessions
	signer   *testutil.TokenSigner
	limiter  *ratelimit.Limiter
	calls    atomic.Int64
}

func newEnv(t *testing.T) *env {
	tdb := testutil.NewDB(t)
	clk := clock.NewFake(time.Now())
	signer := testutil.NewTokenSigner(t)
	sessions := identity.NewSessions(tdb.DB, clk, bytes.Repeat([]byte{7}, 32), 12*time.Hour)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	engine, groups := api.New(api.Deps{
		DB: tdb.DB, Clock: clk, Log: log,
		Auth: &identity.Authenticator{
			Sessions: sessions,
			Verifier: identity.NewStaticVerifier(testutil.Issuer, &signer.Key.PublicKey, []string{appClient}),
			Staff:    identity.NewStaffStore(tdb.DB, clk),
			Clock:    clk,
		},
		Sessions:    sessions,
		Idempotency: idempotency.NewStore(tdb.DB, clk),
	})
	e := &env{t: t, db: tdb, clk: clk, srv: engine, groups: groups, sessions: sessions, signer: signer, limiter: ratelimit.New(tdb.DB, clk)}

	// Feature routes used by the tests.
	groups.Me.POST("/echo", func(c *gin.Context) {
		e.calls.Add(1)
		var body map[string]any
		_ = c.ShouldBindJSON(&body)
		if body["fail"] == true {
			httpx.Fail(c, httpx.ErrInternal)
			return
		}
		httpx.OK(c, http.StatusCreated, gin.H{"call": e.calls.Load(), "echo": body})
	})
	groups.Admin.GET("/refunds", identity.RequireCapability("finance.refund.approve"), func(c *gin.Context) {
		httpx.OK(c, http.StatusOK, gin.H{"ok": true})
	})
	groups.Me.POST("/withdraw", identity.RequireRecentAuth(clk, 10*time.Minute), func(c *gin.Context) {
		httpx.OK(c, http.StatusOK, gin.H{"ok": true})
	})
	groups.Public.POST("/redeem/check", e.limiter.Middleware(3, time.Minute, func(c *gin.Context) string { return "redeem:ip:" + c.ClientIP() }),
		func(c *gin.Context) { httpx.OK(c, http.StatusOK, gin.H{"ok": true}) })
	return e
}

type req struct {
	method, path, body, token, cookie, csrf, key string
}

func (e *env) do(r req) (*httptest.ResponseRecorder, map[string]any) {
	e.t.Helper()
	var body io.Reader
	if r.body != "" {
		body = bytes.NewBufferString(r.body)
	}
	hr := httptest.NewRequest(r.method, r.path, body)
	hr.Header.Set("Content-Type", "application/json")
	if r.token != "" {
		hr.Header.Set("Authorization", "Bearer "+r.token)
	}
	if r.cookie != "" {
		hr.AddCookie(&http.Cookie{Name: identity.SessionCookie, Value: r.cookie})
	}
	if r.csrf != "" {
		hr.Header.Set("X-CSRF-Token", r.csrf)
	}
	if r.key != "" {
		hr.Header.Set(idempotency.Header, r.key)
	}
	w := httptest.NewRecorder()
	e.srv.ServeHTTP(w, hr)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}

func errCode(out map[string]any) string {
	if e, ok := out["error"].(map[string]any); ok {
		s, _ := e["code"].(string)
		return s
	}
	return ""
}

func (e *env) token(sub string) string {
	return e.signer.Sign(e.t, sub, appClient, time.Now(), time.Hour)
}

// ---------------------------------------------------------------------------

func TestHealth(t *testing.T) {
	e := newEnv(t)
	w, out := e.do(req{method: "GET", path: "/healthz"})
	if w.Code != 200 || out["serverTime"] == nil {
		t.Fatalf("healthz: %d %v", w.Code, out)
	}
}

func TestBearerTokens(t *testing.T) {
	e := newEnv(t)
	w, out := e.do(req{method: "GET", path: "/api/v1/auth/session", token: e.token("acct-1")})
	if w.Code != 200 || out["data"].(map[string]any)["accountId"] != "acct-1" {
		t.Fatalf("valid token: %d %v", w.Code, out)
	}
	if _, ok := out["data"].(map[string]any)["csrfToken"]; ok {
		t.Fatal("bearer callers get no CSRF token")
	}

	cases := map[string]string{
		"wrong client": e.signer.Sign(t, "acct-1", "some-other-client", time.Now(), time.Hour),
		"expired":      e.signer.Sign(t, "acct-1", appClient, time.Now(), -time.Minute),
		"forged":       testutil.NewTokenSigner(t).Sign(t, "acct-1", appClient, time.Now(), time.Hour),
		"garbage":      "not-a-jwt",
	}
	for name, tok := range cases {
		if w, out := e.do(req{method: "GET", path: "/api/v1/auth/session", token: tok}); w.Code != 401 || errCode(out) != "AUTH_REQUIRED" {
			t.Errorf("%s: %d %v, want 401 AUTH_REQUIRED", name, w.Code, out)
		}
	}
	if w, _ := e.do(req{method: "GET", path: "/api/v1/auth/session"}); w.Code != 401 {
		t.Fatalf("anonymous: %d, want 401", w.Code)
	}
}

func TestSessionCookieCSRFAndLogout(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	cookie, sess, err := e.sessions.Create(ctx, "acct-2", e.clk.Now(), "127.0.0.1", "test")
	if err != nil {
		t.Fatal(err)
	}
	w, out := e.do(req{method: "GET", path: "/api/v1/auth/session", cookie: cookie})
	if w.Code != 200 {
		t.Fatalf("session: %d %v", w.Code, out)
	}
	csrf := out["data"].(map[string]any)["csrfToken"].(string)
	if csrf == "" || csrf != e.sessions.CSRFToken(sess.IDHash) {
		t.Fatal("session response must carry the CSRF token")
	}

	// State-changing request without CSRF is refused, with it accepted.
	if w, out := e.do(req{method: "POST", path: "/api/v1/me/echo", body: `{}`, cookie: cookie, key: "key-csrf-1"}); w.Code != 403 || errCode(out) != "CSRF_INVALID" {
		t.Fatalf("no csrf: %d %v", w.Code, out)
	}
	if w, _ := e.do(req{method: "POST", path: "/api/v1/me/echo", body: `{}`, cookie: cookie, csrf: csrf, key: "key-csrf-2"}); w.Code != 201 {
		t.Fatalf("with csrf: %d", w.Code)
	}

	// Logout revokes the session.
	if w, _ := e.do(req{method: "POST", path: "/api/v1/auth/logout", cookie: cookie, csrf: csrf}); w.Code != 200 {
		t.Fatalf("logout: %d", w.Code)
	}
	if w, _ := e.do(req{method: "GET", path: "/api/v1/auth/session", cookie: cookie}); w.Code != 401 {
		t.Fatalf("after logout: %d, want 401", w.Code)
	}
}

func TestSessionExpiresAndRevokeAll(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c1, _, _ := e.sessions.Create(ctx, "acct-3", e.clk.Now(), "", "")
	c2, _, _ := e.sessions.Create(ctx, "acct-3", e.clk.Now(), "", "")
	if n, err := e.sessions.RevokeAll(ctx, "acct-3"); err != nil || n != 2 {
		t.Fatalf("RevokeAll = %d, %v", n, err)
	}
	for _, c := range []string{c1, c2} {
		if _, err := e.sessions.Lookup(ctx, c); err != identity.ErrNoSession {
			t.Fatal("revoked session still valid")
		}
	}
	c3, _, _ := e.sessions.Create(ctx, "acct-3", e.clk.Now(), "", "")
	e.clk.Advance(13 * time.Hour)
	if _, err := e.sessions.Lookup(ctx, c3); err != identity.ErrNoSession {
		t.Fatal("expired session still valid")
	}
}

func TestIdempotentReplayConflictAndRetryAfterFailure(t *testing.T) {
	e := newEnv(t)
	tok := e.token("acct-4")

	// Missing or invalid key.
	if w, out := e.do(req{method: "POST", path: "/api/v1/me/echo", body: `{"a":1}`, token: tok}); w.Code != 400 || errCode(out) != "IDEMPOTENCY_KEY_REQUIRED" {
		t.Fatalf("no key: %d %v", w.Code, out)
	}

	// First call runs; the repeat replays the identical response without running again.
	w1, _ := e.do(req{method: "POST", path: "/api/v1/me/echo", body: `{"a":1}`, token: tok, key: "order-create-0001"})
	w2, _ := e.do(req{method: "POST", path: "/api/v1/me/echo", body: `{"a":1}`, token: tok, key: "order-create-0001"})
	// MySQL's JSON column may reformat the stored body, so compare parsed JSON.
	if w1.Code != 201 || w2.Code != 201 || !sameJSON(w1.Body.Bytes(), w2.Body.Bytes()) || w2.Header().Get("Idempotent-Replay") != "true" {
		t.Fatalf("replay: %d %s / %d %s", w1.Code, w1.Body, w2.Code, w2.Body)
	}
	if e.calls.Load() != 1 {
		t.Fatalf("handler ran %d times, want 1", e.calls.Load())
	}

	// Same key, different body: rejected.
	if w, out := e.do(req{method: "POST", path: "/api/v1/me/echo", body: `{"a":2}`, token: tok, key: "order-create-0001"}); w.Code != 409 || errCode(out) != "IDEMPOTENCY_CONFLICT" {
		t.Fatalf("conflict: %d %v", w.Code, out)
	}
	// Same key, another account: rejected, never replayed to someone else.
	if w, _ := e.do(req{method: "POST", path: "/api/v1/me/echo", body: `{"a":1}`, token: e.token("acct-other"), key: "order-create-0001"}); w.Code != 409 {
		t.Fatalf("other account: %d, want 409", w.Code)
	}

	// A 5xx is stored as failed, so the same key may run again.
	e.do(req{method: "POST", path: "/api/v1/me/echo", body: `{"fail":true}`, token: tok, key: "order-create-0002"})
	before := e.calls.Load()
	if w, _ := e.do(req{method: "POST", path: "/api/v1/me/echo", body: `{"fail":true}`, token: tok, key: "order-create-0002"}); w.Code != 500 {
		t.Fatalf("retry after failure: %d", w.Code)
	}
	if e.calls.Load() != before+1 {
		t.Fatal("a failed operation must be allowed to run again")
	}

	// Lookup: owner sees the stored outcome, others get 404.
	w, out := e.do(req{method: "GET", path: "/api/v1/operations/order-create-0001", token: tok})
	if w.Code != 200 || out["data"].(map[string]any)["status"] != "done" {
		t.Fatalf("lookup: %d %v", w.Code, out)
	}
	if w, _ := e.do(req{method: "GET", path: "/api/v1/operations/order-create-0001", token: e.token("acct-other")}); w.Code != 404 {
		t.Fatalf("lookup by other account: %d, want 404", w.Code)
	}
}

func TestStaffCapabilities(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	mustExec(t, e, `INSERT INTO staff (account_id, display_name, email_masked, capabilities, status, created_at)
		VALUES ('fin-1', 'Finance One', 'f***@ryam.app', '[{"cap":"finance.refund.approve","market":"ID"}]', 'active', UTC_TIMESTAMP(3)),
		       ('sup-1', 'Support One', 's***@ryam.app', '[{"cap":"support.case.reply","market":"ID"}]', 'active', UTC_TIMESTAMP(3)),
		       ('gone-1', 'Former', 'g***@ryam.app', '[{"cap":"finance.refund.approve","market":"ID"}]', 'disabled', UTC_TIMESTAMP(3))`)
	_ = ctx

	check := func(sub string, want int) {
		t.Helper()
		if w, out := e.do(req{method: "GET", path: "/api/v1/admin/refunds", token: e.token(sub)}); w.Code != want {
			t.Fatalf("%s: %d %v, want %d", sub, w.Code, out, want)
		}
	}
	check("fin-1", 200)
	check("sup-1", 403)  // staff, wrong capability
	check("gone-1", 403) // disabled staff
	check("cust-1", 403) // not staff

	// Disabling takes effect on the very next request.
	mustExec(t, e, `UPDATE staff SET status = 'disabled' WHERE account_id = 'fin-1'`)
	check("fin-1", 403)
}

func TestRecentAuthRequiredForSensitiveActions(t *testing.T) {
	e := newEnv(t)
	old := e.signer.Sign(t, "acct-5", appClient, e.clk.Now().Add(-30*time.Minute), time.Hour)
	if w, out := e.do(req{method: "POST", path: "/api/v1/me/withdraw", body: `{}`, token: old, key: "withdraw-0001"}); w.Code != 401 || errCode(out) != "STEP_UP_REQUIRED" {
		t.Fatalf("old login: %d %v", w.Code, out)
	}
	fresh := e.signer.Sign(t, "acct-5", appClient, e.clk.Now(), time.Hour)
	if w, _ := e.do(req{method: "POST", path: "/api/v1/me/withdraw", body: `{}`, token: fresh, key: "withdraw-0002"}); w.Code != 200 {
		t.Fatalf("fresh login: %d", w.Code)
	}
}

func TestRateLimit(t *testing.T) {
	e := newEnv(t)
	for i := 0; i < 3; i++ {
		if w, _ := e.do(req{method: "POST", path: "/api/v1/public/redeem/check", body: `{}`}); w.Code != 200 {
			t.Fatalf("attempt %d: %d", i+1, w.Code)
		}
	}
	w, out := e.do(req{method: "POST", path: "/api/v1/public/redeem/check", body: `{}`})
	if w.Code != 429 || errCode(out) != "RATE_LIMITED" || w.Header().Get("Retry-After") == "" {
		t.Fatalf("4th attempt: %d %v", w.Code, out)
	}
	e.clk.Advance(time.Minute)
	if w, _ := e.do(req{method: "POST", path: "/api/v1/public/redeem/check", body: `{}`}); w.Code != 200 {
		t.Fatalf("next window: %d", w.Code)
	}
}

func TestAuditRedactsSecrets(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	aw := audit.NewWriter(e.clk)
	err := aw.Record(ctx, e.db, audit.Event{
		ActorType: audit.ActorStaff, ActorID: "fin-1", Action: "payout_destination.update", EntityType: "seller", EntityID: "12",
		Before: map[string]any{"bank": "BCA", "account_number": "1234567890"},
		After:  map[string]any{"bank": "BNI", "account_number": "9876543210", "nested": map[string]any{"otp": "123456"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	var after string
	if err := e.db.GetContext(ctx, &after, `SELECT after_redacted FROM audit_events WHERE action = 'payout_destination.update'`); err != nil {
		t.Fatal(err)
	}
	if bytes.Contains([]byte(after), []byte("9876543210")) || bytes.Contains([]byte(after), []byte("123456")) {
		t.Fatalf("secret stored in audit: %s", after)
	}
	if !bytes.Contains([]byte(after), []byte("BNI")) {
		t.Fatalf("non-secret value missing: %s", after)
	}
}

func sameJSON(a, b []byte) bool {
	var x, y any
	if json.Unmarshal(a, &x) != nil || json.Unmarshal(b, &y) != nil {
		return false
	}
	xa, _ := json.Marshal(x)
	ya, _ := json.Marshal(y)
	return bytes.Equal(xa, ya)
}

func mustExec(t *testing.T, e *env, q string) {
	t.Helper()
	if _, err := e.db.ExecContext(context.Background(), q); err != nil {
		t.Fatal(err)
	}
}
