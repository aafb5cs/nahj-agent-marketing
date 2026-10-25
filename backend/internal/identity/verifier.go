package identity

import (
	"context"
	"crypto"
	"errors"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
)

// Claims are the token fields the marketplace uses.
type Claims struct {
	Subject  string
	AuthTime time.Time
	AZP      string
}

// TokenVerifier checks a Keycloak bearer access token.
type TokenVerifier interface {
	Verify(ctx context.Context, raw string) (*Claims, error)
}

// ErrTokenRejected means the token is invalid, expired or from a client the
// marketplace does not accept.
var ErrTokenRejected = errors.New("identity: token rejected")

type oidcVerifier struct {
	v          *oidc.IDTokenVerifier
	allowedAZP map[string]bool
}

// NewKeycloakVerifier discovers the realm's keys and verifies access tokens
// (RS256, issuer, expiry). Only tokens whose azp is in allowedAZP pass.
func NewKeycloakVerifier(ctx context.Context, issuer string, allowedAZP []string) (TokenVerifier, error) {
	p, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, err
	}
	return newVerifier(p.Verifier(&oidc.Config{SkipClientIDCheck: true}), allowedAZP), nil
}

// NewStaticVerifier verifies tokens signed by a fixed key. Used in tests.
func NewStaticVerifier(issuer string, key crypto.PublicKey, allowedAZP []string) TokenVerifier {
	ks := &oidc.StaticKeySet{PublicKeys: []crypto.PublicKey{key}}
	return newVerifier(oidc.NewVerifier(issuer, ks, &oidc.Config{SkipClientIDCheck: true}), allowedAZP)
}

func newVerifier(v *oidc.IDTokenVerifier, allowedAZP []string) *oidcVerifier {
	m := map[string]bool{}
	for _, a := range allowedAZP {
		m[a] = true
	}
	return &oidcVerifier{v: v, allowedAZP: m}
}

func (o *oidcVerifier) Verify(ctx context.Context, raw string) (*Claims, error) {
	tok, err := o.v.Verify(ctx, raw)
	if err != nil {
		return nil, ErrTokenRejected
	}
	var c struct {
		AZP      string `json:"azp"`
		AuthTime int64  `json:"auth_time"`
	}
	if err := tok.Claims(&c); err != nil {
		return nil, ErrTokenRejected
	}
	if !o.allowedAZP[c.AZP] || tok.Subject == "" {
		return nil, ErrTokenRejected
	}
	at := tok.IssuedAt
	if c.AuthTime > 0 {
		at = time.Unix(c.AuthTime, 0)
	}
	return &Claims{Subject: tok.Subject, AuthTime: at.UTC(), AZP: c.AZP}, nil
}
