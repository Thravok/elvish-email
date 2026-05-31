package scyllastore

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gocql/gocql"
	"github.com/google/uuid"

	"elvish/internal/mailmeta"
)

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = errors.New("scyllastore: not found")

// cqlUUID converts google/uuid for gocql bind parameters. gocql only marshals
// gocql.UUID, [16]byte, string, and []byte — not github.com/google/uuid.UUID.
func cqlUUID(u uuid.UUID) gocql.UUID {
	return gocql.UUID(u)
}

// Config configures the Scylla session.
type Config struct {
	Hosts       []string
	Keyspace    string
	Username    string
	Password    string
	LocalDC     string
	Consistency string
	Timeout     time.Duration
}

// Store wraps a gocql session.
type Store struct {
	sess *gocql.Session
	ks   string
}

// Open dials the cluster and verifies the keyspace exists.
func Open(cfg Config) (*Store, error) {
	if len(cfg.Hosts) == 0 || cfg.Keyspace == "" {
		return nil, fmt.Errorf("scyllastore: hosts and keyspace required")
	}
	if err := ensureSchema(cfg); err != nil {
		return nil, err
	}
	cluster := newCluster(cfg)
	cluster.Keyspace = cfg.Keyspace
	sess, err := cluster.CreateSession()
	if err != nil {
		return nil, fmt.Errorf("scyllastore connect: %w", err)
	}
	return &Store{sess: sess, ks: cfg.Keyspace}, nil
}

func newCluster(cfg Config) *gocql.ClusterConfig {
	cluster := gocql.NewCluster(cfg.Hosts...)
	if cfg.Username != "" {
		cluster.Authenticator = gocql.PasswordAuthenticator{Username: cfg.Username, Password: cfg.Password}
	}
	if cfg.Timeout > 0 {
		cluster.Timeout = cfg.Timeout
		cluster.ConnectTimeout = cfg.Timeout
	} else {
		cluster.Timeout = 10 * time.Second
		cluster.ConnectTimeout = 10 * time.Second
	}
	switch cfg.Consistency {
	case "ONE":
		cluster.Consistency = gocql.One
	case "QUORUM":
		cluster.Consistency = gocql.Quorum
	case "LOCAL_QUORUM":
		cluster.Consistency = gocql.LocalQuorum
	case "":
		cluster.Consistency = gocql.LocalOne
	default:
		cluster.Consistency = gocql.LocalOne
	}
	if cfg.LocalDC != "" {
		cluster.PoolConfig.HostSelectionPolicy = gocql.DCAwareRoundRobinPolicy(cfg.LocalDC)
	}
	return cluster
}

// Close releases the session.
func (s *Store) Close() {
	if s != nil && s.sess != nil {
		s.sess.Close()
		s.sess = nil
	}
}

// Health runs a trivial keyspace lookup.
func (s *Store) Health(ctx context.Context) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	iter := s.sess.Query("SELECT release_version FROM system.local").WithContext(ctx).Iter()
	var v string
	if !iter.Scan(&v) {
		_ = iter.Close()
		return errors.New("scyllastore: no system.local row")
	}
	return iter.Close()
}

// Manifest is a per-message manifest row in message_manifest_by_id.
type Manifest struct {
	MessageID        uuid.UUID
	UserID           uuid.UUID
	Folder           string
	BodyBlobRef      string
	BodySizeBytes    int64
	HeaderCiphertext []byte
	Provenance       string
	Source           string
	HasAttachments   bool
	CreatedAt        time.Time
}

// MailboxRow is one row from messages_by_mailbox (manifest pointer; for inbox listing).
type MailboxRow struct {
	UserID         uuid.UUID
	Folder         string
	ReceivedAt     time.Time
	MessageID      uuid.UUID
	BodySizeBytes  int64
	Provenance     string
	HasAttachments bool
}

// Flags is the editable flag set for one message.
type Flags struct {
	Read     bool
	Starred  bool
	Deleted  bool
	Archived bool
	Labels   []string
}

