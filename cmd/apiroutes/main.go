// Command apiroutes merges internal/httpserver/api.go literal routes with
// docs/openapi/supplemental.yaml and writes internal/apidoc/openapi.yaml.
package main

import (
	"bytes"
	"flag"
	"fmt"
	"os"

	"elvish/internal/apidoc"
)

func main() {
	write := flag.Bool("write", false, "write internal/apidoc/openapi.yaml")
	check := flag.Bool("check", false, "exit non-zero if openapi.yaml is out of date")
	flag.Parse()
	if *write == *check {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/apiroutes -write   # regenerate spec")
		fmt.Fprintln(os.Stderr, "    or go run ./cmd/apiroutes -check  # verify spec matches sources")
		os.Exit(2)
	}
	root, err := apidoc.ModuleRoot()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	out, err := apidoc.Regenerate(root)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	path := apidoc.DefaultOutputPath(root)
	if *write {
		if err := os.WriteFile(path, out, 0o644); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	existing, err := os.ReadFile(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if !bytes.Equal(bytes.TrimSpace(existing), bytes.TrimSpace(out)) {
		fmt.Fprintf(os.Stderr, "openapi.yaml is out of date (run: make openapi)\n")
		os.Exit(1)
	}
}
