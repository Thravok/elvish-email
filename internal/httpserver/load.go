package httpserver

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"elvish/internal/blog"
	"elvish/internal/config"
	"elvish/internal/markdown"
	"elvish/internal/models"
	"elvish/internal/openpgp"
	"elvish/internal/render"
)

func (s *Server) loadMetrics() (map[string]blog.EntryMetrics, error) {
	p := filepath.Join(s.root, "content", "blog", "metrics.json")
	return blog.LoadMetricsJSON(p)
}

func (s *Server) loadHomeUncached(ctx context.Context) (*config.Home, error) {
	path := filepath.Join(s.root, "content", "home.json")
	h, err := config.LoadHome(path)
	if err != nil {
		return nil, err
	}
	if s.store == nil {
		return h, nil
	}
	override, err := s.store.GetSiteHomeJSON(ctx)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(override) == "" {
		return h, nil
	}
	return config.ParseHomeJSON([]byte(override))
}

func (s *Server) loadHome(ctx context.Context) (*config.Home, error) {
	ttl := s.contentCacheTTL()
	if ttl > 0 {
		s.contentMu.RLock()
		if s.cachedHome != nil && time.Now().Before(s.cachedHomeExp) {
			h := cloneHomeForRender(s.cachedHome)
			s.contentMu.RUnlock()
			return h, nil
		}
		s.contentMu.RUnlock()
	}
	h, err := s.loadHomeUncached(ctx)
	if err != nil {
		return nil, err
	}
	clearNavInactive(h)
	if ttl > 0 {
		s.contentMu.Lock()
		s.cachedHome = h
		s.cachedHomeExp = time.Now().Add(ttl)
		s.contentMu.Unlock()
	}
	return cloneHomeForRender(h), nil
}

func (s *Server) loadPostsUncached(ctx context.Context) ([]blog.Post, error) {
	metrics, err := s.loadMetrics()
	if err != nil {
		return nil, err
	}
	md := markdown.NewRenderer()
	signingOpts := (*blog.SigningLoadOpts)(nil)
	pubPath := filepath.Join(s.root, "content", "blog", "signing.pub")
	if fi, err := os.Stat(pubPath); err == nil && !fi.IsDir() {
		signingOpts = &blog.SigningLoadOpts{VerifyPubPath: pubPath}
	}
	if s.store == nil {
		return blog.LoadPosts(filepath.Join(s.root, "content", "blog"), md, metrics, signingOpts)
	}
	n, err := s.store.PostCount(ctx)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return blog.LoadPosts(filepath.Join(s.root, "content", "blog"), md, metrics, nil)
	}
	docs, err := s.store.ListPosts(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]blog.Post, 0, len(docs))
	for i := range docs {
		p, err := s.blogPostFromStoreDoc(ctx, &docs[i], metrics, md)
		if err != nil {
			return nil, fmt.Errorf("post %q: %w", docs[i].Slug, err)
		}
		out = append(out, p)
	}
	return out, nil
}

func (s *Server) loadPosts(ctx context.Context) ([]blog.Post, error) {
	ttl := s.contentCacheTTL()
	if ttl > 0 {
		s.contentMu.RLock()
		if s.cachedPosts != nil && time.Now().Before(s.cachedPostsExp) {
			out := append([]blog.Post(nil), s.cachedPosts...)
			s.contentMu.RUnlock()
			return out, nil
		}
		s.contentMu.RUnlock()
	}
	posts, err := s.loadPostsUncached(ctx)
	if err != nil {
		return nil, err
	}
	if ttl > 0 {
		snap := append([]blog.Post(nil), posts...)
		s.contentMu.Lock()
		s.cachedPosts = snap
		s.cachedPostsExp = time.Now().Add(ttl)
		s.contentMu.Unlock()
		return append([]blog.Post(nil), posts...), nil
	}
	return posts, nil
}

