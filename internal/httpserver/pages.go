package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"elvish/internal/blog"
	"elvish/internal/config"
	"elvish/internal/feeds"
	"elvish/internal/glyphs"
	"elvish/internal/markdown"
	"elvish/internal/render"
	"elvish/internal/toolcalls"
	"elvish/internal/uptime"
)

func setNavActive(h *config.Home, id string) {
	for i := range h.Nav {
		h.Nav[i].Active = strings.EqualFold(h.Nav[i].ID, id)
	}
}

// callsUsesLiveCounter is true when home.json asks for Valkey-backed counts
// (sentinel dash values, "/", live, auto, or empty).
func callsUsesLiveCounter(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return true
	}
	if s == "/" {
		return true
	}
	switch strings.ToLower(s) {
	case "live", "auto":
		return true
	}
	runes := []rune(s)
	if len(runes) == 1 {
		switch runes[0] {
		case '\u2014', '\u2013', '-': // em dash, en dash, hyphen-minus
			return true
		}
	}
	return false
}

// buildHomeHeroStats copies hero stats from config and substitutes live values for the
// conventional keys TOOLS (visible tool count), CALLS · 30D (sum of Valkey launch counters),
// and UPTIME (monthly rollup when available, same as the spark-line caption). Other rows are unchanged.
func buildHomeHeroStats(base []config.StatKV, shown int, totalCalls int64, callsLiveOK bool, uptimeDisplay string) []config.StatKV {
	if len(base) == 0 {
		return nil
	}
	out := make([]config.StatKV, len(base))
	copy(out, base)
	for i := range out {
		switch strings.TrimSpace(out[i].Key) {
		case "TOOLS":
			out[i].Value = strconv.Itoa(shown)
		case "CALLS · 30D":
			if callsLiveOK {
				out[i].Value = toolcalls.FormatCount(totalCalls)
			} else {
				out[i].Value = "—"
			}
		case "UPTIME":
			out[i].Value = uptimeDisplay
		}
	}
	return out
}

func mergeToolCallsDisplay(yamlVal string, n int64, liveOK bool, callsStatic bool) string {
	if callsStatic || !callsUsesLiveCounter(yamlVal) {
		return strings.TrimSpace(yamlVal)
	}
	if !liveOK {
		return "—"
	}
	return toolcalls.FormatCount(n)
}

func visibleHomeTools(tools []config.Tool) []config.Tool {
	out := make([]config.Tool, 0, len(tools))
	for _, t := range tools {
		if !t.Hidden {
			out = append(out, t)
		}
	}
	return out
}

func countToolsOnline(snap *uptime.Snapshot, visible []config.Tool) int {
	if snap == nil {
		return 0
	}
	byID := make(map[string]uptime.ProbeResult, len(snap.Targets))
	for _, pr := range snap.Targets {
		byID[pr.ID] = pr
	}
	n := 0
	for _, t := range visible {
		slug := strings.TrimSpace(t.Slug)
		if slug == "" {
			continue
		}
		rid := uptime.PrimaryProbeIDForTool(slug, t.Monitor)
		if pr, ok := byID[rid]; ok && pr.OK {
			n++
		}
	}
	return n
}

// aggregateVisibleToolsProbeStats sums OK/fail counters for each visible tool's primary uptime probe
// (default tool_<slug> or custom mon_… when configured).
func aggregateVisibleToolsProbeStats(snap *uptime.Snapshot, visible []config.Tool) (pct float64, totOK, totFail int64, has bool) {
	if snap == nil || snap.Stats == nil {
		return 0, 0, 0, false
	}
	for _, t := range visible {
		slug := strings.TrimSpace(t.Slug)
		if slug == "" {
			continue
		}
		rid := uptime.PrimaryProbeIDForTool(slug, t.Monitor)
		st, ok := snap.Stats[rid]
		if !ok || st.OK+st.Fail == 0 {
			continue
		}
		has = true
		totOK += st.OK
		totFail += st.Fail
	}
	if !has {
		return 0, 0, 0, false
	}
	pct = float64(totOK) * 100.0 / float64(totOK+totFail)
	return pct, totOK, totFail, true
}

