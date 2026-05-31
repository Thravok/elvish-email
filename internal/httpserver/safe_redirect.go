package httpserver

import (
	"net/http"
	"net/url"
	"path"
	"strings"
)

func isSafeAbsoluteRedirectPath(p string) bool {
	if len(p) < 1 || p[0] != '/' {
		return false
	}
	if len(p) >= 2 && (p[1] == '/' || p[1] == '\\') {
		return false
	}
	return true
}

func safeRedirectPath(next string) string {
	next = strings.TrimSpace(next)
	if next == "" {
		return "/"
	}
	if strings.ContainsAny(next, "\r\n\x00") || strings.Contains(next, `\`) {
		return "/"
	}
	dec, err := url.PathUnescape(next)
	if err != nil {
		return "/"
	}
	next = strings.TrimSpace(dec)
	if strings.Contains(next, "://") {
		return "/"
	}
	if !isSafeAbsoluteRedirectPath(next) {
		return "/"
	}
	c := path.Clean(next)
	if c == "." || !isSafeAbsoluteRedirectPath(c) {
		return "/"
	}
	return c
}

func redirectSafePath(w http.ResponseWriter, r *http.Request, rawNext string, status int) {
	dest := safeRedirectPath(rawNext)
	http.Redirect(w, r, dest, status) //codeql[go/unvalidated-url-redirection]: dest is same-origin relative path only.
}
