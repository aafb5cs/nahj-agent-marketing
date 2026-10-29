// Package config loads settings from environment variables. Secrets never come
// from files in the repository.
package config

import (
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds everything the server, worker and migrator need.
type Config struct {
	HTTPAddr      string
	DBDSN         string
	PublicBaseURL string
	// WebDir holds the built web app (web/dist). Empty or missing: API only.
	WebDir string

	OIDC OIDC

	// SessionKey signs CSRF tokens and the short-lived login cookie. 32+ bytes.
	SessionKey   []byte
	CookieSecure bool
	SessionTTL   time.Duration

	WorkerID          string
	WorkerBatch       int
	WorkerPoll        time.Duration
	MaintenanceEvery  time.Duration
	ShutdownGraceTime time.Duration
}

// OIDC describes the Keycloak realm shared with nahj_backend.
type OIDC struct {
	Issuer       string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	// AllowedAZP lists the Keycloak clients whose bearer tokens the API accepts
	// (for example the Android app's client).
	AllowedAZP []string
}

// Mode selects which settings are required.
type Mode string

const (
	ModeAPI     Mode = "api"
	ModeWorker  Mode = "worker"
	ModeMigrate Mode = "migrate"
)

// Enabled reports whether Keycloak sign-in is configured.
func (o OIDC) Enabled() bool {
	return o.Issuer != "" && o.ClientID != "" && o.ClientSecret != "" && o.RedirectURL != ""
}

// Load reads the environment and validates what the mode needs.
func Load(mode Mode) (Config, error) {
	c := Config{
		HTTPAddr:      env("MK_HTTP_ADDR", ":8090"),
		WebDir:        env("MK_WEB_DIR", "../web/dist"),
		DBDSN:         os.Getenv("MK_DB_DSN"),
		PublicBaseURL: strings.TrimRight(env("MK_PUBLIC_BASE_URL", "http://localhost:8090"), "/"),
		OIDC: OIDC{
			Issuer:       os.Getenv("MK_OIDC_ISSUER"),
			ClientID:     os.Getenv("MK_OIDC_CLIENT_ID"),
			ClientSecret: os.Getenv("MK_OIDC_CLIENT_SECRET"),
			RedirectURL:  os.Getenv("MK_OIDC_REDIRECT_URL"),
			AllowedAZP:   splitList(os.Getenv("MK_OIDC_ALLOWED_AZP")),
		},
		CookieSecure:      envBool("MK_COOKIE_SECURE", true),
		WorkerID:          env("MK_WORKER_ID", hostname()),
		WorkerBatch:       envInt("MK_WORKER_BATCH", 20),
		ShutdownGraceTime: 20 * time.Second,
	}
	var err error
	if c.SessionTTL, err = envDuration("MK_SESSION_TTL", 12*time.Hour); err != nil {
		return c, err
	}
	if c.WorkerPoll, err = envDuration("MK_WORKER_POLL", time.Second); err != nil {
		return c, err
	}
	if c.MaintenanceEvery, err = envDuration("MK_MAINTENANCE_EVERY", 10*time.Minute); err != nil {
		return c, err
	}

	var missing []string
	if c.DBDSN == "" {
		missing = append(missing, "MK_DB_DSN")
	}
	if mode == ModeAPI {
		// Keycloak settings are optional: without them the API starts with
		// sign-in switched off, and every protected route refuses access.
		key, kerr := hex.DecodeString(os.Getenv("MK_SESSION_KEY"))
		if kerr != nil || len(key) < 32 {
			missing = append(missing, "MK_SESSION_KEY (hex, at least 32 bytes)")
		}
		c.SessionKey = key
	}
	if len(missing) > 0 {
		return c, fmt.Errorf("config: missing or invalid: %s", strings.Join(missing, ", "))
	}
	return c, nil
}

func env(name, def string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return def
}

func envBool(name string, def bool) bool {
	v := os.Getenv(name)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

func envInt(name string, def int) int {
	v, err := strconv.Atoi(os.Getenv(name))
	if err != nil || v <= 0 {
		return def
	}
	return v
}

func envDuration(name string, def time.Duration) (time.Duration, error) {
	v := os.Getenv(name)
	if v == "" {
		return def, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return 0, errors.New("config: " + name + " is not a duration like 10m")
	}
	return d, nil
}

func splitList(v string) []string {
	var out []string
	for _, p := range strings.Split(v, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func hostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "worker"
	}
	return h
}
