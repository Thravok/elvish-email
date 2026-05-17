# Backend Settings API Implementation Notes

This document outlines the backend API endpoints and systems needed to support the comprehensive mail settings page.

---

## Current Status

### Already Implemented
- `GET/POST /api/v1/mail/settings` - Mail consent settings (per-field metadata consent)
- `GET /api/v1/identities` - List user identities
- `POST /api/v1/identities/default` - Set default identity  
- `DELETE /api/v1/identities/:fingerprint` - Delete an identity
- `GET /api/v1/keys/lookup` - Recipient key lookup (keyserver chain)

---

## Required API Endpoints

### 1. Account & Security

#### Password Change
```
POST /api/v1/auth/password/change
Request: {
  current_password: string,
  new_password: string
}
Response: { success: bool, message: string }
```

**Backend work needed:**
- Re-encrypt all GPG keys with the new password-derived key
- Implement SRP-6a password change flow (new verifier)
- Session invalidation (optional: all other sessions)

#### Two-Factor Authentication
```
GET /api/auth/2fa
Response: {
  mfa: {
    enabled: bool,
    preferred_method: "totp" | "webauthn" | "",
    methods: string[],
    totp_factors: [{ id: string, label: string, last_used_at?: datetime }],
    webauthn_factors: [{ id: string, label: string, last_used_at?: datetime }],
    recovery_remaining: number
  }
}

POST /api/auth/2fa/totp/begin
Response: { setup_id: string, secret: string, otpauth_url: string, qr_png_url: string }

POST /api/auth/2fa/totp/confirm
Request: { setup_id: string, code: string }
Response: { ok: true, factor_id: string, recovery_codes?: string[] }

POST /api/auth/2fa/webauthn/register/begin
POST /api/auth/2fa/webauthn/register/finish

POST /api/auth/2fa/verify/totp
POST /api/auth/2fa/verify/recovery
POST /api/auth/2fa/verify/webauthn/begin
POST /api/auth/2fa/verify/webauthn/finish

POST /api/auth/2fa/recovery/regenerate
DELETE /api/auth/2fa/totp/:id
DELETE /api/auth/2fa/webauthn/:id
```

**Implementation notes:**
- Auth routes live under `/api/auth/...` rather than `/api/v1/auth/...`.
- Login now becomes a two-step flow when MFA is enabled:
  - first factor (`/api/auth/login` or SRP begin/finish)
  - second factor (`/api/auth/2fa/login/*`)
- TOTP seeds are encrypted at rest with `ELVISH_MFA_ENCRYPTION_KEY`.
- Recovery codes are stored hashed and rotated on regeneration.

---

### 2. Identity Management (Enhanced)

#### Create New Identity (Alias)
```
POST /api/v1/identities
Request: {
  name: string,           // e.g., "work", "personal"
  type: "alias" | "plus" | "disposable",
  expires_at?: datetime   // for disposable only
}
Response: {
  identity: {
    fingerprint: string,
    email: string,
    type: string,
    ...
  }
}
```

**Backend work needed:**
- Validate identity name (3-30 chars, alphanumeric + underscore)
- Check for conflicts with existing identities
- Generate GPG keypair (client-side, but backend stores encrypted private key)
- Create email alias in mail system (MTA configuration)

#### Plus Address Configuration
```
POST /api/v1/identities/plus
Request: {
  tag: string,            // The +tag part
  folder?: string,        // Route to folder (optional)
  enabled: bool
}
Response: { success: bool }
```

**Backend work needed:**
- Plus address routing rules storage
- Integration with mail filter/delivery system

#### Disposable Address
```
POST /api/v1/identities/disposable
Request: {
  expires_in_days?: number  // Default 30
}
Response: {
  identity: {
    email: string,        // Random generated address
    expires_at: datetime
  }
}
```

**Backend work needed:**
- Random address generation
- TTL/expiration handling
- Cleanup job for expired addresses

---

### 3. Folder Management

#### List Folders
```
GET /api/v1/mailbox/folders
Response: {
  folders: [{
    name: string,
    total: number,
    unread: number,
    is_standard: bool
  }]
}
```

#### Create Folder
```
POST /api/v1/mailbox/folders
Request: { name: string }
Response: { folder: { name: string, ... } }
```

#### Delete Folder
```
DELETE /api/v1/mailbox/folders/:name
Response: { success: bool }
```

**Backend work needed:**
- Folder storage (ScyllaDB table: `mail_folders`)
- Standard folders (inbox, sent, drafts, trash) should be immutable
- Validate folder names (alphanumeric, dashes, underscores, max 50 chars)
- Handle folder deletion (move messages to trash or delete)

---

### 4. Email Filters

