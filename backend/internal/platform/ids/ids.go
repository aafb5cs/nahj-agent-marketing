// Package ids creates random tokens, human-readable references and codes.
package ids

import (
	"crypto/rand"
	"encoding/base64"
	"strings"
	"time"
)

// Alphabet has no look-alike characters (no 0/O, 1/I/L), so codes can be read
// aloud or typed from WhatsApp without mistakes.
const Alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

// RandomBytes returns n bytes from a cryptographic source.
func RandomBytes(n int) []byte {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic("ids: crypto/rand failed: " + err.Error())
	}
	return b
}

// Token returns a URL-safe random token with n bytes of entropy.
func Token(n int) string {
	return base64.RawURLEncoding.EncodeToString(RandomBytes(n))
}

// Code returns n characters from Alphabet, without modulo bias.
func Code(n int) string {
	var sb strings.Builder
	sb.Grow(n)
	max := byte(256 - 256%len(Alphabet))
	for sb.Len() < n {
		for _, b := range RandomBytes(n) {
			if b >= max {
				continue
			}
			sb.WriteByte(Alphabet[int(b)%len(Alphabet)])
			if sb.Len() == n {
				break
			}
		}
	}
	return sb.String()
}

// Reference builds a readable reference such as NHO-261025-7K2M.
func Reference(prefix string, t time.Time) string {
	return prefix + "-" + t.UTC().Format("060102") + "-" + Code(4)
}
