// Package scyllastore is the high-volume mailbox layer (per-user partitions).
//
// Houses message manifests, mailbox listings, flags, events, and the sparse
// opt-in plaintext metadata projection. Backed by ScyllaDB / Cassandra via
// gocql, wrapped behind narrow interfaces so the driver can be swapped later.
//
// Body bytes are NOT stored here — they live in object storage. Manifest rows
// contain only the encrypted header blob plus a blob_ref pointing at the
// ciphertext body in the object store.
package scyllastore
