package render

import (
	"html/template"
	"io"
	"io/fs"
	"strings"

	"elvish/internal/config"
)

// Engine executes HTML templates.
type Engine struct {
	t *template.Template
}

// New parses templates from a filesystem rooted at the templates directory (e.g. os.DirFS("templates")).
func New(tmplFS fs.FS) (*Engine, error) {
	funcs := template.FuncMap{
		"barDur": func(i int) float64 {
			return 1.4 + float64(i%4)*0.2
		},
		"barDelay": func(i int) float64 {
			return float64(i) * 0.05
		},
		// assetQ returns a cache-busting query suffix for static CSS/JS (matches service worker precache).
		"assetQ": func(site *config.Home) string {
			if site == nil {
				return ""
			}
			if v := strings.TrimSpace(site.HashShort); v != "" {
				return "?v=" + v
			}
			if v := strings.TrimSpace(site.Version); v != "" {
				return "?v=" + strings.ReplaceAll(v, " ", "-")
			}
			return ""
		},
	}
	t, err := template.New("site").Funcs(funcs).ParseFS(tmplFS, "*.tmpl")
	if err != nil {
		return nil, err
	}
	return &Engine{t: t}, nil
}

// Home writes index.html.
func (e *Engine) Home(w io.Writer, d *HomePage) error {
	return e.t.ExecuteTemplate(w, "home", d)
}

// Log writes the changelog listing page.
func (e *Engine) Log(w io.Writer, d *LogPage) error {
	return e.t.ExecuteTemplate(w, "log", d)
}

// Post writes a single entry page.
func (e *Engine) Post(w io.Writer, d *PostPage) error {
	return e.t.ExecuteTemplate(w, "post", d)
}

// Status writes /status/.
func (e *Engine) Status(w io.Writer, d *StatusPage) error {
	return e.t.ExecuteTemplate(w, "status", d)
}

// Manifesto writes /manifesto/.
func (e *Engine) Manifesto(w io.Writer, d *ManifestoPage) error {
	return e.t.ExecuteTemplate(w, "manifesto", d)
}
