package elvishboot

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"elvish/libs/go/db"
	"elvish/libs/go/scyllastore"
)

const healthcheckTimeout = 5 * time.Second

// RunHealthcheck probes a running process for the given role and exits 0 on success.
// Intended for Docker HEALTHCHECK (separate short-lived invocation, not full boot).
func RunHealthcheck(role Role, flags Flags) error {
	ctx, cancel := context.WithTimeout(context.Background(), healthcheckTimeout)
	defer cancel()

	switch role {
	case RoleAPI:
		return probeHTTPHealth(ctx, flags.Addr)
	case RoleMTA:
		if envTruthy("ELVISH_HTTP_ENABLED") {
			return probeHTTPHealth(ctx, flags.Addr)
		}
		if err := probeTCPAddr(ctx, os.Getenv("ELVISH_SMTP_ADDR")); err != nil {
			return err
		}
		return probeTCPAddr(ctx, os.Getenv("ELVISH_SMTP_SUBMISSION_ADDR"))
	case RoleWorker:
		return probeWorkerBackends(ctx)
	default:
		return fmt.Errorf("healthcheck: unknown role %s", role.String())
	}
}

func probeHTTPHealth(ctx context.Context, listenAddr string) error {
	target, err := httpHealthURL(listenAddr)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return fmt.Errorf("healthcheck http request: %w", err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("healthcheck http get: %w", err)
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("healthcheck http status: %d", res.StatusCode)
	}
	return nil
}

func httpHealthURL(listenAddr string) (string, error) {
	hostPort, err := loopbackDialAddr(listenAddr)
	if err != nil {
		return "", err
	}
	return "http://" + hostPort + "/api/healthz", nil
}

func probeTCPAddr(ctx context.Context, listenAddr string) error {
	addr, err := loopbackDialAddr(listenAddr)
	if err != nil {
		return err
	}
	d := net.Dialer{Timeout: healthcheckTimeout}
	conn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("healthcheck tcp dial %s: %w", addr, err)
	}
	return conn.Close()
}

func loopbackDialAddr(listenAddr string) (string, error) {
	a := strings.TrimSpace(listenAddr)
	if a == "" {
		return "", fmt.Errorf("healthcheck: empty listen address")
	}
	if strings.HasPrefix(a, ":") {
		return "127.0.0.1" + a, nil
	}
	host, port, err := net.SplitHostPort(a)
	if err != nil {
		return "", fmt.Errorf("healthcheck: parse address %q: %w", a, err)
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		return net.JoinHostPort("127.0.0.1", port), nil
	}
	if host == "[::]" {
		return net.JoinHostPort("127.0.0.1", port), nil
	}
	return a, nil
}

func probeWorkerBackends(ctx context.Context) error {
	cfg := db.LoadConfigFromEnv()
	bundle, err := db.Open(cfg)
	if err != nil {
		return fmt.Errorf("healthcheck worker db open: %w", err)
	}
	defer func() { _ = bundle.Close(ctx) }()
	if err := bundle.Health(ctx); err != nil {
		return fmt.Errorf("healthcheck worker sql/valkey: %w", err)
	}
	if !cfg.ScyllaEnabled() {
		return nil
	}
	scy, err := scyllastore.Open(scyllastore.Config{
		Hosts:    cfg.ScyllaHosts,
		Keyspace: cfg.ScyllaKeyspace,
		Username: cfg.ScyllaUsername,
		Password: cfg.ScyllaPassword,
		LocalDC:  cfg.ScyllaLocalDC,
		Timeout:  healthcheckTimeout,
	})
	if err != nil {
		return fmt.Errorf("healthcheck worker scylla open: %w", err)
	}
	defer scy.Close()
	if err := scy.Health(ctx); err != nil {
		return fmt.Errorf("healthcheck worker scylla: %w", err)
	}
	return nil
}
