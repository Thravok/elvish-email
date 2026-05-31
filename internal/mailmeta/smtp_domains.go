package mailmeta

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// OwnedDomain is a row from mail_domains for API listing.
type OwnedDomain struct {
	Domain               string    `json:"domain"`
	Status               string    `json:"status"`
	MXVerified           bool      `json:"mx_verified"`
	SPFVerified          bool      `json:"spf_verified"`
	DKIMVerified         bool      `json:"dkim_verified"`
	DMARCVerified        bool      `json:"dmarc_verified"`
	VerificationTXTHost  string    `json:"verification_txt_host,omitempty"`
	VerificationTXTValue string    `json:"verification_txt_value,omitempty"`
	CatchallIdentityFP   string    `json:"catchall_identity_fp,omitempty"`
	DKIMSelector         string    `json:"dkim_selector,omitempty"`
	DKIMKeyRef           string    `json:"dkim_key_ref,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
}

func normalizeOwnedDomain(domain string) (string, error) {
	domain = strings.Trim(strings.TrimSpace(strings.ToLower(domain)), ".")
	if domain == "" || len(domain) > 253 || !strings.Contains(domain, ".") {
		return "", errors.New("mailmeta: invalid domain")
	}
	parts := strings.Split(domain, ".")
	for _, part := range parts {
		if part == "" || len(part) > 63 {
			return "", errors.New("mailmeta: invalid domain")
		}
		if part[0] == '-' || part[len(part)-1] == '-' {
			return "", errors.New("mailmeta: invalid domain")
		}
		for _, r := range part {
			switch {
			case r >= 'a' && r <= 'z':
			case r >= '0' && r <= '9':
			case r == '-':
			default:
				return "", errors.New("mailmeta: invalid domain")
			}
		}
	}
	return domain, nil
}

// ListOwnedDomains returns domains owned by userID.
func (s *Store) ListOwnedDomains(ctx context.Context, userID uuid.UUID) ([]OwnedDomain, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT domain, status, mx_verified, spf_verified, dkim_verified, dmarc_verified,
		verification_txt_host, verification_txt_value, catchall_identity_fp, dkim_selector, dkim_key_id, created_at
		FROM mail_domains WHERE owner_user_id = $1 ORDER BY domain ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OwnedDomain
	for rows.Next() {
		var d OwnedDomain
		if err := rows.Scan(&d.Domain, &d.Status, &d.MXVerified, &d.SPFVerified, &d.DKIMVerified, &d.DMARCVerified,
			&d.VerificationTXTHost, &d.VerificationTXTValue, &d.CatchallIdentityFP, &d.DKIMSelector, &d.DKIMKeyRef, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// UserOwnsActiveInboundDomain reports whether userID owns domain and inbound mail is ready
// (status active and MX verified).
func (s *Store) UserOwnsActiveInboundDomain(ctx context.Context, userID uuid.UUID, domain string) (bool, error) {
	if s == nil || s.pool == nil {
		return false, errors.New("mailmeta: nil")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	if domain == "" {
		return false, nil
	}
	var mxOK bool
	var status string
	err := s.pool.QueryRow(ctx, `SELECT mx_verified, status FROM mail_domains WHERE domain = $1 AND owner_user_id = $2`,
		domain, userID).Scan(&mxOK, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	st := strings.TrimSpace(strings.ToLower(status))
	return mxOK && st == "active", nil
}

// Share modes for mail_domains.share_mode (who may create identities on an active MX-verified domain).
const (
	ShareModeOwnerOnly        = "owner_only"
	ShareModeAllVerifiedUsers = "all_verified_users"
	ShareModeAllowlist        = "allowlist"
)

// ValidShareMode reports whether s is a legal share_mode value.
func ValidShareMode(s string) bool {
	switch strings.TrimSpace(strings.ToLower(s)) {
	case ShareModeOwnerOnly, ShareModeAllVerifiedUsers, ShareModeAllowlist:
		return true
	default:
		return false
	}
}

// UserMayUseDomainForMailbox is true when userID may create a mailbox identity @domain
// (platform domain is checked separately by the caller). Requires active status and MX verified.
func (s *Store) UserMayUseDomainForMailbox(ctx context.Context, userID uuid.UUID, domain string) (bool, error) {
	if s == nil || s.pool == nil {
		return false, errors.New("mailmeta: nil")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	if domain == "" {
		return false, nil
	}
	ok, err := s.UserOwnsActiveInboundDomain(ctx, userID, domain)
	if err != nil || ok {
		return ok, err
	}
	var shareMode string
	var mxOK bool
	var status string
	err = s.pool.QueryRow(ctx, `SELECT share_mode, mx_verified, status FROM mail_domains WHERE domain = $1`, domain).Scan(&shareMode, &mxOK, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	st := strings.TrimSpace(strings.ToLower(status))
	if !mxOK || st != "active" {
		return false, nil
	}
	switch strings.TrimSpace(strings.ToLower(shareMode)) {
	case ShareModeAllVerifiedUsers:
		return true, nil
	case ShareModeAllowlist:
		var exists bool
		err = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM mail_domain_allowlist WHERE domain = $1 AND user_id = $2)`,
			domain, userID).Scan(&exists)
		if err != nil {
			return false, err
		}
		return exists, nil
	default:
		return false, nil
	}
}

