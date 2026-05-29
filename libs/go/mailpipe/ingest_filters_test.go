package mailpipe

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"elvish/libs/go/mailmeta"
)

func TestIngestRuleConditionsMatch_sender(t *testing.T) {
	ctx := buildIngestFilterCtx("spammer@evil.test", "user@example.com", []byte("x"), HeaderSummary{
		From: "Spammer <spammer@evil.test>",
	})
	conds := []filterCondJSON{{Type: "sender", Operator: "contains", Value: "evil.test"}}
	if !ingestRuleConditionsMatch(conds, ctx) {
		t.Fatal("expected sender match on envelope/header")
	}
	conds[0].Value = "other"
	if ingestRuleConditionsMatch(conds, ctx) {
		t.Fatal("expected no match")
	}
}

func TestIngestRuleConditionsMatch_subjectSizeAttachment(t *testing.T) {
	raw := []byte("From: a@a.com\r\nTo: b@b.com\r\nSubject: weekly deals\r\n\r\n")
	hs := completeHeaderSummary(extractHeaders(raw), "a@a.com", []string{"b@b.com"})
	ctx := buildIngestFilterCtx("a@a.com", "b@b.com", raw, hs)
	if !ingestRuleConditionsMatch([]filterCondJSON{{Type: "subject", Operator: "contains", Value: "deals"}}, ctx) {
		t.Fatal("subject")
	}
	if !ingestRuleConditionsMatch([]filterCondJSON{{Type: "size", Operator: "greater_than", Value: "10"}}, ctx) {
		t.Fatal("size")
	}
	hs2 := hs
	hs2.Attachments = []AttachmentSummary{{FileName: "x"}}
	ctx2 := buildIngestFilterCtx("a@a.com", "b@b.com", raw, hs2)
	if !ingestRuleConditionsMatch([]filterCondJSON{{Type: "attachment", Operator: "equals", Value: "yes"}}, ctx2) {
		t.Fatal("attachment yes")
	}
	if !ingestRuleConditionsMatch([]filterCondJSON{{Type: "attachment", Operator: "equals", Value: "no"}}, ctx) {
		t.Fatal("attachment no")
	}
}

func TestIngestRuleConditionsMatch_bodyNeverMatches(t *testing.T) {
	ctx := buildIngestFilterCtx("a@a.com", "b@b.com", []byte("secret body"), HeaderSummary{})
	if ingestRuleConditionsMatch([]filterCondJSON{{Type: "body", Operator: "contains", Value: "secret"}}, ctx) {
		t.Fatal("body must not match server-side")
	}
}

func TestIngestDecisionFromActions_deleteOverridesMove(t *testing.T) {
	dec, err := ingestDecisionFromActions(context.Background(), nil, uuid.Nil, []filterActJSON{
		{Type: "move", Value: "archive"},
		{Type: "delete"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !dec.Drop {
		t.Fatalf("drop=%v", dec.Drop)
	}
}

func TestResolveIngestMoveFolder_standard(t *testing.T) {
	f, err := resolveIngestMoveFolder(context.Background(), nil, uuid.Nil, "Archive")
	if err != nil {
		t.Fatal(err)
	}
	if f != mailmeta.FolderArchive {
		t.Fatalf("got %q", f)
	}
}
