package api

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/httpx"
	"github.com/gin-gonic/gin"
)

// webApp serves the built single-page app from dir. Files that exist are
// served as they are; any other non-API GET returns index.html so the app's
// own router handles the path. API paths and other methods get a JSON 404.
func webApp(dir string) gin.HandlerFunc {
	index := filepath.Join(dir, "index.html")
	return func(c *gin.Context) {
		p := c.Request.URL.Path
		if dir == "" || strings.HasPrefix(p, "/api/") || (c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead) {
			httpx.Fail(c, httpx.ErrNotFound)
			return
		}
		clean := path.Clean("/" + p)
		file := filepath.Join(dir, filepath.FromSlash(clean))
		if st, err := os.Stat(file); err == nil && !st.IsDir() {
			if strings.HasPrefix(clean, "/assets/") {
				// Vite puts a content hash in asset names, so they never change.
				c.Header("Cache-Control", "public, max-age=31536000, immutable")
			}
			c.File(file)
			return
		}
		if _, err := os.Stat(index); err != nil {
			httpx.Fail(c, httpx.ErrNotFound)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.File(index)
	}
}
