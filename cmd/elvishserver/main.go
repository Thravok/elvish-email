// Command elvishserver was removed. Use elvishapi, elvishmta, or elvishworker.
package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Fprintln(os.Stderr, "elvishserver is removed. Use:")
	fmt.Fprintln(os.Stderr, "  elvishapi     — HTTP /api and SSR")
	fmt.Fprintln(os.Stderr, "  elvishmta     — SMTP MX and submission")
	fmt.Fprintln(os.Stderr, "  elvishworker  — outbox delivery and sweepers")
	fmt.Fprintln(os.Stderr, "Local dev: make dev (Overmind) or make dev-api / dev-mta / dev-worker")
	os.Exit(2)
}
