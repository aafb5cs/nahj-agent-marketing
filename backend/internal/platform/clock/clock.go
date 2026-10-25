// Package clock gives code a replaceable "now", so tests can control time.
package clock

import (
	"sync"
	"time"
)

// Clock returns the current time in UTC, truncated to milliseconds to match
// DATETIME(3) columns.
type Clock interface {
	Now() time.Time
}

// System is the real clock.
type System struct{}

// Now implements Clock.
func (System) Now() time.Time { return time.Now().UTC().Truncate(time.Millisecond) }

// Fake is a clock for tests.
type Fake struct {
	mu sync.Mutex
	t  time.Time
}

// NewFake starts a fake clock at t.
func NewFake(t time.Time) *Fake { return &Fake{t: t.UTC().Truncate(time.Millisecond)} }

// Now implements Clock.
func (f *Fake) Now() time.Time {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.t
}

// Advance moves the clock forward.
func (f *Fake) Advance(d time.Duration) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.t = f.t.Add(d)
}

// Set moves the clock to t.
func (f *Fake) Set(t time.Time) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.t = t.UTC().Truncate(time.Millisecond)
}
