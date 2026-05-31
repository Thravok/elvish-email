package scyllastore

import (
	_ "embed"
	"fmt"
	"strings"
)

const defaultSchemaKeyspace = "elvish_mail"

//go:embed schema.cql
var schemaCQL string

func ensureSchema(cfg Config) error {
	if err := validateIdentifier(cfg.Keyspace); err != nil {
		return fmt.Errorf("scyllastore keyspace %q: %w", cfg.Keyspace, err)
	}

	systemCluster := newCluster(cfg)
	systemCluster.Keyspace = "system"
	systemSession, err := systemCluster.CreateSession()
	if err != nil {
		return fmt.Errorf("scyllastore connect: %w", err)
	}
	defer systemSession.Close()

	keyspaceStmt := fmt.Sprintf(
		"CREATE KEYSPACE IF NOT EXISTS %s WITH replication = {'class':'SimpleStrategy','replication_factor':1}",
		cfg.Keyspace,
	)
	if err := systemSession.Query(keyspaceStmt).Exec(); err != nil {
		return fmt.Errorf("scyllastore ensure keyspace: %w", err)
	}

	appCluster := newCluster(cfg)
	appCluster.Keyspace = cfg.Keyspace
	appSession, err := appCluster.CreateSession()
	if err != nil {
		return fmt.Errorf("scyllastore connect: %w", err)
	}
	defer appSession.Close()

	for _, stmt := range schemaTableStatements() {
		if err := appSession.Query(stmt).Exec(); err != nil {
			return fmt.Errorf("scyllastore ensure table schema: %w", err)
		}
	}
	return nil
}

func schemaTableStatements() []string {
	var statements []string
	for _, raw := range strings.Split(stripSchemaComments(schemaCQL), ";") {
		stmt := strings.TrimSpace(strings.ReplaceAll(raw, defaultSchemaKeyspace, defaultSchemaKeyspace))
		if stmt == "" {
			continue
		}
		upper := strings.ToUpper(stmt)
		if strings.HasPrefix(upper, "CREATE KEYSPACE ") || strings.HasPrefix(upper, "USE ") {
			continue
		}
		statements = append(statements, stmt)
	}
	return statements
}

func stripSchemaComments(s string) string {
	lines := strings.Split(s, "\n")
	filtered := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "--") {
			continue
		}
		filtered = append(filtered, line)
	}
	return strings.Join(filtered, "\n")
}

func validateIdentifier(s string) error {
	if s == "" {
		return fmt.Errorf("identifier required")
	}
	for _, r := range s {
		if r >= 'a' && r <= 'z' {
			continue
		}
		if r >= 'A' && r <= 'Z' {
			continue
		}
		if r >= '0' && r <= '9' {
			continue
		}
		if r == '_' {
			continue
		}
		return fmt.Errorf("identifier must use letters, digits, or underscores")
	}
	return nil
}
