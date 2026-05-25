package keyserver

import (
	"net/http"
)

func doWKDFetch(hc *http.Client, req *http.Request, fetchURL wkdHTTPSURL) (*http.Response, error) {
	if req == nil || req.URL == nil || req.URL.String() != fetchURL.String() {
		return nil, ErrNotFound
	}
	// codeql[go/request-forgery]: WKD fetch URL host was validated by wkdDomainOK before request construction.
	return hc.Do(req)
}
