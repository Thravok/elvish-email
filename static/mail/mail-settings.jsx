// ELVISH MAIL SETTINGS — comprehensive settings panel.
//
// Mounted by mail-app.jsx as the "Settings" view. Provides:
// - Account info & subscription
// - Security (password, 2FA)
// - Identities (default, aliases, plus, disposable)
// - Folders management
// - Filters (client-evaluated rules; JSON synced for all devices)
// - Custom Domains with DNS setup
// - GPG Keys management
// - SMTP Submission credentials
// - Support & Danger Zone
//
// Backend APIs required are documented in docs/backend-settings-api.md

import React from "react";

// Import shared components
import {
  Card,
  Button,
  Alert,
  Badge,
  EmptyState,
  Modal,
  ConfirmModal,
  Toggle,
  Icons,
  UserSettingsLayout,
} from "../shared/index.jsx";

const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ============ Icons ============
// Use shared icons with mail-specific aliases
const SettingsIcons = {
  account: Icons.account,
  security: Icons.security,
  identities: Icons.mail,
  folders: Icons.folder,
  filters: Icons.filter,
  domains: Icons.globe,
  keys: Icons.key,
  smtp: Icons.send,
  consent: Icons.file,
  support: Icons.help,
  danger: Icons.danger,
  back: Icons.back,
  check: Icons.check,
  x: Icons.x,
  plus: Icons.plus,
  trash: Icons.trash,
  edit: Icons.edit,
  copy: Icons.copy,
  download: Icons.download,
  upload: Icons.upload,
  refresh: Icons.refresh,
  lock: Icons.lock,
  unlock: Icons.unlock,
  star: Icons.star,
  info: Icons.info,
  warning: Icons.warning,
};

// ============ Settings Sections Config ============
const SETTINGS_SECTIONS = [
  { id: 'account', label: 'Account', icon: 'account' },
  { id: 'security', label: 'Security', icon: 'security' },
  { id: 'identities', label: 'Identities', icon: 'mail' },
  { id: 'folders', label: 'Folders', icon: 'folder' },
  { id: 'filters', label: 'Filters', icon: 'filter' },
  { id: 'domains', label: 'Custom Domains', icon: 'globe' },
  { id: 'keys', label: 'GPG Keys', icon: 'key' },
  { id: 'smtp', label: 'SMTP Submission', icon: 'send' },
  { id: 'consent', label: 'Mail & privacy', icon: 'file' },
  { id: 'support', label: 'Support', icon: 'help' },
  { id: 'danger', label: 'Danger Zone', icon: 'danger', variant: 'danger' },
];

const DEFAULT_RETENTION_DAYS = Object.freeze({
  inbox: null,
  sent: 30,
  trash: 30,
  archive: null,
});

// ============ Utility Components ============
// Note: Alert, Button, Badge, EmptyState, Modal, ConfirmModal are now imported from shared components.
// The imported components use elvish-* class names but are backward compatible.

