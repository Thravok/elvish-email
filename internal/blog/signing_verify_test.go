package blog

import (
	"crypto/rand"
	"os"
	"path/filepath"
	"testing"

	aead "aead.dev/minisign"
	"elvish/internal/markdown"
)

func TestLoadPosts_MinisignBadSig_SoftFailWithoutRequireSigned(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	pub, _, err := aead.GenerateKey(rand.Reader)
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
	_, otherPriv, err := aead.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	const md = `---
title: Bad sig
date: 2026-02-01
tags: [test]
---
Body
`
	mdPath := filepath.Join(dir, "2026-02-01-bad.md")
	if err := os.WriteFile(mdPath, []byte(md), 0o644); err != nil {
		t.Fatal(err)
	}
	sig := aead.SignWithComments(otherPriv, []byte(md), "x", "y")
	if err := os.WriteFile(mdPath+".minisig", sig, 0o644); err != nil {
		t.Fatal(err)
	}
	posts, err := LoadPosts(dir, markdown.NewRenderer(), nil, &SigningLoadOpts{VerifyPubPath: pubPath})
	if err != nil {
		t.Fatal(err)
	}
	if len(posts) != 1 || !posts[0].Signing.HasSignature || posts[0].Signing.VerifiedOK {
		t.Fatalf("want one post with bad sig, got %+v err=%v", posts[0].Signing, err)
	}
}