// OptInMetadata holds sparse plaintext projections of consented header fields.
type OptInMetadata struct {
	Subject      string
	FromAddr     string
	ToAddrs      []string
	SentAt       time.Time
	ThreadID     string
	FlagsSummary string
}

// InsertManifest writes a manifest row + the corresponding mailbox listing row + initialized flags.
// Outbound copies in the sent folder start read=true (author already composed them).
func (s *Store) InsertManifest(ctx context.Context, m Manifest) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	if m.CreatedAt.IsZero() {
		m.CreatedAt = time.Now().UTC()
	}
	q := `INSERT INTO message_manifest_by_id (message_id, user_id, folder, body_blob_ref, body_size_bytes, header_ciphertext, provenance, source, created_at)
	      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	if err := s.sess.Query(q,
		cqlUUID(m.MessageID), cqlUUID(m.UserID), m.Folder, m.BodyBlobRef, m.BodySizeBytes, m.HeaderCiphertext, m.Provenance, m.Source, m.CreatedAt,
	).WithContext(ctx).Exec(); err != nil {
		return fmt.Errorf("manifest insert: %w", err)
	}
	q2 := `INSERT INTO messages_by_mailbox (user_id, folder, received_at, message_id, body_size_bytes, provenance, has_attachments)
	       VALUES (?, ?, ?, ?, ?, ?, ?)`
	if err := s.sess.Query(q2,
		cqlUUID(m.UserID), m.Folder, m.CreatedAt, cqlUUID(m.MessageID), m.BodySizeBytes, m.Provenance, m.HasAttachments,
	).WithContext(ctx).Exec(); err != nil {
		return fmt.Errorf("mailbox row insert: %w", err)
	}
	initialRead := m.Folder == mailmeta.FolderSent
	q3 := `INSERT INTO message_flags_by_user (user_id, message_id, read, starred, deleted, archived, labels, updated_at)
	       VALUES (?, ?, ?, false, false, false, {}, now())`
	if err := s.sess.Query(q3, cqlUUID(m.UserID), cqlUUID(m.MessageID), initialRead).WithContext(ctx).Exec(); err != nil {
		return fmt.Errorf("flags init: %w", err)
	}
	return nil
}

// DeleteManifest removes the manifest row and the mailbox listing row (compensating delete on partial-write failure).
func (s *Store) DeleteManifest(ctx context.Context, userID uuid.UUID, folder string, receivedAt time.Time, messageID uuid.UUID) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	if err := s.sess.Query(`DELETE FROM message_manifest_by_id WHERE message_id = ?`, cqlUUID(messageID)).WithContext(ctx).Exec(); err != nil {
		return err
	}
	return s.sess.Query(`DELETE FROM messages_by_mailbox WHERE user_id = ? AND folder = ? AND received_at = ? AND message_id = ?`,
		cqlUUID(userID), folder, receivedAt, cqlUUID(messageID),
	).WithContext(ctx).Exec()
}

// GetManifest returns a single manifest by id (must belong to userID).
func (s *Store) GetManifest(ctx context.Context, userID, messageID uuid.UUID) (*Manifest, error) {
	if s == nil || s.sess == nil {
		return nil, errors.New("scyllastore: nil")
	}
	q := `SELECT message_id, user_id, folder, body_blob_ref, body_size_bytes, header_ciphertext, provenance, source, created_at
	      FROM message_manifest_by_id WHERE message_id = ?`
	var m Manifest
	var mid, uid gocql.UUID
	err := s.sess.Query(q, cqlUUID(messageID)).WithContext(ctx).Scan(
		&mid, &uid, &m.Folder, &m.BodyBlobRef, &m.BodySizeBytes, &m.HeaderCiphertext, &m.Provenance, &m.Source, &m.CreatedAt,
	)
	if errors.Is(err, gocql.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	m.MessageID = uuid.UUID(mid)
	m.UserID = uuid.UUID(uid)
	if m.UserID != userID {
		return nil, ErrNotFound
	}
	return &m, nil
}

// ListMailbox returns up to limit rows from a mailbox folder, newest first.
func (s *Store) ListMailbox(ctx context.Context, userID uuid.UUID, folder string, before time.Time, limit int) ([]MailboxRow, error) {
	if s == nil || s.sess == nil {
		return nil, errors.New("scyllastore: nil")
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var iter *gocql.Iter
	if before.IsZero() {
		iter = s.sess.Query(`SELECT user_id, folder, received_at, message_id, body_size_bytes, provenance, has_attachments
		                     FROM messages_by_mailbox WHERE user_id = ? AND folder = ? LIMIT ?`,
			cqlUUID(userID), folder, limit,
		).WithContext(ctx).Iter()
	} else {
		iter = s.sess.Query(`SELECT user_id, folder, received_at, message_id, body_size_bytes, provenance, has_attachments
		                     FROM messages_by_mailbox WHERE user_id = ? AND folder = ? AND received_at < ? LIMIT ?`,
			cqlUUID(userID), folder, before, limit,
		).WithContext(ctx).Iter()
	}
	var out []MailboxRow
	for {
		var r MailboxRow
		var rowUser, rowMsg gocql.UUID
		if !iter.Scan(&rowUser, &r.Folder, &r.ReceivedAt, &rowMsg, &r.BodySizeBytes, &r.Provenance, &r.HasAttachments) {
			break
		}
		r.UserID = uuid.UUID(rowUser)
		r.MessageID = uuid.UUID(rowMsg)
		out = append(out, r)
	}
	if err := iter.Close(); err != nil {
		return nil, err
	}
	return out, nil
}

// CountMailbox returns how many messages are listed in a mailbox partition (may be expensive on huge folders).
func (s *Store) CountMailbox(ctx context.Context, userID uuid.UUID, folder string) (int64, error) {
	if s == nil || s.sess == nil {
		return 0, errors.New("scyllastore: nil")
	}
	iter := s.sess.Query(`SELECT COUNT(*) FROM messages_by_mailbox WHERE user_id = ? AND folder = ?`,
		cqlUUID(userID), folder,
	).WithContext(ctx).Iter()
	var n int64
	if !iter.Scan(&n) {
		return 0, iter.Close()
	}
	return n, iter.Close()
}

// InsertMailboxRow writes one mailbox listing row.
func (s *Store) InsertMailboxRow(ctx context.Context, row MailboxRow) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	q := `INSERT INTO messages_by_mailbox (user_id, folder, received_at, message_id, body_size_bytes, provenance, has_attachments)
	      VALUES (?, ?, ?, ?, ?, ?, ?)`
	return s.sess.Query(q,
		cqlUUID(row.UserID), row.Folder, row.ReceivedAt, cqlUUID(row.MessageID), row.BodySizeBytes, row.Provenance, row.HasAttachments,
	).WithContext(ctx).Exec()
}

// DeleteMailboxRow removes one mailbox listing row.
func (s *Store) DeleteMailboxRow(ctx context.Context, userID uuid.UUID, folder string, receivedAt time.Time, messageID uuid.UUID) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	return s.sess.Query(`DELETE FROM messages_by_mailbox WHERE user_id = ? AND folder = ? AND received_at = ? AND message_id = ?`,
		cqlUUID(userID), folder, receivedAt, cqlUUID(messageID),
	).WithContext(ctx).Exec()
}

// UpdateManifestFolder updates the manifest's logical folder.
func (s *Store) UpdateManifestFolder(ctx context.Context, messageID uuid.UUID, folder string) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	return s.sess.Query(`UPDATE message_manifest_by_id SET folder = ? WHERE message_id = ?`,
		folder, cqlUUID(messageID),
	).WithContext(ctx).Exec()
}

// UpdateManifestHeaderCiphertext updates the encrypted header summary for one message.
func (s *Store) UpdateManifestHeaderCiphertext(ctx context.Context, messageID uuid.UUID, headerCiphertext []byte) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	return s.sess.Query(`UPDATE message_manifest_by_id SET header_ciphertext = ? WHERE message_id = ?`,
		headerCiphertext, cqlUUID(messageID),
	).WithContext(ctx).Exec()
}

// SetFlags updates message_flags_by_user for one message.
func (s *Store) SetFlags(ctx context.Context, userID, messageID uuid.UUID, f Flags) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	q := `INSERT INTO message_flags_by_user (user_id, message_id, read, starred, deleted, archived, labels, updated_at)
	      VALUES (?, ?, ?, ?, ?, ?, ?, now())`
	return s.sess.Query(q, cqlUUID(userID), cqlUUID(messageID), f.Read, f.Starred, f.Deleted, f.Archived, f.Labels).WithContext(ctx).Exec()
}

// GetFlags returns the flags for one message.
func (s *Store) GetFlags(ctx context.Context, userID, messageID uuid.UUID) (*Flags, error) {
	if s == nil || s.sess == nil {
		return nil, errors.New("scyllastore: nil")
	}
	var f Flags
	err := s.sess.Query(`SELECT read, starred, deleted, archived, labels FROM message_flags_by_user WHERE user_id = ? AND message_id = ?`,
		cqlUUID(userID), cqlUUID(messageID),
	).WithContext(ctx).Scan(&f.Read, &f.Starred, &f.Deleted, &f.Archived, &f.Labels)
	if errors.Is(err, gocql.ErrNotFound) {
		return nil, ErrNotFound
	}
	return &f, err
}

// DeleteFlags removes the flag row for one message.
func (s *Store) DeleteFlags(ctx context.Context, userID, messageID uuid.UUID) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	return s.sess.Query(`DELETE FROM message_flags_by_user WHERE user_id = ? AND message_id = ?`,
		cqlUUID(userID), cqlUUID(messageID),
	).WithContext(ctx).Exec()
}

// AppendEvent records a delivery / mailbox event with TTL.
func (s *Store) AppendEvent(ctx context.Context, userID uuid.UUID, kind string, messageID uuid.UUID, detail string) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	q := `INSERT INTO message_events_by_user (user_id, event_at, event_id, kind, message_id, detail) VALUES (?, ?, now(), ?, ?, ?)`
	return s.sess.Query(q, cqlUUID(userID), time.Now().UTC(), kind, cqlUUID(messageID), detail).WithContext(ctx).Exec()
}

// SetOptInMetadata writes the sparse plaintext metadata projection (only consented fields).
func (s *Store) SetOptInMetadata(ctx context.Context, userID, messageID uuid.UUID, m OptInMetadata) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	q := `INSERT INTO opt_in_metadata_by_user (user_id, message_id, subject, from_addr, to_addrs, sent_at, thread_id, flags_summary)
	      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	return s.sess.Query(q, cqlUUID(userID), cqlUUID(messageID), m.Subject, m.FromAddr, m.ToAddrs, m.SentAt, m.ThreadID, m.FlagsSummary).WithContext(ctx).Exec()
}