// UsableMailboxDomain is one domain the user may pick when creating identities (owned or shared).
type UsableMailboxDomain struct {
	Domain string `json:"domain"`
	Source string `json:"source"` // owned | shared
}

// ListUsableDomainsForUser returns active MX-verified domains the user may use for new identities.
func (s *Store) ListUsableDomainsForUser(ctx context.Context, userID uuid.UUID) ([]UsableMailboxDomain, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	owned, err := s.ListOwnedDomains(ctx, userID)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]struct{})
	var out []UsableMailboxDomain
	for _, d := range owned {
		if !d.MXVerified || strings.TrimSpace(strings.ToLower(d.Status)) != "active" {
			continue
		}
		seen[d.Domain] = struct{}{}
		out = append(out, UsableMailboxDomain{Domain: d.Domain, Source: "owned"})
	}
	rows, err := s.pool.Query(ctx, `SELECT d.domain FROM mail_domains d
		WHERE d.mx_verified = true AND lower(btrim(d.status)) = 'active'
		AND (
			d.share_mode = $2
			OR (d.share_mode = $3 AND EXISTS (SELECT 1 FROM mail_domain_allowlist a WHERE a.domain = d.domain AND a.user_id = $1))
		)
		AND (d.owner_user_id IS DISTINCT FROM $1)`,
		userID, ShareModeAllVerifiedUsers, ShareModeAllowlist)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var dom string
		if err := rows.Scan(&dom); err != nil {
			return nil, err
		}
		if _, dup := seen[dom]; dup {
			continue
		}
		seen[dom] = struct{}{}
		out = append(out, UsableMailboxDomain{Domain: dom, Source: "shared"})
	}
	return out, rows.Err()
}

// SetDomainShareMode updates share_mode for a domain (admin).
func (s *Store) SetDomainShareMode(ctx context.Context, domain, mode string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	if !ValidShareMode(mode) {
		return errors.New("mailmeta: invalid share_mode")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	tag, err := s.pool.Exec(ctx, `UPDATE mail_domains SET share_mode = $2 WHERE domain = $1`, domain, strings.TrimSpace(strings.ToLower(mode)))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ReplaceDomainAllowlist replaces the full allowlist for a domain (admin). userIDs may be empty.
func (s *Store) ReplaceDomainAllowlist(ctx context.Context, domain string, userIDs []uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `DELETE FROM mail_domain_allowlist WHERE domain = $1`, domain); err != nil {
		return err
	}
	for _, uid := range userIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO mail_domain_allowlist (domain, user_id) VALUES ($1, $2)`, domain, uid); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// DomainAllowlistEntry is one allowlisted user for a shared domain.
type DomainAllowlistEntry struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
}

// ListDomainAllowlist returns allowlisted users with emails for admin UI.
func (s *Store) ListDomainAllowlist(ctx context.Context, domain string) ([]DomainAllowlistEntry, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	rows, err := s.pool.Query(ctx, `SELECT a.user_id, COALESCE(u.email, '') FROM mail_domain_allowlist a
		JOIN users u ON u.id = a.user_id WHERE a.domain = $1 ORDER BY u.email`, domain)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DomainAllowlistEntry
	for rows.Next() {
		var e DomainAllowlistEntry
		if err := rows.Scan(&e.UserID, &e.Email); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// InsertOwnedDomain registers a domain for the user with verification token metadata.
func (s *Store) InsertOwnedDomain(ctx context.Context, userID uuid.UUID, domain, verificationHost, verificationValue string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	var err error
	domain, err = normalizeOwnedDomain(domain)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO mail_domains (domain, owner_user_id, status, verification_txt_host, verification_txt_value, created_at)
		VALUES ($1,$2,'pending',$3,$4,now())`,
		domain, userID, verificationHost, verificationValue)
	return err
}

