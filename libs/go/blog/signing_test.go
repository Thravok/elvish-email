package blog

import (
	"crypto/rand"
	"errors"
	"os"
	"path/filepath"
	"testing"

	aead "aead.dev/minisign"
	"elvish/libs/go/markdown"
)

func TestLoadPosts_MinisignVerify_ValidSig_OK(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	pub, priv, err := aead.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	pubPath := filepath.Join(dir, "signing.pub")
	pubPEM, err := pub.MarshalText()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(pubPath, pubPEM, 0o644); err != nil {
		t.Fatal(err)
	}

	const md = `---
title: Signed test
date: 2026-01-15
tags: [test]
---
Hello **signed** world.
`
	mdPath := filepath.Join(dir, "2026-01-15-signed-test.md")
	if err := os.WriteFile(mdPath, []byte(md), 0o644); err != nil {
		t.Fatal(err)
	}
	sig := aead.SignWithComments(priv, []byte(md), "trusted:test", "untrusted")
	if err := os.WriteFile(mdPath+".minisig", sig, 0o644); err != nil {
		t.Fatal(err)
	}

	mdr := markdown.NewRenderer()
	posts, err := LoadPosts(dir, mdr, nil, &SigningLoadOpts{VerifyPubPath: pubPath})
	if err != nil {
		t.Fatal(err)
	}
	if len(posts) != 1 {
		t.Fatalf("posts: got %d want 1", len(posts))
	}
	p := posts[0]
	if !p.Signing.HasSignature || !p.Signing.VerifiedOK {
		t.Fatalf("signing: %+v", p.Signing)
	}
	if p.Signing.PubKeyIDHex == "" || p.Signing.SigKeyIDHex == "" {
		t.Fatalf("key ids: %+v", p.Signing)
	}
	if p.SourcePath != mdPath {
		t.Fatalf("SourcePath: %q", p.SourcePath)
	}
}

func TestSigningLoadOpts_RequireSignedWithoutVerify_ReturnsErrRequireSignedNeedsVerifyPubPath(t *testing.T) {
	t.Parallel()
	_, err := LoadPosts(t.TempDir(), markdown.NewRenderer(), nil, &SigningLoadOpts{RequireSigned: true})
	if err == nil || !errors.Is(err, ErrRequireSignedNeedsVerifyPubPath) {
		t.Fatalf("expected ErrRequireSignedNeedsVerifyPubPath, got %v", err)
	}
}

func TestLoadPosts_RequireSignedMissingSig_ReturnsError(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	pubPath := filepath.Join(dir, "signing.pub")
	if err := os.WriteFile(pubPath, []byte("invalid"), 0o644); err != nil {
		t.Fatal(err)
	}
	mdPath := filepath.Join(dir, "2026-01-10-a.md")
	content := "---\ntitle: A\ndate: 2026-01-10\ntags: []\n---\n\nx\n"
	if err := os.WriteFile(mdPath, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err := LoadPosts(dir, markdown.NewRenderer(), nil, &SigningLoadOpts{
		VerifyPubPath: pubPath,
		RequireSigned: true,
	})
	if err == nil {
		t.Fatal("expected error for missing signature")
	}
}
