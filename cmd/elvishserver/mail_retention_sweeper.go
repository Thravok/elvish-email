package main

import (
	"context"
	"log/slog"
	"time"

	"elvish/internal/blobstore"
	"elvish/internal/mailmeta"
	"elvish/internal/mailops"
	"elvish/internal/scyllastore"
	"elvish/internal/telemetry"
)

// startMailRetentionSweeper periodically purges expired mailbox content according
// to per-folder retention policy.
func startMailRetentionSweeper(ctx context.Context, logger *slog.Logger, meta *mailmeta.Store, scylla *scyllastore.Store, blob *blobstore.Store, tel *telemetry.Service) {
	if meta == nil || scylla == nil || blob == nil {
		return
	}
	ops := mailops.New(meta, scylla, blob)
	go func() {
		t := time.NewTicker(5 * time.Minute)
		defer t.Stop()
		sweepMailRetention(ctx, logger, ops, tel)
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				sweepMailRetention(ctx, logger, ops, tel)
			}
		}
	}()
}

func sweepMailRetention(ctx context.Context, logger *slog.Logger, ops *mailops.Service, tel *telemetry.Service) {
	startedAt := time.Now()
	var sweepErr error
	defer func() {
		if tel == nil {
			return
		}
		if err := tel.RecordJobRun(ctx, "mail_retention_sweeper", sweepErr, time.Since(startedAt)); err != nil && logger != nil {
			logger.Warn("mail-retention telemetry", "err", err)
		}
	}()
	swCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	result, err := ops.SweepExpired(swCtx, 200)
	if err != nil {
		sweepErr = err
		if logger != nil {
			logger.Warn("mail-retention sweep", "err", err, "purged", result.Purged, "failed", result.Failed)
		}
		return
	}
	if result.Purged > 0 && logger != nil {
		logger.Info("mail-retention sweep", "purged", result.Purged, "failed", result.Failed)
	}
}
