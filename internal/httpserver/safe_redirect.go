package httpserver

import (
	"net/http"
	"net/url"

	"elvish/internal/oauthoidc"
)

func redirectSafePath(w http.ResponseWriter, r *http.Request, rawNext string, status int) {
	http.Redirect(w, r, safeRedirectPath(rawNext), status)
}

// redirectLoginWithOAuthNext sends the browser to /login with a sanitized authorize URL in next=.
func redirectLoginWithOAuthNext(w http.ResponseWriter, r *http.Request, rawAuthorizeURI string) {
	next := safeOAuthAuthorizeNext(rawAuthorizeURI)
	if next == "" {
		http.Redirect(w, r, "/login", http.StatusFound)
		return
	}
	http.Redirect(w, r, "/login?next="+url.QueryEscape(next), http.StatusFound)
}

func redirectAllowlistedOAuth(w http.ResponseWriter, r *http.Request, target *url.URL, code, state string) {
	w.Header().Set("Cache-Control", cacheControlRedirect)
	http.Redirect(w, r, oauthoidc.RedirectURLWithAuthCode(target, code, state), http.StatusFound)
}
