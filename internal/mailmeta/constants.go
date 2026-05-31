package mailmeta

// Source values for mail_ingest_ledger.source.
const (
	SourceSMTPInbound    = "smtp_inbound"
	SourceSMTPSubmission = "smtp_submission"
	SourceAPIClient      = "api_client"
	SourceInternal       = "internal"
)

// Provenance values for mail_ingest_ledger.provenance.
const (
	ProvenanceClientEncrypted      = "client_encrypted"
	ProvenanceAlreadyEncrypted     = "already_encrypted"
	ProvenanceSMTPGatewayEncrypted = "smtp_gateway_encrypted"
	ProvenanceSenderPGPMime        = "sender_pgp_mime"
)

// Folder names for Scylla mailbox listings.
const (
	FolderInbox   = "inbox"
	FolderSent    = "sent"
	FolderDrafts  = "drafts"
	FolderTrash   = "trash"
	FolderArchive = "archive"
)

// StandardFolders lists the built-in mailbox folder names.
var StandardFolders = []string{
	FolderInbox,
	FolderSent,
	FolderDrafts,
	FolderTrash,
	FolderArchive,
}

// KeyserverSource values for contact_pgp_keys.source.
const (
	KeyserverSourceLocal               = "local"
	KeyserverSourceWKDAdvanced         = "wkd_advanced"
	KeyserverSourceWKDDirect           = "wkd_direct"
	KeyserverSourceHKPSKeysOpenPGPOrg  = "hkps_keys_openpgp_org"
	KeyserverSourceHKPSKeyserverUbuntu = "hkps_keyserver_ubuntu_com"
	KeyserverSourceProton              = "proton"
)
