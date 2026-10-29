// Package httpx holds the HTTP conventions shared by every handler:
// one response envelope, stable error codes and common middleware.
package httpx

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Error is a safe, user-facing error. Code is stable and translated by the
// client; Message is a short English fallback.
type Error struct {
	Status     int    `json:"-"`
	Code       string `json:"code"`
	Message    string `json:"message"`
	RetryAfter int    `json:"retryAfterSeconds,omitempty"`
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

// WithRetryAfter returns a copy carrying a retry delay.
func (e *Error) WithRetryAfter(d time.Duration) *Error {
	c := *e
	c.RetryAfter = int(d.Round(time.Second) / time.Second)
	if c.RetryAfter < 1 {
		c.RetryAfter = 1
	}
	return &c
}

// Errors used across modules.
var (
	ErrBadRequest          = &Error{Status: http.StatusBadRequest, Code: "BAD_REQUEST", Message: "The request is not valid."}
	ErrAuthRequired        = &Error{Status: http.StatusUnauthorized, Code: "AUTH_REQUIRED", Message: "Sign in to continue."}
	ErrStepUpRequired      = &Error{Status: http.StatusUnauthorized, Code: "STEP_UP_REQUIRED", Message: "Confirm it is you to continue."}
	ErrForbidden           = &Error{Status: http.StatusForbidden, Code: "FORBIDDEN", Message: "You do not have access to this."}
	ErrCSRF                = &Error{Status: http.StatusForbidden, Code: "CSRF_INVALID", Message: "Reload the page and try again."}
	ErrNotFound            = &Error{Status: http.StatusNotFound, Code: "NOT_FOUND", Message: "Not found."}
	ErrIdempotencyKey      = &Error{Status: http.StatusBadRequest, Code: "IDEMPOTENCY_KEY_REQUIRED", Message: "Send an Idempotency-Key header (8 to 64 letters, digits, '-', '_' or ':')."}
	ErrIdempotencyConflict = &Error{Status: http.StatusConflict, Code: "IDEMPOTENCY_CONFLICT", Message: "This key was already used for a different request."}
	ErrOperationInProgress = &Error{Status: http.StatusConflict, Code: "OPERATION_IN_PROGRESS", Message: "This request is still being processed. Check its result shortly."}
	ErrRateLimited         = &Error{Status: http.StatusTooManyRequests, Code: "RATE_LIMITED", Message: "Too many attempts. Wait and try again."}
	ErrInternal            = &Error{Status: http.StatusInternalServerError, Code: "INTERNAL", Message: "Something went wrong. Use the reference when contacting support."}
	ErrServiceUnavailable  = &Error{Status: http.StatusServiceUnavailable, Code: "UNAVAILABLE", Message: "The service is not ready."}
	ErrSignInOff           = &Error{Status: http.StatusServiceUnavailable, Code: "SIGN_IN_OFF", Message: "Sign-in is not configured on this server."}
)

type okBody struct {
	Data       any       `json:"data"`
	ServerTime time.Time `json:"serverTime"`
}

type errBody struct {
	Error      errDetail `json:"error"`
	ServerTime time.Time `json:"serverTime"`
}

type errDetail struct {
	*Error
	Reference string `json:"reference"`
}

// OK writes {"data": ..., "serverTime": ...}.
func OK(c *gin.Context, status int, data any) {
	c.JSON(status, okBody{Data: data, ServerTime: time.Now().UTC().Truncate(time.Millisecond)})
}

// Fail writes {"error": {code, message, reference}, "serverTime": ...} and aborts.
func Fail(c *gin.Context, e *Error) {
	if e.RetryAfter > 0 {
		c.Header("Retry-After", itoa(e.RetryAfter))
	}
	c.AbortWithStatusJSON(e.Status, errBody{
		Error:      errDetail{Error: e, Reference: RequestID(c)},
		ServerTime: time.Now().UTC().Truncate(time.Millisecond),
	})
}

// FailInternal logs err with the request ID and writes a generic 500.
func FailInternal(c *gin.Context, err error) {
	_ = c.Error(err)
	Fail(c, ErrInternal)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
