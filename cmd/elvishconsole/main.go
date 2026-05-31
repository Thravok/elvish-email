// Command elvishconsole runs the ELVish Console operator service.
package main

import (
	"context"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"elvish/internal/blobstore"
	"elvish/internal/consoleserver"
	"elvish/internal/db"
	"elvish/internal/httpserver"
	"elvish/internal/keyserver"
	"elvish/internal/maillinks"
	"elvish/internal/mailmeta"
	"elvish/internal/relaykey"
	"elvish/internal/scyllastore"
	"elvish/internal/staffsession"
	"elvish/internal/store"
	"elvish/internal/supportvault"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	root := flag.String("root", ".", "project root")
	healthcheck := flag.Bool("healthcheck", false, "probe /healthz and exit")
	flag.Parse()

	if *healthcheck {
		url := "http://127.0.0.1" + *addr + "/healthz"
		if u := strings.TrimSpace(os.Getenv("ELVISH_CONSOLE_HEALTH_URL")); u != "" {
			url = u
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			os.Exit(1)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		return
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	cfg := db.LoadConfigFromEnv()
	if cfg.CockroachDSN == "" || cfg.ValkeyAddr == "" {
		logger.Error("elvishconsole requires COCKROACH_DSN and VALKEY_ADDR")
		os.Exit(1)
	}
	bundle, err := db.Open(cfg)
	if err != nil {
		logger.Error("db open", "err", err)
		os.Exit(1)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = bundle.Close(ctx)
	}()

	ctx := context.Background()
	if err := db.RunMigrations(ctx, bundle.Pool()); err != nil {
		logger.Error("migrations", "err", err)
		os.Exit(1)
	}

	sqlStore := store.New(bundle.Pool())
	if err := consoleserver.BootstrapStaff(ctx, sqlStore, logger); err != nil {
		logger.Error("staff bootstrap", "err", err)
		os.Exit(1)
	}

	staffSess := staffsession.NewStore(bundle.Valkey())

	cookieSecure := strings.EqualFold(os.Getenv("COOKIE_SECURE"), "1") || strings.EqualFold(os.Getenv("COOKIE_SECURE"), "true")
	platform, err := httpserver.New(httpserver.Options{
		Root:         *root,
		CookieSecure: cookieSecure,
		Logger:       logger,
	}, bundle)
	if err != nil {
		logger.Error("platform server", "err", err)
		os.Exit(1)
	}

	mailDomain := strings.TrimSpace(os.Getenv("ELVISH_MAIL_DOMAIN"))
	mm := mailmeta.New(bundle.Pool())
	var scy *scyllastore.Store
	if cfg.ScyllaEnabled() {
		scy, err = scyllastore.Open(scyllastore.Config{
			Hosts: cfg.ScyllaHosts, Keyspace: cfg.ScyllaKeyspace,
			Username: cfg.ScyllaUsername, Password: cfg.ScyllaPassword,
			LocalDC: cfg.ScyllaLocalDC, Timeout: 10 * time.Second,
		})
		if err != nil {
			logger.Warn("scylla open", "err", err)
		} else {
			defer scy.Close()
		}
	}
	var blb *blobstore.Store
	if cfg.BlobEnabled() {
		blb, err = blobstore.New(blobstore.Config{
			Endpoint: cfg.BlobEndpoint, Region: cfg.BlobRegion, Bucket: cfg.BlobBucket,
			AccessKey: cfg.BlobAccessKey, SecretKey: cfg.BlobSecretKey, ForcePathStyle: cfg.BlobForcePathStyle,
		})
		if err != nil {
			logger.Warn("blobstore", "err", err)
		}
	}
	var cache *keyserver.Cache
	if bundle.Valkey() != nil {
		cache = keyserver.NewCache(bundle.Valkey(), mm)
	}
	res := keyserver.DefaultChain(mm, cache, logger)
	platform.WithMail(mm, scy, blb, res, mailDomain)
	if base := strings.TrimSpace(os.Getenv("ELVISH_PUBLIC_BASE_URL")); base != "" {
		platform.WithPublicBaseURL(base)
	}
	relayPath := filepath.Join(*root, "data", "relay.key")
	platform.WithRelayKeyConfig(relayPath)
	if kp, _, err := relaykey.LoadOrGenerate(relayPath, "Elvish Plaintext Relay", "relay@local"); err == nil {
		platform.WithRelayKey(kp)
	}
	if blb != nil {
		links := maillinks.New(bundle.Pool())
		platform.WithMailLinks(links)
	}
	dkimPath := filepath.Join(*root, "data", "dkim.key")
	platform.WithDKIMConfig(os.Getenv("ELVISH_DKIM_SELECTOR"), os.Getenv("ELVISH_DKIM_DOMAIN"), dkimPath)

	var vault *supportvault.Vault
	if keyB64 := strings.TrimSpace(os.Getenv("ELVISH_CONSOLE_VAULT_KEY")); keyB64 != "" {
		vault, err = supportvault.Open(keyB64, "default")
		if err != nil {
			logger.Error("vault open", "err", err)
			os.Exit(1)
		}
	}

	publicURL := strings.TrimSpace(os.Getenv("ELVISH_CONSOLE_PUBLIC_URL"))
	srv, err := consoleserver.New(consoleserver.Options{
		Root:         *root,
		CookieSecure: cookieSecure,
		Logger:       logger,
		PublicURL:    publicURL,
	}, sqlStore, staffSess, platform, vault)
	if err != nil {
		logger.Error("console server", "err", err)
		os.Exit(1)
	}

	httpSrv := &http.Server{
		Addr:              *addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		logger.Info("elvishconsole listening", "addr", *addr)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("listen", "err", err)
			os.Exit(1)
		}
	}()

	sigCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-sigCtx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
}
