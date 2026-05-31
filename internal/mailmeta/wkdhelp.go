package mailmeta

import (
	"crypto/sha1"
	"strings"
)

// zBase32Alphabet per the WKD draft.
const zBase32Alphabet = "ybndrfg8ejkmcpqxot1uwisza345h769"

// hashLocalPart computes the WKD Z-Base-32(SHA-1) of a lowercased local-part.
// Duplicated from internal/openpgp.WKDLocalPartHash to avoid an import cycle.
func hashLocalPart(localPart string) string {
	lp := strings.ToLower(strings.TrimSpace(localPart))
	sum := sha1.Sum([]byte(lp))
	return zBase32(sum[:])
}

func zBase32(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	out := make([]byte, 0, (len(data)*8+4)/5)
	var buf uint64
	bits := 0
	for _, b := range data {
		buf = (buf << 8) | uint64(b)
		bits += 8
		for bits >= 5 {
			bits -= 5
			out = append(out, zBase32Alphabet[(buf>>uint(bits))&0x1F])
		}
	}
	if bits > 0 {
		out = append(out, zBase32Alphabet[(buf<<uint(5-bits))&0x1F])
	}
	return string(out)
}

func lastAt(s string) int {
	return strings.LastIndex(s, "@")
}
