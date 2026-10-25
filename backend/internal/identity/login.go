package identity

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/httpx"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/ids"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

const loginCookie = "nm_login"

// WebLogin runs the server-side OpenID Connect login with Keycloak
// (authorization code + PKCE) and issues the marketplace session cookie.
// Tokens never reach browser JavaScript.
type WebLogin struct {
	oauth    oauth2.Config
	verifier *oidc.IDTokenVerifier
	sessions *Sessions
	clk      clock.Clock
	key      []byte
	secure   bool
	ttl      time.Duration
}

// LoginConfig configures WebLogin.
type LoginConfig struct {
	Issuer, ClientID, ClientSecret, RedirectURL string
	SessionKey                                  []byte
	CookieSecure                                bool
	SessionTTL                                  time.Duration
}

// NewWebLogin discovers the Keycloak realm and prepares the login flow.
func NewWebLogin(ctx context.Context, cfg LoginConfig, sessions *Sessions, clk clock.Clock) (*WebLogin, error) {
	p, err := oidc.NewProvider(ctx, cfg.Issuer)
	if err != nil {
		return nil, err
	}
	return &WebLogin{
		oauth: oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			RedirectURL:  cfg.RedirectURL,
			Endpoint:     p.Endpoint(),
			Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
		},
		verifier: p.Verifier(&oidc.Config{ClientID: cfg.ClientID}),
		sessions: sessions,
		clk:      clk,
		key:      cfg.SessionKey,
		secure:   cfg.CookieSecure,
		ttl:      cfg.SessionTTL,
	}, nil
}

type loginState struct {
	State    string `json:"s"`
	Nonce    string `json:"n"`
	Verifier string `json:"v"`
	Return   string `json:"r"`
	Expires  int64  `json:"e"`
}

// Start handles GET /auth/login?return=/path and redirects to Keycloak.
// Add prompt=login&max_age=0 (?stepup=1) to force a fresh login with TOTP.
func (w *WebLogin) Start(c *gin.Context) {
	st := loginState{
		State:    ids.Token(24),
		Nonce:    ids.Token(24),
		Verifier: oauth2.GenerateVerifier(),
		Return:   safeReturn(c.Query("return")),
		Expires:  w.clk.Now().Add(10 * time.Minute).Unix(),
	}
	w.setSigned(c, loginCookie, st, 600)
	opts := []oauth2.AuthCodeOption{oidc.Nonce(st.Nonce), oauth2.S256ChallengeOption(st.Verifier)}
	if c.Query("stepup") == "1" {
		opts = append(opts, oauth2.SetAuthURLParam("prompt", "login"), oauth2.SetAuthURLParam("max_age", "0"))
	}
	c.Redirect(http.StatusFound, w.oauth.AuthCodeURL(st.State, opts...))
}

// Callback handles GET /auth/callback from Keycloak.
func (w *WebLogin) Callback(c *gin.Context) {
	var st loginState
	if !w.getSigned(c, loginCookie, &st) || st.State != c.Query("state") || w.clk.Now().Unix() > st.Expires {
		httpx.Fail(c, httpx.ErrAuthRequired)
		return
	}
	c.SetCookie(loginCookie, "", -1, "/", "", w.secure, true)
	if c.Query("error") != "" {
		c.Redirect(http.StatusFound, st.Return)
		return
	}
	ctx := c.Request.Context()
	tok, err := w.oauth.Exchange(ctx, c.Query("code"), oauth2.VerifierOption(st.Verifier))
	if err != nil {
		httpx.Fail(c, httpx.ErrAuthRequired)
		return
	}
	rawID, _ := tok.Extra("id_token").(string)
	idt, err := w.verifier.Verify(ctx, rawID)
	if err != nil || idt.Nonce != st.Nonce {
		httpx.Fail(c, httpx.ErrAuthRequired)
		return
	}
	var cl struct {
		AuthTime int64 `json:"auth_time"`
	}
	_ = idt.Claims(&cl)
	authTime := idt.IssuedAt
	if cl.AuthTime > 0 {
		authTime = time.Unix(cl.AuthTime, 0)
	}
	cookie, _, err := w.sessions.Create(ctx, idt.Subject, authTime, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		httpx.FailInternal(c, err)
		return
	}
	w.setSessionCookie(c, cookie)
	c.Redirect(http.StatusFound, st.Return)
}

func (w *WebLogin) setSessionCookie(c *gin.Context, value string) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(SessionCookie, value, int(w.ttl/time.Second), "/", "", w.secure, true)
}

func (w *WebLogin) setSigned(c *gin.Context, name string, v any, maxAge int) {
	b, _ := json.Marshal(v)
	payload := base64.RawURLEncoding.EncodeToString(b)
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(name, payload+"."+w.sign(payload), maxAge, "/", "", w.secure, true)
}

func (w *WebLogin) getSigned(c *gin.Context, name string, v any) bool {
	raw, err := c.Cookie(name)
	if err != nil {
		return false
	}
	payload, sig, ok := strings.Cut(raw, ".")
	if !ok || !hmac.Equal([]byte(sig), []byte(w.sign(payload))) {
		return false
	}
	b, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return false
	}
	return json.Unmarshal(b, v) == nil
}

func (w *WebLogin) sign(payload string) string {
	m := hmac.New(sha256.New, w.key)
	m.Write([]byte("login:" + payload))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

// safeReturn allows only same-site relative paths, so the login can never
// redirect to another website.
func safeReturn(r string) string {
	if r == "" || !strings.HasPrefix(r, "/") || strings.HasPrefix(r, "//") || strings.HasPrefix(r, "/\\") || strings.ContainsAny(r, "\r\n") {
		return "/"
	}
	return r
}
