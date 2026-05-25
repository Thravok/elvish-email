package keyserver

import (
	"net/http"
)

func doWKDFetch(hc *http.Client, req *http.Request, fetchURL wkdHTTPSURL) (*http.Response, error) {
	if req == nil || req.URL == nil || req.URL.String() != fetchURL.String() {
		return nil, ErrNotFound
	}
	return hc.Do(req) //codeql[go/request-forgery]: WKD URL built only from wkdDomainOK-checked domain via newWKD*URL.
}
