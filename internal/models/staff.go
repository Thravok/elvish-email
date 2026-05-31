package models

import (
	"time"

	"github.com/google/uuid"
)

// StaffRole is a Console RBAC role.
type StaffRole string

const (
	StaffRoleSuperAdmin   StaffRole = "super_admin"
	StaffRoleOperator     StaffRole = "operator"
	StaffRoleSupportAgent StaffRole = "support_agent"
)

// StaffUser is a Console operator account (not a platform user).
type StaffUser struct {
	ID           uuid.UUID
	Email        string
	Name         string
	PasswordHash string
	Role         StaffRole
	DisabledAt   *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// StaffAuditEntry records a staff action in Console.
type StaffAuditEntry struct {
	ID           uuid.UUID
	ActorStaffID *uuid.UUID
	Action       string
	TargetType   string
	TargetID     string
	MetadataJSON []byte
	CreatedAt    time.Time
}

// SupportMailboxConfig links Console support inbox to a platform user.
type SupportMailboxConfig struct {
	ID             string
	PlatformUserID uuid.UUID
	PrimaryAddress string
	Status         string
	UpdatedAt      time.Time
}

// SupportKeyVault holds escrowed support mailbox keys (ciphertext only).
type SupportKeyVault struct {
	PlatformUserID            uuid.UUID
	EncryptedAccountKey       []byte
	EncryptedIdentityKeysJSON []byte
	VaultKeyID                string
	RotatedAt                 time.Time
	UpdatedAt                 time.Time
}
