package identity

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/httpx"
	"github.com/gin-gonic/gin"
)

// SessionCookie is the name of the web session cookie.
const SessionCookie = "nm_session"

// Authenticator resolves the caller from a bearer token or a session cookie.
type Authenticator struct {
	Sessions *Sessions
	Verifier TokenVerifier // may be nil when bearer tokens are not accepted
	Staff    *StaffStore
	Clock    clock.Clock
}

// Middleware sets the Principal when the request carries valid credentials.
// It never rejects anonymous requests; RequireAuth does that.
// A request that sends a bearer token that fails is rejected outright, so a
// broken app token is never silently treated as anonymous.
func (a *Authenticator) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		if h := c.GetHeader("Authorization"); h != "" {
			raw, ok := strings.CutPrefix(h, "Bearer ")
			if !ok || a.Verifier == nil {
				httpx.Fail(c, httpx.ErrAuthRequired)
				return
			}
			cl, err := a.Verifier.Verify(ctx, strings.TrimSpace(raw))
			if err != nil {
				httpx.Fail(c, httpx.ErrAuthRequired)
				return
			}
			p := &Principal{AccountID: cl.Subject, Via: ViaBearer, AuthTime: cl.AuthTime}
			if err := a.attachStaff(c, p); err != nil {
				httpx.FailInternal(c, err)
				return
			}
			setPrincipal(c, p)
			c.Next()
			return
		}
		if cookie, err := c.Cookie(SessionCookie); err == nil && cookie != "" {
			sess, err := a.Sessions.Lookup(ctx, cookie)
			switch {
			case errors.Is(err, ErrNoSession):
				// Treated as anonymous; the browser keeps a stale cookie until logout.
			case err != nil:
				httpx.FailInternal(c, err)
				return
			default:
				p := &Principal{AccountID: sess.AccountID, Via: ViaSession, AuthTime: sess.AuthTime, SessionID: sess.IDHash}
				if err := a.attachStaff(c, p); err != nil {
					httpx.FailInternal(c, err)
					return
				}
				setPrincipal(c, p)
			}
		}
		c.Next()
	}
}

func (a *Authenticator) attachStaff(c *gin.Context, p *Principal) error {
	if a.Staff == nil {
		return nil
	}
	st, err := a.Staff.Active(c.Request.Context(), p.AccountID)
	if err != nil {
		return err
	}
	p.Staff = st
	return nil
}

// RequireAuth rejects anonymous requests.
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if FromContext(c) == nil {
			httpx.Fail(c, httpx.ErrAuthRequired)
			return
		}
		c.Next()
	}
}

// RequireCSRF checks X-CSRF-Token on state-changing requests made with a
// session cookie. Bearer requests are not exposed to CSRF and pass.
func RequireCSRF(s *Sessions) gin.HandlerFunc {
	return func(c *gin.Context) {
		p := FromContext(c)
		if p != nil && p.Via == ViaSession && !isSafeMethod(c.Request.Method) {
			if !s.VerifyCSRF(p.SessionID, c.GetHeader("X-CSRF-Token")) {
				httpx.Fail(c, httpx.ErrCSRF)
				return
			}
		}
		c.Next()
	}
}

// RequireCapability allows only active staff holding cap in the default market.
func RequireCapability(cap string) gin.HandlerFunc {
	return func(c *gin.Context) {
		p := FromContext(c)
		if p == nil {
			httpx.Fail(c, httpx.ErrAuthRequired)
			return
		}
		if !p.Can(cap, DefaultMarket) {
			httpx.Fail(c, httpx.ErrForbidden)
			return
		}
		c.Next()
	}
}

// RequireRecentAuth asks for a fresh Keycloak login (with TOTP, enforced by
// Keycloak) when the last one is older than maxAge. Used for withdrawals and
// payout destination changes.
func RequireRecentAuth(clk clock.Clock, maxAge time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		p := FromContext(c)
		if p == nil {
			httpx.Fail(c, httpx.ErrAuthRequired)
			return
		}
		if clk.Now().Sub(p.AuthTime) > maxAge {
			httpx.Fail(c, httpx.ErrStepUpRequired)
			return
		}
		c.Next()
	}
}

func isSafeMethod(m string) bool {
	return m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions
}
