// Command elvishapi runs the HTTP/API tier (JSON /api, SSR). SQL migrations run here only.
package main

import (
	"flag"
	"log/slog"
	"os"

	"elvish/libs/go/elvishboot"
)

func main() {
	addr := flag.String("addr", ":8765", "listen address (e.g. :8766)")
	root := flag.String("root", ".", "project root (content/, static/, templates/)")
	migrateOnly := flag.Bool("migrate", false, "import markdown posts from content/blog into the database, then exit")
	flag.Parse()

	if err := elvishboot.Run(elvishboot.RoleAPI, elvishboot.Flags{
		Addr:        *addr,
		Root:        *root,
		MigrateOnly: *migrateOnly,
	}); err != nil {
		slog.Default().Error("elvishapi", "err", err)
		os.Exit(1)
	}
}
