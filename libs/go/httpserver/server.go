// Package httpserver is the live Elvish HTTP site + JSON API (CockroachDB/Postgres + Valkey).
package httpserver

import (
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"elvish/libs/go/blobstore"
	"elvish/libs/go/blog"
	"elvish/libs/go/config"
	"elvish/libs/go/db"
	"elvish/libs/go/dkim"
	"elvish/libs/go/keyserver"
	"elvish/libs/go/maillinks"
	"elvish/libs/go/mailmeta"
	"elvish/libs/go/mailworker"
	"elvish/libs/go/oauthoidc"
	"elvish/libs/go/operatorconfig"
	"elvish/libs/go/ratelimit"
	"elvish/libs/go/relaykey"
	"elvish/libs/go/render"
	"elvish/libs/go/scyllastore"
	"elvish/libs/go/session"
	"elvish/libs/go/store"
	"elvish/libs/go/paths"
	"elvish/libs/go/telemetry"
	"elvish/libs/go/toolcalls"
	"elvish/libs/go/uptime"
)

// Server serves the public site, static assets, and /api routes.
type Server struct {
	log               *slog.Logger
	root              string
	staticRoot        string
	serveWebStatic    bool
	webOrigin         string
	adminOrigin       string
	templatesFS       fs.FS
	bundle            *db.Bundle
	store             *store.Store
	mailmeta          *mailmeta.Store
	scylla            *scyllastore.Store
	blob              *blobstore.Store
	resolver          *keyserver.Resolver
	mailDomain        string
	smtpHostname      string
	mailLinks         *maillinks.Store
	relayKey          *relaykey.KeyPair
	relayKeyPath      string
	dkimKeyPath       string
	dkimSelector      string
	dkimDomain        string
	mailWorker        *mailworker.Worker
	publicBaseURL     string
	sessions          *session.Store
	eng               *render.Engine
	cookieSecure      bool
	cookieDomain      string
	webOrigins        []string
	telemetry         *telemetry.Service
	toolCalls         *toolcalls.Store
	uptimeSnap        *uptime.RedisStore
	uptimeMu          sync.Mutex
	uptimeMem         *uptime.Snapshot
	uptimeAggMu       sync.Mutex
	uptimeLocalYM     string
	uptimeLocal       map[string]struct{ OK, Fail int64 }
	rateLimit         *ratelimit.Limiter
	oidcIssuer        *oauthoidc.Issuer
	operator          *operatorconfig.Service
	trustForwardedFor bool
	authMu            sync.Mutex
	authChallenges    map[string]*srpChallenge

	contentMu      sync.RWMutex
	cachedHome     *config.Home
	cachedHomeExp  time.Time
	cachedPosts    []blog.Post
	cachedPostsExp time.Time
}

// WithMail wires the four-store mail subsystem. Optional; nil values disable the related routes.
func (s *Server) WithMail(mm *mailmeta.Store, sc *scyllastore.Store, bl *blobstore.Store, resolver *keyserver.Resolver, mailDomain string) {
	if s == nil {
		return
	}
	s.mailmeta = mm
	s.scylla = sc
	s.blob = bl
	s.resolver = resolver
	s.mailDomain = mailDomain
}

// WithSMTPHostname stores the inbound/outbound SMTP hostname used for MX guidance.
func (s *Server) WithSMTPHostname(hostname string) {
	if s == nil {
		return
	}
	s.smtpHostname = strings.TrimSpace(hostname)
}

// WithMailLinks attaches the protected-link store (Mode B). nil disables /api/v1/mail/protected-links and /m/{token}.
func (s *Server) WithMailLinks(ml *maillinks.Store) {
	if s == nil {
		return
	}
	s.mailLinks = ml
}

// WithRelayKey attaches the optional plaintext-relay PGP keypair (Mode C). nil leaves /api/v1/mail/outbox-plain returning 503.
func (s *Server) WithRelayKey(kp *relaykey.KeyPair) {
	if s == nil {
		return
	}
	s.relayKey = kp
}

// WithRelayKeyConfig stores relay key metadata for admin/runtime management.
func (s *Server) WithRelayKeyConfig(path string) {
	if s == nil {
		return
	}
	s.relayKeyPath = strings.TrimSpace(path)
}

// WithDKIMConfig stores DKIM metadata for admin/runtime management.
func (s *Server) WithDKIMConfig(selector, domain, path string) {
	if s == nil {
		return
	}
	s.dkimSelector = strings.ToLower(strings.TrimSpace(selector))
	s.dkimDomain = strings.ToLower(strings.TrimSpace(domain))
	s.dkimKeyPath = strings.TrimSpace(path)
}

// WithMailWorker attaches the outbound mail worker for runtime crypto reloads.
func (s *Server) WithMailWorker(w *mailworker.Worker) {
	if s == nil {
		return
	}
	s.mailWorker = w
}

// ReloadRelayKey replaces the in-process relay key and updates the mail worker.
func (s *Server) ReloadRelayKey(kp *relaykey.KeyPair) {
	if s == nil {
		return
	}
	s.relayKey = kp
	if s.mailWorker != nil {
		s.mailWorker.SetRelayKey(kp)
	}
}

