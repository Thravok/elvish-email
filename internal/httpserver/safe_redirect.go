package httpserver

import (
	"net/http"
	"net/url"
)

func redirectSafePath(w http.ResponseWriter, r *http.Request, rawNext string, status int) {
	// codeql[go/unvalidated-url-redirection]: next path is sanitized to a same-origin relative URL.
	http.Redirect(w, r, safeRedirectPath(rawNext), status)
}

func redirectAllowlistedOAuth(w http.ResponseWriter, r *http.Request, target *url.URL, code, state string) {
	redir := *target
	qq := redir.Query()
	qq.Set("code", code)
	qq.Set("state", state)
	redir.RawQuery = qq.Encode()
	w.Header().Set("Cache-Control", cacheControlRedirect)
	// codeql[go/unvalidated-url-redirection]: redirect target came from OAuth client allowlist via RedirectTarget.
	http.Redirect(w, r, redir.String(), http.StatusFound)
}