// SetOwnedDomainDKIM stores the DKIM selector and private-key file basename (mail_domains.dkim_key_id) for a domain.
func (s *Store) SetOwnedDomainDKIM(ctx context.Context, userID uuid.UUID, domain, selector, keyRef string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	selector = strings.TrimSpace(strings.ToLower(selector))
	keyRef = strings.TrimSpace(keyRef)
	tag, err := s.pool.Exec(ctx, `UPDATE mail_domains SET dkim_selector=$3, dkim_key_id=$4 WHERE domain=$1 AND owner_user_id=$2`,
		domain, userID, selector, keyRef)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetDomainDKIMByName returns stored DKIM selector and key file basename for domain (any owner).
func (s *Store) GetDomainDKIMByName(ctx context.Context, domain string) (selector, keyRef string, err error) {
	if s == nil || s.pool == nil {
		return "", "", errors.New("mailmeta: nil")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	err = s.pool.QueryRow(ctx, `SELECT dkim_selector, dkim_key_id FROM mail_domains WHERE domain=$1`, domain).Scan(&selector, &keyRef)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrNotFound
	}
	if err != nil {
		return "", "", err
	}
	return strings.TrimSpace(strings.ToLower(selector)), strings.TrimSpace(keyRef), nil
}

// DeleteOwnedDomain removes a domain owned by the user.
func (s *Store) DeleteOwnedDomain(ctx context.Context, userID uuid.UUID, domain string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	tag, err := s.pool.Exec(ctx, `DELETE FROM mail_domains WHERE domain = $1 AND owner_user_id = $2`, domain, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetDomainCatchall updates catch-all routing fingerprint.
func (s *Store) SetDomainCatchall(ctx context.Context, userID uuid.UUID, domain, fingerprint string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	tag, err := s.pool.Exec(ctx, `UPDATE mail_domains SET catchall_identity_fp = $3 WHERE domain = $1 AND owner_user_id = $2`,
		domain, userID, strings.TrimSpace(fingerprint))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// UpdateDomainVerification stores booleans from DNS checks.
func (s *Store) UpdateDomainVerification(ctx context.Context, userID uuid.UUID, domain string, mx, spf, dkim, dmarc bool, status string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	tag, err := s.pool.Exec(ctx, `UPDATE mail_domains SET mx_verified=$3, spf_verified=$4, dkim_verified=$5, dmarc_verified=$6, status=$7
		WHERE domain=$1 AND owner_user_id=$2`,
		domain, userID, mx, spf, dkim, dmarc, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SMTPCredentialMeta lists credential rows without password hashes.
type SMTPCredentialMeta struct {
	ID                  uuid.UUID `json:"id"`
	Name                string    `json:"name"`
	IdentityFingerprint string    `json:"identity_fingerprint"`
	IdentityEmail       string    `json:"identity_email"`
	Username            string    `json:"username"`
	CreatedAt           time.Time `json:"created_at"`
}

// ListSMTPCredentials lists SMTP credentials for a user.
func (s *Store) ListSMTPCredentials(ctx context.Context, userID uuid.UUID) ([]SMTPCredentialMeta, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT c.credential_id, c.name, c.identity_fingerprint, c.username, c.created_at,
		COALESCE(ik.email, '') AS identity_email
		FROM user_smtp_credentials c
		LEFT JOIN user_identity_keys ik
			ON ik.user_id = c.user_id
			AND ik.fingerprint = c.identity_fingerprint
			AND ik.is_active = true
		WHERE c.user_id = $1 ORDER BY c.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SMTPCredentialMeta
	for rows.Next() {
		var r SMTPCredentialMeta
		if err := rows.Scan(&r.ID, &r.Name, &r.IdentityFingerprint, &r.Username, &r.CreatedAt, &r.IdentityEmail); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// InsertSMTPCredential inserts a new SMTP credential; passwordHash is bcrypt of client-visible SMTP password.
func (s *Store) InsertSMTPCredential(ctx context.Context, userID uuid.UUID, name, identityFP, username, passwordHash string) (uuid.UUID, error) {
	if s == nil || s.pool == nil {
		return uuid.Nil, errors.New("mailmeta: nil")
	}
	id := uuid.New()
	_, err := s.pool.Exec(ctx, `INSERT INTO user_smtp_credentials (user_id, credential_id, name, identity_fingerprint, username, password_hash, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,now())`,
		userID, id, strings.TrimSpace(name), strings.TrimSpace(strings.ToUpper(identityFP)), username, passwordHash)
	return id, err
}

// UpdateSMTPCredentialPassword replaces bcrypt hash after regenerate.
func (s *Store) UpdateSMTPCredentialPassword(ctx context.Context, userID, credentialID uuid.UUID, username, passwordHash string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE user_smtp_credentials SET username=$3, password_hash=$4 WHERE user_id=$1 AND credential_id=$2`,
		userID, credentialID, username, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteSMTPCredential removes one credential.
func (s *Store) DeleteSMTPCredential(ctx context.Context, userID, credentialID uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM user_smtp_credentials WHERE user_id=$1 AND credential_id=$2`, userID, credentialID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SMTPCredentialForAuth looks up by SMTP username (login).
func (s *Store) SMTPCredentialForAuth(ctx context.Context, username string) (userID uuid.UUID, passwordHash string, err error) {
	if s == nil || s.pool == nil {
		return uuid.Nil, "", errors.New("mailmeta: nil")
	}
	const q = `SELECT user_id, password_hash FROM user_smtp_credentials WHERE username = $1`
	err = s.pool.QueryRow(ctx, q, username).Scan(&userID, &passwordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, "", ErrNotFound
	}
	return userID, passwordHash, err
}

// AdminDomain is a row from mail_domains for admin API listing (includes owner info).
type AdminDomain struct {
	Domain               string    `json:"domain"`
	OwnerUserID          uuid.UUID `json:"owner_user_id"`
	OwnerEmail           string    `json:"owner_email,omitempty"`
	Status               string    `json:"status"`
	MXVerified           bool      `json:"mx_verified"`
	SPFVerified          bool      `json:"spf_verified"`
	DKIMVerified         bool      `json:"dkim_verified"`
	DMARCVerified        bool      `json:"dmarc_verified"`
	VerificationTXTHost  string    `json:"verification_txt_host,omitempty"`
	VerificationTXTValue string    `json:"verification_txt_value,omitempty"`
	CatchallIdentityFP   string    `json:"catchall_identity_fp,omitempty"`
	DKIMSelector         string    `json:"dkim_selector,omitempty"`
	DKIMKeyRef           string    `json:"dkim_key_ref,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	ShareMode            string    `json:"share_mode"`
	AllowlistCount       int64     `json:"allowlist_count"`
}

// ListAllDomains returns all custom domains for admin view.
func (s *Store) ListAllDomains(ctx context.Context, offset, limit int) ([]AdminDomain, int64, error) {
	if s == nil || s.pool == nil {
		return nil, 0, errors.New("mailmeta: nil")
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	var total int64
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM mail_domains`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := s.pool.Query(ctx, `SELECT d.domain, d.owner_user_id, COALESCE(u.email, ''), d.status, d.mx_verified, d.spf_verified, d.dkim_verified, d.dmarc_verified,
		d.verification_txt_host, d.verification_txt_value, d.catchall_identity_fp, d.dkim_selector, d.dkim_key_id, d.created_at,
		d.share_mode, COALESCE((SELECT count(*)::bigint FROM mail_domain_allowlist al WHERE al.domain = d.domain), 0)
		FROM mail_domains d
		LEFT JOIN users u ON u.id = d.owner_user_id
		ORDER BY d.created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []AdminDomain
	for rows.Next() {
		var d AdminDomain
		if err := rows.Scan(&d.Domain, &d.OwnerUserID, &d.OwnerEmail, &d.Status, &d.MXVerified, &d.SPFVerified, &d.DKIMVerified, &d.DMARCVerified,
			&d.VerificationTXTHost, &d.VerificationTXTValue, &d.CatchallIdentityFP, &d.DKIMSelector, &d.DKIMKeyRef, &d.CreatedAt, &d.ShareMode, &d.AllowlistCount); err != nil {
			return nil, 0, err
		}
		out = append(out, d)
	}
	return out, total, rows.Err()
}

// GetCustomDomainByID returns a domain by domain name (no user filter, admin use).
func (s *Store) GetCustomDomainByID(ctx context.Context, domainID uuid.UUID) (*AdminDomain, error) {
	// Note: domains use domain name as key, not UUID. The domainID here is actually passed as string in the API.
	// For proper implementation, this would need schema change. For now, return not found.
	return nil, ErrNotFound
}

// GetCustomDomainByName returns a domain by domain name (admin).
func (s *Store) GetCustomDomainByName(ctx context.Context, domain string) (*AdminDomain, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	var d AdminDomain
	err := s.pool.QueryRow(ctx, `SELECT d.domain, d.owner_user_id, COALESCE(u.email, ''), d.status, d.mx_verified, d.spf_verified, d.dkim_verified, d.dmarc_verified,
		d.verification_txt_host, d.verification_txt_value, d.catchall_identity_fp, d.dkim_selector, d.dkim_key_id, d.created_at,
		d.share_mode, COALESCE((SELECT count(*)::bigint FROM mail_domain_allowlist al WHERE al.domain = d.domain), 0)
		FROM mail_domains d
		LEFT JOIN users u ON u.id = d.owner_user_id
		WHERE d.domain = $1`, strings.ToLower(strings.TrimSpace(domain))).Scan(
		&d.Domain, &d.OwnerUserID, &d.OwnerEmail, &d.Status, &d.MXVerified, &d.SPFVerified, &d.DKIMVerified, &d.DMARCVerified,
		&d.VerificationTXTHost, &d.VerificationTXTValue, &d.CatchallIdentityFP, &d.DKIMSelector, &d.DKIMKeyRef, &d.CreatedAt,
		&d.ShareMode, &d.AllowlistCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}
