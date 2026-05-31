// Command elvishworker runs outbound mail delivery and background sweepers (no HTTP, no SMTP).
package main

import (
	"flag"
	"log/slog"
	"os"

	"elvish/libs/go/elvishboot"
)

func main() {
	root := flag.String("root", ".", "project root (data/ keys)")
	healthcheck := flag.Bool("healthcheck", false, "probe configured SQL/Valkey/Scylla backends and exit")
	flag.Parse()

	flags := elvishboot.Flags{Root: *root}
	if *healthcheck {
		if err := elvishboot.RunHealthcheck(elvishboot.RoleWorker, flags); err != nil {
			os.Exit(1)
		}
		return
	}

	if err := elvishboot.Run(elvishboot.RoleWorker, flags); err != nil {
		slog.Default().Error("elvishworker", "err", err)
		os.Exit(1)
	}
}
