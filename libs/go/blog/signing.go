package blog

import (
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	jed "github.com/jedisct1/go-minisign"
)

// SigningLoadOpts controls optional minisign verification while loading posts.
type SigningLoadOpts struct {
	// VerifyPubPath is a path to the minisign public key file (e.g. content/blog/signing.pub).
	// When non-empty, each post with a sidecar *.md.minisig is verified against the raw markdown bytes.
	VerifyPubPath string
	// RequireSigned causes LoadPosts to fail if any non-draft post is missing a detached signature
	// or has an invalid one (after VerifyPubPath verification). Requires VerifyPubPath.
	RequireSigned bool
}

// PostSigning describes a detached minisign signature over the exact on-disk markdown source bytes.
type PostSigning struct {
	HasSignature bool
	VerifiedOK   bool
	PubKeyIDHex  string // verifying key id (hex), when verification ran
	SigKeyIDHex  string // key id embedded in the signature
	TrustedLine  string // trusted comment payload (e.g. timestamp:...)
	ErrMsg       string // set when verification was attempted and failed
}

// KeyIDHexLE formats an 8-byte minisign key id the same way as the reference implementation (LE uint64, uppercase hex).
func KeyIDHexLE(id [8]byte) string {
	return fmt.Sprintf("%016X", binary.LittleEndian.Uint64(id[:]))
}

func parseSigning(contentRoot, mdPath string, raw []byte, opts *SigningLoadOpts) (PostSigning, error) {
	var out PostSigning
	if strings.TrimSpace(contentRoot) == "" {
		if opts != nil && opts.RequireSigned {
			return out, fmt.Errorf("require signed: content root is required to load minisig sidecars")
		}
		return out, nil
	}
	rootAbs, err := filepath.Abs(filepath.Clean(contentRoot))
	if err != nil {
		return out, fmt.Errorf("content root: %w", err)
	}
	mdAbs, err := filepath.Abs(filepath.Clean(mdPath))
	if err != nil {
		return out, fmt.Errorf("markdown path: %w", err)
	}
	rel, err := filepath.Rel(rootAbs, mdAbs)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return out, fmt.Errorf("markdown path outside content root")
	}
	sigPath := mdAbs + ".minisig"
	sigBytes, err := os.ReadFile(sigPath)
	if err != nil {
		if os.IsNotExist(err) {
			if opts != nil && opts.RequireSigned {
				return out, fmt.Errorf("%s: missing detached signature %s (require signed posts)", mdPath, sigPath)
			}
			return out, nil
		}
		return out, fmt.Errorf("%s: read signature: %w", sigPath, err)
	}
	out.HasSignature = true
	jsig, err := jed.DecodeSignature(string(sigBytes))
	if err != nil {
		return out, fmt.Errorf("%s: %w", sigPath, err)
	}
	out.SigKeyIDHex = KeyIDHexLE(jsig.KeyId)
	out.TrustedLine = strings.TrimSpace(strings.TrimPrefix(jsig.TrustedComment, "trusted comment: "))

	if opts == nil || strings.TrimSpace(opts.VerifyPubPath) == "" {
		return out, nil
	}
	v, err := VerifyMinisigDetached(opts.VerifyPubPath, raw, sigBytes)
	if err != nil {
		return out, fmt.Errorf("%s: verify minisig: %w", mdPath, err)
	}
	out.PubKeyIDHex = v.PubKeyIDHex
	out.VerifiedOK = v.VerifiedOK
	out.ErrMsg = v.ErrMsg
	if opts.RequireSigned && out.HasSignature && !out.VerifiedOK {
		msg := out.ErrMsg
		if msg == "" {
			msg = "invalid signature"
		}
		return out, fmt.Errorf("%s: minisign verification required but failed: %s", mdPath, msg)
	}
	return out, nil
}

// VerifyMinisigDetached verifies detached minisign ASCII over exact document bytes using a minisign public key file.
// A bad signature returns PostSigning with VerifiedOK=false and ErrMsg set, err nil.
func VerifyMinisigDetached(pubPath string, document []byte, sigASCII []byte) (PostSigning, error) {
	var out PostSigning
	sigASCII = []byte(strings.TrimSpace(string(sigASCII)))
	if len(sigASCII) == 0 {
		return out, nil
	}
	jsig, err := jed.DecodeSignature(string(sigASCII))
	if err != nil {
		out.HasSignature = true
		out.ErrMsg = err.Error()
		return out, nil
	}
	out.HasSignature = true
	out.SigKeyIDHex = KeyIDHexLE(jsig.KeyId)
	out.TrustedLine = strings.TrimSpace(strings.TrimPrefix(jsig.TrustedComment, "trusted comment: "))
	pub, err := jed.NewPublicKeyFromFile(pubPath)
	if err != nil {
		out.ErrMsg = fmt.Sprintf("public key: %v", err)
		return out, nil
	}
	out.PubKeyIDHex = KeyIDHexLE(pub.KeyId)
	ok, err := pub.Verify(document, jsig)
	if err != nil || !ok {
		out.VerifiedOK = false
		out.ErrMsg = "invalid signature"
		if err != nil {
			out.ErrMsg = err.Error()
		}
		return out, nil
	}
	out.VerifiedOK = true
	return out, nil
}
