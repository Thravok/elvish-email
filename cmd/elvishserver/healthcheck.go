package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

const healthcheckTimeout = 5 * time.Second

func runHealthcheck(listenAddr string) error {
	ctx, cancel := context.WithTimeout(context.Background(), healthcheckTimeout)
	defer cancel()
	hostPort, err := loopbackDialAddr(listenAddr)
	if err != nil {
		return err
	}
	target := "http://" + hostPort + "/api/healthz"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return fmt.Errorf("healthcheck request: %w", err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("healthcheck get: %w", err)
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("healthcheck status: %d", res.StatusCode)
	}
	return nil
}

func loopbackDialAddr(listenAddr string) (string, error) {
	addr := strings.TrimSpace(listenAddr)
	if addr == "" {
		return "", fmt.Errorf("healthcheck: empty listen address")
	}
	if !strings.Contains(addr, ":") {
		addr = ":" + addr
	}
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return "", fmt.Errorf("healthcheck: parse listen address: %w", err)
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	return net.JoinHostPort(host, port), nil
}
