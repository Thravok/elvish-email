// Package elvishboot starts ELVish by deployment role (api, mta, worker).
package elvishboot

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"elvish/libs/go/blobstore"
	"elvish/libs/go/db"
	"elvish/libs/go/dkim"
	"elvish/libs/go/httpserver"
	"elvish/libs/go/keyserver"
	"elvish/libs/go/maillinks"
	"elvish/libs/go/mailmeta"
	"elvish/libs/go/mailpipe"
	"elvish/libs/go/mailworker"
	"elvish/libs/go/migrate"
	"elvish/libs/go/models"
	"elvish/libs/go/oauthoidc"
	"elvish/libs/go/operatorconfig"
	"elvish/libs/go/paths"
	"elvish/libs/go/ratelimit"
	"elvish/libs/go/relaykey"
	"elvish/libs/go/scyllastore"
	smtpserver "elvish/libs/go/smtp/server"
	"elvish/libs/go/store"
)

func openScyllaWithRetry(ctx context.Context, cfg db.Config, strictDB bool, logger *slog.Logger) (*scyllastore.Store, error) {
	scyllaCfg := scyllastore.Config{
		Hosts: cfg.ScyllaHosts, Keyspace: cfg.ScyllaKeyspace,
		Username: cfg.ScyllaUsername, Password: cfg.ScyllaPassword,
		LocalDC: cfg.ScyllaLocalDC,
		Timeout: 10 * time.Second,
	}
	if !strictDB {
		return scyllastore.Open(scyllaCfg)
	}

	deadline := time.Now().Add(3 * time.Minute)
	var lastErr error
	for attempt := 1; ; attempt++ {
		store, err := scyllastore.Open(scyllaCfg)
		if err == nil {
			if attempt > 1 {
				logger.Info("scylla ready", "attempt", attempt)
			}
			return store, nil
		}
		lastErr = err

		remaining := time.Until(deadline)
		if remaining <= 0 {
			return nil, lastErr
		}

		wait := 2 * time.Second
		if remaining < wait {
			wait = remaining
		}
		logger.Info("waiting for scylla to accept CQL", "attempt", attempt, "retry_in", wait.String(), "err", err)

		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, ctx.Err()
		case <-timer.C:
		}
	}
}