func (s *Server) blogPostFromStoreDoc(ctx context.Context, bp *models.BlogPost, metrics map[string]blog.EntryMetrics, md *markdown.Renderer) (blog.Post, error) {
	hint := filepath.Join("db", bp.Slug+".md")
	post, skip, err := blog.ParsePostMarkdown(hint, []byte(bp.BodyMarkdown), md, metrics, nil)
	if err != nil {
		return post, err
	}
	if skip {
		return post, fmt.Errorf("unexpected draft in db: %s", bp.Slug)
	}
	post.BootstrapBody = bp.BodyMarkdown
	post.SourcePath = ""
	post.DetachedOpenPGPArmored = strings.TrimSpace(bp.DetachedOpenPGPSig)
	post.DetachedMinisigASCII = strings.TrimSpace(bp.DetachedMinisig)

	if strings.TrimSpace(bp.DetachedOpenPGPSig) == "" && strings.TrimSpace(bp.DetachedMinisig) != "" {
		pubPath := filepath.Join(s.root, "content", "blog", "signing.pub")
		if fi, err := os.Stat(pubPath); err != nil || fi.IsDir() {
			post.Signing = blog.PostSigning{
				HasSignature: true,
				VerifiedOK:   false,
				ErrMsg:       "content/blog/signing.pub missing on server; cannot verify minisig",
			}
		} else {
			st, err := blog.VerifyMinisigDetached(pubPath, []byte(bp.BodyMarkdown), []byte(strings.TrimSpace(bp.DetachedMinisig)))
			if err != nil {
				return post, fmt.Errorf("minisign verify %q: %w", bp.Slug, err)
			}
			post.Signing = st
		}
		return post, nil
	}
	if strings.TrimSpace(bp.DetachedOpenPGPSig) == "" {
		return post, nil
	}
	body := []byte(bp.BodyMarkdown)
	sig := []byte(bp.DetachedOpenPGPSig)
	fpHint := strings.TrimSpace(strings.ToUpper(bp.OpenPGPKeyID))
	var armored string
	var fp string
	if fpHint != "" {
		a, err := s.store.PGPPublicKeyArmoredByFingerprint16(ctx, fpHint)
		if err != nil {
			post.OpenPGP = blog.PostOpenPGP{HasSignature: true, VerifiedOK: false, KeyFingerprint: fpHint, ErrMsg: "public key not found"}
			return post, nil
		}
		armored, fp = a, fpHint
	} else {
		keys, err := s.store.ListPGPKeys(ctx)
		if err != nil || len(keys) == 0 {
			post.OpenPGP = blog.PostOpenPGP{HasSignature: true, VerifiedOK: false, ErrMsg: "no public keys uploaded"}
			return post, nil
		}
		for _, k := range keys {
			if err := openpgp.VerifyDetached(k.Armored, body, sig); err == nil {
				armored, fp = k.Armored, k.Fingerprint16
				break
			}
		}
		if armored == "" {
			post.OpenPGP = blog.PostOpenPGP{HasSignature: true, VerifiedOK: false, ErrMsg: "signature does not match any uploaded key"}
			return post, nil
		}
	}
	verr := openpgp.VerifyDetached(armored, body, sig)
	verified := verr == nil
	errMsg := ""
	if verr != nil {
		errMsg = verr.Error()
	}
	meta, metaErr := openpgp.ParseArmoredPublicKeyMeta(armored)
	if metaErr != nil {
		s.log.Warn("openpgp parse key meta", "slug", bp.Slug, "err", metaErr)
	}
	displayFP := fp
	if meta != nil && meta.Fingerprint16 != "" {
		displayFP = meta.Fingerprint16
	}
	post.OpenPGP = blog.PostOpenPGP{
		HasSignature:   true,
		VerifiedOK:     verified,
		KeyFingerprint: displayFP,
		ErrMsg:         errMsg,
	}
	return post, nil
}

func openPGPTemplateFromPost(p blog.Post, slug string) *render.OpenPGPSection {
	if !p.OpenPGP.HasSignature {
		return nil
	}
	sec := &render.OpenPGPSection{
		HasSignature: true,
		VerifiedOK:   p.OpenPGP.VerifiedOK,
		Fingerprint:  p.OpenPGP.KeyFingerprint,
		ErrMsg:       p.OpenPGP.ErrMsg,
		SigURL:       "/log/" + slug + "/source.openpgp.asc",
	}
	if fp := strings.TrimSpace(strings.ToLower(p.OpenPGP.KeyFingerprint)); fp != "" {
		sec.KeyURL = "/pgp/key/" + fp + ".asc"
	}
	return sec
}
