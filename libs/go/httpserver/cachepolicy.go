package httpserver

import (
	"net/http"
	"strings"
)

// HTTP cache policies align with static/_headers for Pages deploys and keep
// personalized HTML out of shared caches when a session cookie is present.

const (
	cacheControlImmutableAsset = "public, max-age=31536000, immutable"
	cacheControlStaticLong     = "public, max-age=86400, stale-while-revalidate=604800"
	cacheControlFeeds          = "public, max-age=120, stale-while-revalidate=86400"
	cacheControlSigningPub     = "public, max-age=86400, stale-while-revalidate=604800"
	cacheControlPGPKeyAsc      = "public, max-age=86400, stale-while-revalidate=604800"
	cacheControlPGPKeysJSON    = "public, max-age=60, stale-while-revalidate=300"
	cacheControlServiceWorker  = "public, max-age=0, must-revalidate"
	cacheControlHTMLPublic     = "public, max-age=0, stale-while-revalidate=86400"
	cacheControlHTMLPrivate    = "private, max-age=0, stale-while-revalidate=300"
	cacheControlAPINoStore     = "no-store"
	cacheControlRedirect       = "private, max-age=0, no-cache"
	cacheControlAuthHTML       = "private, max-age=0, stale-while-revalidate=60"
	cacheControlBootstrapJSON  = "public, max-age=60, stale-while-revalidate=300"
	cacheControlAdminJSX       = "no-store"
	cacheControlAdminDefault   = "private, max-age=0, must-revalidate"
	cacheControlMarkdownSource = "public, max-age=60, stale-while-revalidate=3600"
	cacheControlMinisig        = "public, max-age=86400, immutable"
	cacheControlNoStore        = "no-store"
)

func hasSessionCookie(r *http.Request) bool {
	c, err := r.Cookie(sessionCookie)
	return err == nil && strings.TrimSpace(c.Value) != ""
}

func setCacheHTMLDocument(w http.ResponseWriter, r *http.Request) {
	if hasSessionCookie(r) {
		w.Header().Set("Cache-Control", cacheControlHTMLPrivate)
		return
	}
	w.Header().Set("Cache-Control", cacheControlHTMLPublic)
}

func setCacheFeeds(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlFeeds)
}

func setCacheSigningPubOK(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlSigningPub)
}

func setCachePGPKeysJSON(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlPGPKeysJSON)
}

func setCachePGPKeyAsc(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlPGPKeyAsc)
}

func setCacheServiceWorker(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlServiceWorker)
}

func setCacheAPIDefault(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlAPINoStore)
}

func setCacheToolRedirect(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlRedirect)
}

func setCacheAuthHTML(w http.ResponseWriter, r *http.Request) {
	if hasSessionCookie(r) {
		w.Header().Set("Cache-Control", cacheControlHTMLPrivate)
		return
	}
	w.Header().Set("Cache-Control", cacheControlAuthHTML)
}

func setCachePostSourceMD(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlMarkdownSource)
}

func setCachePostMinisig(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlMinisig)
}

func setCachePostOpenPGPSig(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlPGPKeyAsc)
}

func setCacheInternalError(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlNoStore)
}

// setCacheStaticFromPath sets Cache-Control for files under static/ (not sw.js).
func setCacheStaticFromPath(w http.ResponseWriter, r *http.Request, rel string) {
	lower := strings.ToLower(rel)
	switch {
	case lower == "styles.css" || lower == "page.css" || lower == "site.js":
		if strings.Contains(r.URL.RawQuery, "v=") {
			w.Header().Set("Cache-Control", cacheControlImmutableAsset)
			return
		}
		w.Header().Set("Cache-Control", cacheControlStaticLong)
	case strings.HasSuffix(lower, ".css"), strings.HasSuffix(lower, ".js"):
		if strings.Contains(r.URL.RawQuery, "v=") {
			w.Header().Set("Cache-Control", cacheControlImmutableAsset)
			return
		}
		w.Header().Set("Cache-Control", cacheControlStaticLong)
	case strings.HasSuffix(lower, ".svg"), strings.HasSuffix(lower, ".png"),
		strings.HasSuffix(lower, ".ico"), strings.HasSuffix(lower, ".webp"),
		strings.HasSuffix(lower, ".woff2"), strings.HasSuffix(lower, ".woff"):
		w.Header().Set("Cache-Control", cacheControlStaticLong)
	default:
		w.Header().Set("Cache-Control", cacheControlStaticLong)
	}
}

func setCacheAdminFile(w http.ResponseWriter, r *http.Request, rel string) {
	lower := strings.ToLower(rel)
	switch {
	case lower == "bootstrap.json":
		w.Header().Set("Cache-Control", cacheControlBootstrapJSON)
	case strings.HasSuffix(lower, ".jsx"):
		w.Header().Set("Cache-Control", cacheControlAdminJSX)
	default:
		if hasSessionCookie(r) {
			w.Header().Set("Cache-Control", cacheControlHTMLPrivate)
			return
		}
		w.Header().Set("Cache-Control", cacheControlAdminDefault)
	}
}
