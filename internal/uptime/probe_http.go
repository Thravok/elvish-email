package uptime

import (
	"fmt"
	"net/http"
)

// doValidatedProbeRequest executes hc.Do only when req targets the validated probe URL.
func doValidatedProbeRequest(hc *http.Client, req *http.Request, validated ValidatedProbeURL) (*http.Response, error) {
	if req == nil || req.URL == nil {
		return nil, fmt.Errorf("uptime: nil probe request")
	}
	if req.URL.String() != validated.String() {
		return nil, fmt.Errorf("uptime: probe request URL mismatch")
	}
	// codeql[go/request-forgery]: probe URL validated by NewValidatedProbeURL and matched to the request URL.
	return hc.Do(req)
}
