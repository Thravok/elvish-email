// Package blobstore is a small S3-compatible object client (PUT/GET/HEAD/DELETE)
// signed with AWS SigV4. Owned in-tree to keep the supply chain narrow and to
// avoid pulling aws-sdk-go-v2 or minio-go.
//
// Used by mailpipe to persist encrypted message bodies and outbox payloads.
// Server never holds plaintext bodies; everything written here is PGP ciphertext.
package blobstore
