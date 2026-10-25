package ids

import (
	"strings"
	"testing"
	"time"
)

func TestCodeUsesOnlyReadableCharacters(t *testing.T) {
	for i := 0; i < 200; i++ {
		c := Code(6)
		if len(c) != 6 {
			t.Fatalf("len(%q) = %d", c, len(c))
		}
		for _, r := range c {
			if !strings.ContainsRune(Alphabet, r) {
				t.Fatalf("%q contains %q", c, r)
			}
		}
		if strings.ContainsAny(c, "01OIL") {
			t.Fatalf("%q contains a look-alike character", c)
		}
	}
}

func TestReference(t *testing.T) {
	ref := Reference("NHO", time.Date(2026, 10, 25, 23, 0, 0, 0, time.UTC))
	if !strings.HasPrefix(ref, "NHO-261025-") || len(ref) != len("NHO-261025-XXXX") {
		t.Fatalf("Reference = %q", ref)
	}
}

func TestTokensAreUnique(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		tok := Token(16)
		if seen[tok] {
			t.Fatal("duplicate token")
		}
		seen[tok] = true
	}
}
