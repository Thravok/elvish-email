// Command elvishmta runs SMTP receive/submission only (no HTTP unless ELVISH_HTTP_ENABLED=1 for /api/healthz).
package main

import (
	"flag"
	"log/slog"
	"os"

	"elvish/libs/go/elvishboot"
)

func main() {
	addr := flag.String("addr", ":8765", "listen address when ELVISH_HTTP_ENABLED=1 (health checks)")
	root := flag.String("root", ".", "project root (data/ keys)")
	healthcheck := flag.Bool("healthcheck", false, "probe SMTP or /api/healthz on the running server and exit")
	flag.Parse()

	flags := elvishboot.Flags{Addr: *addr, Root: *root}
	if *healthcheck {
		if err := elvishboot.RunHealthcheck(elvishboot.RoleMTA, flags); err != nil {
			os.Exit(1)
		}
		return
	}

	if err := elvishboot.Run(elvishboot.RoleMTA, flags); err != nil {
		slog.Default().Error("elvishmta", "err", err)
		os.Exit(1)
	}
}