func Run(role Role, flags Flags) error {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	if err := maybeBootstrapMFAEncryptionKey(flags.Root, logger); err != nil {
		return fmt.Errorf("mfa key bootstrap: %w", err)
	}

	cfg := db.LoadConfigFromEnv()
	if err := cfg.Validate(); err != nil {
		return fmt.Errorf("db config invalid: %w", err)
	}

	if err := validateRoleEnv(role); err != nil {
		return err
	}

	allowEmptyDB := envTruthy("ELVISH_ALLOW_EMPTY_DB")
	strictDB := !allowEmptyDB && !flags.MigrateOnly
	if strictDB {
		if cfg.CockroachDSN == "" || cfg.ValkeyAddr == "" {
			logger.Error("elvish requires COCKROACH_DSN and VALKEY_ADDR (both must be set and reachable)",
				"hint", "make dev-once or make dev sets local DB defaults; or: make db-up && export COCKROACH_DSN='postgres://root@127.0.0.1:26257/defaultdb?sslmode=disable' VALKEY_ADDR=127.0.0.1:6379",
				"static_only", "set ELVISH_ALLOW_EMPTY_DB=1 only for static demos without auth or admin persistence")
			return fmt.Errorf("startup failed")
		}
	}

	var bundle *db.Bundle
	if cfg.Enabled() {
		var err error
		bundle, err = db.Open(cfg)
		if err != nil {
			logger.Error("db open", "err", err)
			return fmt.Errorf("startup failed")
		}
		defer func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := bundle.Close(ctx); err != nil {
				logger.Error("db close", "err", err)
			}
		}()
		hctx, hcancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer hcancel()
		if err := bundle.Health(hctx); err != nil {
			if strictDB {
				logger.Error("database health check failed (refusing to start)", "err", err)
				return fmt.Errorf("startup failed")
			}
			logger.Warn("db health check failed (server will still start)", "err", err)
		}
	} else if strictDB {
		return fmt.Errorf("internal: strict DB mode but no backends enabled")
	}

	ctx := context.Background()
	components := componentsForRole(role)

	if bundle != nil && bundle.Pool() != nil && components.RunMigrations {
		mctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
		err := db.RunMigrations(mctx, bundle.Pool())
		cancel()
		if err != nil {
			if strictDB || flags.MigrateOnly {
				logger.Error("sql migrations", "err", err)
				return fmt.Errorf("startup failed")
			}
			logger.Warn("sql migrations", "err", err)
		}
	}
	var sqlStore *store.Store
	if bundle != nil && bundle.Pool() != nil {
		sqlStore = store.New(bundle.Pool())
	}

	srv, err := httpserver.New(httpserver.Options{
		Root:         flags.Root,
		CookieSecure: strings.EqualFold(os.Getenv("COOKIE_SECURE"), "1") || strings.EqualFold(os.Getenv("COOKIE_SECURE"), "true"),
		Logger:       logger,
	}, bundle)
	if err != nil {
		return fmt.Errorf("httpserver new: %w", err)
	}

	opSvc := operatorconfig.New(sqlStore, logger)
	if sqlStore != nil {
		if err := opSvc.MaybeMigrateFromEnv(ctx); err != nil {
			logger.Warn("operator settings env migration", "err", err)
		}
	}
	srv.WithOperatorConfig(opSvc)

	if flags.MigrateOnly {
		if role != RoleAPI {
			return fmt.Errorf("-migrate is only supported on elvishapi")
		}
		if bundle == nil || bundle.Pool() == nil {
			logger.Error("migrate requires COCKROACH_DSN")
			return fmt.Errorf("startup failed")
		}
		n, err := migrate.PostsFromDisk(ctx, sqlStore, paths.RepoRoot(flags.Root).APIContent())
		if err != nil {
			logger.Error("migrate", "err", err)
			return fmt.Errorf("startup failed")
		}
		logger.Info("migrated posts", "count", n)
		return nil
	}

	rootCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	logger.Info("deployment components",
		"role", role.String(),
		"http", components.HTTP,
		"smtp", components.SMTP,
		"mail_worker", components.MailWorker,
		"background_jobs", components.BackgroundJobs,
	)

	mailDomain := ""
	publicBase := ""
	smtpRateLimit := int64(models.DefaultSMTPRateLimitPerHour)
	if plat, perr := opSvc.Settings(ctx); perr == nil && plat != nil {
		mailDomain = plat.PlatformMailDomain
		publicBase = plat.PublicBaseURL
		if plat.SMTPRateLimitPerHour > 0 {
			smtpRateLimit = plat.SMTPRateLimitPerHour
		}
	}
	hostName := strings.TrimSpace(os.Getenv("ELVISH_HOSTNAME"))
	if hostName == "" && mailDomain != "" {
		hostName = "mx." + mailDomain
	}

	var (
		mm  *mailmeta.Store
		scy *scyllastore.Store
		blb *blobstore.Store
		res *keyserver.Resolver
	)

	if bundle != nil && bundle.Pool() != nil {
		mm = mailmeta.New(bundle.Pool())
	}
	if cfg.ScyllaEnabled() {
		scStore, err := openScyllaWithRetry(rootCtx, cfg, strictDB, logger)
		if err != nil {
			if strictDB {
				logger.Error("scylla open (refusing to start)", "err", err)
				return fmt.Errorf("startup failed")
			}
			logger.Warn("scylla open (mail subsystem disabled)", "err", err)
		} else {
			scy = scStore
			defer scy.Close()
		}
	}
	if cfg.BlobEnabled() {
		bs, err := blobstore.New(blobstore.Config{
			Endpoint: cfg.BlobEndpoint, Region: cfg.BlobRegion, Bucket: cfg.BlobBucket,
			AccessKey: cfg.BlobAccessKey, SecretKey: cfg.BlobSecretKey, ForcePathStyle: cfg.BlobForcePathStyle,
		})
		if err != nil {
			if strictDB {
				logger.Error("blobstore new (refusing to start)", "err", err)
				return fmt.Errorf("startup failed")
			}
			logger.Warn("blobstore new (mail subsystem disabled)", "err", err)
		} else {
			blb = bs
			ebctx, ebcancel := context.WithTimeout(ctx, 10*time.Second)
			if err := blb.EnsureBucket(ebctx); err != nil {
				logger.Warn("blobstore ensure bucket", "err", err)
			}
			ebcancel()
		}
	}
	if mm != nil {
		var cache *keyserver.Cache
		if bundle != nil && bundle.Valkey() != nil {
			cache = keyserver.NewCache(bundle.Valkey(), mm)
		}
		res = keyserver.DefaultChain(mm, cache, logger)
	}
	srv.WithMail(mm, scy, blb, res, mailDomain)
	srv.WithSMTPHostname(hostName)
	if publicBase != "" {
		srv.WithPublicBaseURL(publicBase)
	}
	oidcIss, err := oauthoidc.LoadIssuerFromEnv(publicBase)
	if err != nil {
		return fmt.Errorf("oauth oidc issuer config: %w", err)
	}
	if oidcIss != nil {
		srv.WithOAuthOIDC(oidcIss)
		logger.Info("oauth oidc issuer enabled", "issuer", oidcIss.IssuerURL)
	}

	var (
		relay *relaykey.KeyPair
		links *maillinks.Store
	)
	relayPath, relayExplicit := relayKeyPathForRoot(flags.Root)
	srv.WithRelayKeyConfig(relayPath)
	if kp, generated, err := relaykey.LoadOrGenerate(relayPath, "Elvish Plaintext Relay", "relay@local"); err != nil {
		if relayExplicit {
			logger.Warn("relay key load/generate (Mode C disabled)", "err", err, "path", relayPath)
		} else {
			logger.Warn("relay key bootstrap (Mode C disabled)", "err", err, "path", relayPath)
		}
	} else {
		relay = kp
		srv.WithRelayKey(relay)
		if generated {
			logger.Info("relay key generated", "path", relayPath, "fingerprint", relay.FingerprintShort())
		} else {
			logger.Info("relay key loaded", "path", relayPath, "fingerprint", relay.FingerprintShort())
		}
	}
	if bundle != nil && bundle.Pool() != nil && blb != nil {
		links = maillinks.New(bundle.Pool())
		srv.WithMailLinks(links)
	}

	if mm != nil && scy != nil && blb != nil {
		var signer *dkim.Signer
		smtpTLSConfig := smtpServerTLSConfig(logger)
		outboundSMTPClientTLS := smtpClientTLSConfig()
		dkimSelector, dkimDomain, dkimKeyPath, _ := dkimSettingsForRoot(flags.Root, mailDomain)
		if sqlStore != nil {
			doc, derr := sqlStore.GetAdminMailSettings(ctx)
			if derr != nil {
				logger.Warn("admin mail settings load", "err", derr)
			} else if doc != nil && !doc.UpdatedAt.IsZero() {
				if strings.TrimSpace(doc.DKIMSelector) != "" {
					dkimSelector = strings.TrimSpace(doc.DKIMSelector)
				}
				if strings.TrimSpace(doc.DKIMDomain) != "" {
					dkimDomain = strings.TrimSpace(doc.DKIMDomain)
				}
			}
		}
		srv.WithDKIMConfig(dkimSelector, dkimDomain, dkimKeyPath)
		if dkimSelector != "" && dkimDomain != "" && dkimKeyPath != "" {
			pemBytes, rerr := os.ReadFile(dkimKeyPath)
			if rerr != nil {
				logger.Warn("dkim key read", "err", rerr, "path", dkimKeyPath)
			} else if sg, perr := dkim.NewRSASignerFromPEM(pemBytes); perr != nil {
				logger.Warn("dkim signer parse", "err", perr)
			} else {
				signer = sg
			}
		}
		dkimDomainsDir := filepath.Join(flags.Root, "data", "dkim", "domains")
		if err := os.MkdirAll(dkimDomainsDir, 0o700); err != nil {
			logger.Warn("dkim domains dir mkdir", "err", err, "path", dkimDomainsDir)
		}
		if components.MailWorker {
			w := mailworker.New(mailworker.Config{
				Hostname: hostName, DKIMSelector: dkimSelector, DKIMSigner: signer, DKIMDomain: dkimDomain,
				DKIMDomainsDir: dkimDomainsDir,
				RelayKey:       relay, ClientTLSConfig: outboundSMTPClientTLS,
				Logger: logger, Interval: 3 * time.Second, BatchSize: 10, Telemetry: srv.Telemetry(),
			}, mm, scy, blb)
			srv.WithMailWorker(w)
			w.Start(rootCtx)
			logger.Info("mail outbox worker started")
		}
		if components.BackgroundJobs {
			if links != nil {
				startProtectedLinkSweeper(rootCtx, logger, links, blb, srv.Telemetry())
				logger.Info("protected-link sweeper started")
			}
			startMailRetentionSweeper(rootCtx, logger, mm, scy, blb, srv.Telemetry())
			logger.Info("mail retention sweeper started")
		}

		pipe := mailpipe.New(blb, scy, mm, logger)
		pipe.Telemetry = srv.Telemetry()
		var stForAuth *store.Store
		var smtpRL *ratelimit.Limiter
		if bundle != nil && bundle.Pool() != nil {
			stForAuth = store.New(bundle.Pool())
		}
		if bundle != nil && bundle.Valkey() != nil {
			smtpRL = ratelimit.New(bundle.Valkey(), "")
		}
		if components.SMTP {
			if sa := strings.TrimSpace(os.Getenv("ELVISH_SMTP_ADDR")); sa != "" && mailDomain != "" {
				be := newSMTPBackend(pipe, logger, false, stForAuth, mm, srv.Telemetry(), smtpRL, smtpRateLimit)
				s, serr := smtpserver.New(smtpserver.Config{
					Addr: sa, Hostname: hostName, Mode: smtpserver.ModeMX, Logger: logger, TLSConfig: smtpTLSConfig,
				}, be)
				if serr != nil {
					logger.Error("smtp inbound new", "err", serr)
				} else {
					go func() {
						if err := s.ListenAndServe(rootCtx); err != nil {
							logger.Error("smtp inbound exited", "err", err)
						}
					}()
					logger.Info("smtp inbound listening", "addr", sa, "domain", mailDomain)
				}
			} else if sa := strings.TrimSpace(os.Getenv("ELVISH_SMTP_ADDR")); sa != "" && mailDomain == "" {
				logger.Warn("ELVISH_SMTP_ADDR set but ELVISH_MAIL_DOMAIN empty; inbound SMTP disabled")
			}
			if ss := strings.TrimSpace(os.Getenv("ELVISH_SMTP_SUBMISSION_ADDR")); ss != "" {
				be := newSMTPBackend(pipe, logger, true, stForAuth, mm, srv.Telemetry(), smtpRL, smtpRateLimit)
				s, serr := smtpserver.New(smtpserver.Config{
					Addr: ss, Hostname: hostName, Mode: smtpserver.ModeSubmission, Logger: logger,
					TLSConfig: smtpTLSConfig, AllowPlainAuth: envTruthy("ELVISH_SMTP_ALLOW_PLAIN_AUTH"),
				}, be)
				if serr != nil {
					logger.Error("smtp submission new", "err", serr)
				} else {
					go func() {
						if err := s.ListenAndServe(rootCtx); err != nil {
							logger.Error("smtp submission exited", "err", err)
						}
					}()
					logger.Info("smtp submission listening", "addr", ss)
				}
			}
		}
	} else if strictDB {
		logger.Warn("mail subsystem partially configured; mail HTTP routes will return 503 until SCYLLA_* and BLOB_S3_* are set")
	}

	var backgroundWg sync.WaitGroup
	if components.BackgroundJobs {
		uptimeFallback := strings.TrimRight(httpserver.ProbeBaseFromAddr(flags.Addr), "/")
		backgroundWg.Add(1)
		go func() {
			defer backgroundWg.Done()
			srv.RunUptimeLoop(rootCtx, uptimeFallback)
		}()
		logger.Info("uptime background", "fallback_base", uptimeFallback)
		backgroundWg.Add(1)
		go func() {
			defer backgroundWg.Done()
			srv.RunAccountDeletionLoop(rootCtx)
		}()
		logger.Info("account deletion sweeper started")
	}

	if !components.HTTP {
		logger.Info("HTTP listener disabled", "role", role.String())
		<-rootCtx.Done()
		backgroundWg.Wait()
		return nil
	}

	var h http.Handler
	if role == RoleMTA {
		h = healthOnlyHandler()
	} else {
		h = srv.Handler()
	}
	logger.Info("elvish listening", "role", role.String(), "url", "http://127.0.0.1"+flags.Addr+"/", "root", flags.Root)
	server := &http.Server{
		Addr:              flags.Addr,
		Handler:           h,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	errCh := make(chan error, 1)
	go func() { errCh <- server.ListenAndServe() }()

	select {
	case err := <-errCh:
		stop()
		backgroundWg.Wait()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("listen: %w", err)
		}
		return nil
	case <-rootCtx.Done():
		shCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		if err := server.Shutdown(shCtx); err != nil {
			logger.Error("http shutdown", "err", err)
		}
		cancel()
		<-errCh
		backgroundWg.Wait()
		return nil
	}
}
