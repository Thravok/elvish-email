package envelope

import "testing"

func TestManifestValidate_NativeEncrypted(t *testing.T) {
	m := Manifest{
		Version:            VersionV1,
		Mode:               ModeNativeEncrypted,
		Provenance:         ProvenanceNativeEncrypted,
		BodyCipher:         BodyCipherXChaCha20Poly1305,
		SignatureAlgorithm: SignatureAlgorithmMLDSA65,
		BodyBlobRef:        "mail/user/message/body.enc",
		BodySizeBytes:      128,
		RecipientWraps: []RecipientWrap{{
			RecipientID:   "user-1",
			KeyHandle:     "mailbox-key-1",
			Algorithm:     WrapAlgorithmMLKEM768,
			WrappedKeyB64: "ZmFrZQ==",
		}},
		Attachments: []Attachment{{
			AttachmentID: "att-1",
			BlobRef:      "mail/user/message/attachments/att-1.enc",
			SizeBytes:    64,
		}},
	}
	if err := m.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestManifestValidate_AlreadyEncryptedOpenPGP(t *testing.T) {
	m := Manifest{
		Version:       VersionV1,
		Mode:          ModeAlreadyEncrypted,
		Provenance:    ProvenanceAlreadyEncrypted,
		BodyCipher:    BodyCipherOpenPGPMessage,
		BodyBlobRef:   "mail/user/message/body.enc",
		BodySizeBytes: 512,
	}
	if err := m.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestManifestValidate_RejectsMissingWraps(t *testing.T) {
	m := Manifest{
		Version:       VersionV1,
		Mode:          ModeNativeEncrypted,
		Provenance:    ProvenanceNativeEncrypted,
		BodyCipher:    BodyCipherAES256GCM,
		BodyBlobRef:   "mail/user/message/body.enc",
		BodySizeBytes: 128,
	}
	if err := m.Validate(); err == nil {
		t.Fatal("Validate() = nil, want error")
	}
}