// GetOptInMetadata fetches the sparse opt-in projection for one message (returns ErrNotFound if absent).
func (s *Store) GetOptInMetadata(ctx context.Context, userID, messageID uuid.UUID) (*OptInMetadata, error) {
	if s == nil || s.sess == nil {
		return nil, errors.New("scyllastore: nil")
	}
	var m OptInMetadata
	err := s.sess.Query(`SELECT subject, from_addr, to_addrs, sent_at, thread_id, flags_summary
		FROM opt_in_metadata_by_user WHERE user_id = ? AND message_id = ?`, cqlUUID(userID), cqlUUID(messageID),
	).WithContext(ctx).Scan(&m.Subject, &m.FromAddr, &m.ToAddrs, &m.SentAt, &m.ThreadID, &m.FlagsSummary)
	if errors.Is(err, gocql.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DeleteOptInMetadata removes one sparse metadata row.
func (s *Store) DeleteOptInMetadata(ctx context.Context, userID, messageID uuid.UUID) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	return s.sess.Query(`DELETE FROM opt_in_metadata_by_user WHERE user_id = ? AND message_id = ?`,
		cqlUUID(userID), cqlUUID(messageID),
	).WithContext(ctx).Exec()
}

// DeleteMailboxPartition removes all mailbox rows for one user/folder partition.
func (s *Store) DeleteMailboxPartition(ctx context.Context, userID uuid.UUID, folder string) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	return s.sess.Query(`DELETE FROM messages_by_mailbox WHERE user_id = ? AND folder = ?`,
		cqlUUID(userID), folder,
	).WithContext(ctx).Exec()
}

