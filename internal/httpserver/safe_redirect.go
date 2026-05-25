package httpserver

import (
	"net/http"
	"net/url"
)

func redirectSafePath(w http.ResponseWriter, r *http.Request, rawNext string, status int) {
	http.Redirect(w, r, safeRedirectPath(rawNext), status) //codeql[go/unvalidated-url-redirection]: same-origin relative path only.
}

// redirectLoginWithOAuthNext sends the browser to /login with a sanitized authorize URL in next=.
func redirectLoginWithOAuthNext(w http.ResponseWriter, r *http.Request, rawAuthorizeURI string) {
	next := safeOAuthAuthorizeNext(rawAuthorizeURI)
	if next == "" {
		http.Redirect(w, r, "/login", http.StatusFound)
		return
	}
	http.Redirect(w, r, "/login?next="+url.QueryEscape(next), http.StatusFound) //codeql[go/unvalidated-url-redirection]: next limited to /oauth/authorize on this host.
}

func redirectAllowlistedOAuth(w http.ResponseWriter, r *http.Request, target *url.URL, code, state string) {
	redir := *target
	qq := redir.Query()
	qq.Set("code", code)
	qq.Set("state", state)
	redir.RawQuery = qq.Encode()
	w.Header().Set("Cache-Control", cacheControlRedirect)
	http.Redirect(w, r, redir.String(), http.StatusFound) //codeql[go/unvalidated-url-redirection]: target from OAuth client allowlist via RedirectTarget.
}