// ReloadDKIMSigner replaces the in-process DKIM signer and updates the mail worker.
func (s *Server) ReloadDKIMSigner(selector, domain string, signer *dkim.Signer) {
	if s == nil {
		return
	}
	s.dkimSelector = strings.ToLower(strings.TrimSpace(selector))
	s.dkimDomain = strings.ToLower(strings.TrimSpace(domain))
	if s.mailWorker != nil {
		s.mailWorker.SetDKIM(s.dkimSelector, s.dkimDomain, signer)
	}
}

// WithPublicBaseURL sets the canonical public base URL used to render absolute /m/{token} links in protected-link notification emails.
func (s *Server) WithPublicBaseURL(base string) {
	if s == nil {
		return
	}
	s.publicBaseURL = strings.TrimRight(strings.TrimSpace(base), "/")
}

// Options configures the HTTP server.
type Options struct {
	// Root is the repository root (services/api, apps/web, data/, …).
	Root string
	// CookieSecure sets the Secure flag on session cookies.
	CookieSecure bool
	// Logger is used for server and handler diagnostics; if nil, slog.Default() is used.
	Logger *slog.Logger
}

// New builds a Server. When the process is started without SQL/Valkey (static-only mode),
// bundle is nil: content is disk-only and auth APIs are unavailable. Normal operation expects both.
func New(opts Options, bundle *db.Bundle) (*Server, error) {
	root := filepath.Clean(opts.Root)
	repo := paths.RepoRoot(root)
	tmplFS := os.DirFS(repo.APITemplates())
	eng, err := render.New(tmplFS)
	if err != nil {
		return nil, err
	}
	var st *store.Store
	var rdb *db.Bundle
	if bundle != nil {
		rdb = bundle
		if bundle.Pool() != nil {
			st = store.New(bundle.Pool())
		}
	}
	sess := (*session.Store)(nil)
	var tc *toolcalls.Store
	var up *uptime.RedisStore
	var rl *ratelimit.Limiter
	if bundle != nil {
		if bundle.Valkey() != nil {
			sess = session.NewStore(bundle.Valkey(), "")
			tc = toolcalls.New(bundle.Valkey())
			up = uptime.NewRedisStore(bundle.Valkey())
			rl = ratelimit.New(bundle.Valkey(), "")
		}
	}
	lg := opts.Logger
	if lg == nil {
		lg = slog.Default()
	}
	return &Server{
		log:            lg,
		root:           root,
		staticRoot:     repo.WebApp(),
		serveWebStatic: serveWebStaticFromEnv(),
		webOrigin:      strings.TrimRight(strings.TrimSpace(os.Getenv("ELVISH_WEB_ORIGIN")), "/"),
		adminOrigin:    strings.TrimRight(strings.TrimSpace(os.Getenv("ELVISH_ADMIN_ORIGIN")), "/"),
		templatesFS:    tmplFS,
		bundle:         rdb,
		store:          st,
		sessions:       sess,
		eng:            eng,
		cookieSecure:   opts.CookieSecure,
		telemetry:      telemetry.New(st),
		toolCalls:      tc,
		uptimeSnap:     up,
		rateLimit:      rl,
		authChallenges: map[string]*srpChallenge{},
	}, nil
}

// Telemetry returns the anonymous operational telemetry service.
func (s *Server) Telemetry() *telemetry.Service {
	if s == nil {
		return nil
	}
	return s.telemetry
}

func envTruthy(key string) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	return v == "1" || v == "true" || v == "yes"
}

// serveWebStaticFromEnv defaults to true when ELVISH_SERVE_STATIC is unset (local dev).
func serveWebStaticFromEnv() bool {
	v := strings.TrimSpace(os.Getenv("ELVISH_SERVE_STATIC"))
	if v == "" {
		return true
	}
	return envTruthy("ELVISH_SERVE_STATIC")
}

func (s *Server) redirectToWebUI(w http.ResponseWriter, r *http.Request) bool {
	if s.serveWebStatic {
		return false
	}
	if s.webOrigin == "" {
		http.NotFound(w, r)
		return true
	}
	target := s.webOrigin + r.URL.RequestURI()
	http.Redirect(w, r, target, http.StatusTemporaryRedirect)
	return true
}

func (s *Server) redirectToAdminUI(w http.ResponseWriter, r *http.Request) bool {
	if s.serveWebStatic {
		return false
	}
	if s.adminOrigin == "" {
		return s.redirectToWebUI(w, r)
	}
	target := s.adminOrigin + strings.TrimPrefix(r.URL.RequestURI(), "/admin")
	if target == s.adminOrigin {
		target = s.adminOrigin + "/"
	}
	http.Redirect(w, r, target, http.StatusTemporaryRedirect)
	return true
}

func (s *Server) writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		s.log.Warn("writeJSON encode", "err", err)
	}
}

func (s *Server) writeErr(w http.ResponseWriter, status int, msg string) {
	s.writeJSON(w, status, map[string]string{"error": msg})
}

