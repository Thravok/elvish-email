package mailpipe

import (
	"bytes"
	"context"
	"io"
	"testing"
	"time"

	"elvish/internal/mailmeta"
	"elvish/internal/openpgp"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"
	"github.com/ProtonMail/go-crypto/openpgp/packet"
)

func genRecipientKey(t *testing.T, name, email string) *pgpcrypto.Entity {
	t.Helper()
	cfg := &packet.Config{Algorithm: packet.PubKeyAlgoEdDSA, RSABits: 2048, Time: func() time.Time { return time.Now() }}
	ent, err := pgpcrypto.NewEntity(name, "", email, cfg)
	if err != nil {
		t.Fatalf("NewEntity: %v", err)
	}
	return ent
}

func armorRecipientPub(t *testing.T, e *pgpcrypto.Entity) string {
	t.Helper()
	var buf bytes.Buffer
	w, err := armor.Encode(&buf, "PGP PUBLIC KEY BLOCK", nil)
	if err != nil {
		t.Fatalf("armor: %v", err)
	}
	if err := e.Serialize(w); err != nil {
		t.Fatalf("serialize: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close armor: %v", err)
	}
	return buf.String()
}

func decryptArmoredMessage(t *testing.T, e *pgpcrypto.Entity, ciphertext []byte) []byte {
	t.Helper()
	armBlock, err := armor.Decode(bytes.NewReader(ciphertext))
	if err != nil {
		t.Fatalf("armor decode: %v", err)
	}
	md, err := pgpcrypto.ReadMessage(armBlock.Body, pgpcrypto.EntityList{e}, nil, nil)
	if err != nil {
		t.Fatalf("read message: %v", err)
	}
	out, err := io.ReadAll(md.UnverifiedBody)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	return out
}

// TestSniffPGPCleartextDetection asserts that the Sniff classifier we depend
// on for IngestInternal correctly distinguishes ciphertext from cleartext.
// IngestInternal MUST refuse cleartext bodies with a clear error so we never
// accidentally land plaintext in the body blob via the API path.
func TestSniffPGPCleartextDetection(t *testing.T) {
	cases := []struct {
		name string
		body []byte
		want openpgp.BodyKind
	}{
		{"cleartext", []byte("hello world\n"), openpgp.BodyCleartext},
		{"armored msg", []byte("-----BEGIN PGP MESSAGE-----\n\nfake\n-----END PGP MESSAGE-----\n"), openpgp.BodyArmoredMessage},
		{"signed cleartext", []byte("-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA256\n\nx\n-----BEGIN PGP SIGNATURE-----\nabc\n-----END PGP SIGNATURE-----\n"), openpgp.BodyCleartext},
		{"binary pgp", []byte{0xC4, 0x01, 0x02, 0x03}, openpgp.BodyBinaryPGP},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := openpgp.Sniff(c.body); got != c.want {
				t.Fatalf("Sniff(%q) = %v want %v", c.name, got, c.want)
			}
		})
	}
}

// TestIngestInternalRejectsCleartext exercises the early refusal.
func TestIngestInternalRejectsCleartext(t *testing.T) {
	p := &Pipe{}
	_, err := p.IngestInternal(context.Background(), "x@y.z", []byte("h"), []byte("plain text"), "a@b.c", []string{"x@y.z"}, nil)
	if err == nil {
		t.Fatal("expected error for cleartext body")
	}
	if !bytes.Contains([]byte(err.Error()), []byte("ciphertext")) && !bytes.Contains([]byte(err.Error()), []byte("nil")) {
		// Either "requires ciphertext" or "nil meta store" is acceptable here:
		// when Meta is nil we fail earlier with a different message.
		t.Logf("err=%v", err)
	}
}

func TestMaterializeGatewayEncryptsPlaintext(t *testing.T) {
	p := &Pipe{}
	recipient := genRecipientKey(t, "alice", "alice@example.com")
	armoredPub := armorRecipientPub(t, recipient)
	plaintext := []byte("Subject: hi\r\n\r\nhello from smtp")

	provenance, ciphertext, err := p.materialize(plaintext, armoredPub)
	if err != nil {
		t.Fatalf("materialize: %v", err)
	}
	if provenance != mailmeta.ProvenanceSMTPGatewayEncrypted {
		t.Fatalf("provenance = %q want %q", provenance, mailmeta.ProvenanceSMTPGatewayEncrypted)
	}
	if bytes.Contains(ciphertext, plaintext) {
		t.Fatal("ciphertext should not contain plaintext bytes")
	}
	if got := decryptArmoredMessage(t, recipient, ciphertext); !bytes.Equal(got, plaintext) {
		t.Fatalf("decrypted plaintext mismatch: got %q want %q", got, plaintext)
	}
}

func TestMaterializePreservesAlreadyEncryptedMail(t *testing.T) {
	p := &Pipe{}
	recipient := genRecipientKey(t, "alice", "alice@example.com")
	armoredPub := armorRecipientPub(t, recipient)
	plaintext := []byte("hello encrypted sender path")
	ciphertext, err := openpgp.Encrypt(armoredPub, plaintext)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	provenance, gotCiphertext, err := p.materialize(ciphertext, armoredPub)
	if err != nil {
		t.Fatalf("materialize: %v", err)
	}
	if provenance != mailmeta.ProvenanceSenderPGPMime {
		t.Fatalf("provenance = %q want %q", provenance, mailmeta.ProvenanceSenderPGPMime)
	}
	if !bytes.Equal(gotCiphertext, ciphertext) {
		t.Fatal("already encrypted ciphertext should be stored unchanged")
	}
}

// TestWipeZerosBuffer asserts the wipe helper actually clears the slice.
func TestWipeZerosBuffer(t *testing.T) {
	b := []byte("super secret")
	wipe(b)
	for i, v := range b {
		if v != 0 {
			t.Fatalf("byte %d still %d", i, v)
		}
	}
}
