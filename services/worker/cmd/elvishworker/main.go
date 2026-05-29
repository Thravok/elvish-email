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
	flag.Parse()

	if err := elvishboot.Run(elvishboot.RoleWorker, elvishboot.Flags{
		Root: *root,
	}); err != nil {
		slog.Default().Error("elvishworker", "err", err)
		os.Exit(1)
	}
}
