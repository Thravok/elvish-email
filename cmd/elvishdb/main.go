// Command elvishdb checks connectivity to optional CockroachDB/Postgres and Valkey backends
// using the same env configuration as elvishserver (COCKROACH_DSN, VALKEY_ADDR, …).
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"elvish/internal/db"
)

func main() {
	log.SetFlags(0)
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage: %s health\n\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "Environment (optional; omit to skip that backend):\n")
		fmt.Fprintf(os.Stderr, "  COCKROACH_DSN       Postgres/Cockroach connection URI\n")
		fmt.Fprintf(os.Stderr, "  VALKEY_ADDR         host:port (Redis protocol)\n")
		fmt.Fprintf(os.Stderr, "  VALKEY_PASSWORD     optional\n")
		fmt.Fprintf(os.Stderr, "  VALKEY_DB           optional, default 0\n")
	}
	flag.Parse()
	if flag.NArg() < 1 || flag.Arg(0) != "health" {
		flag.Usage()
		os.Exit(2)
	}

	cfg := db.LoadConfigFromEnv()
	if err := cfg.Validate(); err != nil {
		log.Fatal(err)
	}
	if !cfg.Enabled() {
		log.Println("no databases configured (set COCKROACH_DSN and/or VALKEY_ADDR); nothing to check")
		os.Exit(0)
	}

	ctx := context.Background()
	b, err := db.Open(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() {
		if err := b.Close(context.Background()); err != nil {
			log.Printf("close: %v", err)
		}
	}()

	if err := b.Health(ctx); err != nil {
		log.Fatal(err)
	}
	log.Println("health: ok (all configured backends reachable)")
}
