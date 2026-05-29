package scyllastore

import "testing"

func TestSchemaTableStatements(t *testing.T) {
	stmts := schemaTableStatements()
	if len(stmts) != 5 {
		t.Fatalf("schemaTableStatements() len = %d, want 5", len(stmts))
	}
	for _, stmt := range stmts {
		if stmt == "" {
			t.Fatal("schemaTableStatements() returned empty statement")
		}
		if stmt == "USE elvish_mail" {
			t.Fatal("schemaTableStatements() should not include USE statement")
		}
	}
}

func TestValidateIdentifier(t *testing.T) {
	if err := validateIdentifier("elvish_mail"); err != nil {
		t.Fatalf("validateIdentifier(valid): %v", err)
	}
	if err := validateIdentifier("elvish-mail"); err == nil {
		t.Fatal("validateIdentifier(invalid) returned nil")
	}
}
