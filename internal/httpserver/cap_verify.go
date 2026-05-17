package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	capMaxWidgetEndpointLen = 2048
	capMaxSecretLen         = 512
	capMaxTokenLen          = 16384
	capVerifyTimeout        = 10 * time.Second
)

// capSiteVerifyURL returns the Cap instance siteverify URL for a widget API endpoint
// of the form https://host/<site-key>/ (origin + /siteverify).
func capSiteVerifyURL(widgetAPIEndpoint string) (string, error) {
	raw := strings.TrimSpace(widgetAPIEndpoint)
	if len(raw) == 0 || len(raw) > capMaxWidgetEndpointLen {
		return "", errors.New("invalid widget endpoint")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Host == "" {
		return "", errors.New("invalid widget endpoint")
	}
	return u.Scheme + "://" + u.Host + "/siteverify", nil
}

type capVerifyJSON struct {
	Success bool `json:"success"`
}

// verifyCapTokenPOST checks a Cap token against the instance siteverify endpoint
// using the reCAPTCHA-compatible form body (secret + response).
func verifyCapTokenPOST(ctx context.Context, httpClient *http.Client, verifyURL, secret, token string) error {
	if httpClient == nil {
		return errors.New("nil http client")
	}
	secret = strings.TrimSpace(secret)
	token = strings.TrimSpace(token)
	if len(secret) == 0 || len(secret) > capMaxSecretLen {
		return errors.New("invalid secret")
	}
	if len(token) == 0 || len(token) > capMaxTokenLen {
		return errors.New("invalid token")
	}
	form := url.Values{}
	form.Set("secret", secret)
	form.Set("response", token)

	ctx, cancel := context.WithTimeout(ctx, capVerifyTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, verifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("siteverify status %d", resp.StatusCode)
	}
	var out capVerifyJSON
	if err := json.Unmarshal(body, &out); err != nil {
		return err
	}
	if !out.Success {
		return errors.New("verification failed")
	}
	return nil
}
