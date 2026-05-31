package mailauth

import (
	"bytes"
	"strings"

	"github.com/emersion/go-msgauth/dkim"
)

// checkDKIM verifies DKIM signatures on the raw RFC822 message when present.
func checkDKIM(raw []byte) string {
	if len(raw) == 0 {
		return "none"
	}
	if !bytes.Contains(bytes.ToLower(raw), []byte("dkim-signature:")) {
		return "none"
	}
	_, err := dkim.Verify(bytes.NewReader(raw))
	if err == nil {
		return "pass"
	}
	if strings.Contains(err.Error(), "no signature") {
		return "none"
	}
	return "fail"
}
