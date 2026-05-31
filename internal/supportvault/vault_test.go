package supportvault

import (
	"encoding/base64"
	"testing"
)

func TestVaultEncryptRoundTrip(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	v, err := Open(base64.StdEncoding.EncodeToString(key), "test")
	if err != nil {
		t.Fatal(err)
	}
	plain := []byte(`{"armored_private":"-----BEGIN PGP PRIVATE KEY BLOCK-----\n"}`)
	ct, err := v.Encrypt(plain)
	if err != nil {
		t.Fatal(err)
	}
	out, err := v.Decrypt(ct)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != string(plain) {
		t.Fatalf("round trip mismatch")
	}
}
