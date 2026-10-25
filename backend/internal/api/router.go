// Package api wires the HTTP routes. Dependencies are passed in explicitly;
// there are no package-level globals.
package api

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/idempotency"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/identity"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/ops"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
)

// Deps are the services the routes need.
type Deps struct {
	DB           *sqlx.DB
	Clock        clock.Clock
	Log          *slog.Logger
	Auth         *identity.Authenticator
	Sessions     *identity.Sessions
	Login        *identity.WebLogin // nil in tests without Keycloak
	Idempotency  *idempotency.Store
	CookieSecure bool
}

// Groups are the route groups that feature modules attach to, already
// carrying the right middleware.
type Groups struct {
	Public *gin.RouterGroup // /api/v1/public: no sign-in
	Me     *gin.RouterGroup // /api/v1/me: signed-in customer
	Seller *gin.RouterGroup // /api/v1/seller: signed-in (seller checks per route)
	Admin  *gin.RouterGroup // /api/v1/admin: staff (capability checks per route)
}

// New builds the engine with the foundation routes and returns the groups for
// feature modules.
func New(d Deps) (*gin.Engine, Groups) {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(httpx.RequestIDMiddleware(), httpx.Recover(d.Log), httpx.AccessLog(d.Log))
	r.NoRoute(func(c *gin.Context) { httpx.Fail(c, httpx.ErrNotFound) })

	r.GET("/healthz", health(d.DB))

	v1 := r.Group("/api/v1", d.Auth.Middleware())

	// Sign-in endpoints sit outside idempotency and CSRF: login is a browser
	// redirect flow, logout is protected by SameSite and the session itself.
	auth := v1.Group("/auth")
	if d.Login != nil {
		auth.GET("/login", d.Login.Start)
		auth.GET("/callback", d.Login.Callback)
	}
	h := &identity.Handlers{Sessions: d.Sessions, CookieSecure: d.CookieSecure}
	auth.GET("/session", identity.RequireAuth(), h.Me)
	auth.POST("/logout", identity.RequireAuth(), identity.RequireCSRF(d.Sessions), h.Logout)

	// Every state-changing feature route gets CSRF (for cookie sessions) and idempotency.
	guarded := []gin.HandlerFunc{identity.RequireCSRF(d.Sessions), idempotency.Middleware(d.Idempotency)}

	v1.GET("/operations/:key", identity.RequireAuth(), idempotency.LookupHandler(d.Idempotency))

	g := Groups{
		Public: v1.Group("/public"),
		Me:     v1.Group("/me", append([]gin.HandlerFunc{identity.RequireAuth()}, guarded...)...),
		Seller: v1.Group("/seller", append([]gin.HandlerFunc{identity.RequireAuth()}, guarded...)...),
		Admin:  v1.Group("/admin", append([]gin.HandlerFunc{identity.RequireAuth(), requireStaff()}, guarded...)...),
	}
	return r, g
}

func requireStaff() gin.HandlerFunc {
	return func(c *gin.Context) {
		if p := identity.FromContext(c); p == nil || p.Staff == nil {
			httpx.Fail(c, httpx.ErrForbidden)
			return
		}
		c.Next()
	}
}

func health(conn *sqlx.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := conn.PingContext(ctx); err != nil {
			httpx.Fail(c, httpx.ErrServiceUnavailable)
			return
		}
		st, err := ops.ReadStats(ctx, conn)
		if err != nil {
			httpx.Fail(c, httpx.ErrServiceUnavailable)
			return
		}
		out := gin.H{"status": "ok", "jobsQueued": st.Queued, "jobsFailed": st.Failed}
		if st.OldestQueued.Valid {
			out["oldestQueuedAt"] = st.OldestQueued.Time
		}
		httpx.OK(c, http.StatusOK, out)
	}
}
