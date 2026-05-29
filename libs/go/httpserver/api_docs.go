package httpserver

import (
	"net/http"

	"elvish/libs/go/apidoc"
)

func (s *Server) serveOpenAPISpec(w http.ResponseWriter, r *http.Request) {
	setCacheAPIDefault(w)
	w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
	data := apidoc.OpenAPIYAML()
	if len(data) == 0 {
		http.Error(w, "openapi spec not embedded", http.StatusNotFound)
		return
	}
	if _, err := w.Write(data); err != nil {
		s.log.Warn("write openapi yaml", "err", err)
	}
}

func (s *Server) serveOpenAPIDocs(w http.ResponseWriter, r *http.Request) {
	setCacheAPIDefault(w)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>ELVish API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.css"/>
</head>
<body>
  <redoc spec-url="/api/openapi.yaml"></redoc>
  <script src="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js"></script>
</body>
</html>`
	if _, err := w.Write([]byte(page)); err != nil {
		s.log.Warn("write api docs html", "err", err)
	}
}
