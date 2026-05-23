package httpserver

import (
	"errors"
	"strings"
	"testing"
)

func TestPartitionRecipientsByLocality_SplitsLocalAndExternal(t *testing.T) {
	t.Parallel()

	local, external, err := partitionRecipientsByLocality(
		[]string{" Alice@Elvish.Local ", "bob@example.com", "", "carol@custom.test"},
		func(rcpt string) (bool, error) {
			switch rcpt {
			case "alice@elvish.local", "carol@custom.test":
				return true, nil
			default:
				return false, nil
			}
		},
	)
	if err != nil {
		t.Fatalf("partitionRecipientsByLocality: %v", err)
	}
	if got, want := len(local), 2; got != want {
		t.Fatalf("len(local) = %d want %d", got, want)
	}
	if got, want := len(external), 1; got != want {
		t.Fatalf("len(external) = %d want %d", got, want)
	}
	if local[0] != "alice@elvish.local" || local[1] != "carol@custom.test" {
		t.Fatalf("local = %#v", local)
	}
	if external[0] != "bob@example.com" {
		t.Fatalf("external = %#v", external)
	}
}

func TestPartitionRecipientsByLocality_PropagatesLookupErrors(t *testing.T) {
	t.Parallel()

	wantErr := errors.New("boom")
	_, _, err := partitionRecipientsByLocality([]string{"alice@elvish.local"}, func(string) (bool, error) {
		return false, wantErr
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v want %v", err, wantErr)
	}
}

func TestBuildRFC5322_RejectsHeaderInjection(t *testing.T) {
	t.Parallel()

	_, _, err := buildRFC5322(
		"sender@example.com",
		[]string{"user@example.com"},
		"evil\r\nBcc: attacker@example.com",
		"body",
		nil,
	)
	if err == nil {
		t.Fatal("expected header injection error")
	}
}

func TestBuildRFC5322_WithAttachmentsBuildsMultipartMessage(t *testing.T) {
	t.Parallel()

	raw, header, err := buildRFC5322(
		"announcements@example.com",
		[]string{"user@example.com"},
		"Attachment test",
		"Hello from Elvish.",
		[]plaintextAttachment{{
			FileName:    "report.txt",
			ContentType: "text/plain",
			Data:        []byte("hello attachment"),
		}},
	)
	if err != nil {
		t.Fatalf("buildRFC5322: %v", err)
	}
	text := string(raw)
	if !strings.Contains(text, "Content-Type: multipart/mixed;") {
		t.Fatalf("raw message missing multipart content-type:\n%s", text)
	}
	if !strings.Contains(text, `filename="report.txt"`) {
		t.Fatalf("raw message missing attachment filename:\n%s", text)
	}
	if got := len(header.Attachments); got != 1 {
		t.Fatalf("len(header.Attachments) = %d want 1", got)
	}
	if got := header.Attachments[0].FileName; got != "report.txt" {
		t.Fatalf("header attachment filename = %q want report.txt", got)
	}
	if got := header.Attachments[0].SizeBytes; got != int64(len("hello attachment")) {
		t.Fatalf("header attachment size = %d want %d", got, len("hello attachment"))
	}
}
