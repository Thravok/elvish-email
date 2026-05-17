package openpgp

import (
	"crypto/sha1"
	"strings"
)

// zBase32Alphabet per RFC 6189 / Z-Base-32 (used by WKD per draft-koch-openpgp-webkey-service).
const zBase32Alphabet = "ybndrfg8ejkmcpqxot1uwisza345h769"

// WKDLocalPartHash returns the Z-Base-32 of SHA-1 of the lowercased local-part
// per draft-koch-openpgp-webkey-service-13 §3.1. Used to build the WKD URL.
func WKDLocalPartHash(localPart string) string {
	lp := strings.ToLower(strings.TrimSpace(localPart))
	sum := sha1.Sum([]byte(lp))
	return zBase32Encode(sum[:])
}

func zBase32Encode(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	bitLen := len(data) * 8
	outLen := (bitLen + 4) / 5
	out := make([]byte, 0, outLen)
	var buf uint64
	bits := 0
	for _, b := range data {
		buf = (buf << 8) | uint64(b)
		bits += 8
		for bits >= 5 {
			bits -= 5
			idx := byte((buf >> uint(bits)) & 0x1F)
			out = append(out, zBase32Alphabet[idx])
		}
	}
	if bits > 0 {
		idx := byte((buf << uint(5-bits)) & 0x1F)
		out = append(out, zBase32Alphabet[idx])
	}
	return string(out)
}
