package identity

import (
	"net/http"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/httpx"
	"github.com/gin-gonic/gin"
)

// SessionInfo is what the web app learns about the caller.
type SessionInfo struct {
	AccountID string `json:"accountId"`
	Via       string `json:"via"`
	AuthTime  string `json:"authTime"`
	CSRFToken string `json:"csrfToken,omitempty"`
	Staff     *Staff `json:"staff,omitempty"`
}

// Handlers serves the session endpoints.
type Handlers struct {
	Sessions     *Sessions
	CookieSecure bool
}

// Me handles GET /auth/session.
func (h *Handlers) Me(c *gin.Context) {
	p := FromContext(c)
	info := SessionInfo{AccountID: p.AccountID, Via: p.Via, AuthTime: p.AuthTime.Format("2006-01-02T15:04:05.000Z07:00"), Staff: p.Staff}
	if p.Via == ViaSession {
		info.CSRFToken = h.Sessions.CSRFToken(p.SessionID)
	}
	httpx.OK(c, http.StatusOK, info)
}

// Logout handles POST /auth/logout: ends the session and clears the cookie.
func (h *Handlers) Logout(c *gin.Context) {
	p := FromContext(c)
	if p.Via == ViaSession {
		if err := h.Sessions.Revoke(c.Request.Context(), p.SessionID); err != nil {
			httpx.FailInternal(c, err)
			return
		}
	}
	c.SetCookie(SessionCookie, "", -1, "/", "", h.CookieSecure, true)
	httpx.OK(c, http.StatusOK, gin.H{"signedOut": true})
}
