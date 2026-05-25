package elvishboot

import (
	"context"
	"log/slog"
	"time"

	"elvish/internal/blobstore"
	"elvish/internal/maillinks"
	"elvish/internal/telemetry"
)

// startProtectedLinkSweeper runs a 5-minute ticker that purges expired or
// fully-burned protected links and deletes their underlying ciphertext blobs.
// Failures are logged at warn; the sweeper retries on the next tick.
func startProtectedLinkSweeper(ctx context.Context, logger *slog.Logger, links *maillinks.Store, blob *blobstore.Store, tel *telemetry.Service) {
	if links == nil || blob == nil {
		return
	}
	go func() {
		t := time.NewTicker(5 * time.Minute)
		defer t.Stop()
		// Run once at startup to drain anything left behind by a crash.
		sweepProtectedLinks(ctx, logger, links, blob, tel)
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				sweepProtectedLinks(ctx, logger, links, blob, tel)
			}
		}
	}()
}

func sweepProtectedLinks(ctx context.Context, logger *slog.Logger, links *maillinks.Store, blob *blobstore.Store, tel *telemetry.Service) {
	startedAt := time.Now()
	var sweepErr error
	defer func() {
		if tel == nil {
			return
		}
		if err := tel.RecordJobRun(ctx, "protected_link_sweeper", sweepErr, time.Since(startedAt)); err != nil && logger != nil {
			logger.Warn("protected-link telemetry", "err", err)
		}
	}()
	swCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	purged, err := links.PurgeExpired(swCtx, 100)
	if err != nil {
		sweepErr = err
		if logger != nil {
			logger.Warn("protected-link sweep purge", "err", err)
		}
		return
	}
	for _, e := range purged {
		if err := blob.Delete(swCtx, e.BlobRef); err != nil && logger != nil {
			logger.Warn("protected-link sweep blob delete", "token", e.Token, "err", err)
		}
	}
	if len(purged) > 0 && logger != nil {
		logger.Info("protected-link sweep", "purged", len(purged))
	}
}
