package consoleserver

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func (s *Server) handleStatic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	p := r.URL.Path
	if p == "/" || p == "" {
		p = "/index.html"
	}
	if strings.Contains(p, "..") {
		http.NotFound(w, r)
		return
	}
	rel := strings.TrimPrefix(p, "/")
	target := filepath.Join(s.staticRoot, filepath.FromSlash(rel))
	if info, err := os.Stat(target); err != nil || info.IsDir() {
		// shared assets live under static/shared
		alt := filepath.Join(s.root, "static", filepath.FromSlash(rel))
		if info2, err2 := os.Stat(alt); err2 == nil && !info2.IsDir() {
			target = alt
		} else if rel == "login" || strings.HasPrefix(rel, "login/") {
			target = filepath.Join(s.staticRoot, "index.html")
		} else {
			http.NotFound(w, r)
			return
		}
	}
	http.ServeFile(w, r, target)
}

// ServeConsoleAsset serves a file from static/console (for tests).
func (s *Server) ServeConsoleAsset(w http.ResponseWriter, r *http.Request, name string) {
	if strings.Contains(name, "..") {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, filepath.Join(s.staticRoot, name))
}

func readLimitedFile(path string, limit int64) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return io.ReadAll(io.LimitReader(f, limit))
}