function Input({ label, type, value, onChange, placeholder, disabled, helperText, error, className }) {
  return (
    <div className={`settings-input-group elvish-form-group ${className || ''}`}>
      {label && <label className="settings-label elvish-label">{label}</label>}
      <input
        type={type || 'text'}
        className={`settings-input elvish-input ${error ? 'settings-input-error elvish-input-error' : ''}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
      />
      {(helperText || error) && <div className={`settings-helper elvish-helper ${error ? 'settings-helper-error elvish-helper-error' : ''}`}>{error || helperText}</div>}
    </div>
  );
}

const IDENTITY_AVATAR_COLORS = [
  { id: 'pink', label: 'Pink', bg: 'linear-gradient(135deg, #ff80b5, #c14d85)', fg: '#fff7fb' },
  { id: 'yellow', label: 'Yellow', bg: 'linear-gradient(135deg, #ffd36a, #b38316)', fg: '#fffaf0' },
  { id: 'red', label: 'Red', bg: 'linear-gradient(135deg, #ff7b7b, #bb4040)', fg: '#fff5f5' },
  { id: 'orange', label: 'Orange', bg: 'linear-gradient(135deg, #ffad66, #c76321)', fg: '#fff7f0' },
  { id: 'green', label: 'Green', bg: 'linear-gradient(135deg, #74dca8, #25865d)', fg: '#f4fff8' },
  { id: 'blue', label: 'Blue', bg: 'linear-gradient(135deg, #7aa8ff, #3f5bd1)', fg: '#f5f8ff' },
  { id: 'dark-blue', label: 'Dark Blue', bg: 'linear-gradient(135deg, #7f8fb6, #35425e)', fg: '#f4f7fd' },
];

const IDENTITY_AVATAR_COLOR_MAP = IDENTITY_AVATAR_COLORS.reduce((acc, color) => {
  acc[color.id] = color;
  return acc;
}, {});

function identityAvatarInitial(label) {
  const raw = String(label || '').trim();
  if (!raw) return '?';
  const local = raw.includes('@') ? raw.split('@')[0] : raw;
  const cleaned = local.replace(/[^a-z0-9]/gi, '');
  return (cleaned[0] || local[0] || '?').toUpperCase();
}

function IdentityAvatar({ label, avatarDataUrl, avatarColor, showStatusBadge, size = 'md' }) {
  const palette = IDENTITY_AVATAR_COLOR_MAP[avatarColor] || IDENTITY_AVATAR_COLOR_MAP.blue;
  return (
    <div
      className={`identity-avatar identity-avatar-${size}`}
      style={{
        '--identity-avatar-bg': palette.bg,
        '--identity-avatar-fg': palette.fg,
      }}
      aria-hidden="true"
    >
      {avatarDataUrl ? (
        <img src={avatarDataUrl} alt="" className="identity-avatar-img" />
      ) : (
        <span className="identity-avatar-initial">{identityAvatarInitial(label)}</span>
      )}
      {showStatusBadge && <span className="identity-avatar-status"></span>}
    </div>
  );
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = src;
  });
}

async function fileToAvatarDataURL(file) {
  if (!file) throw new Error('Choose an image first');
  if (!String(file.type || '').startsWith('image/')) throw new Error('Avatar must be an image file');
  if (file.size > 3 * 1024 * 1024) throw new Error('Avatar must be smaller than 3 MB');
  const src = await readFileAsDataURL(file);
  const img = await loadImage(src);
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  const scale = Math.max(size / img.width, size / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  const x = (size - width) / 2;
  const y = (size - height) / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, x, y, width, height);
  return canvas.toDataURL('image/png');
}

// ============ Section Components ============

// --- Account Section ---
function AccountSection({ user }) {
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.ElvishMailManifest.getBillingStatus()
      .then((b) => { if (!cancelled) setPaid(!!b.paid); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Account Information</h2>
        <p>View your account details and status</p>
      </div>

      <Card>
        <div className="settings-account-grid">
          <div className="settings-account-item">
            <div className="settings-account-icon">{SettingsIcons.account}</div>
            <div className="settings-account-content">
              <div className="settings-account-label">Username</div>
              <div className="settings-account-value">{user?.name || user?.email || '—'}</div>
            </div>
          </div>
          <div className="settings-account-item">
            <div className="settings-account-icon">{SettingsIcons.identities}</div>
            <div className="settings-account-content">
              <div className="settings-account-label">Primary Email</div>
              <div className="settings-account-value mono">{user?.email || '—'}</div>
            </div>
          </div>
          <div className="settings-account-item">
            <div className="settings-account-icon">{SettingsIcons.security}</div>
            <div className="settings-account-content">
              <div className="settings-account-label">Account Role</div>
              <div className="settings-account-value">
                <Badge variant={user?.is_admin ? 'accent' : 'default'}>
                  {user?.is_admin ? 'Admin' : 'User'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Subscription" description="Your current plan and billing status">
        <Alert type="info" title={paid ? 'Paid API tier' : 'Free tier'}>
          {paid
            ? 'Paid API features are enabled for this deployment (or your account is admin).'
            : "You're on the free tier. Operator can set ELVISH_PAID_FEATURES for SMTP submission and custom domains."}
        </Alert>
        <div className="settings-subscription-features">
          <div className="settings-feature">
            <span className="settings-feature-icon">{SettingsIcons.check}</span>
            <span>End-to-end encryption</span>
          </div>
          <div className="settings-feature">
            <span className="settings-feature-icon">{SettingsIcons.check}</span>
            <span>Multiple identities</span>
          </div>
          <div className="settings-feature">
            <span className="settings-feature-icon">{SettingsIcons.check}</span>
            <span>GPG key management</span>
          </div>
          <div className="settings-feature">
            <span className="settings-feature-icon">{SettingsIcons.check}</span>
            <span>Folder organization</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

async function getTwoFactorInfo() {
  const result = await window.ElvishMailManifest.getTwoFactorStatus();
  return result && result.mfa ? result.mfa : { enabled: false, methods: [], totp_factors: [], webauthn_factors: [], recovery_remaining: 0 };
}

async function ensureFreshTwoFactor(status) {
  const current = status || await getTwoFactorInfo();
  if (!current || !current.enabled) return current;
  const methods = Array.isArray(current.methods) ? current.methods : [];
  if (methods.includes('webauthn') && window.ElvishWebAuthn && window.confirm('Use a security key for this action?\nPress Cancel to enter an authenticator or recovery code instead.')) {
    const begin = await window.ElvishMailManifest.beginWebAuthnVerification();
    const credential = await window.ElvishWebAuthn.getAssertion(begin.options);
    await window.ElvishMailManifest.finishWebAuthnVerification(begin.challenge_id, credential);
    return await getTwoFactorInfo();
  }
  const code = window.prompt(methods.includes('recovery')
    ? 'Enter your 6-digit authenticator code, or paste a recovery code.'
    : 'Enter your 6-digit authenticator code.');
  if (!code || !code.trim()) throw new Error('Two-factor verification was cancelled');
  const normalized = code.trim();
  if (/^\d{6}$/.test(normalized.replace(/\s+/g, ''))) {
    await window.ElvishMailManifest.verifyTwoFactorTOTP(normalized);
  } else {
    await window.ElvishMailManifest.verifyTwoFactorRecovery(normalized);
  }
  return await getTwoFactorInfo();
}

async function runWithFreshTwoFactor(action, status) {
  try {
    return await action();
  } catch (e) {
    const message = String((e && e.message) || e || '');
    if (!message.includes('recent 2fa verification required')) throw e;
    await ensureFreshTwoFactor(status);
    return await action();
  }
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

function SecuritySection() {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [mfa, setMfa] = useState(null);
  const [loadingMfa, setLoadingMfa] = useState(true);
  const [mfaError, setMfaError] = useState('');
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpSetup, setTotpSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [busyAction, setBusyAction] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  const loadMFA = useCallback(async () => {
    setLoadingMfa(true);
    try {
      const info = await getTwoFactorInfo();
      setMfa(info);
      setMfaError('');
    } catch (e) {
      setMfaError(e.message || 'Failed to load 2FA status');
    } finally {
      setLoadingMfa(false);
    }
  }, []);

  useEffect(() => { loadMFA(); }, [loadMFA]);

  const handleBeginTOTP = async () => {
    setBusyAction(true);
    setMfaError('');
    try {
      const setup = await window.ElvishMailManifest.beginTOTPSetup('Authenticator app');
      setTotpSetup(setup);
      setTotpCode('');
      setShowTotpModal(true);
    } catch (e) {
      setMfaError(e.message || 'Could not start authenticator setup');
    } finally {
      setBusyAction(false);
    }
  };

  const handleConfirmTOTP = async (e) => {
    e.preventDefault();
    if (!totpSetup) return;
    setBusyAction(true);
    try {
      const result = await window.ElvishMailManifest.confirmTOTPSetup(totpSetup.setup_id, totpCode);
      setRecoveryCodes(Array.isArray(result.recovery_codes) ? result.recovery_codes : null);
      setShowTotpModal(false);
      setTotpSetup(null);
      setTotpCode('');
      await loadMFA();
    } catch (e) {
      setMfaError(e.message || 'Could not confirm authenticator app');
    } finally {
      setBusyAction(false);
    }
  };

  const handleRegisterSecurityKey = async () => {
    if (!window.ElvishWebAuthn) {
      setMfaError('This browser does not support security keys.');
      return;
    }
    setBusyAction(true);
    setMfaError('');
    try {
      const begin = await window.ElvishMailManifest.beginWebAuthnRegistration();
      const credential = await window.ElvishWebAuthn.createCredential(begin.options);
      const result = await window.ElvishMailManifest.finishWebAuthnRegistration(begin.challenge_id, credential, 'Security key');
      setRecoveryCodes(Array.isArray(result.recovery_codes) ? result.recovery_codes : null);
      await loadMFA();
    } catch (e) {
      setMfaError(e.message || 'Could not register security key');
    } finally {
      setBusyAction(false);
    }
  };

  const handleRegenerateRecovery = async () => {
    setBusyAction(true);
    setMfaError('');
    try {
      const result = await runWithFreshTwoFactor(() => window.ElvishMailManifest.regenerateRecoveryCodes(), mfa);
      setRecoveryCodes(Array.isArray(result.recovery_codes) ? result.recovery_codes : null);
      await loadMFA();
    } catch (e) {
      setMfaError(e.message || 'Could not regenerate recovery codes');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteTOTP = async (id) => {
    if (!window.confirm('Remove this authenticator app from your account?')) return;
    setBusyAction(true);
    try {
      await runWithFreshTwoFactor(() => window.ElvishMailManifest.deleteTOTPFactor(id), mfa);
      await loadMFA();
    } catch (e) {
      setMfaError(e.message || 'Could not remove authenticator app');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteSecurityKey = async (id) => {
    if (!window.confirm('Remove this security key from your account?')) return;
    setBusyAction(true);
    try {
      await runWithFreshTwoFactor(() => window.ElvishMailManifest.deleteWebAuthnCredential(id), mfa);
      await loadMFA();
    } catch (e) {
      setMfaError(e.message || 'Could not remove security key');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Security</h2>
        <p>Manage your account security settings</p>
      </div>

      {mfaError && <Alert type="error">{mfaError}</Alert>}

      <Card
        title="Change Password"
        description="Update your password. Your GPG keys will be re-encrypted with the new password."
      >
        <Alert type="warning">
          Changing your password will re-encrypt your GPG keys. Locked keys (from previous
          password resets) will be skipped and can be unlocked separately.
        </Alert>
        <Button variant="primary" onClick={() => setShowChangePassword(true)}>
          {SettingsIcons.lock} Change Password
        </Button>
      </Card>

      <Card
        title="Two-Factor Authentication"
        description="Protect your account with an authenticator app and security keys."
      >
        {loadingMfa && <Alert type="info">Loading your current 2FA status…</Alert>}
        {!loadingMfa && mfa && !mfa.enabled && (
          <>
            <Alert type="info" title="2FA is off">
              Add an authenticator app, a security key, or both. Recovery codes are generated the first time you enable 2FA.
            </Alert>
            <div className="settings-modal-actions">
              <Button variant="primary" onClick={handleBeginTOTP} loading={busyAction}>
                {SettingsIcons.security} Set up authenticator app
              </Button>
              <Button variant="secondary" onClick={handleRegisterSecurityKey} loading={busyAction}>
                {SettingsIcons.keys} Add security key
              </Button>
            </div>
          </>
        )}
        {!loadingMfa && mfa && mfa.enabled && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <Badge variant="accent">2FA enabled</Badge>
              <Badge variant="default">{(mfa.methods || []).join(' + ') || 'configured'}</Badge>
            </div>
            <div className="settings-encryption-status" style={{ marginBottom: 16 }}>
              {(mfa.totp_factors || []).map((factor) => (
                <div key={factor.id} className="settings-encryption-item ok" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <span>{SettingsIcons.check} Authenticator app: {factor.label || 'Authenticator app'}</span>
                  <Button variant="secondary" size="sm" onClick={() => handleDeleteTOTP(factor.id)} disabled={busyAction}>
                    Remove
                  </Button>
                </div>
              ))}
              {(mfa.webauthn_factors || []).map((factor) => (
                <div key={factor.id} className="settings-encryption-item ok" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <span>{SettingsIcons.check} Security key: {factor.label || 'Security key'}</span>
                  <Button variant="secondary" size="sm" onClick={() => handleDeleteSecurityKey(factor.id)} disabled={busyAction}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div className="settings-modal-actions">
              <Button variant="secondary" onClick={handleBeginTOTP} loading={busyAction}>
                Add authenticator app
              </Button>
              <Button variant="secondary" onClick={handleRegisterSecurityKey} loading={busyAction}>
                Add security key
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card
        title="Recovery Codes"
        description="Use one-time recovery codes if you lose access to your authenticator or security key."
      >
        {!loadingMfa && mfa && (
          <>
            <Alert type="info" title={`${mfa.recovery_remaining || 0} codes remaining`}>
              Regenerate recovery codes after downloading them. Old recovery codes stop working immediately.
            </Alert>
            <div className="settings-modal-actions">
              <Button variant="secondary" onClick={handleRegenerateRecovery} loading={busyAction} disabled={!mfa.enabled}>
                {SettingsIcons.refresh} Regenerate Codes
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card
        title="Encryption Verification"
        description="Verify the encryption status of your account and keys."
      >
        <div className="settings-encryption-status">
          <div className="settings-encryption-item ok">
            {SettingsIcons.check}
            <span>Account key encrypted client-side</span>
          </div>
          <div className="settings-encryption-item ok">
            {SettingsIcons.check}
            <span>Identity keys encrypted to account key</span>
          </div>
          <div className="settings-encryption-item ok">
            {SettingsIcons.check}
            <span>Message bodies stored as PGP ciphertext</span>
          </div>
        </div>
      </Card>

      <Modal open={showChangePassword} onClose={() => setShowChangePassword(false)} title="Change Password">
        <ChangePasswordForm onClose={() => setShowChangePassword(false)} />
      </Modal>

      <Modal open={showTotpModal} onClose={() => !busyAction && setShowTotpModal(false)} title="Set Up Authenticator App">
        {totpSetup && (
          <form onSubmit={handleConfirmTOTP}>
            <Alert type="info">
              Scan the QR code with your authenticator app, or copy the manual secret below.
            </Alert>
            {totpSetup.qr_png_url && <img src={totpSetup.qr_png_url} alt="Authenticator QR code" style={{ width: 192, height: 192, display: 'block', margin: '0 auto 16px' }} />}
            <Input label="Manual secret" value={totpSetup.secret || ''} onChange={() => {}} helperText="Works in Google Authenticator, Authy, 1Password, and similar apps." />
            <div className="settings-modal-actions">
              <Button variant="secondary" type="button" onClick={() => copyText(totpSetup.secret || '')}>Copy Secret</Button>
            </div>
            <Input
              label="Authenticator code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="123456"
              helperText="Enter the 6-digit code shown in your authenticator app."
            />
            <div className="settings-modal-actions">
              <Button variant="secondary" type="button" onClick={() => setShowTotpModal(false)} disabled={busyAction}>Cancel</Button>
              <Button variant="primary" type="submit" loading={busyAction} disabled={!totpCode.trim()}>Enable 2FA</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Array.isArray(recoveryCodes) && recoveryCodes.length > 0} onClose={() => setRecoveryCodes(null)} title="Recovery Codes">
        <Alert type="warning" title="Store these now">
          Each code can only be used once. Regenerating recovery codes invalidates every old code immediately.
        </Alert>
        <div className="settings-encryption-status" style={{ marginTop: 16 }}>
          {(recoveryCodes || []).map((code) => (
            <div key={code} className="settings-encryption-item ok">
              {SettingsIcons.check}
              <span className="mono">{code}</span>
            </div>
          ))}
        </div>
        <div className="settings-modal-actions">
          <Button variant="secondary" type="button" onClick={() => copyText((recoveryCodes || []).join('\n'))}>
            {SettingsIcons.copy} Copy Codes
          </Button>
          <Button variant="primary" type="button" onClick={() => setRecoveryCodes(null)}>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ChangePasswordForm({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 10) {
      setError('Password must be at least 10 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await runWithFreshTwoFactor(() => window.ElvishMailManifest.changePassword(currentPassword, newPassword));
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <Alert type="error">{error}</Alert>}
      <Input
        label="Current Password"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        placeholder="Enter current password"
      />
      <Input
        label="New Password"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Enter new password"
        helperText="Minimum 10 characters (matches registration)"
      />
      <Input
        label="Confirm New Password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm new password"
      />
      <div className="settings-modal-actions">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" loading={loading}>Change Password</Button>
      </div>
    </form>
  );
}

// Matches server disposable heuristic (d_<8+ alnum>) so rows without expires_at still sort correctly.
function looksLikeDisposableIdentity(email, type) {
  if (type === 'disposable') return true;
  const local = (email || '').split('@')[0].toLowerCase();
  if (local.length < 10 || !local.startsWith('d_')) return false;
  return /^d_[a-z0-9]+$/.test(local);
}

// --- Identities Section (Enhanced) ---
function IdentitiesSection({ user }) {
  const [identities, setIdentities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('alias');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [savingFingerprint, setSavingFingerprint] = useState('');

  const loadIdentities = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.ElvishMailManifest.listIdentities();
      setIdentities(result.identities || []);
    } catch (e) {
      setError(e.message || 'Failed to load identities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadIdentities(); }, [loadIdentities]);

  const handleSetDefault = async (fp) => {
    try {
      await window.ElvishMailManifest.setDefaultIdentity(fp);
      await loadIdentities();
    } catch (e) {
      setError(e.message || 'Failed to set default');
    }
  };

  const executeDelete = async (fp) => {
    setDeleteLoading(true);
    try {
      await window.ElvishMailManifest.deleteIdentity(fp);
      await loadIdentities();
      setConfirmDelete(null);
    } catch (e) {
      setError(e.message || 'Failed to delete identity');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = (fp) => {
    setConfirmDelete(fp);
  };

  const handleUpdateProfile = async (fp, payload) => {
    setSavingFingerprint(fp);
    setError('');
    try {
      await window.ElvishMailManifest.updateIdentityProfile(fp, payload);
      await loadIdentities();
    } catch (e) {
      setError(e.message || 'Failed to update identity profile');
    } finally {
      setSavingFingerprint('');
    }
  };

  const defaultIdentities = identities.filter((i) => {
    if (looksLikeDisposableIdentity(i.email, i.type)) return false;
    return i.is_default || i.type === 'primary';
  });
  const aliasIdentities = identities.filter((i) => {
    if (looksLikeDisposableIdentity(i.email, i.type)) return false;
    return !i.is_default && i.type !== 'primary' && i.type !== 'plus' && i.type !== 'disposable';
  });
  const plusIdentities = identities.filter((i) => i.type === 'plus');
  const disposableIdentities = identities.filter((i) => looksLikeDisposableIdentity(i.email, i.type));

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Identities</h2>
        <p>Manage your email addresses. Each identity has its own PGP keypair for encryption.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Default/Primary Identity */}
      <Card 
        title="Email Identities" 
        description="Your main email addresses. Each has its own GPG key encrypted to your account key."
        actions={
          <Button variant="primary" size="sm" onClick={() => { setCreateType('alias'); setShowCreateModal(true); }}>
            {SettingsIcons.plus} Create Identity
          </Button>
        }
      >
        {loading ? (
          <div className="settings-loading">Loading identities...</div>
        ) : (defaultIdentities.length === 0 && aliasIdentities.length === 0) ? (
          <EmptyState 
            icon="identities" 
            title="No identities yet"
            description="Create your first email identity to start receiving encrypted mail."
            action={<Button variant="primary" onClick={() => setShowCreateModal(true)}>Create Identity</Button>}
          />
        ) : (
          <div className="settings-identities-list">
            {[...defaultIdentities, ...aliasIdentities].map(id => (
              <IdentityItem 
                key={id.fingerprint} 
                identity={id} 
                onSetDefault={handleSetDefault}
                onDelete={handleDelete}
                onUpdateProfile={handleUpdateProfile}
                saving={savingFingerprint === id.fingerprint}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Plus Addresses */}
      <Card 
        title="Plus Addresses" 
        description="Automatically created addresses like user+tag@domain.com for organization."
        actions={
          <Button variant="secondary" size="sm" onClick={() => { setCreateType('plus'); setShowCreateModal(true); }}>
            {SettingsIcons.plus} Configure Plus Address
          </Button>
        }
      >
        <Alert type="info">
          Plus addresses are automatically created when emails arrive. Configure one to set up 
          custom folder routing (e.g., user+shopping@domain.com → shopping folder).
        </Alert>
        {plusIdentities.length === 0 ? (
          <EmptyState 
            icon="identities" 
            title="No plus addresses configured"
            description="Plus addresses are created automatically when emails arrive at them."
          />
        ) : (
          <div className="settings-identities-list">
            {plusIdentities.map(id => (
              <IdentityItem
                key={id.fingerprint}
                identity={id}
                onDelete={handleDelete}
                onUpdateProfile={handleUpdateProfile}
                saving={savingFingerprint === id.fingerprint}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Disposable Addresses */}
      <Card 
        title="Disposable Addresses" 
        description="Temporary email addresses that expire automatically."
        actions={
          <Button variant="secondary" size="sm" onClick={() => { setCreateType('disposable'); setShowCreateModal(true); }}>
            {SettingsIcons.plus} Create Disposable
          </Button>
        }
      >
        <Alert type="info">
          Disposable addresses expire after 30 days by default. Perfect for one-time sign-ups 
          or temporary communications.
        </Alert>
        {disposableIdentities.length === 0 ? (
          <EmptyState 
            icon="identities" 
            title="No disposable addresses"
            description="Create a temporary address for one-time use."
          />
        ) : (
          <div className="settings-identities-list">
            {disposableIdentities.map(id => (
              <IdentityItem
                key={id.fingerprint}
                identity={id}
                onDelete={handleDelete}
                onUpdateProfile={handleUpdateProfile}
                saving={savingFingerprint === id.fingerprint}
                showExpiry
              />
            ))}
          </div>
        )}
      </Card>

      <Modal 
        open={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        title={createType === 'alias' ? 'Create Identity' : createType === 'plus' ? 'Configure Plus Address' : 'Create Disposable Address'}
      >
        <CreateIdentityForm type={createType} user={user} onClose={() => setShowCreateModal(false)} onSuccess={loadIdentities} />
      </Modal>

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => !deleteLoading && setConfirmDelete(null)}
        onConfirm={() => executeDelete(confirmDelete)}
        title="Delete Identity"
        message="Are you sure you want to delete this identity? Past messages encrypted to this key will become unreadable. This action cannot be undone."
        confirmLabel="Delete Identity"
        confirmVariant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}

function IdentityItem({ identity, onSetDefault, onDelete, onUpdateProfile, showExpiry, saving }) {
  const isExpired = identity.expires_at && new Date(identity.expires_at) < new Date();
  const fileInputRef = useRef(null);

  const triggerAvatarPicker = () => {
    if (fileInputRef.current && !saving) fileInputRef.current.click();
  };

  const handleAvatarPicked = async (event) => {
    const file = event.target && event.target.files && event.target.files[0];
    if (!file || !onUpdateProfile) return;
    try {
      const avatarDataUrl = await fileToAvatarDataURL(file);
      await onUpdateProfile(identity.fingerprint, { avatar_data_url: avatarDataUrl });
    } catch (e) {
      alert(e.message || 'Failed to prepare avatar');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className={`settings-identity-item ${identity.is_default ? 'is-default' : ''} ${isExpired ? 'is-expired' : ''}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleAvatarPicked}
      />
      <div className="settings-identity-main">
        <IdentityAvatar
          label={identity.primary_uid || identity.email}
          avatarDataUrl={identity.avatar_data_url}
          avatarColor={identity.avatar_color}
          showStatusBadge={!!identity.status_badge_enabled}
        />
        <div className="settings-identity-content">
          <div className="settings-identity-email">
            <strong>{identity.email}</strong>
            {identity.is_default && <Badge variant="accent">Default</Badge>}
            {!identity.is_active && <Badge variant="muted">Inactive</Badge>}
            {isExpired && <Badge variant="error">Expired</Badge>}
            {identity.status_badge_enabled && <Badge variant="success">Status badge on</Badge>}
          </div>
          <div className="settings-identity-meta">
            <code>{identity.fingerprint}</code>
            <span className="dim">
              {identity.algorithm} · {identity.bits} bits · 
              created {new Date(identity.created_at).toLocaleDateString()}
            </span>
            {showExpiry && identity.expires_at && (
              <span className={isExpired ? 'error' : ''}>
                {isExpired ? 'Expired' : 'Expires'}: {new Date(identity.expires_at).toLocaleDateString()}
              </span>
            )}
          </div>
          {onUpdateProfile && (
            <div className="settings-identity-profile">
              <label className="settings-identity-profile-field">
                <span>Fallback color</span>
                <select
                  className="settings-select"
                  value={identity.avatar_color || 'blue'}
                  disabled={saving}
                  onChange={(e) => onUpdateProfile(identity.fingerprint, { avatar_color: e.target.value })}
                >
                  {IDENTITY_AVATAR_COLORS.map((color) => (
                    <option key={color.id} value={color.id}>{color.label}</option>
                  ))}
                </select>
              </label>
              <label className="settings-identity-toggle">
                <input
                  type="checkbox"
                  checked={!!identity.status_badge_enabled}
                  disabled={saving}
                  onChange={(e) => onUpdateProfile(identity.fingerprint, { status_badge_enabled: e.target.checked })}
                />
                <span>Enable status badge after mutual reply</span>
              </label>
              <div className="settings-identity-avatar-actions">
                <Button variant="secondary" size="sm" onClick={triggerAvatarPicker} disabled={saving}>
                  {saving ? 'Saving…' : identity.avatar_data_url ? 'Replace Avatar' : 'Upload Avatar'}
                </Button>
                {identity.avatar_data_url && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onUpdateProfile(identity.fingerprint, { avatar_data_url: '' })}
                    disabled={saving}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="settings-identity-actions">
        {onSetDefault && !identity.is_default && identity.is_active && (
          <Button variant="secondary" size="sm" onClick={() => onSetDefault(identity.fingerprint)} title="Set as default">
            {SettingsIcons.star}
          </Button>
        )}
        {onDelete && !identity.is_default && (
          <Button variant="danger" size="sm" onClick={() => onDelete(identity.fingerprint)} title="Delete">
            {SettingsIcons.trash}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Same interaction + styling as compose `FromSelector` (from-selector CSS). */
function MailFromStyleSelect({
  value,
  options,
  onChange,
  loading,
  placeholder,
  emptyMessage,
  menuLabel,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const getInitial = (v) => {
    if (!v) return '?';
    const at = v.indexOf('@');
    const key = at > 0 ? v.slice(0, at) : v;
    return (key[0] || '?').toUpperCase();
  };

  const getAvatarStyle = (key) => {
    if (!key) return {};
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return {
      '--from-avatar-bg': `linear-gradient(135deg, hsl(${hue}, 55%, 45%), hsl(${(hue + 40) % 360}, 50%, 35%))`,
    };
  };

  const selected = (options || []).find((o) => o.value === value);
  const ready = !loading;
  const noOptions = ready && (!options || options.length === 0);
  const triggerDisabled = loading || noOptions;
  const displayLine = loading ? 'Loading…' : (selected ? selected.label : (noOptions ? emptyMessage : placeholder));

  return (
    <div className="from-selector" ref={containerRef}>
      <button
        type="button"
        className={`from-selector-trigger${open ? ' open' : ''}`}
        onClick={() => {
          if (triggerDisabled) return;
          setOpen(!open);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={triggerDisabled}
      >
        <span className="from-selector-avatar" style={getAvatarStyle(value || displayLine)}>
          {loading ? '…' : getInitial(value)}
        </span>
        <span className="from-selector-value">
          <span className="from-selector-email">{displayLine}</span>
        </span>
        <span className="from-selector-chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && ready && options.length > 0 && (
        <div className="from-selector-menu" role="listbox">
          <div className="from-selector-menu-header">
            <span className="from-selector-menu-label">{menuLabel}</span>
          </div>
          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                className={`from-selector-option${isSelected ? ' selected' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <span className="from-selector-avatar" style={getAvatarStyle(o.value)}>
                  {getInitial(o.value)}
                </span>
                <span className="from-selector-option-content">
                  <span className="from-selector-option-email">{o.label}</span>
                </span>
                {isSelected && <span className="from-selector-check">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateIdentityForm({ type, user, onClose, onSuccess }) {
  const accountLocalDefault = useMemo(() => {
    const e = String(user?.email || '');
    const i = e.indexOf('@');
    return i > 0 ? e.slice(0, i).toLowerCase() : '';
  }, [user?.email]);

  const [platformDomain, setPlatformDomain] = useState('');
  const [usableDomains, setUsableDomains] = useState([]);
  const [domainsLoaded, setDomainsLoaded] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [localPart, setLocalPart] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const domainOptions = useMemo(() => {
    const opts = [];
    if (platformDomain) opts.push({ value: platformDomain, label: `${platformDomain} (host)` });
    (usableDomains || []).forEach((d) => {
      if (d.domain) {
        const suf = d.source === 'shared' ? ' (shared)' : '';
        opts.push({ value: d.domain, label: `${d.domain}${suf}` });
      }
    });
    return opts;
  }, [platformDomain, usableDomains]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDomainsLoaded(false);
      try {
        const resp = await fetch('/api/auth/signup-config', { credentials: 'include' });
        const j = await resp.json().catch(() => ({}));
        const dom = typeof j.mail_domain === 'string' ? j.mail_domain.trim().toLowerCase() : '';
        if (!cancelled) {
          setPlatformDomain(dom);
          setSelectedDomain((prev) => prev || dom);
        }
      } catch (_) {
        if (!cancelled) {
          const e = String(user?.email || '');
          const i = e.indexOf('@');
          const fb = i > 0 ? e.slice(i + 1).toLowerCase() : '';
          setPlatformDomain(fb);
          setSelectedDomain((prev) => prev || fb);
        }
      }
      try {
        const d = await window.ElvishMailManifest.listUsableDomains();
        if (!cancelled) {
          setUsableDomains(Array.isArray(d.domains) ? d.domains : []);
        }
      } catch (_) {
        if (!cancelled) setUsableDomains([]);
      } finally {
        if (!cancelled) setDomainsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  useEffect(() => {
    if (!domainsLoaded) return;
    setSelectedDomain((prev) => {
      if (prev && domainOptions.some((o) => o.value === prev)) return prev;
      if (platformDomain) return platformDomain;
      const first = domainOptions[0];
      return first ? first.value : '';
    });
  }, [domainsLoaded, platformDomain, domainOptions]);

  useEffect(() => {
    if (type === 'plus') {
      setLocalPart((prev) => (prev && prev.trim() ? prev : accountLocalDefault));
    } else if (type === 'alias') {
      setLocalPart('');
    }
  }, [type, accountLocalDefault]);

  const previewEmail = useMemo(() => {
    const dom = selectedDomain || platformDomain || '…';
    if (type === 'disposable') return `(random)@${dom}`;
    if (type === 'plus') {
      const base = (localPart || 'local').trim().toLowerCase();
      const tag = (name || 'tag').trim().toLowerCase() || 'tag';
      return `${base}+${tag}@${dom}`;
    }
    const loc = (localPart || 'local').trim().toLowerCase() || 'local';
    return `${loc}@${dom}`;
  }, [type, localPart, name, selectedDomain, platformDomain]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.email) {
      setError('Session email unavailable');
      return;
    }
    if (!selectedDomain) {
      setError('Select a domain');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await window.ElvishMailManifest.createGeneratedIdentity({
        accountEmail: user.email,
        type,
        name,
        domain: selectedDomain,
        localPart: type === 'disposable' ? '' : localPart,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create identity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <Alert type="error">{error}</Alert>}

      {(type === 'alias' || type === 'plus' || type === 'disposable') && (
        <label className="settings-identity-profile-field" style={{ marginBottom: '12px' }}>
          <span>Domain</span>
          <MailFromStyleSelect
            value={selectedDomain}
            options={domainOptions}
            onChange={setSelectedDomain}
            loading={!domainsLoaded}
            placeholder="Select a domain"
            emptyMessage="No domains available"
            menuLabel="▸ SELECT DOMAIN"
          />
          {domainsLoaded && usableDomains.length === 0 && platformDomain && (
            <div className="settings-helper">
              Verified custom domains also appear here after you add them under Custom Domains. Operator-shared domains appear when enabled by your admin.
            </div>
          )}
        </label>
      )}

      {type === 'alias' && (
        <Input
          label="Local part (before @)"
          value={localPart}
          onChange={(ev) => setLocalPart(ev.target.value)}
          placeholder="e.g. work, contact, sales"
          helperText="3-64 characters: letters, digits, dots, hyphens, underscores (no +). This is the full mailbox name, not a suffix on your login."
        />
      )}

      {type === 'plus' && (
        <>
          <Input
            label="Local part (before +)"
            value={localPart}
            onChange={(ev) => setLocalPart(ev.target.value)}
            placeholder={accountLocalDefault || 'mailbox'}
            helperText="Usually your main mailbox name on this domain"
          />
          <Input
            label="Plus tag"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            placeholder="e.g. shopping, newsletters"
            helperText="Mail goes to local+tag@domain"
          />
          <Input
            label="Route to Folder (optional)"
            placeholder="e.g. shopping"
            helperText="Leave empty to deliver to inbox"
          />
        </>
      )}

      {type === 'disposable' && (
        <Alert type="info">
          A random disposable local part will be generated on the domain you select. It expires in 30 days.
        </Alert>
      )}

      {(type === 'alias' || type === 'plus' || type === 'disposable') && (
        <div className="settings-helper" style={{ marginBottom: '12px' }}>
          Preview: <strong>{previewEmail}</strong>
        </div>
      )}

      <div className="settings-modal-actions">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          type="submit"
          loading={loading}
          disabled={
            !domainsLoaded
            || !selectedDomain
            || (type === 'alias' && !localPart.trim())
            || (type === 'plus' && (!String(localPart || '').trim() || !String(name || '').trim()))
          }
        >
          {type === 'disposable' ? 'Generate Address' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

// --- Folders Section ---
function FoldersSection() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.ElvishMailManifest.listMailboxFolders();
      const list = result.folders || [];
      setFolders(list.map((f) => ({
        name: f.name,
        total: f.total != null ? f.total : 0,
        unread: f.unread != null ? f.unread : 0,
        isStandard: !!f.is_standard,
      })));
    } catch (e) {
      setError(e.message || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  const standardFolders = folders.filter(f => f.isStandard);
  const customFolders = folders.filter(f => !f.isStandard);

  const getFolderIcon = (name) => {
    const icons = { inbox: 'identities', sent: 'smtp', drafts: 'edit', trash: 'trash' };
    return icons[name.toLowerCase()] || 'folders';
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Folder Management</h2>
        <p>Organize your emails with custom folders</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <Card title="Standard Folders" description="Built-in folders that cannot be deleted or renamed.">
        {loading ? (
          <div className="settings-loading">Loading folders...</div>
        ) : (
          <div className="settings-folders-grid">
            {standardFolders.map(f => (
              <div key={f.name} className="settings-folder-item">
                <span className="settings-folder-icon">{SettingsIcons[getFolderIcon(f.name)]}</span>
                <span className="settings-folder-name">{f.name.charAt(0).toUpperCase() + f.name.slice(1)}</span>
                <span className="settings-folder-count dim">{f.total} emails</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card 
        title="Custom Folders" 
        description="Create folders to organize your emails."
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            {SettingsIcons.plus} Create Folder
          </Button>
        }
      >
        {customFolders.length === 0 ? (
          <EmptyState
            icon="folders"
            title="No custom folders"
            description="Create folders to organize your emails."
            action={<Button variant="secondary" onClick={() => setShowCreateModal(true)}>Create Your First Folder</Button>}
          />
        ) : (
          <div className="settings-folders-grid">
            {customFolders.map(f => (
              <div key={f.name} className="settings-folder-item custom">
                <span className="settings-folder-icon">{SettingsIcons.folders}</span>
                <span className="settings-folder-name">{f.name}</span>
                <span className="settings-folder-count dim">{f.total} emails</span>
                <Button variant="danger" size="sm" title="Delete folder" onClick={() => setConfirmDelete(f.name)}>{SettingsIcons.trash}</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Folder">
        <CreateFolderForm onClose={() => setShowCreateModal(false)} onSuccess={loadFolders} />
      </Modal>

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => !deleteLoading && setConfirmDelete(null)}
        onConfirm={async () => {
          setDeleteLoading(true);
          try {
            await window.ElvishMailManifest.deleteMailboxFolder(confirmDelete);
            await loadFolders();
            setConfirmDelete(null);
          } catch (e) {
            setError(e.message || 'Failed to delete folder');
          } finally {
            setDeleteLoading(false);
          }
        }}
        title="Delete Folder"
        message={`Delete folder "${confirmDelete}"? Messages in this folder may remain in storage until moved.`}
        confirmLabel="Delete Folder"
        confirmVariant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}

function CreateFolderForm({ onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Folder name is required');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setError('Only letters, numbers, dashes, and underscores allowed');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await window.ElvishMailManifest.createMailboxFolder(name.trim());
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <Alert type="error">{error}</Alert>}
      <Input
        label="Folder Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., shopping, newsletters, work"
        helperText="Letters, numbers, dashes, and underscores only. Max 50 characters."
      />
      <div className="settings-modal-actions">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" loading={loading}>Create Folder</Button>
      </div>
    </form>
  );
}

const FILTER_CONDITION_TYPES = [
  { id: 'sender', label: 'Sender (From)' },
  { id: 'subject', label: 'Subject' },
  { id: 'recipient', label: 'Recipient (To)' },
  { id: 'body', label: 'Body (preview / recovered text only)' },
  { id: 'attachment', label: 'Attachments' },
  { id: 'size', label: 'Size (bytes)' },
];

const FILTER_OPS_STRING = [
  { id: 'contains', label: 'Contains' },
  { id: 'equals', label: 'Equals' },
  { id: 'starts_with', label: 'Starts with' },
  { id: 'ends_with', label: 'Ends with' },
  { id: 'matches', label: 'Matches (substring)' },
];

const FILTER_OPS_SIZE = [
  { id: 'greater_than', label: 'Greater than' },
  { id: 'less_than', label: 'Less than' },
  { id: 'equals', label: 'Equals' },
];

const FILTER_ACTION_TYPES = [
  { id: 'move', label: 'Move to folder', supported: true },
  { id: 'mark_read', label: 'Mark as read', supported: true },
  { id: 'delete', label: 'Move to trash', supported: true },
  { id: 'mark_important', label: 'Star / important (API pending)', supported: false },
  { id: 'label', label: 'Label (API pending)', supported: false },
  { id: 'forward', label: 'Forward (not available)', supported: false },
];

function emptyCondition() {
  return { type: 'subject', operator: 'contains', value: '' };
}

function emptyAction() {
  return { type: 'move', value: 'archive' };
}

function opsForConditionType(type) {
  if (type === 'size') return FILTER_OPS_SIZE;
  if (type === 'attachment') return [{ id: 'equals', label: 'Equals' }];
  return FILTER_OPS_STRING;
}

function defaultOperatorForType(type) {
  if (type === 'size') return 'greater_than';
  if (type === 'attachment') return 'equals';
  return 'contains';
}

// --- Filters Section ---
function FiltersSection() {
  const [filters, setFilters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(null);

  const loadFilters = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await window.ElvishMailManifest.listFilters();
      const raw = r.filters || [];
      setFilters(raw.map((x) => ({
        ...x,
        conditions: Array.isArray(x.conditions) ? x.conditions : [],
        actions: Array.isArray(x.actions) ? x.actions : [],
      })));
    } catch (e) {
      setError(e.message || 'Failed to load filters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFilters(); }, [loadFilters]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await window.ElvishMailManifest.createFilter({
        name: newName.trim(),
        enabled: true,
        priority: 100,
        conditions: [emptyCondition()],
        actions: [emptyAction()],
      });
      setNewName('');
      setShowCreateModal(false);
      await loadFilters();
    } catch (err) {
      setError(err.message || 'Failed to create filter');
    }
  };

  const handleDelete = (id) => {
    setConfirmDelete(id);
  };

  const executeDeleteFilter = async () => {
    setDeleteLoading(true);
    try {
      await window.ElvishMailManifest.deleteFilter(confirmDelete);
      await loadFilters();
      setConfirmDelete(null);
    } catch (err) {
      setError(err.message || 'Failed to delete filter');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEdit = (f) => {
    setEditDraft({
      id: f.id,
      name: f.name || '',
      enabled: f.enabled !== false,
      priority: Number(f.priority) || 100,
      conditions: (f.conditions && f.conditions.length) ? f.conditions.map((c) => ({
        type: c.type || 'subject',
        operator: c.operator || 'contains',
        value: c.value == null ? '' : String(c.value),
      })) : [emptyCondition()],
      actions: (f.actions && f.actions.length) ? f.actions.map((a) => ({
        type: a.type || 'move',
        value: a.value == null ? '' : String(a.value),
      })) : [emptyAction()],
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editDraft || !editDraft.name.trim()) {
      setError('Rule name is required');
      return;
    }
    const conds = editDraft.conditions || [];
    if (!conds.length) {
      setError('Add at least one condition');
      return;
    }
    for (let i = 0; i < conds.length; i += 1) {
      const c = conds[i];
      if (c.type === 'attachment') {
        const v = String(c.value || '').trim().toLowerCase();
        if (v !== 'yes' && v !== 'no' && v !== '1' && v !== '0' && v !== 'true' && v !== 'false') {
          setError('Attachment condition value: use yes or no');
          return;
        }
      } else if (c.type !== 'size' && !String(c.value || '').trim()) {
        setError('Each condition needs a value (except size, which needs a number)');
        return;
      }
      if (c.type === 'size' && !/^-?\d+$/.test(String(c.value || '').trim())) {
        setError('Size condition needs a numeric value');
        return;
      }
    }
    const acts = (editDraft.actions || []).filter((a) => {
      const t = FILTER_ACTION_TYPES.find((x) => x.id === a.type);
      return t && t.supported;
    });
    if (!acts.length) {
      setError('Add at least one supported action (move, mark read, or delete)');
      return;
    }
    for (let j = 0; j < acts.length; j += 1) {
      if (acts[j].type === 'move') {
        const folder = String(acts[j].value || '').trim().toLowerCase();
        if (!folder) {
          setError('Move action needs a folder name');
          return;
        }
        if (!/^[a-z0-9_-]+$/.test(folder)) {
          setError('Folder name: letters, numbers, dashes, underscores only');
          return;
        }
      }
    }
    setSaveLoading(true);
    setError('');
    try {
      await window.ElvishMailManifest.updateFilter(editDraft.id, {
        name: editDraft.name.trim(),
        enabled: !!editDraft.enabled,
        priority: Number(editDraft.priority) || 100,
        conditions: conds.map((c) => ({
          type: c.type,
          operator: c.operator,
          value: c.type === 'size' ? String(parseInt(c.value, 10)) : String(c.value || ''),
        })),
        actions: acts,
      });
      setEditDraft(null);
      await loadFilters();
    } catch (err) {
      setError(err.message || 'Failed to save filter');
    } finally {
      setSaveLoading(false);
    }
  };

  const toggleEnabled = async (f) => {
    setToggleLoading(f.id);
    setError('');
    try {
      await window.ElvishMailManifest.updateFilter(f.id, {
        name: f.name,
        enabled: !f.enabled,
        priority: Number(f.priority) || 100,
        conditions: f.conditions || [],
        actions: f.actions || [],
      });
      await loadFilters();
    } catch (err) {
      setError(err.message || 'Failed to update filter');
    } finally {
      setToggleLoading(null);
    }
  };

  const updateConditionRow = (idx, patch) => {
    setEditDraft((d) => {
      if (!d) return d;
      const next = d.conditions.slice();
      const cur = { ...next[idx], ...patch };
      if (patch.type) {
        cur.operator = defaultOperatorForType(patch.type);
      }
      next[idx] = cur;
      return { ...d, conditions: next };
    });
  };

  const updateActionRow = (idx, patch) => {
    setEditDraft((d) => {
      if (!d) return d;
      const next = d.actions.slice();
      next[idx] = { ...next[idx], ...patch };
      return { ...d, actions: next };
    });
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Email Filters</h2>
        <p>
          Rules sync to your account for all clients. Matching uses decrypted metadata in the app for body-based rules.
          For external mail, the server applies the same JSON rules at delivery using only envelope and header fields plus message size — never body text, never third-party spam scores — so sender blocks can discard mail before it is stored.
        </p>
      </div>

      <Alert type="info">
        Filter definitions are stored as JSON on the server so clients stay in sync. In the web app, auto-apply still runs in the Inbox on decrypted previews. At SMTP delivery, Elvish evaluates enabled rules once using envelope/headers/size only: delete actions block without persisting; move actions file straight to the folder. Body conditions are ignored on the server and still match only in the client. Star/label actions are not wired to the API yet.
      </Alert>

      {error && <Alert type="error">{error}</Alert>}

      <Card
        title="Filter rules"
        description="When a message matches all conditions (AND), supported actions run in order. Higher priority numbers run first."
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            {SettingsIcons.plus} Create filter
          </Button>
        }
      >
        {loading ? (
          <div className="settings-loading">Loading filters...</div>
        ) : filters.length === 0 ? (
          <EmptyState
            icon="filters"
            title="No filters yet"
            description="Create a rule with conditions and actions."
            action={<Button variant="primary" onClick={() => setShowCreateModal(true)}>Create your first filter</Button>}
          />
        ) : (
          <div className="settings-filters-list">
            {filters.map((f) => (
              <div key={f.id} className="settings-filter-item">
                <div className="settings-filter-info">
                  <strong>{f.name}</strong>
                  <span className="dim">{(f.conditions || []).length} condition(s) · {(f.actions || []).length} action(s) · priority {(f.priority != null ? f.priority : 100)}</span>
                </div>
                <Badge variant={f.enabled ? 'success' : 'muted'}>{f.enabled ? 'Enabled' : 'Disabled'}</Badge>
                <div className="settings-filter-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={toggleLoading === f.id}
                    onClick={() => toggleEnabled(f)}
                    title={f.enabled ? 'Disable' : 'Enable'}
                  >
                    {f.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openEdit(f)} title="Edit">{SettingsIcons.edit}</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(f.id)}>{SettingsIcons.trash}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create filter" size="lg">
        <form onSubmit={handleCreate}>
          <Input
            label="Rule name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Newsletters to archive"
          />
          <p className="settings-helper" style={{ marginTop: 8 }}>You can add conditions and actions after creation.</p>
          <div className="settings-modal-actions">
            <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editDraft} onClose={() => !saveLoading && setEditDraft(null)} title="Edit filter" size="lg">
        {editDraft && (
          <form onSubmit={saveEdit}>
            <Input label="Rule name" value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
            <div className="settings-filter-editor-grid" style={{ marginTop: 12 }}>
              <label className="settings-label">Enabled</label>
              <label className="settings-checkbox-inline">
                <input
                  type="checkbox"
                  checked={editDraft.enabled}
                  onChange={(e) => setEditDraft({ ...editDraft, enabled: e.target.checked })}
                />
                <span>Run this rule when viewing Inbox</span>
              </label>
              <Input
                label="Priority (higher runs first)"
                type="number"
                value={String(editDraft.priority)}
                onChange={(e) => setEditDraft({ ...editDraft, priority: parseInt(e.target.value, 10) || 0 })}
              />
            </div>

            <h4 className="settings-filter-editor-subtitle">Conditions (all must match)</h4>
            {(editDraft.conditions || []).map((c, idx) => (
              <div key={`c-${idx}`} className="settings-filter-rule-row">
                <select
                  className="settings-select"
                  value={c.type}
                  onChange={(e) => updateConditionRow(idx, { type: e.target.value })}
                >
                  {FILTER_CONDITION_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <select
                  className="settings-select"
                  value={c.operator}
                  onChange={(e) => updateConditionRow(idx, { operator: e.target.value })}
                >
                  {opsForConditionType(c.type).map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <input
                  className="settings-input"
                  placeholder={c.type === 'attachment' ? 'yes or no' : 'Value'}
                  value={c.value}
                  onChange={(e) => updateConditionRow(idx, { value: e.target.value })}
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => {
                  setEditDraft((d) => {
                    if (!d) return d;
                    const next = d.conditions.filter((_, i) => i !== idx);
                    return { ...d, conditions: next.length ? next : [emptyCondition()] };
                  });
                }}>{SettingsIcons.trash}</Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => {
              setEditDraft((d) => (d ? { ...d, conditions: [...d.conditions, emptyCondition()] } : d));
            }}>{SettingsIcons.plus} Add condition</Button>

            <h4 className="settings-filter-editor-subtitle">Actions</h4>
            {(editDraft.actions || []).map((a, idx) => (
              <div key={`a-${idx}`} className="settings-filter-rule-row">
                <select
                  className="settings-select"
                  value={a.type}
                  onChange={(e) => updateActionRow(idx, { type: e.target.value, value: e.target.value === 'move' ? (a.value || 'archive') : '' })}
                >
                  {FILTER_ACTION_TYPES.map((t) => (
                    <option key={t.id} value={t.id} disabled={!t.supported}>{t.label}</option>
                  ))}
                </select>
                <input
                  className="settings-input"
                  style={{ flex: 1 }}
                  placeholder={a.type === 'move' ? 'Folder (e.g. archive, trash, work)' : 'Value if required'}
                  value={a.value || ''}
                  onChange={(e) => updateActionRow(idx, { value: e.target.value })}
                  disabled={a.type === 'mark_read' || a.type === 'delete'}
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => {
                  setEditDraft((d) => {
                    if (!d) return d;
                    const next = d.actions.filter((_, i) => i !== idx);
                    return { ...d, actions: next.length ? next : [emptyAction()] };
                  });
                }}>{SettingsIcons.trash}</Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => {
              setEditDraft((d) => (d ? { ...d, actions: [...d.actions, emptyAction()] } : d));
            }}>{SettingsIcons.plus} Add action</Button>

            <div className="settings-modal-actions" style={{ marginTop: 20 }}>
              <Button variant="secondary" type="button" onClick={() => setEditDraft(null)} disabled={saveLoading}>Cancel</Button>
              <Button variant="primary" type="submit" loading={saveLoading}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => !deleteLoading && setConfirmDelete(null)}
        onConfirm={executeDeleteFilter}
        title="Delete filter"
        message="Are you sure you want to delete this filter rule? This action cannot be undone."
        confirmLabel="Delete filter"
        confirmVariant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}

function normalizeCustomDomainRecord(raw) {
  const status = String(raw?.status || 'pending').trim().toLowerCase() || 'pending';
  return {
    domain: String(raw?.domain || '').trim().toLowerCase(),
    status,
    mxVerified: !!(raw?.mx_verified ?? raw?.mxVerified),
    spfVerified: !!(raw?.spf_verified ?? raw?.spfVerified),
    dkimVerified: !!(raw?.dkim_verified ?? raw?.dkimVerified),
    dmarcVerified: !!(raw?.dmarc_verified ?? raw?.dmarcVerified),
    verificationTxtHost: String(raw?.verification_txt_host ?? raw?.verificationTxtHost ?? '').trim(),
    verificationTxtValue: String(raw?.verification_txt_value ?? raw?.verificationTxtValue ?? '').trim(),
    dnsConfig: normalizeCustomDomainDNSConfig(raw),
    catchallIdentityFP: String(raw?.catchall_identity_fp ?? raw?.catchallIdentityFp ?? '').trim().toUpperCase(),
    createdAt: raw?.created_at || raw?.createdAt || '',
  };
}

function normalizeCustomDomainDNSConfig(raw) {
  const source = raw?.dns_config || raw?.dnsConfig || {};
  return {
    verificationTxt: normalizeCustomDomainDNSConfigEntry(source.verification_txt || source.verificationTxt, 'TXT'),
    mx: normalizeCustomDomainDNSConfigEntry(source.mx, 'MX'),
    spf: normalizeCustomDomainDNSConfigEntry(source.spf, 'TXT'),
    dkim: normalizeCustomDomainDNSConfigEntry(source.dkim, 'TXT'),
    dmarc: normalizeCustomDomainDNSConfigEntry(source.dmarc, 'TXT'),
  };
}

function normalizeCustomDomainDNSConfigEntry(raw, fallbackType) {
  return {
    type: String(raw?.type || fallbackType || 'TXT').trim().toUpperCase() || 'TXT',
    host: String(raw?.host || '').trim(),
    value: String(raw?.value || '').trim(),
    ttl: String(raw?.ttl || 'Auto').trim() || 'Auto',
    extra: String(raw?.extra || '').trim(),
    hint: String(raw?.hint || '').trim(),
  };
}

function customDomainStatusVariant(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'active' || normalized === 'verified') return 'success';
  if (normalized === 'pending') return 'warning';
  return 'error';
}

function customDomainStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'active' ? 'ready' : (normalized || 'pending');
}

function customDomainIsReady(domain) {
  const status = String(domain?.status || '').trim().toLowerCase();
  return status === 'active' || status === 'verified';
}

function relativeDNSName(name, domain) {
  const fqdn = String(name || '').trim().toLowerCase().replace(/\.$/, '');
  const base = String(domain || '').trim().toLowerCase().replace(/\.$/, '');
  if (!fqdn || !base) return fqdn || '';
  if (fqdn === base) return '@';
  const suffix = '.' + base;
  return fqdn.endsWith(suffix) ? (fqdn.slice(0, -suffix.length) || '@') : fqdn;
}

function uniqueDNSValues(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)));
}

function buildCustomDomainDNSRecords(domain, verifyResult) {
  if (!domain?.domain) return [];
  const dnsConfig = domain.dnsConfig || {};
  const domainName = domain.domain;
  const records = [];
  const checkFor = (key) => verifyResult?.checks?.[key] || null;
  const pushRecord = (id, label, recordConfig, check, ok) => {
    const fqdn = String(recordConfig?.host || '').trim();
    const statusText = String(
      check?.note
      || check?.error
      || (check?.ok ? 'Verified.' : '')
      || recordConfig?.hint
      || ''
    ).trim();
    records.push({
      id,
      label,
      ok: !!ok,
      type: String(recordConfig?.type || (id === 'mx' ? 'MX' : 'TXT')).trim().toUpperCase(),
      hostLabel: relativeDNSName(fqdn, domainName) || '@',
      fqdn,
      value: String(recordConfig?.value || '').trim(),
      ttl: String(recordConfig?.ttl || 'Auto').trim() || 'Auto',
      extra: String(recordConfig?.extra || '').trim(),
      statusText,
      setupNote: String(recordConfig?.hint || '').trim(),
      detectedValues: uniqueDNSValues(check?.values),
    });
  };

  pushRecord(
    'ownership',
    'Ownership TXT',
    {
      type: 'TXT',
      host: domain.verificationTxtHost || dnsConfig?.verificationTxt?.host || '',
      value: domain.verificationTxtValue || dnsConfig?.verificationTxt?.value || '',
      ttl: dnsConfig?.verificationTxt?.ttl || 'Auto',
      hint: 'Publish this exact TXT record so Elvish can verify you control the domain.',
    },
    checkFor('ownership'),
    verifyResult?.ownership_verified
  );
  pushRecord('mx', 'MX', dnsConfig?.mx || { host: domainName }, checkFor('mx'), domain.mxVerified || checkFor('mx')?.ok);
  pushRecord('spf', 'SPF', dnsConfig?.spf || { host: domainName }, checkFor('spf'), domain.spfVerified || checkFor('spf')?.ok);
  pushRecord('dkim', 'DKIM', dnsConfig?.dkim || { host: '' }, checkFor('dkim'), domain.dkimVerified || checkFor('dkim')?.ok);
  pushRecord('dmarc', 'DMARC', dnsConfig?.dmarc || { host: `_dmarc.${domainName}` }, checkFor('dmarc'), domain.dmarcVerified || checkFor('dmarc')?.ok);
  return records;
}

function validateCustomDomainInput(raw) {
  const domain = String(raw || '').trim().toLowerCase().replace(/\.+$/, '');
  if (!domain) return 'Domain is required';
  if (domain.length > 253 || !domain.includes('.')) return 'Enter a valid DNS domain';
  const parts = domain.split('.');
  for (const part of parts) {
    if (!part || part.length > 63) return 'Enter a valid DNS domain';
    if (part.startsWith('-') || part.endsWith('-')) return 'Enter a valid DNS domain';
    if (!/^[a-z0-9-]+$/.test(part)) return 'Enter a valid DNS domain';
  }
  return '';
}

function domainCheckState(domain, verifyResult, key, label) {
  const checks = verifyResult?.checks || {};
  if (checks[key]) {
    const entry = checks[key];
    const values = Array.isArray(entry.values) && entry.values.length ? entry.values.join(', ') : '';
    return {
      key,
      label,
      ok: !!entry.ok,
      note: entry.note || entry.error || values || entry.expected || '',
    };
  }
  if (key === 'ownership') {
    const setup = domain?.verificationTxtHost && domain?.verificationTxtValue
      ? `${domain.verificationTxtHost} -> ${domain.verificationTxtValue}`
      : 'Add the verification TXT record, then run Verify DNS.';
    return {
      key,
      label,
      ok: !!verifyResult?.ownership_verified,
      note: verifyResult?.ownership_verified ? 'Ownership verified.' : setup,
    };
  }
  const flagName = `${key}Verified`;
  return {
    key,
    label,
    ok: !!domain?.[flagName],
    note: domain?.[flagName] ? 'Verified.' : 'Run Verify DNS to test this record.',
  };
}

function SettingsToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast?.message) return undefined;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast?.message) return null;
  return <div className={`mail-toast ${toast.type || ''}`}>{toast.message}</div>;
}

// --- Domain Setup Progress Component ---
function DomainSetupProgress({ checks }) {
  const steps = [
    { key: 'ownership', label: 'Ownership' },
    { key: 'mx', label: 'MX' },
    { key: 'spf', label: 'SPF' },
    { key: 'dkim', label: 'DKIM' },
    { key: 'dmarc', label: 'DMARC' },
  ];

  const completedCount = checks.filter((c) => c.ok).length;
  const allComplete = completedCount === steps.length;

  return (
    <div className="domain-setup-progress">
      <div className="domain-setup-progress-header">
        <span className="domain-setup-progress-title">Setup Progress</span>
        <span className={`domain-setup-progress-count ${allComplete ? 'complete' : ''}`}>
          {completedCount} of {steps.length} complete
        </span>
      </div>
      <div className="domain-setup-progress-bar">
        <div
          className="domain-setup-progress-fill"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>
      <div className="domain-setup-progress-steps">
        {steps.map((step) => {
          const check = checks.find((c) => c.key === step.key);
          const isComplete = check?.ok;
          return (
            <div
              key={step.key}
              className={`domain-setup-step ${isComplete ? 'complete' : 'pending'}`}
            >
              <div className="domain-setup-step-icon">
                {isComplete ? SettingsIcons.check : <span className="domain-setup-step-circle" />}
              </div>
              <span className="domain-setup-step-label">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Compact DNS Record Component ---
function DomainDNSRecord({ record, onCopy }) {
  const copyAllFields = () => {
    const parts = [];
    if (record.hostLabel) parts.push(`Host: ${record.hostLabel}`);
    if (record.type) parts.push(`Type: ${record.type}`);
    if (record.value) parts.push(`Value: ${record.value}`);
    if (record.extra) parts.push(record.extra);
    if (record.ttl && record.ttl !== 'Auto') parts.push(`TTL: ${record.ttl}`);
    onCopy(parts.join('\n'));
  };

  return (
    <div className={`domain-dns-record ${record.ok ? 'verified' : 'pending'}`}>
      <div className="domain-dns-record-header">
        <div className="domain-dns-record-title">
          <span className="domain-dns-record-icon">
            {record.ok ? SettingsIcons.check : SettingsIcons.x}
          </span>
          <strong>{record.label}</strong>
        </div>
        <Badge variant={record.ok ? 'success' : 'warning'}>
          {record.ok ? 'Verified' : 'Pending'}
        </Badge>
      </div>
      <div className="domain-dns-record-fields">
        <div className="domain-dns-record-row">
          <div className="domain-dns-record-field">
            <span className="domain-dns-record-field-label">Type</span>
            <code>{record.type}</code>
          </div>
          <div className="domain-dns-record-field">
            <span className="domain-dns-record-field-label">Host</span>
            <code>{record.hostLabel || '@'}</code>
          </div>
          {record.extra && (
            <div className="domain-dns-record-field">
              <span className="domain-dns-record-field-label">Priority</span>
              <code>{record.extra.replace(/^Priority\s*/i, '')}</code>
            </div>
          )}
        </div>
        <div className="domain-dns-record-value-row">
          <div className="domain-dns-record-field wide">
            <span className="domain-dns-record-field-label">Value</span>
            <code className="domain-dns-record-value">{record.value || 'Awaiting server guidance'}</code>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={copyAllFields}
            disabled={!record.value}
            title="Copy record details"
          >
            {SettingsIcons.copy} Copy
          </Button>
        </div>
      </div>
      {record.statusText && !record.ok && (
        <div className="domain-dns-record-note">{record.statusText}</div>
      )}
      {record.detectedValues?.length > 0 && (
        <div className="domain-dns-record-detected">
          <span className="domain-dns-record-field-label">Detected</span>
          <code>{record.detectedValues.join(', ')}</code>
        </div>
      )}
    </div>
  );
}

// --- Custom Domains Section ---
function CustomDomainsSection() {
  const [domains, setDomains] = useState([]);
  const [identities, setIdentities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [paid, setPaid] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [domainFormError, setDomainFormError] = useState('');
  const [busyAdd, setBusyAdd] = useState(false);
  const [detailDomainName, setDetailDomainName] = useState('');
  const [detailError, setDetailError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [catchallDraft, setCatchallDraft] = useState('');
  const [catchallLoading, setCatchallLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const showToast = useCallback((message, type) => {
    setToast({ message, type });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const billing = await window.ElvishMailManifest.getBillingStatus();
      setPaid(!!billing.paid);
      if (!billing.paid) {
        setDomains([]);
        setIdentities([]);
        return [];
      }
      const [domainsResult, identitiesResult] = await Promise.allSettled([
        window.ElvishMailManifest.listCustomDomains(),
        window.ElvishMailManifest.listIdentities(),
      ]);
      if (domainsResult.status !== 'fulfilled') throw domainsResult.reason;
      const nextDomains = (domainsResult.value.domains || []).map(normalizeCustomDomainRecord);
      setDomains(nextDomains);
      if (identitiesResult.status === 'fulfilled') {
        const nextIdentities = (identitiesResult.value.identities || [])
          .filter((identity) => !!identity.is_active)
          .map((identity) => ({
            email: identity.email,
            fingerprint: String(identity.fingerprint || '').trim().toUpperCase(),
            isDefault: !!identity.is_default,
          }));
        setIdentities(nextIdentities);
      } else {
        setIdentities([]);
      }
      return nextDomains;
    } catch (e) {
      setError(e.message || 'Failed to load domains');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!detailDomainName) return;
    const exists = domains.some((domain) => domain.domain === detailDomainName);
    if (!exists) {
      setDetailDomainName('');
      setVerifyResult(null);
      setDetailError('');
      setCatchallDraft('');
    }
  }, [detailDomainName, domains]);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.domain === detailDomainName) || null,
    [detailDomainName, domains]
  );

  const availableCatchallTargets = useMemo(
    () => identities.slice().sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.email.localeCompare(b.email)),
    [identities]
  );

  const openDomainDetails = useCallback((domain, nextVerifyResult = null) => {
    const current = typeof domain === 'string'
      ? domains.find((entry) => entry.domain === domain) || null
      : domain;
    if (!current?.domain) return;
    setDetailDomainName(current.domain);
    setVerifyResult(nextVerifyResult);
    setDetailError('');
    setCatchallDraft(current.catchallIdentityFP || '');
  }, [domains]);

  const closeDomainDetails = () => {
    if (verifyLoading || catchallLoading) return;
    setDetailDomainName('');
    setVerifyResult(null);
    setDetailError('');
    setCatchallDraft('');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const d = String(newDomain || '').trim().toLowerCase().replace(/\.+$/, '');
    const validation = validateCustomDomainInput(d);
    setDomainFormError(validation);
    if (validation) return;
    setBusyAdd(true);
    setError('');
    try {
      const result = await window.ElvishMailManifest.addCustomDomain(d);
      const refreshed = await load();
      const fallbackDomain = normalizeCustomDomainRecord({
        domain: result.domain || d,
        status: 'pending',
        dns_config: result?.dns_config,
        verification_txt_host: result?.dns_config?.verification_txt?.host,
        verification_txt_value: result?.dns_config?.verification_txt?.value,
      });
      setNewDomain('');
      setShowAddModal(false);
      openDomainDetails(refreshed.find((domain) => domain.domain === fallbackDomain.domain) || fallbackDomain);
      showToast(`Added ${fallbackDomain.domain}. Publish the DNS records, then verify DNS.`, 'ok');
    } catch (err) {
      setError(err.message || 'Failed to add domain');
    } finally {
      setBusyAdd(false);
    }
  };

  const verifySelectedDomain = async () => {
    if (!selectedDomain?.domain) return;
    setVerifyLoading(true);
    setDetailError('');
    setError('');
    try {
      const result = await window.ElvishMailManifest.verifyCustomDomain(selectedDomain.domain);
      setVerifyResult(result);
      const refreshed = await load();
      openDomainDetails(selectedDomain.domain, result);
      const latest = refreshed.find((domain) => domain.domain === selectedDomain.domain);
      if (result.ready || customDomainIsReady(latest || selectedDomain)) {
        showToast(`${selectedDomain.domain} is ready to receive mail.`, 'ok');
      } else {
        showToast(`DNS check finished for ${selectedDomain.domain}. Review the missing records.`, 'err');
      }
    } catch (err) {
      const message = err.message || 'Verify failed';
      setDetailError(message);
      setError(message);
      showToast(message, 'err');
    } finally {
      setVerifyLoading(false);
    }
  };

  const saveCatchall = async () => {
    if (!selectedDomain?.domain) return;
    setCatchallLoading(true);
    setDetailError('');
    setError('');
    try {
      await window.ElvishMailManifest.setDomainCatchall(selectedDomain.domain, catchallDraft || null);
      await load();
      showToast(
        catchallDraft
          ? `Catch-all saved for ${selectedDomain.domain}.`
          : `Catch-all cleared for ${selectedDomain.domain}.`,
        'ok'
      );
    } catch (err) {
      const message = err.message || 'Could not save catch-all';
      setDetailError(message);
      setError(message);
      showToast(message, 'err');
    } finally {
      setCatchallLoading(false);
    }
  };

  const removeOne = (domain) => {
    setConfirmDelete(domain);
  };

  const executeRemoveDomain = async () => {
    setDeleteLoading(true);
    setError('');
    try {
      await window.ElvishMailManifest.deleteCustomDomain(confirmDelete);
      await load();
      if (detailDomainName === confirmDelete) closeDomainDetails();
      showToast(`Removed ${confirmDelete}.`, 'ok');
      setConfirmDelete(null);
    } catch (err) {
      const message = err.message || 'Delete failed';
      setError(message);
      showToast(message, 'err');
    } finally {
      setDeleteLoading(false);
    }
  };

  const domainChecks = selectedDomain ? [
    domainCheckState(selectedDomain, verifyResult, 'ownership', 'Ownership TXT'),
    domainCheckState(selectedDomain, verifyResult, 'mx', 'MX'),
    domainCheckState(selectedDomain, verifyResult, 'spf', 'SPF'),
    domainCheckState(selectedDomain, verifyResult, 'dkim', 'DKIM'),
    domainCheckState(selectedDomain, verifyResult, 'dmarc', 'DMARC'),
  ] : [];
  const dnsRecords = selectedDomain ? buildCustomDomainDNSRecords(selectedDomain, verifyResult) : [];
  const catchallDirty = selectedDomain && (selectedDomain.catchallIdentityFP || '') !== (catchallDraft || '');

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Custom Domains</h2>
        <p>Use your own domain for email addresses</p>
      </div>

      {!paid ? (
        <Alert type="info" title="Paid Feature">
          Enable paid API features (operator sets <code className="mono">ELVISH_PAID_FEATURES=true</code>) or grant admin for testing.
        </Alert>
      ) : (
        <Alert type="info" title="DNS Workflow">
          Add a domain, publish the ownership TXT and mail records shown in the setup modal, then run <strong>Verify DNS</strong> until the domain is ready.
        </Alert>
      )}

      {error && <Alert type="error">{error}</Alert>}

      <Card
        title="Your Domains"
        description="Add and manage custom email domains."
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)} disabled={!paid}>
            {SettingsIcons.plus} Add Domain
          </Button>
        }
      >
        {loading ? (
          <div className="settings-loading">Loading domains...</div>
        ) : domains.length === 0 ? (
          <EmptyState
            icon="domains"
            title="No custom domains"
            description={paid ? 'Add a domain to start guided verification.' : 'Paid tier required.'}
          />
        ) : (
          <div className="settings-domains-list">
            {domains.map((domain) => (
              <div key={domain.domain} className="settings-domain-item">
                <div className="settings-domain-info">
                  <div>
                    <strong>{domain.domain}</strong>
                    <div className="settings-domain-subtitle">
                      {customDomainIsReady(domain)
                        ? 'Ready to receive mail.'
                        : 'DNS records still need attention.'}
                    </div>
                  </div>
                  <div className="settings-domain-status">
                    <Badge variant={customDomainStatusVariant(domain.status)}>
                      {customDomainStatusLabel(domain.status)}
                    </Badge>
                  </div>
                </div>
                <div className="settings-domain-checks">
                  <span className={domain.mxVerified ? 'ok' : 'pending'}>{domain.mxVerified ? SettingsIcons.check : SettingsIcons.x} MX</span>
                  <span className={domain.spfVerified ? 'ok' : 'pending'}>{domain.spfVerified ? SettingsIcons.check : SettingsIcons.x} SPF</span>
                  <span className={domain.dkimVerified ? 'ok' : 'pending'}>{domain.dkimVerified ? SettingsIcons.check : SettingsIcons.x} DKIM</span>
                  <span className={domain.dmarcVerified ? 'ok' : 'pending'}>{domain.dmarcVerified ? SettingsIcons.check : SettingsIcons.x} DMARC</span>
                </div>
                <div className="settings-filter-actions">
                  <Button variant="secondary" size="sm" onClick={() => openDomainDetails(domain)}>
                    {customDomainIsReady(domain) ? 'Manage' : 'Setup & Verify'}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => removeOne(domain.domain)}>{SettingsIcons.trash}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showAddModal} onClose={() => !busyAdd && setShowAddModal(false)} title="Add Custom Domain">
        {!paid ? (
          <Alert type="warning">Paid subscription required.</Alert>
        ) : (
          <form onSubmit={handleAdd}>
            {domainFormError && <Alert type="error">{domainFormError}</Alert>}
            <Input
              label="Domain"
              value={newDomain}
              onChange={(e) => {
                setNewDomain(e.target.value);
                if (domainFormError) setDomainFormError('');
              }}
              placeholder="example.com"
              error={domainFormError}
              helperText="Use the apex domain you control. Subdomains are not supported here."
            />
            <div className="settings-modal-actions">
              <Button variant="secondary" type="button" onClick={() => setShowAddModal(false)} disabled={busyAdd}>Cancel</Button>
              <Button variant="primary" type="submit" loading={busyAdd}>Add</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!selectedDomain}
        onClose={closeDomainDetails}
        title={selectedDomain ? `Domain Setup · ${selectedDomain.domain}` : 'Domain Setup'}
        size="lg"
      >
        {selectedDomain ? (
          <div className="domain-setup-modal">
            {/* Header with status and verify button */}
            <div className="domain-setup-header">
              <div className="domain-setup-header-info">
                <Badge variant={customDomainStatusVariant(selectedDomain.status)}>
                  {customDomainStatusLabel(selectedDomain.status)}
                </Badge>
                <p className="domain-setup-header-desc">
                  {customDomainIsReady(selectedDomain)
                    ? 'This domain is ready to receive mail. Re-run verification anytime or adjust catch-all routing below.'
                    : 'Publish the DNS records below at your provider, then click Verify DNS to check each one.'}
                </p>
              </div>
              <Button variant="primary" onClick={verifySelectedDomain} loading={verifyLoading}>
                {SettingsIcons.refresh} Verify DNS
              </Button>
            </div>

            {/* Visual progress checklist */}
            <DomainSetupProgress checks={domainChecks} />

            {/* Errors and issues */}
            {detailError && <Alert type="error">{detailError}</Alert>}
            {verifyResult?.issues?.length > 0 && (
              <Alert type="warning" title="Issues found">
                <ul className="domain-setup-issues">
                  {verifyResult.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </Alert>
            )}

            {/* DNS Records - using compact component */}
            <div className="domain-setup-records">
              <div className="domain-setup-records-header">
                <h4>DNS Records</h4>
                <p>Add these records at your DNS provider. Most providers need the Host and Value fields.</p>
              </div>
              <div className="domain-dns-record-list">
                {dnsRecords.map((record) => (
                  <DomainDNSRecord
                    key={record.id}
                    record={record}
                    onCopy={copyText}
                  />
                ))}
              </div>
            </div>

            {/* Catch-all - only prominent when domain is ready */}
            {customDomainIsReady(selectedDomain) && (
              <div className="domain-setup-catchall">
                <div className="domain-setup-catchall-header">
                  <h4>Catch-All Routing</h4>
                  <p>Route unmatched addresses to one of your identities.</p>
                </div>
                <div className="domain-setup-catchall-controls">
                  <select
                    className="settings-select"
                    value={catchallDraft}
                    onChange={(e) => setCatchallDraft(e.target.value)}
                    disabled={catchallLoading}
                  >
                    <option value="">Disabled</option>
                    {availableCatchallTargets.map((identity) => (
                      <option key={identity.fingerprint} value={identity.fingerprint}>
                        {identity.email}{identity.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    onClick={saveCatchall}
                    loading={catchallLoading}
                    disabled={!catchallDirty}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}

            <div className="settings-modal-actions">
              <Button variant="secondary" type="button" onClick={closeDomainDetails} disabled={verifyLoading || catchallLoading}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => !deleteLoading && setConfirmDelete(null)}
        onConfirm={executeRemoveDomain}
        title="Remove Domain"
        message={`Are you sure you want to remove the domain "${confirmDelete}"? This will stop receiving emails for this domain.`}
        confirmLabel="Remove Domain"
        confirmVariant="danger"
        loading={deleteLoading}
      />

      <SettingsToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function GpgIdentityKeyRow({ k, showDefaultBadge, vaultUnlocked }) {
  const [exportPrivateOpen, setExportPrivateOpen] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState(false);
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportErr, setExportErr] = useState('');

  const exportPublic = () => {
    const txt = k.armoredPublic || '';
    if (!txt) return;
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `public-${(k.email || 'key').replace(/@/g, '_at_')}.asc`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const closePrivateModal = () => {
    setExportPrivateOpen(false);
    setExportErr('');
    setExportPassphrase(false);
    setPass1('');
    setPass2('');
  };

  const downloadPrivateKey = async () => {
    setExportErr('');
    if (!window.ElvishKeyVault || typeof window.ElvishKeyVault.exportIdentityPrivateKeyArmored !== 'function') {
      setExportErr('Key vault is not available.');
      return;
    }
    if (!window.ElvishKeyVault.isUnlocked()) {
      setExportErr('Unlock your keys from the mail unlock dialog first.');
      return;
    }
    if (exportPassphrase) {
      if (pass1 !== pass2) {
        setExportErr('Passphrases do not match.');
        return;
      }
      if (pass1.trim().length < 8) {
        setExportErr('Passphrase must be at least 8 characters.');
        return;
      }
    }
    setExportBusy(true);
    try {
      const passphrase = exportPassphrase ? pass1 : '';
      const armored = await window.ElvishKeyVault.exportIdentityPrivateKeyArmored(k.keyId, { passphrase });
      const slug = (k.email || 'key').replace(/@/g, '_at_');
      const suffix = exportPassphrase ? '-private-encrypted.asc' : '-private.asc';
      const blob = new Blob([armored], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}${suffix}`;
      a.click();
      URL.revokeObjectURL(a.href);
      closePrivateModal();
    } catch (e) {
      setExportErr((e && e.message) || 'Export failed');
    } finally {
      setExportBusy(false);
    }
  };

  const vaultLocked = !vaultUnlocked;

  return (
    <div className={`settings-key-item ${vaultLocked ? 'is-locked' : ''}`}>
      <div className="settings-key-icon">{SettingsIcons.identities}</div>
      <div className="settings-key-info">
        <strong>{k.email}</strong>
        <code>{k.keyId}</code>
        <span className="dim">{k.algorithm} · {k.bits} bits · {new Date(k.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="settings-key-badges">
        <Badge variant={k.isActive ? 'success' : 'muted'}>{k.isActive ? 'Active' : 'Inactive'}</Badge>
        {showDefaultBadge && k.isDefault && <Badge variant="accent">Default</Badge>}
        {vaultLocked && <Badge variant="warning">Vault locked</Badge>}
      </div>
      <div className="settings-key-actions">
        <Button variant="secondary" size="sm" title="Download armored public key" onClick={exportPublic}>
          {SettingsIcons.download} Public
        </Button>
        <Button
          variant="secondary"
          size="sm"
          title={vaultLocked ? 'Unlock the vault to export' : 'Export private key (.asc)'}
          onClick={() => (vaultLocked ? null : setExportPrivateOpen(true))}
          disabled={vaultLocked}
        >
          {SettingsIcons.download} Private
        </Button>
      </div>

      <Modal open={exportPrivateOpen} onClose={() => !exportBusy && closePrivateModal()} title="Export identity private key">
        <Alert type="warning" title="Sensitive material">
          Anyone with this file can read mail encrypted to this address. Prefer a passphrase-protected file if you copy it off this device.
        </Alert>
        <Alert type="info">
          The account master key is not exportable. This file is only for this identity ({k.email}).
        </Alert>
        <Toggle
          checked={exportPassphrase}
          onChange={(v) => { setExportPassphrase(v); setExportErr(''); }}
          label="Protect with passphrase (OpenPGP / GnuPG–compatible)"
        />
        {exportPassphrase && (
          <>
            <Input
              label="Passphrase"
              type="password"
              value={pass1}
              onChange={(e) => setPass1(e.target.value)}
              placeholder="At least 8 characters"
            />
            <Input
              label="Confirm passphrase"
              type="password"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              placeholder="Repeat passphrase"
            />
          </>
        )}
        {exportErr && <Alert type="error">{exportErr}</Alert>}
        <div className="settings-modal-actions">
          <Button variant="secondary" type="button" onClick={closePrivateModal} disabled={exportBusy}>Cancel</Button>
          <Button variant="primary" type="button" onClick={downloadPrivateKey} loading={exportBusy}>
            {SettingsIcons.download} Download
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// --- GPG Keys Section ---
function GPGKeysSection() {
  const [keys, setKeys] = useState([]);
  const [accountKey, setAccountKey] = useState(null);
  const [vaultUnlocked, setVaultUnlocked] = useState(
    () => !!(typeof window !== 'undefined' && window.ElvishKeyVault && window.ElvishKeyVault.isUnlocked && window.ElvishKeyVault.isUnlocked()),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    const tick = () => {
      try {
        setVaultUnlocked(!!(window.ElvishKeyVault && window.ElvishKeyVault.isUnlocked && window.ElvishKeyVault.isUnlocked()));
      } catch (_) {
        setVaultUnlocked(false);
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, []);

  const longLivedKeys = useMemo(
    () => keys.filter((k) => !looksLikeDisposableIdentity(k.email, k.type)),
    [keys],
  );
  const disposableKeys = useMemo(
    () => keys.filter((k) => looksLikeDisposableIdentity(k.email, k.type)),
    [keys],
  );

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Load identities which contain GPG key info
      const result = await window.ElvishMailManifest.listIdentities();
      const ids = result.identities || [];
      setKeys(ids.map(i => ({
        keyId: i.fingerprint,
        email: i.email,
        type: i.type,
        algorithm: i.algorithm,
        bits: i.bits,
        isActive: i.is_active,
        isDefault: i.is_default,
        createdAt: i.created_at,
        armoredPublic: i.armored_public || '',
      })));
      setAccountKey({
        keyId: 'ACCOUNT-KEY',
      });
    } catch (e) {
      setError(e.message || 'Failed to load keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>GPG Keys</h2>
        <p>Manage your encryption keys for secure email</p>
      </div>

      <div className="settings-section-actions">
        <Button variant="secondary" size="sm" onClick={() => setShowInfo(!showInfo)}>
          {SettingsIcons.info} {showInfo ? 'Hide' : 'Show'} Info
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
          {SettingsIcons.upload} Import Key
        </Button>
      </div>

      {showInfo && (
        <Card>
          <div className="settings-keys-info">
            <div className="settings-keys-info-item">
              <strong>{SettingsIcons.keys} Account Key</strong>
              <p>Master key encrypted with your password. Used to encrypt/decrypt all identity keys. Its private half is not exportable.</p>
            </div>
            <div className="settings-keys-info-item">
              <strong>{SettingsIcons.identities} Identity Keys</strong>
              <p>Individual GPG keys for each long-lived email identity, encrypted to your account key.</p>
            </div>
            <div className="settings-keys-info-item">
              <strong>{SettingsIcons.identities} Disposable Addresses</strong>
              <p>Temporary addresses get their own keys; they expire and can be removed like other identities.</p>
            </div>
            <Alert type="info">
              Keys are generated and encrypted client-side in your browser.
              You can download identity private keys here for GnuPG or other tools; optional passphrase protection uses standard OpenPGP key encryption.
            </Alert>
          </div>
        </Card>
      )}

      {error && <Alert type="error">{error}</Alert>}

      {/* Account Key */}
      {accountKey && (
        <Card className={!vaultUnlocked ? 'settings-card-warning' : ''}>
          <div className="settings-key-item account-key">
            <div className="settings-key-icon">{SettingsIcons.keys}</div>
            <div className="settings-key-info">
              <strong>Account Key</strong>
              <Badge variant={!vaultUnlocked ? 'warning' : 'success'}>
                {!vaultUnlocked ? 'Locked' : 'Unlocked'}
              </Badge>
            </div>
            <div className="settings-key-warning dim" style={{ marginTop: 8 }}>
              The account private key cannot be exported. Identity keys below can be exported when the vault is unlocked.
            </div>
            {!vaultUnlocked && (
              <div className="settings-key-warning">
                Unlock your vault to use encryption features.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Identity Keys (non-disposable) */}
      <Card
        title="Identity Keys"
        description="GPG keys for your primary addresses and aliases (not disposable addresses)."
      >
        {loading ? (
          <div className="settings-loading">Loading keys...</div>
        ) : longLivedKeys.length === 0 ? (
          <EmptyState
            icon="keys"
            title="No identity keys"
            description="Keys are created automatically when you create an identity."
          />
        ) : (
          <div className="settings-keys-list">
            {longLivedKeys.map((k) => (
              <GpgIdentityKeyRow key={k.keyId} k={k} showDefaultBadge vaultUnlocked={vaultUnlocked} />
            ))}
          </div>
        )}
      </Card>

      {/* Disposable address keys */}
      <Card
        title="Disposable Addresses"
        description="GPG keys for temporary disposable addresses (they expire automatically)."
      >
        {loading ? (
          <div className="settings-loading">Loading keys...</div>
        ) : disposableKeys.length === 0 ? (
          <EmptyState
            icon="keys"
            title="No disposable keys"
            description="Create a disposable address under Identities to get a key for it."
          />
        ) : (
          <div className="settings-keys-list">
            {disposableKeys.map((k) => (
              <GpgIdentityKeyRow key={k.keyId} k={k} showDefaultBadge={false} vaultUnlocked={vaultUnlocked} />
            ))}
          </div>
        )}
      </Card>

      <Modal open={showImportModal} onClose={() => setShowImportModal(false)} title="Import GPG Key">
        <Alert type="info">
          Paste your GPG key (private or public) below. The key will be encrypted with your 
          password before being stored.
        </Alert>
        <Alert type="warning">
          Key import is an advanced feature. Imported keys must be compatible with OpenPGP.js.
        </Alert>
        <div className="settings-modal-actions">
          <Button variant="secondary" onClick={() => setShowImportModal(false)}>Cancel</Button>
          <Button variant="primary" disabled>Import Key</Button>
        </div>
      </Modal>
    </div>
  );
}

// --- SMTP Submission Section ---
function SMTPSubmissionSection({ onGoToIdentities }) {
  const [credentials, setCredentials] = useState([]);
  const [identities, setIdentities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [paid, setPaid] = useState(false);
  const [credName, setCredName] = useState('');
  const [credFp, setCredFp] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCredentials, setShowCredentials] = useState(null);

  const smtpHost = typeof window !== 'undefined' ? window.location.hostname : '';

  const sendingIdentities = useMemo(() => {
    const raw = identities || [];
    const rows = raw
      .filter((i) => i.is_active !== false)
      .map((i) => ({
        email: String(i.email || '').trim(),
        fingerprint: String(i.fingerprint || '').trim().toUpperCase(),
        isDefault: !!i.is_default,
        type: i.type,
      }))
      .filter((i) => i.fingerprint && i.email);
    rows.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.email.localeCompare(b.email));
    return rows;
  }, [identities]);

  const identityEmailByFp = useMemo(() => {
    const m = new Map();
    for (const i of sendingIdentities) {
      m.set(i.fingerprint, i.email);
    }
    return m;
  }, [sendingIdentities]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const b = await window.ElvishMailManifest.getBillingStatus();
      setPaid(!!b.paid);
      if (!b.paid) {
        setCredentials([]);
        setIdentities([]);
        return;
      }
      const [credRes, idRes] = await Promise.allSettled([
        window.ElvishMailManifest.listSMTPCredentials(),
        window.ElvishMailManifest.listIdentities(),
      ]);
      if (credRes.status !== 'fulfilled') throw credRes.reason;
      const raw = credRes.value.credentials || [];
      setCredentials(raw.map((c) => ({
        id: c.id,
        name: c.name,
        username: c.username,
        identityFingerprint: String(c.identity_fingerprint ?? c.identityFingerprint ?? '').trim().toUpperCase(),
        identityEmail: String(c.identity_email ?? c.email ?? '').trim(),
      })));
      if (idRes.status === 'fulfilled') {
        setIdentities(idRes.value.identities || []);
      } else {
        setIdentities([]);
      }
    } catch (e) {
      setError(e.message || 'Failed to load SMTP credentials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreateModal = useCallback(() => {
    setError('');
    const list = sendingIdentities;
    const def = list.find((i) => i.isDefault) || list[0];
    setCredFp(def ? def.fingerprint : '');
    setCredName('');
    setShowCreateModal(true);
  }, [sendingIdentities]);

  const createCred = async (e) => {
    e.preventDefault();
    if (!credName.trim() || !credFp.trim()) return;
    setBusy(true);
    setError('');
    try {
      const r = await window.ElvishMailManifest.createSMTPCredential({
        name: credName.trim(),
        identity_fingerprint: credFp.trim(),
      });
      const pw = r.credential && r.credential.password;
      const user = r.credential && r.credential.username;
      setShowCredentials({ username: user, password: pw, isNew: true });
      setCredName('');
      setCredFp('');
      setShowCreateModal(false);
      await load();
    } catch (err) {
      setError(err.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const regenerate = (id) => {
    setConfirmAction({ type: 'regenerate', id });
  };

  const executeRegenerate = async () => {
    setActionLoading(true);
    try {
      const r = await window.ElvishMailManifest.regenerateSMTPCredential(confirmAction.id);
      setShowCredentials({ username: r.username, password: r.password, isNew: false });
      setConfirmAction(null);
      await load();
    } catch (err) {
      setError(err.message || 'Regenerate failed');
    } finally {
      setActionLoading(false);
    }
  };

  const remove = (id) => {
    setConfirmAction({ type: 'delete', id });
  };

  const executeRemove = async () => {
    setActionLoading(true);
    try {
      await window.ElvishMailManifest.deleteSMTPCredential(confirmAction.id);
      setConfirmAction(null);
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  };

  const resolveCredentialSendAs = (c) => {
    if (c.identityEmail) return c.identityEmail;
    return identityEmailByFp.get(c.identityFingerprint) || '';
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>SMTP submission</h2>
        <p>Connect Apple Mail, Thunderbird, Outlook, or any client that supports authenticated SMTP.</p>
      </div>

      {!paid ? (
        <Alert type="info" title="Paid feature">
          SMTP submission requires paid API access (operator env <code className="mono">ELVISH_PAID_FEATURES</code>).
        </Alert>
      ) : null}

      {error && <Alert type="error">{error}</Alert>}

      <Card
        title="Mail client setup"
        description="Each credential is a generated login. Submission is always bound to one sending identity so outbound mail uses the correct From address and key material."
        actions={
          <Button variant="primary" size="sm" onClick={openCreateModal} disabled={!paid}>
            {SettingsIcons.plus} Create credential
          </Button>
        }
      >
        <div className="settings-smtp-conn">
          <div className="settings-smtp-conn-block">
            <div className="settings-smtp-conn-label">Submission host</div>
            <div className="settings-domain-copy-value">
              <code>{smtpHost || 'your-mail-host'}</code>
              <Button variant="secondary" size="sm" type="button" title="Copy hostname" onClick={() => copyText(smtpHost)}>
                {SettingsIcons.copy} Copy
              </Button>
            </div>
          </div>
          <div className="settings-smtp-conn-block">
            <div className="settings-smtp-conn-label">Ports &amp; encryption</div>
            <ul className="settings-smtp-port-list">
              <li><code>587</code> — STARTTLS (recommended for most clients)</li>
              <li><code>465</code> — implicit TLS (SSL/TLS)</li>
            </ul>
          </div>
          <p className="settings-smtp-hint">
            Use normal password (PLAIN/LOGIN) after STARTTLS on 587, or SSL on 465. Your client encrypts the tunnel; message bodies follow your identity&apos;s OpenPGP settings for storage and delivery.
          </p>
        </div>

        {loading ? (
          <div className="settings-loading">Loading credentials…</div>
        ) : credentials.length === 0 ? (
          <EmptyState
            icon="smtp"
            title="No SMTP credentials yet"
            description={paid ? 'Create a credential, then paste the generated username and password into your mail app.' : 'Paid tier required.'}
          />
        ) : (
          <div className="settings-credentials-list">
            {credentials.map((c) => {
              const sendAs = resolveCredentialSendAs(c);
              return (
                <div key={c.id} className="settings-credential-item">
                  <div className="settings-credential-info">
                    <div className="settings-credential-title">{c.name}</div>
                    {sendAs ? (
                      <div className="settings-credential-sendas">
                        Sends as <strong>{sendAs}</strong>
                      </div>
                    ) : (
                      <div className="settings-credential-sendas dim">
                        Identity <span className="mono" title={c.identityFingerprint}>{c.identityFingerprint}</span> (add or restore this address under Identities)
                      </div>
                    )}
                    <div className="settings-domain-copy-value settings-credential-user-row">
                      <code>{c.username}</code>
                      <Button variant="secondary" size="sm" type="button" title="Copy username" onClick={() => copyText(c.username)}>
                        {SettingsIcons.copy}
                      </Button>
                    </div>
                  </div>
                  <div className="settings-credential-actions">
                    <Button variant="secondary" size="sm" onClick={() => regenerate(c.id)}>{SettingsIcons.refresh} Regenerate</Button>
                    <Button variant="danger" size="sm" onClick={() => remove(c.id)} title="Delete credential">{SettingsIcons.trash}</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={showCreateModal} onClose={() => !busy && setShowCreateModal(false)} title="Create SMTP credential">
        {!paid ? (
          <Alert type="warning">Paid subscription required.</Alert>
        ) : (
          <form onSubmit={createCred}>
            <Alert type="info">
              Pick which address this app will send as. You can create separate credentials per device; each can use a different identity if you need that.
            </Alert>
            <Input
              label="Label"
              value={credName}
              onChange={(e) => setCredName(e.target.value)}
              placeholder="e.g. MacBook Thunderbird"
              helperText="Shown only in settings — your mail app never sees this."
            />
            <div className="settings-input-group">
              <label className="settings-label" htmlFor="smtp-create-identity">Sending identity</label>
              <select
                id="smtp-create-identity"
                className="settings-select"
                value={credFp}
                onChange={(e) => setCredFp(e.target.value)}
                required
              >
                {sendingIdentities.length === 0 ? (
                  <option value="">No active identities</option>
                ) : (
                  sendingIdentities.map((i) => (
                    <option key={i.fingerprint} value={i.fingerprint}>
                      {i.email}{i.isDefault ? ' — default' : ''}
                    </option>
                  ))
                )}
              </select>
              <div className="settings-helper">
                {sendingIdentities.length === 0 && onGoToIdentities ? (
                  <span>
                    Create an address under{' '}
                    <button type="button" className="settings-inline-link" onClick={() => { setShowCreateModal(false); onGoToIdentities(); }}>
                      Identities
                    </button>
                    , then return here.
                  </span>
                ) : (
                  'Outbound mail uses this identity’s From address and signing key.'
                )}
              </div>
            </div>
            <div className="settings-modal-actions">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)} disabled={busy}>Cancel</Button>
              <Button
                variant="primary"
                type="submit"
                loading={busy}
                disabled={!credName.trim() || !credFp.trim() || sendingIdentities.length === 0}
              >
                Create
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={confirmAction?.type === 'regenerate'}
        onClose={() => !actionLoading && setConfirmAction(null)}
        onConfirm={executeRegenerate}
        title="Regenerate password"
        message="The current SMTP password stops working immediately. Update every device that uses this credential."
        confirmLabel="Regenerate"
        confirmVariant="primary"
        loading={actionLoading}
      />

      <ConfirmModal
        open={confirmAction?.type === 'delete'}
        onClose={() => !actionLoading && setConfirmAction(null)}
        onConfirm={executeRemove}
        title="Delete SMTP credential"
        message="Mail apps using this username/password will stop sending. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={actionLoading}
      />

      <Modal open={!!showCredentials} onClose={() => setShowCredentials(null)} title={showCredentials?.isNew ? 'Credential created' : 'New password'}>
        <Alert type="warning" title="Save these values now">
          The password is shown only once. Store it in a password manager or your client&apos;s saved passwords.
        </Alert>
        <div className="settings-smtp-reveal-fields">
          <Input label="Username" value={showCredentials?.username || ''} disabled />
          <div className="settings-domain-copy-value">
            <Button variant="secondary" size="sm" type="button" onClick={() => copyText(showCredentials?.username || '')}>
              {SettingsIcons.copy} Copy username
            </Button>
          </div>
          <Input label="Password" value={showCredentials?.password || ''} disabled />
          <div className="settings-domain-copy-value">
            <Button variant="secondary" size="sm" type="button" onClick={() => copyText(showCredentials?.password || '')}>
              {SettingsIcons.copy} Copy password
            </Button>
          </div>
        </div>
        <div className="settings-modal-actions">
          <Button variant="primary" onClick={() => setShowCredentials(null)}>Done</Button>
        </div>
      </Modal>
    </div>
  );
}

// --- Mail & privacy (settings + retention) ---
function PrivacyConsentSection() {
  const [mailOpt, setMailOpt] = useState({
    auto_encrypt_inbound: true,
    wkd_publish: true,
    attach_public_key_default: false,
    keyvault_idle_min: 15,
    retention_setup_completed: false,
  });
  const [retentionDays, setRetentionDays] = useState({ ...DEFAULT_RETENTION_DAYS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadConsent = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await window.ElvishMailManifest.getMailSettings();
      const st = s.settings || {};
      const retention = s.retention_days || {};
      setMailOpt({
        auto_encrypt_inbound: st.auto_encrypt_inbound !== false,
        wkd_publish: st.wkd_publish !== false,
        attach_public_key_default: !!st.attach_public_key_default,
        keyvault_idle_min: typeof st.keyvault_idle_min === 'number' && st.keyvault_idle_min > 0 ? st.keyvault_idle_min : 15,
        retention_setup_completed: !!st.retention_setup_completed,
      });
      setRetentionDays({
        inbox: typeof retention.inbox === 'number' && retention.inbox > 0 ? retention.inbox : null,
        sent: typeof retention.sent === 'number' && retention.sent > 0 ? retention.sent : null,
        trash: typeof retention.trash === 'number' && retention.trash > 0 ? retention.trash : null,
        archive: typeof retention.archive === 'number' && retention.archive > 0 ? retention.archive : null,
      });
    } catch (e) {
      setError(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConsent(); }, [loadConsent]);

  const saveMailBehaviour = async (patch) => {
    const next = { ...mailOpt, ...patch };
    setMailOpt(next);
    try {
      await window.ElvishMailManifest.setMailSettings({
        auto_encrypt_inbound: next.auto_encrypt_inbound,
        wkd_publish: next.wkd_publish,
        attach_public_key_default: !!next.attach_public_key_default,
        keyvault_idle_min: next.keyvault_idle_min,
        retention_setup_completed: !!next.retention_setup_completed,
      });
    } catch (e) {
      setError(e.message || 'Failed to save mail settings');
      await loadConsent();
    }
  };

  const saveRetention = async (nextRetention) => {
    setRetentionDays(nextRetention);
    try {
      await window.ElvishMailManifest.setMailSettings({
        retention_days: nextRetention,
        retention_setup_completed: true,
      });
      setMailOpt((prev) => ({ ...prev, retention_setup_completed: true }));
    } catch (e) {
      setError(e.message || 'Failed to save retention policy');
      await loadConsent();
    }
  };

  const setFolderRetention = (folder, enabled, fallbackDays) => {
    const next = { ...retentionDays };
    next[folder] = enabled ? (next[folder] || fallbackDays || 30) : null;
    saveRetention(next);
  };

  const updateFolderRetentionDays = (folder, value) => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) return;
    saveRetention({ ...retentionDays, [folder]: n });
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Mail & privacy</h2>
        <p>Mail behaviour, retention, keys, and account-related preferences</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <Card title="Mail behaviour" description="Inbound encryption, key directory, and compose defaults.">
        {loading ? (
          <div className="settings-loading">Loading...</div>
        ) : (
          <div className="settings-consent-grid">
            <div className="settings-consent-row">
              <label className="settings-consent-toggle">
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  readOnly
                />
                <span className="settings-consent-label">Inbound SMTP encryption</span>
              </label>
              <span className="settings-consent-help">Plaintext inbound SMTP is gateway-encrypted to your keys automatically before it is stored.</span>
            </div>
            <div className="settings-consent-row">
              <label className="settings-consent-toggle">
                <input
                  type="checkbox"
                  checked={!!mailOpt.wkd_publish}
                  onChange={(e) => saveMailBehaviour({ wkd_publish: e.target.checked })}
                />
                <span className="settings-consent-label">WKD publish</span>
              </label>
              <span className="settings-consent-help">Publish public keys for Web Key Directory discovery.</span>
            </div>
            <div className="settings-consent-row">
              <label className="settings-consent-toggle">
                <input
                  type="checkbox"
                  checked={!!mailOpt.attach_public_key_default}
                  onChange={(e) => saveMailBehaviour({ attach_public_key_default: e.target.checked })}
                />
                <span className="settings-consent-label">Attach my public key (OpenPGP sends)</span>
              </label>
              <span className="settings-consent-help">
                When enabled, new compose sessions default to attaching your identity public key as <code>public-…asc</code> on OpenPGP-direct sends. You can still turn it off per message.
              </span>
            </div>
            <div className="settings-consent-row">
              <label className="settings-consent-label">Key vault idle timeout (minutes)</label>
              <input
                type="number"
                min={1}
                max={1440}
                className="settings-input"
                style={{ maxWidth: 120 }}
                value={mailOpt.keyvault_idle_min}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!Number.isFinite(n) || n < 1) return;
                  saveMailBehaviour({ keyvault_idle_min: n });
                }}
              />
            </div>
          </div>
        )}
      </Card>

      <Card title="Message retention" description="Automatically delete mail after a chosen number of days for each folder.">
        {loading ? (
          <div className="settings-loading">Loading...</div>
        ) : (
          <>
            <Alert type="info">
              Secure defaults: Inbox off, Archive off, Sent 30 days, Trash 30 days.
              Changes here update future retention sweeps for this account.
            </Alert>
            <div className="settings-consent-grid">
              {[
                { id: 'inbox', label: 'Inbox', help: 'Disabled by default. Enable if you want inbox mail to expire automatically.', fallbackDays: 30 },
                { id: 'sent', label: 'Sent', help: 'Defaults to 30 days so app-authored mail is not retained forever.', fallbackDays: 30 },
                { id: 'trash', label: 'Trash', help: 'Defaults to 30 days before permanent deletion.', fallbackDays: 30 },
                { id: 'archive', label: 'Archive', help: 'Disabled by default so archived mail is retained until you choose otherwise.', fallbackDays: 30 },
              ].map((item) => {
                const enabled = typeof retentionDays[item.id] === 'number' && retentionDays[item.id] > 0;
                return (
                  <div key={item.id} className="settings-consent-row">
                    <label className="settings-consent-toggle">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setFolderRetention(item.id, e.target.checked, item.fallbackDays)}
                      />
                      <span className="settings-consent-label">{item.label}</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span className="settings-consent-help">{item.help}</span>
                      <input
                        type="number"
                        min={1}
                        max={3650}
                        className="settings-input"
                        style={{ maxWidth: 120 }}
                        value={enabled ? retentionDays[item.id] : ''}
                        disabled={!enabled}
                        placeholder="days"
                        onChange={(e) => updateFolderRetentionDays(item.id, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Card title="Trusted contacts" description="Per-user OpenPGP keys used for trusted signature badges and compose. WKD/HKPS hits are not trusted until you save a key here or tap Trust on a message.">
        <ContactsManager />
      </Card>

      {/* Recipient Lookup (from original) */}
      <Card title="Recipient Key Lookup" description="Test the keyserver chain for an email address.">
        <RecipientLookup />
      </Card>
    </div>
  );
}

function ContactsManager() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addArmored, setAddArmored] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  const load = useCallback(async () => {
    if (!window.ElvishMailManifest || typeof window.ElvishMailManifest.listContactKeys !== 'function') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const r = await window.ElvishMailManifest.listContactKeys();
      setRows(Array.isArray(r.contacts) ? r.contacts : []);
    } catch (e) {
      setErr((e && e.message) || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (email, fingerprint) => {
    if (!window.ElvishMailManifest || typeof window.ElvishMailManifest.deleteContactKey !== 'function') return;
    try {
      await window.ElvishMailManifest.deleteContactKey(email, fingerprint);
      await load();
    } catch (e) {
      setErr((e && e.message) || String(e));
    }
  };

  const onAdd = async () => {
    const em = addEmail.trim().toLowerCase();
    const arm = addArmored.trim();
    if (!em || !arm) return;
    setAddBusy(true);
    setErr('');
    try {
      await window.ElvishMailManifest.putContactKey({
        email: em,
        armoredPublic: arm,
        source: 'settings',
        trusted: true,
      });
      setAddEmail('');
      setAddArmored('');
      await load();
    } catch (e) {
      setErr((e && e.message) || String(e));
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div>
      <Alert type="info">
        Only keys stored here (or via <strong>Trust sender key</strong> on a message) count as trusted for the green signer badge.
      </Alert>
      {err ? <Alert type="error">{err}</Alert> : null}
      {loading ? (
        <div className="settings-loading">Loading...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="settings-table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Fingerprint (suffix)</th>
                <th>Trusted</th>
                <th>Source</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="dim">
                    No saved contacts.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={`${c.email}-${c.fingerprint}`}>
                    <td>
                      <code>{c.email}</code>
                    </td>
                    <td className="mono dim" title={c.fingerprint}>
                      {(c.fingerprint || '').slice(-16).toUpperCase()}
                    </td>
                    <td>{c.trusted ? <Badge variant="success">yes</Badge> : <Badge variant="muted">no</Badge>}</td>
                    <td className="dim" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.source || ''}>
                      {c.source || '—'}
                    </td>
                    <td>
                      <Button variant="danger" size="sm" onClick={() => onDelete(c.email, c.fingerprint)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="dim" style={{ margin: 0, fontSize: 13 }}>
          Add a contact by pasting their armored public key. It is stored as trusted immediately.
        </p>
        <Input label="Email" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="peer@example.com" />
        <label className="settings-field">
          <span className="settings-field-label">Armored public key</span>
          <textarea
            className="settings-input"
            rows={6}
            value={addArmored}
            onChange={(e) => setAddArmored(e.target.value)}
            placeholder={'-----BEGIN PGP PUBLIC KEY BLOCK-----\n...\n-----END PGP PUBLIC KEY BLOCK-----'}
            style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
          />
        </label>
        <Button variant="primary" onClick={onAdd} disabled={addBusy || !addEmail.trim() || !addArmored.trim()} loading={addBusy}>
          Save as trusted
        </Button>
      </div>
    </div>
  );
}

function RecipientLookup() {
  const [email, setEmail] = useState('');
  const [hit, setHit] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const onLookup = async () => {
    if (!email) return;
    setBusy(true);
    setErr('');
    setHit(null);
    try {
      const r = await window.ElvishMailManifest.lookupKey(email.trim().toLowerCase());
      if (!r) setErr('Not found in any source');
      else setHit(r);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-lookup">
      <div className="settings-lookup-form">
        <Input
          type="email"
          placeholder="alice@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button variant="secondary" onClick={onLookup} disabled={busy || !email} loading={busy}>
          Lookup
        </Button>
      </div>
      {err && <Alert type="error">{err}</Alert>}
      {hit && (
        <div className="settings-lookup-result">
          <div className="settings-lookup-row">
            <strong>Source:</strong>
            <Badge variant={hit.source === 'local' ? 'success' : 'default'}>{hit.source}</Badge>
          </div>
          <div className="settings-lookup-row">
            <strong>Fingerprint:</strong>
            <code>{hit.fingerprint}</code>
          </div>
          <div className="settings-lookup-row">
            <strong>UID Match:</strong>
            <span>{hit.verified_uid_match ? 'Yes' : 'No'}</span>
          </div>
          <details className="settings-lookup-details">
            <summary>Armored public key</summary>
            <pre>{hit.armored}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

// --- Support Section ---
function SupportSection() {
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Support</h2>
        <p>Get help with your account</p>
      </div>

      <div className="settings-support-grid">
        <Card title="Contact Support" className="settings-support-card">
          <p>Need help? Reach out to our support team.</p>
          <a href="mailto:support@elvish.email" className="settings-support-link">
            {SettingsIcons.identities} support@elvish.email
          </a>
        </Card>

        <Card title="Documentation" className="settings-support-card">
          <p>Browse our documentation and guides.</p>
          <a href="/docs" className="settings-support-link">
            {SettingsIcons.info} Documentation
          </a>
        </Card>
      </div>
    </div>
  );
}

// --- Danger Zone Section ---
function DangerZoneSection() {
  const [policy, setPolicy] = useState({ enabled: false, value: 30, unit: 'days' });
  const [status, setStatus] = useState({ last_activity_day: '', scheduled_delete_at: '', scheduled_delete_reason: '' });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState('now');
  const [delPwd, setDelPwd] = useState('');
  const [delConfirm, setDelConfirm] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');

  const applyDeletePolicy = useCallback((payload) => {
    const nextPolicy = payload && payload.policy ? payload.policy : {};
    setPolicy({
      enabled: !!nextPolicy.enabled,
      value: nextPolicy.value > 0 ? nextPolicy.value : 30,
      unit: nextPolicy.unit || 'days',
    });
    setStatus({
      last_activity_day: payload && payload.last_activity_day ? payload.last_activity_day : '',
      scheduled_delete_at: payload && payload.scheduled_delete_at ? payload.scheduled_delete_at : '',
      scheduled_delete_reason: payload && payload.scheduled_delete_reason ? payload.scheduled_delete_reason : '',
    });
  }, []);

  const loadDeletePolicy = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError('');
    try {
      const result = await window.ElvishMailManifest.getDeletePolicy();
      applyDeletePolicy(result);
    } catch (err) {
      setStatusError(err.message || 'Could not load account deletion settings');
    } finally {
      setLoadingStatus(false);
    }
  }, [applyDeletePolicy]);

  useEffect(() => {
    loadDeletePolicy();
  }, [loadDeletePolicy]);

  const formatDateTime = (value) => {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const formatDay = (value) => {
    if (!value) return 'Not available';
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const openDeleteModal = (mode) => {
    setDeleteMode(mode);
    setDelPwd('');
    setDelConfirm('');
    setDelErr('');
    setShowDeleteModal(true);
  };

  const submitDelete = async (e) => {
    e.preventDefault();
    setDelErr('');
    if (delConfirm !== 'DELETE') {
      setDelErr('Confirmation must be exactly DELETE');
      return;
    }
    setActionBusy(true);
    try {
      const action = deleteMode === 'schedule'
        ? () => window.ElvishMailManifest.scheduleAccountDeletion(delPwd, delConfirm)
        : () => window.ElvishMailManifest.deleteAccount(delPwd, delConfirm);
      await runWithFreshTwoFactor(action);
      if (deleteMode === 'now') {
        window.location.href = '/';
        return;
      }
      setShowDeleteModal(false);
      await loadDeletePolicy();
    } catch (err) {
      setDelErr(err.message || 'Could not update account deletion');
    } finally {
      setActionBusy(false);
    }
  };

  const savePolicy = async () => {
    setStatusError('');
    if (policy.enabled && (!Number.isFinite(policy.value) || policy.value <= 0)) {
      setStatusError('Choose a valid inactivity value greater than zero');
      return;
    }
    setPolicyBusy(true);
    try {
      const result = await window.ElvishMailManifest.setDeletePolicy({
        enabled: !!policy.enabled,
        value: policy.enabled ? Number(policy.value) : 0,
        unit: policy.enabled ? policy.unit : '',
      });
      applyDeletePolicy(result);
    } catch (err) {
      setStatusError(err.message || 'Could not save inactivity delete policy');
    } finally {
      setPolicyBusy(false);
    }
  };

  const cancelScheduledDeletion = async () => {
    setStatusError('');
    setCancelBusy(true);
    try {
      await window.ElvishMailManifest.cancelAccountDeletion();
      await loadDeletePolicy();
    } catch (err) {
      setStatusError(err.message || 'Could not cancel scheduled deletion');
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header danger">
        <h2>{SettingsIcons.danger} Danger Zone</h2>
        <p>Irreversible actions that affect your account</p>
      </div>

      {statusError && <Alert type="error">{statusError}</Alert>}

      {loadingStatus ? <div className="settings-loading">Loading...</div> : null}

      {status.scheduled_delete_at ? (
        <Alert type="warning" title="Account deletion is scheduled">
          Your account is set to be deleted on <strong>{formatDateTime(status.scheduled_delete_at)}</strong>.
          You can cancel it before that deadline.
        </Alert>
      ) : null}

      <Card className="settings-card-danger">
        <div className="settings-danger-item">
          <div className="settings-danger-info">
            <strong>Delete Account</strong>
            <p>
              Delete all data tied to this account. Deleted addresses stay unavailable for 2 years so
              nobody can immediately reclaim them after account removal.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button variant="danger" onClick={() => openDeleteModal('now')}>
              {SettingsIcons.trash} Delete Now
            </Button>
            <Button variant="secondary" onClick={() => openDeleteModal('schedule')}>
              Schedule 7-Day Delete
            </Button>
            {status.scheduled_delete_at ? (
              <Button variant="secondary" onClick={cancelScheduledDeletion} loading={cancelBusy}>
                Cancel Scheduled Delete
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card title="Auto-Delete After Inactivity" className="settings-card-danger">
        <div className="settings-consent-grid">
          <div className="settings-consent-row">
            <label className="settings-consent-toggle">
              <input
                type="checkbox"
                checked={!!policy.enabled}
                onChange={(e) => setPolicy(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              <span className="settings-consent-label">Delete this account after inactivity</span>
            </label>
            <span className="settings-consent-help">Any authenticated use of the app resets the inactivity timer. We only keep the last online day for this policy.</span>
          </div>

          <div className="settings-consent-row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label className="settings-consent-label">Delete after</label>
            <input
              type="number"
              min={1}
              className="settings-input"
              style={{ maxWidth: 120 }}
              disabled={!policy.enabled}
              value={policy.value}
              onChange={(e) => setPolicy(prev => ({ ...prev, value: parseInt(e.target.value || '0', 10) || 0 }))}
            />
            <select
              className="settings-input"
              style={{ maxWidth: 160 }}
              disabled={!policy.enabled}
              value={policy.unit}
              onChange={(e) => setPolicy(prev => ({ ...prev, unit: e.target.value }))}
            >
              <option value="days">days</option>
              <option value="weeks">weeks</option>
              <option value="months">months</option>
            </select>
            <Button variant="secondary" onClick={savePolicy} loading={policyBusy}>
              Save Auto-Delete Policy
            </Button>
          </div>

          <div className="settings-consent-row">
            <span className="settings-consent-label">Most recent activity day</span>
            <span className="settings-consent-help">{formatDay(status.last_activity_day)}</span>
          </div>
        </div>
      </Card>

      <Modal
        open={showDeleteModal}
        onClose={() => !actionBusy && setShowDeleteModal(false)}
        title={deleteMode === 'schedule' ? 'Schedule Account Deletion' : 'Delete Account'}
      >
        <Alert type="error" title="Warning: This action is irreversible">
          {deleteMode === 'schedule' ? 'When the 7-day window expires, Elvish will permanently erase:' : 'Deleting your account will permanently erase:'}
          <ul>
            <li>All your emails and attachments</li>
            <li>All your GPG keys (messages become unreadable)</li>
            <li>All your identities and custom domains</li>
            <li>Your filters and folder configurations</li>
            <li>Your login and account metadata, while keeping non-reversible address reservations for 2 years</li>
          </ul>
        </Alert>
        <form onSubmit={submitDelete}>
          {delErr && <Alert type="error">{delErr}</Alert>}
          <Input type="password" label="Account password" value={delPwd} onChange={(e) => setDelPwd(e.target.value)} placeholder="Current password" />
          <Input label='Type DELETE to confirm' value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder="DELETE" />
          <div className="settings-modal-actions">
            <Button variant="secondary" type="button" onClick={() => setShowDeleteModal(false)} disabled={actionBusy}>Cancel</Button>
            <Button variant="danger" type="submit" loading={actionBusy} disabled={delConfirm !== 'DELETE' || !delPwd}>
              {deleteMode === 'schedule' ? 'Schedule delete in 7 days' : 'Delete forever'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ============ Main Settings Panel ============
function MailSettingsPanel({ user }) {
  const [activeSection, setActiveSection] = useState('account');

  const navSections = useMemo(
    () =>
      SETTINGS_SECTIONS.map((s) => ({
        ...s,
        testId: `mail-settings-nav-${s.id}`,
      })),
    []
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'account': return <AccountSection user={user} />;
      case 'security': return <SecuritySection />;
      case 'identities': return <IdentitiesSection user={user} />;
      case 'folders': return <FoldersSection />;
      case 'filters': return <FiltersSection />;
      case 'domains': return <CustomDomainsSection />;
      case 'keys': return <GPGKeysSection />;
      case 'smtp': return <SMTPSubmissionSection onGoToIdentities={() => setActiveSection('identities')} />;
      case 'consent': return <PrivacyConsentSection />;
      case 'support': return <SupportSection />;
      case 'danger': return <DangerZoneSection />;
      default: return <AccountSection user={user} />;
    }
  };

  return (
    <div className="mail-settings-panel">
      <UserSettingsLayout
        title="Settings"
        sections={navSections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        wideLayout
        searchPlaceholder="Search settings…"
        searchInputAriaLabel="Search mail settings sections"
        navAriaLabel="Mail settings sections"
        emptySearchTitle="No matching settings"
        emptySearchDescription="Try a different keyword or clear the search to see all sections."
      >
        {renderSection()}
      </UserSettingsLayout>
    </div>
  );
}

window.ElvishMailSettings = MailSettingsPanel;