// writeBytes writes p to w and logs a non-nil write error at warn level.
func (s *Server) writeBytes(w http.ResponseWriter, context string, p []byte) {
	if _, err := w.Write(p); err != nil {
		s.log.Warn("response write", "context", context, "err", err)
	}
}

// Handler returns the root http.Handler.
func (s *Server) Handler() http.Handler {
	var h http.Handler = http.HandlerFunc(s.serveHTTP)
	h = requestIDMiddleware(h)
	h = s.corsMiddleware(h)
	return SecureHeaders(GzipHandler(h))
}

// ServeHTTP implements the elvish site router.
func (s *Server) serveHTTP(w http.ResponseWriter, r *http.Request) {
	startedAt := time.Now()
	sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
	defer func() {
		if s.telemetry == nil {
			return
		}
		if err := s.telemetry.RecordHTTP(r.Context(), r.URL.Path, sw.status, time.Since(startedAt)); err != nil && s.log != nil {
			s.log.Warn("telemetry http", "err", err)
		}
	}()
	if r.Method == http.MethodOptions {
		sw.WriteHeader(http.StatusNoContent)
		return
	}
	path := r.URL.Path
	if path == "" {
		path = "/"
	}
	if isHoneypotProbePath(path) {
		if !s.rateLimitOK(sw, r, "http_probe_honeypot", rateLimitProbePerHour, rateLimitProbeWindow) {
			return
		}
		sw.Header().Set("Cache-Control", "no-store")
		http.NotFound(sw, r)
		return
	}
	if path == "/.well-known/security.txt" && (r.Method == http.MethodGet || r.Method == http.MethodHead) {
		s.serveSecurityTxt(sw, r)
		return
	}
	if strings.HasPrefix(path, "/api/") {
		s.handleAPI(sw, r)
		return
	}
	if s.oidcIssuerEnabled() {
		switch {
		case path == "/.well-known/webfinger" && r.Method == http.MethodGet:
			s.handleOIDCWebFinger(sw, r)
			return
		case path == "/.well-known/openid-configuration" && r.Method == http.MethodGet:
			s.handleOIDCDiscovery(sw, r)
			return
		case path == "/.well-known/jwks.json" && r.Method == http.MethodGet:
			s.handleOIDCJWKS(sw, r)
			return
		case path == "/oauth/authorize" && r.Method == http.MethodGet:
			s.handleOIDCAuthorize(sw, r)
			return
		case path == "/oauth/token" && r.Method == http.MethodPost:
			s.handleOIDCToken(sw, r)
			return
		}
	}
	if strings.HasPrefix(path, "/.well-known/openpgpkey") {
		s.handleWKD(sw, r)
		return
	}
	if path == "/auth/logout" {
		s.handleAuthLogout(sw, r)
		return
	}
	if path == "/login/" {
		http.Redirect(sw, r, "/login", http.StatusFound)
		return
	}
	if path == "/register/" {
		http.Redirect(sw, r, "/register", http.StatusFound)
		return
	}
	if path == "/mail/" {
		http.Redirect(sw, r, "/mail", http.StatusFound)
		return
	}
	if path == "/mail" {
		if s.redirectToWebUI(sw, r) {
			return
		}
		s.serveMailUI(sw, r)
		return
	}
	if strings.HasPrefix(path, "/m/") {
		if s.redirectToWebUI(sw, r) {
			return
		}
		s.serveProtectedLinkUI(sw, r, strings.TrimPrefix(path, "/m/"))
		return
	}
	if path == "/login" {
		if s.redirectToWebUI(sw, r) {
			return
		}
		s.serveAuthHTML(sw, r, "login.html")
		return
	}
	if path == "/register" {
		if s.redirectToWebUI(sw, r) {
			return
		}
		s.serveAuthHTML(sw, r, "register.html")
		return
	}
	if path == "/auth/cap-embed.html" {
		if s.redirectToWebUI(sw, r) {
			return
		}
		s.serveAuthCapEmbed(sw, r)
		return
	}
	if strings.HasPrefix(path, "/admin") {
		if s.redirectToAdminUI(sw, r) {
			return
		}
		s.serveAdminOrStatic(sw, r)
		return
	}
	if path == "/manifesto" {
		http.Redirect(sw, r, "/manifesto/", http.StatusFound)
		return
	}
	// Legacy routes removed in email-first pivot: redirect to home
	if path == "/log" || strings.HasPrefix(path, "/log/") ||
		path == "/status" || path == "/status/" ||
		strings.HasPrefix(path, "/go/") ||
		path == "/feed.xml" || path == "/atom.xml" || path == "/feed.json" ||
		path == "/signing.pub" {
		http.Redirect(sw, r, "/", http.StatusMovedPermanently)
		return
	}
	switch {
	case strings.HasPrefix(path, "/pgp/"):
		s.handlePGPStatic(sw, r)
	case path == "/manifesto/":
		s.serveStaticManifesto(sw, r)
	case path == "/" || path == "/index.html":
		s.handleHome(sw, r)
	default:
		s.serveStaticFile(sw, r)
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusWriter) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(p)
}