// heroUptimeBars returns one strip segment per visible tool (slug required), height ∝ rollup uptime for that probe.
// When snap is nil, returns (nil, true) so the caller can fall back to decorative load_bar_heights from config.
func heroUptimeBars(visible []config.Tool, snap *uptime.Snapshot) ([]render.HeroUptimeBar, bool) {
	const minH, maxH = 10, 56
	if snap == nil {
		return nil, true
	}
	byID := make(map[string]uptime.ProbeResult, len(snap.Targets))
	for _, pr := range snap.Targets {
		byID[pr.ID] = pr
	}
	out := make([]render.HeroUptimeBar, 0, len(visible))
	for _, t := range visible {
		slug := strings.TrimSpace(t.Slug)
		if slug == "" {
			continue
		}
		rid := uptime.PrimaryProbeIDForTool(slug, t.Monitor)
		pr, hasPR := byID[rid]
		if hasPR && !pr.OK {
			out = append(out, render.HeroUptimeBar{HeightPx: minH, LatestDown: true})
			continue
		}
		h := minH
		if snap.Stats != nil {
			if st, ok := snap.Stats[rid]; ok && st.OK+st.Fail > 0 {
				h = minH + int(float64(maxH-minH)*st.UptimePct/100.0+0.5)
				if h < minH {
					h = minH
				}
				if h > maxH {
					h = maxH
				}
			} else if hasPR && pr.OK {
				h = maxH
			}
		} else if hasPR && pr.OK {
			h = maxH
		}
		out = append(out, render.HeroUptimeBar{HeightPx: h, LatestDown: false})
	}
	if len(out) == 0 {
		return nil, true
	}
	return out, false
}

func buildHomeHeroSysRows(snap *uptime.Snapshot, visible []config.Tool, online, shown int, now time.Time) []config.SysStatusRow {
	pct, okC, failC, rollHas := aggregateVisibleToolsProbeStats(snap, visible)
	rows := make([]config.SysStatusRow, 0, 4)

	probeVal := fmt.Sprintf("● %d / %d", online, shown)
	probeSt := "ok"
	if shown > 0 && online < shown {
		probeSt = "accent"
	}
	if shown == 0 {
		probeSt = "dim"
	}
	rows = append(rows, config.SysStatusRow{Label: "PROBES", Value: probeVal, Status: probeSt})

	uptimeVal := "● —"
	uptimeSt := "dim"
	if rollHas {
		uptimeVal = "● " + formatOverallUptimePct(pct, okC, failC)
		uptimeSt = "ok"
	} else if snap != nil && snap.OverallOK+snap.OverallFail > 0 {
		uptimeVal = "● " + formatOverallUptimePct(snap.OverallUptimePct, snap.OverallOK, snap.OverallFail)
		uptimeSt = "ok"
	}
	rows = append(rows, config.SysStatusRow{Label: "UPTIME", Value: uptimeVal, Status: uptimeSt})

	stateVal := "● NO DATA"
	stateSt := "dim"
	if snap != nil && shown > 0 {
		if online == shown {
			stateVal = "● OPERATIONAL"
			stateSt = "ok"
		} else {
			stateVal = fmt.Sprintf("● %d DOWN", shown-online)
			stateSt = "accent"
		}
	} else if snap != nil && shown == 0 {
		stateVal = "● N/A"
		stateSt = "dim"
	}
	rows = append(rows, config.SysStatusRow{Label: "HEALTH", Value: stateVal, Status: stateSt})

	lastVal := "—"
	if snap != nil && !snap.CheckedAt.Time.IsZero() {
		lastVal = formatProbeAgeShort(snap.CheckedAt.Time, now)
	}
	rows = append(rows, config.SysStatusRow{Label: "LAST RUN", Value: lastVal, Status: "dim"})
	return rows
}

