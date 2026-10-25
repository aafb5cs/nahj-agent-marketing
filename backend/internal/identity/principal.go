// Package identity answers "who is calling and what may they do".
// Keycloak proves identity; capabilities live in the marketplace database.
package identity

import (
	"time"

	"github.com/gin-gonic/gin"
)

// How the caller authenticated.
const (
	ViaSession = "session" // web: HTTP-only cookie issued after Keycloak login
	ViaBearer  = "bearer"  // Android app: existing Keycloak access token
)

// DefaultMarket is the only market in V1.
const DefaultMarket = "ID"

// Principal is the authenticated caller of one request.
type Principal struct {
	AccountID string    // Keycloak sub = nahj users.id
	Via       string    // ViaSession or ViaBearer
	AuthTime  time.Time // last real Keycloak login, for step-up checks
	SessionID []byte    // hash of the session cookie, when Via is ViaSession
	Staff     *Staff    // nil unless the account is active staff
}

// Can reports whether the principal is staff with capability cap in market.
func (p *Principal) Can(cap, market string) bool {
	if p == nil || p.Staff == nil {
		return false
	}
	for _, c := range p.Staff.Capabilities {
		if c.Cap == cap && (c.Market == market || c.Market == "*") {
			return true
		}
	}
	return false
}

const principalKey = "principal"

func setPrincipal(c *gin.Context, p *Principal) { c.Set(principalKey, p) }

// FromContext returns the caller, or nil when the request is anonymous.
func FromContext(c *gin.Context) *Principal {
	v, ok := c.Get(principalKey)
	if !ok {
		return nil
	}
	p, _ := v.(*Principal)
	return p
}