// DeleteUserFlags removes the full flags partition for one user.
func (s *Store) DeleteUserFlags(ctx context.Context, userID uuid.UUID) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	return s.sess.Query(`DELETE FROM message_flags_by_user WHERE user_id = ?`,
		cqlUUID(userID),
	).WithContext(ctx).Exec()
}

// DeleteUserEvents removes the full event-stream partition for one user.
func (s *Store) DeleteUserEvents(ctx context.Context, userID uuid.UUID) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	return s.sess.Query(`DELETE FROM message_events_by_user WHERE user_id = ?`,
		cqlUUID(userID),
	).WithContext(ctx).Exec()
}

// DeleteUserOptInMetadata removes the full sparse-metadata partition for one user.
func (s *Store) DeleteUserOptInMetadata(ctx context.Context, userID uuid.UUID) error {
	if s == nil || s.sess == nil {
		return errors.New("scyllastore: nil")
	}
	return s.sess.Query(`DELETE FROM opt_in_metadata_by_user WHERE user_id = ?`,
		cqlUUID(userID),
	).WithContext(ctx).Exec()
}

// SearchOptInMetadata returns message_ids whose consented fields contain any of the query tokens (case-insensitive).
// Implementation note: Scylla SASI/secondary indexes are not assumed; we scan the user's rows in-memory.
// For very large mailboxes the worker should be configured to limit how many rows to scan.
func (s *Store) SearchOptInMetadata(ctx context.Context, userID uuid.UUID, fields []string, q string, limit int) ([]uuid.UUID, error) {
	if s == nil || s.sess == nil {
		return nil, errors.New("scyllastore: nil")
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	iter := s.sess.Query(`SELECT message_id, subject, from_addr, to_addrs FROM opt_in_metadata_by_user WHERE user_id = ?`, cqlUUID(userID)).
		WithContext(ctx).PageSize(200).Iter()
	defer func() { _ = iter.Close() }()
	wantSubject := stringSliceContains(fields, "subject")
	wantFrom := stringSliceContains(fields, "from_addr")
	wantTo := stringSliceContains(fields, "to_addrs")
	var out []uuid.UUID
	var (
		mid    gocql.UUID
		subj   string
		from   string
		toList []string
	)
	for iter.Scan(&mid, &subj, &from, &toList) {
		if matchesQuery(q, subj, from, toList, wantSubject, wantFrom, wantTo) {
			out = append(out, uuid.UUID(mid))
			if len(out) >= limit {
				break
			}
		}
	}
	return out, iter.Close()
}

func stringSliceContains(ss []string, v string) bool {
	for _, s := range ss {
		if s == v {
			return true
		}
	}
	return false
}

func matchesQuery(q, subject, from string, toAddrs []string, wantSubject, wantFrom, wantTo bool) bool {
	q = strings.ToLower(strings.TrimSpace(q))
	if q == "" {
		return false
	}
	if wantSubject && containsFold(subject, q) {
		return true
	}
	if wantFrom && containsFold(from, q) {
		return true
	}
	if wantTo {
		for _, t := range toAddrs {
			if containsFold(t, q) {
				return true
			}
		}
	}
	return false
}

func containsFold(haystack, needle string) bool {
	return strings.Contains(strings.ToLower(haystack), needle)
}