func (s *Server) latestUptimeSnapshot(ctx context.Context) *uptime.Snapshot {
	if snap := s.getUptimeMem(); snap != nil {
		return snap
	}
	if s.uptimeSnap == nil {
		return nil
	}
	snap, _, err := s.uptimeSnap.GetSnapshot(ctx)
	if err != nil || snap == nil {
		return nil
	}
	return snap
}

func buildToolVMs(tools []config.Tool, live map[string]int64, liveOK bool, snap *uptime.Snapshot) []render.ToolVM {
	out := make([]render.ToolVM, 0, len(tools))
	for _, t := range tools {
		sb := strings.ToLower(strings.Join([]string{
			t.Name,
			t.Desc,
			strings.Join(t.Signals, " "),
			t.Slug,
		}, " "))
		tt := t
		n := int64(0)
		if live != nil {
			n = live[tt.Slug]
		}
		tt.Calls = mergeToolCallsDisplay(tt.Calls, n, liveOK, tt.CallsStatic)
		out = append(out, render.ToolVM{
			Tool:       tt,
			Glyph:      glyphs.SVG(tt.Glyph),
			SearchBlob: sb,
			UptimeLine: uptimeLineForTool(snap, tt.Slug, tt.Monitor),
		})
	}
	return out
}

func logDates(posts []blog.Post) (first, latest string, count int) {
	count = len(posts)
	if count == 0 {
		return "—", "—", 0
	}
	return posts[count-1].DisplayDate, posts[0].DisplayDate, count
}

