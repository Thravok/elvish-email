package keyserver

import (
	"fmt"
	"net/url"
)

// wkdHTTPSURL is a WKD fetch URL whose host passed wkdDomainOK.
type wkdHTTPSURL string

func (u wkdHTTPSURL) String() string { return string(u) }

func newWKDAdvancedURL(domain, hash, local string) (wkdHTTPSURL, error) {
	if err := wkdDomainOK(domain); err != nil {
		return "", err
	}
	u := &url.URL{
		Scheme:   "https",
		Host:     "openpgpkey." + domain,
		Path:     fmt.Sprintf("/.well-known/openpgpkey/%s/hu/%s", domain, hash),
		RawQuery: url.Values{"l": {local}}.Encode(),
	}
	return wkdHTTPSURL(u.String()), nil
}

func newWKDDirectURL(domain, hash, local string) (wkdHTTPSURL, error) {
	if err := wkdDomainOK(domain); err != nil {
		return "", err
	}
	u := &url.URL{
		Scheme:   "https",
		Host:     domain,
		Path:     fmt.Sprintf("/.well-known/openpgpkey/hu/%s", hash),
		RawQuery: url.Values{"l": {local}}.Encode(),
	}
	return wkdHTTPSURL(u.String()), nil
}
