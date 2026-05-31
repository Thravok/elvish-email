package httpserver

import (
	"encoding/json"
	"html/template"
	"net/http"
	"strings"

	"elvish/internal/config"
)

// normalizeUITheme returns one of auto, dark, light.
func normalizeUITheme(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "dark", "light", "auto":
		return strings.ToLower(strings.TrimSpace(s))
	default:
		return "auto"
	}
}

// marshalTweakDefaultsJSON builds tweak defaults for the public shell script.
// When a user session is present, the theme key reflects their saved ui_theme
// (auto, dark, light) so the client can resolve auto against prefers-color-scheme.
func (s *Server) marshalTweakDefaultsJSON(r *http.Request, h *config.Home) template.JS {
	tweakMap := map[string]any{
		"theme":     h.TweakDefaults.Theme,
		"font":      h.TweakDefaults.Font,
		"crosshair": h.TweakDefaults.Crosshair,
		"scanlines": h.TweakDefaults.Scanlines,
		"showGrid":  h.TweakDefaults.ShowGrid,
	}
	if u, ok := s.userFromRequest(r); ok && u != nil {
		tweakMap["theme"] = normalizeUITheme(u.UITheme)
	}
	b, err := json.Marshal(tweakMap)
	if err != nil {
		if s.log != nil {
			s.log.Error("marshal tweak defaults", "err", err)
		}
		return template.JS("{}")
	}
	return template.JS(b)
}
