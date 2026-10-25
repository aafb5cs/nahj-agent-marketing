package httpx

import (
	"fmt"
	"log/slog"
	"regexp"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/ids"
	"github.com/gin-gonic/gin"
)

const requestIDKey = "request_id"

var validRequestID = regexp.MustCompile(`^[A-Za-z0-9_\-]{8,64}$`)

// RequestID reuses a valid incoming X-Request-ID or creates one, and echoes it.
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader("X-Request-ID")
		if !validRequestID.MatchString(id) {
			id = ids.Token(12)
		}
		c.Set(requestIDKey, id)
		c.Header("X-Request-ID", id)
		c.Next()
	}
}

// RequestID returns the current request's ID.
func RequestID(c *gin.Context) string {
	return c.GetString(requestIDKey)
}

// Recover turns a panic into a 500 with a reference, and logs it.
func Recover(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if p := recover(); p != nil {
				log.Error("panic", "request_id", RequestID(c), "panic", fmt.Sprint(p), "path", c.FullPath())
				Fail(c, ErrInternal)
			}
		}()
		c.Next()
	}
}

// AccessLog writes one line per request, with any handler errors attached.
// It never logs request bodies, tokens or cookies.
func AccessLog(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		attrs := []any{
			"request_id", RequestID(c),
			"method", c.Request.Method,
			"route", c.FullPath(),
			"status", c.Writer.Status(),
			"duration_ms", time.Since(start).Milliseconds(),
		}
		if len(c.Errors) > 0 {
			attrs = append(attrs, "errors", c.Errors.String())
			log.Error("request", attrs...)
			return
		}
		log.Info("request", attrs...)
	}
}
