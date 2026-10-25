// Package logging sets up structured JSON logs.
package logging

import (
	"log/slog"
	"os"
	"strings"
)

// New returns a JSON logger. Level comes from MK_LOG_LEVEL (debug, info, warn, error).
func New(service string) *slog.Logger {
	level := slog.LevelInfo
	switch strings.ToLower(os.Getenv("MK_LOG_LEVEL")) {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}
	h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	return slog.New(h).With("service", service)
}