#### List Filters
```
GET /api/v1/filters
Response: {
  filters: [{
    id: string,
    name: string,
    enabled: bool,
    priority: number,
    conditions: FilterCondition[],
    actions: FilterAction[]
  }]
}
```

#### Create/Update Filter
```
POST /api/v1/filters
PUT /api/v1/filters/:id
Request: {
  name: string,
  enabled: bool,
  priority?: number,
  conditions: [{
    type: "sender" | "subject" | "recipient" | "header" | "body" | "size" | "attachment",
    operator: "contains" | "equals" | "starts_with" | "ends_with" | "matches" | "greater_than" | "less_than",
    value: string
  }],
  actions: [{
    type: "move" | "mark_read" | "mark_important" | "delete" | "forward" | "label",
    value?: string  // folder name, email, label
  }]
}
Response: { filter: Filter }
```

#### Delete Filter
```
DELETE /api/v1/filters/:id
Response: { success: bool }
```

**Backend work needed:**
- Filter storage (ScyllaDB table: `mail_filters`)
- Filter execution engine (at message delivery time)
- Note: Body matching only works on unencrypted portions
- Priority ordering for multiple matching filters
- Import/export filters as JSON

---

### 5. Custom Domains (Paid Feature)

#### List Domains
```
GET /api/v1/custom-domains
Response: {
  domains: [{
    domain: string,
    status: "pending" | "active",
    mx_verified: bool,
    spf_verified: bool,
    dkim_verified: bool,
    dmarc_verified: bool,
    verification_txt_host: string,
    verification_txt_value: string,
    dns_config: {
      verification_txt: { type: "TXT", host: string, value: string, ttl: string },
      mx: { type: "MX", host: string, value?: string, ttl: string, extra?: string, hint?: string },
      spf: { type: "TXT", host: string, value: string, ttl: string, hint?: string },
      dkim: { type: "TXT", host: string, value?: string, ttl: string, hint?: string },
      dmarc: { type: "TXT", host: string, value: string, ttl: string, hint?: string }
    },
    catchall_identity_fp?: string,
    created_at: datetime
  }]
}
```

#### Add Domain
```
POST /api/v1/custom-domains
Request: { domain: string }
Response: {
  domain: string,
  dns_config: {
    verification_txt: { type: "TXT", host: string, value: string, ttl: string },
    mx: { type: "MX", host: string, value?: string, ttl: string, extra?: string, hint?: string },
    spf: { type: "TXT", host: string, value: string, ttl: string, hint?: string },
    dkim: { type: "TXT", host: string, value?: string, ttl: string, hint?: string },
    dmarc: { type: "TXT", host: string, value: string, ttl: string, hint?: string }
  }
}
```

#### Verify Domain DNS
```
POST /api/v1/custom-domains/:domain/verify
Response: {
  status: "pending" | "active",
  ownership_verified: bool,
  mx_verified: bool,
  spf_verified: bool,
  dkim_verified: bool,
  dmarc_verified: bool,
  ready: bool,
  issues: string[],
  checks: {
    ownership: { name: string, ok: bool, expected?: string, values?: string[], error?: string, note?: string },
    mx: { name: string, ok: bool, expected?: string, values?: string[], error?: string, note?: string },
    spf: { name: string, ok: bool, expected?: string, values?: string[], error?: string, note?: string },
    dkim: { name: string, ok: bool, expected?: string, values?: string[], error?: string, note?: string },
    dmarc: { name: string, ok: bool, expected?: string, values?: string[], error?: string, note?: string }
  }
}
```

#### Configure Catchall
```
PUT /api/v1/custom-domains/:domain/catchall
Request: { identity_fingerprint: string | null }
Response: { ok: bool }
```

#### Delete Domain
```
DELETE /api/v1/custom-domains/:domain
Response: { ok: bool }
```

**Backend work needed:**
- Domain storage (ScyllaDB table: `custom_domains`)
- DNS verification service (query MX, TXT records)
- DKIM key generation and storage
- MTA/Postfix configuration for custom domains
- Subscription/billing check (paid feature)

---

### 6. GPG Keys (Enhanced)

#### List All Keys
```
GET /api/v1/gpg-keys
Response: {
  account_key: {
    key_id: string,
    locked: bool
  },
  identity_keys: [{
    key_id: string,
    fingerprint: string,
    email: string,
    algorithm: string,
    bits: number,
    is_active: bool,
    is_default: bool,
    locked: bool,
    created_at: datetime
  }]
}
```

#### Export Public Key
```
GET /api/v1/gpg-keys/:fingerprint/public
Response: {
  armored: string  // ASCII-armored public key
}
```

#### Import Key (Advanced)
```
POST /api/v1/gpg-keys/import
Request: {
  armored_key: string,
  password?: string       // For encrypted private keys
}
Response: {
  key_id: string,
  fingerprint: string,
  type: "public" | "private"
}
```