// serveStaticManifesto renders /manifesto/ via SSR template.
func (s *Server) serveStaticManifesto(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	h, err := s.loadHome(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	tweakJSON := []byte(s.marshalTweakDefaultsJSON(r, h))
	setNavActive(h, "manifesto")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	setCacheHTMLDocument(w, r)
	if err := s.eng.Manifesto(w, &render.ManifestoPage{
		Site:          h,
		Title:         "ELVISH — security",
		Description:   "Security principles and zero-access architecture for ELVISH encrypted email.",
		TweakDefaults: template.JS(tweakJSON),
		ActiveNav:     "manifesto",
		NavAuth:       s.navAuthFromRequest(r),
	}); err != nil {
		s.log.Error("render manifesto", "err", err)
	}
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	h, err := s.loadHome(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	tweakJSON := []byte(s.marshalTweakDefaultsJSON(r, h))
	snap := s.latestUptimeSnapshot(ctx)
	payload := s.uptimeAPIPayload(ctx)
	uptimeJSON, err := json.Marshal(payload)
	if err != nil {
		s.log.Error("marshal uptime payload", "err", err)
		uptimeJSON = []byte(`{"live":false}`)
	}
	monNames := s.monitorNameLookup(ctx)
	labelMap := map[string]string{}
	if snap != nil {
		for _, r := range snap.Targets {
			if _, ok := labelMap[r.ID]; !ok {
				labelMap[r.ID] = displayNameForUptimeTarget(h, r.ID, monNames)
			}
		}
	}
	labelJSON, err := json.Marshal(labelMap)
	if err != nil {
		s.log.Error("marshal uptime labels", "err", err)
		labelJSON = []byte("{}")
	}
	overall := "—"
	checked := "—"
	live := false
	msg := ""
	if snap != nil {
		live = true
		overall = formatOverallUptimePct(snap.OverallUptimePct, snap.OverallOK, snap.OverallFail)
		checked = formatCheckedAt(snap.CheckedAt.Time)
		if len(snap.Targets) == 0 {
			msg = "No probe targets in the latest snapshot."
		}
	} else if v, ok := payload["message"].(string); ok && v != "" {
		msg = v
	} else {
		msg = "No uptime data yet."
	}
	setNavActive(h, "status")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	setCacheHTMLDocument(w, r)
	if err := s.eng.Status(w, &render.StatusPage{
		Site:          h,
		Title:         "ELVISH — status",
		Description:   "Probe status and monthly (UTC) uptime rollups for monitored endpoints and tools.",
		TweakDefaults: template.JS(tweakJSON),
		UptimeInitial: template.JS(uptimeJSON),
		LabelsJSON:    template.JS(labelJSON),
		Ticker:        h.TickerHome,
		ActiveNav:     "status",
		NavAuth:       s.navAuthFromRequest(r),
		OverallUptime: overall,
		CheckedAt:     checked,
		Live:          live,
		EmptyMessage:  msg,
		Rows:          buildStatusRows(h, snap, monNames),
	}); err != nil {
		s.log.Error("render status", "err", err)
	}
}

func (s *Server) handleHome(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	h, err := s.loadHome(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	md := markdown.NewRenderer()
	ledeHTML, err := md.ToHTML([]byte(h.Hero.LedeMarkdown))
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	tweakJSON := []byte(s.marshalTweakDefaultsJSON(r, h))

	setNavActive(h, "home")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	setCacheHTMLDocument(w, r)
	if err := s.eng.Home(w, &render.HomePage{
		Site:          h,
		Title:         h.Title,
		Description:   h.Description,
		LedeHTML:      template.HTML(ledeHTML),
		HeroStats:     h.Hero.Stats,
		TweakDefaults: template.JS(tweakJSON),
		ActiveNav:     "home",
		NavAuth:       s.navAuthFromRequest(r),
	}); err != nil {
		s.log.Error("render home", "err", err)
	}
}

func (s *Server) handleFeeds(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	h, err := s.loadHome(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	if err := feeds.ValidateBaseURL(h.BaseURL); err != nil {
		s.logHTTPServer("feeds validate base url", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	posts, err := s.loadPosts(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	rss, atom, jf, err := feeds.RSSAtomJSONBytes(h.BaseURL, h, posts)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	setCacheFeeds(w)
	switch r.URL.Path {
	case "/feed.xml":
		w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
		s.writeBytes(w, "feed rss", rss)
	case "/atom.xml":
		w.Header().Set("Content-Type", "application/atom+xml; charset=utf-8")
		s.writeBytes(w, "feed atom", atom)
	case "/feed.json":
		w.Header().Set("Content-Type", "application/feed+json; charset=utf-8")
		s.writeBytes(w, "feed json", jf)
	}
}

func (s *Server) signingPubDeployed() bool {
	pub := filepath.Join(s.root, "content", "blog", "signing.pub")
	if _, err := os.Stat(pub); err == nil {
		return true
	}
	return false
}

func (s *Server) handleSigningPub(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	path := filepath.Join(s.root, "content", "blog", "signing.pub")
	b, err := os.ReadFile(path)
	if err == nil {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		setCacheSigningPubOK(w)
		s.writeBytes(w, "signing.pub file", b)
		return
	}
	if s.store != nil {
		ctx := r.Context()
		keys, err := s.store.ListPGPKeys(ctx)
		if err == nil && len(keys) > 0 {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			setCacheSigningPubOK(w)
			s.writeBytes(w, "signing.pub db", []byte(keys[0].Armored))
			return
		}
	}
	http.NotFound(w, r)
}

func (s *Server) handlePGPStatic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.store == nil {
		http.NotFound(w, r)
		return
	}
	ctx := r.Context()
	if r.URL.Path == "/pgp/keys.json" {
		keys, err := s.store.ListPGPKeys(ctx)
		if err != nil {
			s.httpErrorInternal500(w, err)
			return
		}
		type row struct {
			Fingerprint16 string `json:"fingerprint16"`
			FullKeyID     string `json:"full_key_id,omitempty"`
			URL           string `json:"url"`
			Label         string `json:"label,omitempty"`
		}
		out := make([]row, 0, len(keys))
		for _, k := range keys {
			out = append(out, row{
				Fingerprint16: k.Fingerprint16,
				FullKeyID:     k.FullKeyID,
				URL:           "/pgp/key/" + strings.ToLower(k.Fingerprint16) + ".asc",
				Label:         k.Label,
			})
		}
		setCachePGPKeysJSON(w)
		s.writeJSON(w, http.StatusOK, out)
		return
	}
	const pfx = "/pgp/key/"
	if strings.HasPrefix(r.URL.Path, pfx) && strings.HasSuffix(r.URL.Path, ".asc") {
		fp := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, pfx), ".asc")
		arm, err := s.store.PGPPublicKeyArmoredByFingerprint16(ctx, fp)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		setCachePGPKeyAsc(w)
		s.writeBytes(w, "pgp key asc", []byte(arm))
		return
	}
	http.NotFound(w, r)
}

func (s *Server) handleLogTree(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	trim := strings.TrimPrefix(r.URL.Path, "/log/")
	trim = strings.TrimSuffix(trim, "/")
	parts := strings.Split(trim, "/")
	if len(parts) == 1 && parts[0] == "" {
		s.renderLogIndex(w, r, ctx, "all")
		return
	}
	if len(parts) >= 2 && parts[0] == "tags" {
		s.renderLogIndex(w, r, ctx, parts[1])
		return
	}
	if len(parts) >= 1 && parts[0] != "" {
		slug := parts[0]
		if len(parts) == 1 {
			s.renderPostHTML(w, r, ctx, slug)
			return
		}
		if len(parts) == 2 {
			switch parts[1] {
			case "source.md":
				s.servePostSourceMD(w, r, ctx, slug)
				return
			case "source.md.minisig":
				s.servePostMinisig(w, r, ctx, slug)
				return
			case "source.openpgp.asc":
				s.servePostOpenPGPSig(w, r, ctx, slug)
				return
			}
		}
	}
	http.NotFound(w, r)
}

func (s *Server) renderLogIndex(w http.ResponseWriter, r *http.Request, ctx context.Context, filter string) {
	title := "ELVISH — /log"
	if filter != "" && filter != "all" {
		title = fmt.Sprintf("ELVISH — /log (%s)", filter)
	}
	h, err := s.loadHome(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	md := markdown.NewRenderer()
	introHTML, err := md.ToHTML([]byte(h.LogPage.IntroMarkdown))
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	posts, err := s.loadPosts(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	tweakJSON := []byte(s.marshalTweakDefaultsJSON(r, h))
	first, latest, ec := logDates(posts)
	filtered := blog.FilterByTag(posts, filter)
	activeFilter := filter
	if activeFilter == "" {
		activeFilter = "all"
	}
	setNavActive(h, "log")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	setCacheHTMLDocument(w, r)
	if err := s.eng.Log(w, &render.LogPage{
		Site:          h,
		Title:         title,
		Description:   h.Description,
		Posts:         filtered,
		Filters:       h.LogPage.Filters,
		ActiveFilter:  activeFilter,
		IntroHTML:     template.HTML(introHTML),
		TweakDefaults: template.JS(tweakJSON),
		Ticker:        h.LogPage.Ticker,
		ActiveNav:     "log",
		FirstDate:     first,
		LatestDate:    latest,
		EntryCount:    ec,
		NavAuth:       s.navAuthFromRequest(r),
	}); err != nil {
		s.log.Error("render log index", "err", err)
	}
}

func (s *Server) renderPostHTML(w http.ResponseWriter, r *http.Request, ctx context.Context, slug string) {
	h, err := s.loadHome(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	posts, err := s.loadPosts(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	var p *blog.Post
	for i := range posts {
		if posts[i].Slug == slug {
			p = &posts[i]
			break
		}
	}
	if p == nil {
		http.NotFound(w, r)
		return
	}
	tweakJSON := []byte(s.marshalTweakDefaultsJSON(r, h))
	setNavActive(h, "log")
	deployed := s.signingPubDeployed() || (s.store != nil && func() bool {
		k, e := s.store.ListPGPKeys(ctx)
		return e == nil && len(k) > 0
	}())
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	setCacheHTMLDocument(w, r)
	if err := s.eng.Post(w, &render.PostPage{
		Site:               h,
		Title:              p.Title + " — ELVISH",
		Description:        h.Description,
		Post:               *p,
		TweakDefaults:      template.JS(tweakJSON),
		ActiveNav:          "log",
		SigningPubURL:      h.SigningPubHref(),
		SigningPubDeployed: deployed,
		OpenPGP:            openPGPTemplateFromPost(*p, slug),
		NavAuth:            s.navAuthFromRequest(r),
	}); err != nil {
		s.log.Error("render post", "slug", slug, "err", err)
	}
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.clearBrowserSession(w, r)
	redirectSafePath(w, r, r.FormValue("next"), http.StatusSeeOther)
}

// serveAuthHTML serves /login and /register (static/auth/*.html).
func (s *Server) serveAuthHTML(w http.ResponseWriter, r *http.Request, file string) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	setSecureAuthHTMLPageHeaders(w)
	setCacheAuthHTML(w, r)
	http.ServeFile(w, r, filepath.Join(s.staticRoot, "auth", file))
}

// serveAuthCapEmbed serves static/auth/cap-embed.html for native login WebViews.
// Uses the same relaxed auth CSP as /login so the Cap widget can reach https endpoints and WASM.
func (s *Server) serveAuthCapEmbed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	setSecureAuthHTMLPageHeaders(w)
	setCacheAuthHTML(w, r)
	http.ServeFile(w, r, filepath.Join(s.staticRoot, "auth", "cap-embed.html"))
}

// serveMailUI serves the minimal E2EE mail client shell (static/mail/index.html).
func (s *Server) serveMailUI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	setSecureAppPageHeaders(w)
	setCacheAuthHTML(w, r)
	http.ServeFile(w, r, filepath.Join(s.staticRoot, "mail", "index.html"))
}

// serveProtectedLinkUI serves the public recipient page that decrypts a Mode-B
// payload entirely in the browser. No session cookie, no DB read here: the
// underlying ciphertext + KDF parameters are fetched via /api/v1/protected-links.
func (s *Server) serveProtectedLinkUI(w http.ResponseWriter, r *http.Request, _ string) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	setSecureAppPageHeaders(w)
	setCacheAuthHTML(w, r)
	http.ServeFile(w, r, filepath.Join(s.staticRoot, "protected", "index.html"))
}

func (s *Server) servePostSourceMD(w http.ResponseWriter, r *http.Request, ctx context.Context, slug string) {
	if s.store != nil {
		doc, err := s.store.GetPostBySlug(ctx, slug)
		if err == nil && doc != nil {
			w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
			setCachePostSourceMD(w)
			s.writeBytes(w, "post source md db", []byte(doc.BodyMarkdown))
			return
		}
	}
	posts, err := s.loadPosts(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	for i := range posts {
		if posts[i].Slug == slug && posts[i].SourcePath != "" {
			b, err := os.ReadFile(posts[i].SourcePath)
			if err != nil {
				break
			}
			w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
			setCachePostSourceMD(w)
			s.writeBytes(w, "post source md disk", b)
			return
		}
	}
	http.NotFound(w, r)
}

func (s *Server) servePostMinisig(w http.ResponseWriter, r *http.Request, ctx context.Context, slug string) {
	posts, err := s.loadPosts(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	for i := range posts {
		if posts[i].Slug == slug && posts[i].SourcePath != "" {
			b, err := os.ReadFile(posts[i].SourcePath + ".minisig")
			if err != nil {
				break
			}
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			setCachePostMinisig(w)
			s.writeBytes(w, "post minisig", b)
			return
		}
	}
	http.NotFound(w, r)
}

func (s *Server) servePostOpenPGPSig(w http.ResponseWriter, r *http.Request, ctx context.Context, slug string) {
	if s.store == nil {
		http.NotFound(w, r)
		return
	}
	doc, err := s.store.GetPostBySlug(ctx, slug)
	if err != nil || doc == nil || strings.TrimSpace(doc.DetachedOpenPGPSig) == "" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	setCachePostOpenPGPSig(w)
	s.writeBytes(w, "post openpgp sig", []byte(doc.DetachedOpenPGPSig))
}

func (s *Server) serveStaticFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	rel := strings.TrimPrefix(r.URL.Path, "/")
	if rel == "" || strings.Contains(rel, "..") {
		http.NotFound(w, r)
		return
	}
	full := filepath.Join(s.staticRoot, filepath.FromSlash(rel))
	fi, err := os.Stat(full)
	if err != nil || fi.IsDir() {
		http.NotFound(w, r)
		return
	}
	if rel == "sw.js" {
		s.emitServiceWorker(w, r)
		return
	}
	if isOperatorDistAsset(rel) && legacyConsoleEnabled() && !s.requireAdminUIAccess(w, r, adminUIAuthAsset) {
		return
	}
	setCacheStaticFromPath(w, r, rel)
	http.ServeFile(w, r, full)
}

func (s *Server) emitServiceWorker(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	h, err := s.loadHome(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	body, err := os.ReadFile(filepath.Join(s.staticRoot, "sw.js"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	q := ""
	if s := strings.TrimSpace(h.HashShort); s != "" {
		q = "?v=" + s
	} else if s := strings.TrimSpace(h.Version); s != "" {
		q = "?v=" + strings.ReplaceAll(s, " ", "-")
	}
	ver := strings.TrimSpace(h.HashShort)
	if ver == "" {
		ver = strings.ReplaceAll(strings.TrimSpace(h.Version), " ", "-")
	}
	if ver == "" {
		ver = "dev"
	}
	var buf bytes.Buffer
	fmt.Fprintf(&buf, "self.__ELVISH_ASSET_Q__=%s;\n", strconv.Quote(q))
	fmt.Fprintf(&buf, "self.__ELVISH_SW_VER__=%s;\n", strconv.Quote(ver))
	buf.Write(body)
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	setCacheServiceWorker(w)
	if _, err := io.Copy(w, &buf); err != nil {
		s.log.Warn("emit service worker", "err", err)
	}
}

func (s *Server) serveSecurityTxt(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	h, err := s.loadHome(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	base := strings.TrimSpace(h.BaseURL)
	canonical := "https://example.com/.well-known/security.txt"
	if base != "" {
		canonical = strings.TrimSuffix(base, "/") + "/.well-known/security.txt"
	}
	var b strings.Builder
	rows := h.Support.PublicSupportRows()
	if len(rows) == 0 {
		fb := base
		if fb == "" {
			fb = "https://example.com"
		}
		fmt.Fprintf(&b, "Contact: %s\n", fb)
	} else {
		for _, row := range rows {
			fmt.Fprintf(&b, "Contact: mailto:%s\n", row.Email)
		}
	}
	fmt.Fprintf(&b, "Preferred-Languages: en\n")
	fmt.Fprintf(&b, "Canonical: %s\n", canonical)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	if r.Method == http.MethodGet {
		if _, err := io.WriteString(w, b.String()); err != nil {
			s.log.Warn("write security.txt", "err", err)
		}
	}
}

func (s *Server) serveAdminOrStatic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	target := strings.TrimSpace(os.Getenv("ELVISH_CONSOLE_PUBLIC_URL"))
	if target == "" {
		target = "http://127.0.0.1:8780"
	}
	http.Redirect(w, r, strings.TrimRight(target, "/")+"/", http.StatusFound)
}