#### Regenerate Key
```
POST /api/v1/gpg-keys/:fingerprint/regenerate
Request: { password: string }
Response: {
  new_fingerprint: string,
  ...
}
```

**Backend work needed:**
- Key import validation (OpenPGP.js compatibility)
- Key revocation handling
- Key backup/recovery mechanisms

---

### 7. SMTP Submission (Paid Feature)

#### List SMTP Credentials
```
GET /api/v1/smtp-submission
Response: {
  credentials: [{
    id: string,
    name: string,
    email: string,        // The "from" address
    username: string,
    created_at: datetime
  }]
}
```

#### Create SMTP Credential
```
POST /api/v1/smtp-submission
Request: {
  name: string,
  identity_fingerprint: string  // Which identity to send as
}
Response: {
  credential: {
    id: string,
    name: string,
    email: string,
    username: string,
    password: string      // Only returned on creation
  }
}
```

#### Regenerate Password
```
POST /api/v1/smtp-submission/:id/regenerate
Response: {
  password: string
}
```

#### Delete Credential
```
DELETE /api/v1/smtp-submission/:id
Response: { success: bool }
```

**Backend work needed:**
- SMTP credential storage (ScyllaDB table: `smtp_credentials`)
- Password hashing (bcrypt/argon2 for SMTP auth)
- Postfix SASL authentication integration
- Rate limiting per credential
- Subscription/billing check (paid feature)

---

### 8. Account Deletion (Danger Zone)

#### Delete Account
```
DELETE /api/v1/account
Request: {
  password: string,
  confirmation: "DELETE"
}
Response: { success: bool }
```

**Backend work needed:**
- Cascade delete all user data:
  - Messages (ScyllaDB + object storage blobs)
  - Identities
  - GPG keys
  - Folders
  - Filters
  - Custom domains
  - SMTP credentials
  - Sessions
- Consider soft-delete with 30-day grace period
- Send confirmation email (if possible)

---

## Database Schema Additions

### ScyllaDB Tables Needed

```sql
-- Custom folders
CREATE TABLE mail_folders (
  user_id UUID,
  name TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (user_id, name)
);

-- Email filters
CREATE TABLE mail_filters (
  user_id UUID,
  filter_id UUID,
  name TEXT,
  enabled BOOLEAN,
  priority INT,
  conditions TEXT,  -- JSON
  actions TEXT,     -- JSON
  created_at TIMESTAMP,
  PRIMARY KEY (user_id, filter_id)
);

-- Custom domains
CREATE TABLE custom_domains (
  user_id UUID,
  domain TEXT,
  status TEXT,
  dns_config TEXT,  -- JSON with verification values
  mx_verified BOOLEAN,
  spf_verified BOOLEAN,
  dkim_verified BOOLEAN,
  dmarc_verified BOOLEAN,
  dkim_private_key TEXT,  -- Encrypted
  catchall_identity TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (user_id, domain)
);

-- SMTP credentials
CREATE TABLE smtp_credentials (
  user_id UUID,
  credential_id UUID,
  name TEXT,
  identity_fingerprint TEXT,
  username TEXT,
  password_hash TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (user_id, credential_id)
);
CREATE INDEX ON smtp_credentials (username);

-- Plus address routing
CREATE TABLE plus_addresses (
  user_id UUID,
  tag TEXT,
  folder TEXT,
  enabled BOOLEAN,
  PRIMARY KEY (user_id, tag)
);
```

---

## Integration Points

### Mail Transfer Agent (Postfix/etc)
- Custom domain routing
- SMTP submission authentication
- Plus address handling
- Catchall configuration

### DNS Verification Service
- MX record lookup
- TXT record lookup (SPF, DKIM, DMARC, verification)
- Async verification jobs

### Subscription/Billing System
- Gate paid features (custom domains, SMTP submission)
- Check subscription status in API middleware

### Key Management
- Client-side key generation (OpenPGP.js)
- Server stores encrypted private keys only
- Password change triggers re-encryption

---

## Priority Order for Implementation

1. **Folders** - Simple CRUD, immediate user value
2. **Filters** - Important for email organization
3. **Password Change** - Security essential
4. **GPG Key Export** - Users need this for backup
5. **SMTP Submission** - High user demand (paid)
6. **Custom Domains** - High user demand (paid)
7. **2FA** - Security enhancement
8. **Account Deletion** - GDPR compliance

---

## Security Considerations

- All password operations must use SRP-6a (no plaintext)
- GPG private keys never stored unencrypted
- SMTP credentials use strong password hashing
- Rate limit all authentication endpoints
- Audit log for sensitive operations
- CSRF protection on all state-changing endpoints
