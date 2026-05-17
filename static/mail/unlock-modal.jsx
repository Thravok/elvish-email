// ELVISH MAIL — unlock modal.
//
// Shown whenever ElvishKeyVault is locked while the user is on /mail. The
// password derives the KEK that unwraps the account secret; identities are
// then unwrapped from PGP ciphertext to the account public key. Password and
// derived key never leave the browser.
//
// We deliberately do NOT round-trip through /login: re-deriving in place keeps
// the existing session, so the user can stay on /mail and not lose composition
// state.
//
// Auto-bootstrap: if the account has no wrapped account key on the server (e.g.
// the user logged in but never completed key bootstrap), we generate the full
// Skiff hierarchy in-place from the same password. If the account key exists
// but no identities do, we mint a default identity for the user's primary
// email. Both paths are best-effort and idempotent.

import * as React from "react";

(function () {
  const { useState, useEffect, useCallback, useRef } = React;

  function ElvishMailUnlockModal({ open, onUnlocked, onClose, idleLockout }) {
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [step, setStep] = useState("");
    const [needsBootstrap, setNeedsBootstrap] = useState(false);
    const [activeStage, setActiveStage] = useState("idle");
    const inputRef = useRef(null);

    const stages = [
      {
        id: "session",
        label: "Check your signed-in session",
        help: "Confirm which account this browser should open.",
      },
      {
        id: "secure",
        label: needsBootstrap ? "Generate keys on this device" : "Fetch your encrypted account key",
        help: needsBootstrap
          ? "Your browser creates and uploads wrapped key material one time."
          : "Only the wrapped key blob is fetched from the server.",
      },
      {
        id: "open",
        label: "Unlock your mailbox",
        help: "Your password unwraps keys locally so mail can open.",
      },
    ];

    function stageState(stageId) {
      if (activeStage === "idle") return "pending";
      if (activeStage === "done") return "complete";
      const order = ["session", "secure", "open"];
      const current = order.indexOf(activeStage);
      const target = order.indexOf(stageId);
      if (current === -1 || target === -1) return "pending";
      if (target < current) return "complete";
      if (target === current) return "active";
      return "pending";
    }

    useEffect(() => {
      if (open && inputRef.current) {
        inputRef.current.focus();
      }
      if (!open) {
        setPassword("");
        setShowPassword(false);
        setErr("");
        setStep("");
        setNeedsBootstrap(false);
        setActiveStage("idle");
      }
    }, [open]);

    // Probe on open so the prompt copy can warn the user that they're about to
    // generate fresh keys (which requires the password they want to lock the
    // KEK with).
    useEffect(() => {
      if (!open) return;
      let cancelled = false;
      (async () => {
        try {
          const r = await fetch("/api/v1/account-key/me", { credentials: "include" });
          if (!r.ok) return;
          const j = await r.json();
          if (!cancelled) setNeedsBootstrap(!j.bootstrapped);
        } catch (_) { /* ignore; main flow surfaces the real error */ }
      })();
      return () => { cancelled = true; };
    }, [open]);

    const submit = useCallback(async (e) => {
      if (e) e.preventDefault();
      if (busy) return;
      setErr("");
      setBusy(true);
      try {
        if (!window.ElvishKeygen || !window.ElvishKeyVault) {
          throw new Error("crypto subsystem not loaded");
        }
        if (password.length < 10) {
          throw new Error("password must be at least 10 characters");
        }
        setActiveStage("session");
        setStep("Checking your signed-in session…");
        const meAuthRes = await fetch("/api/auth/me", { credentials: "include" });
        if (!meAuthRes.ok) throw new Error("not logged in (refresh and try again)");
        const meAuth = await meAuthRes.json();
        const userEmail = meAuth && meAuth.user && meAuth.user.email;
        if (!userEmail) throw new Error("session has no user email");

        setActiveStage("secure");
        setStep(needsBootstrap ? "Generating account keys for this device…" : "Fetching your encrypted account key…");
        const meRes = await fetch("/api/v1/account-key/me", { credentials: "include" });
        if (!meRes.ok) throw new Error("account key fetch failed (" + meRes.status + ")");
        let me = await meRes.json();

        if (!me.bootstrapped) {
          setStep("No keys yet — generating account + identity in your browser…");
          await bootstrapNew(userEmail, password);
          const refetch = await fetch("/api/v1/account-key/me", { credentials: "include" });
          if (!refetch.ok) throw new Error("account key re-fetch failed (" + refetch.status + ")");
          me = await refetch.json();
          if (!me.bootstrapped) throw new Error("bootstrap upload did not persist");
        }

        setActiveStage("open");
        setStep("Unlocking your mailbox…");
        await window.ElvishKeyVault.unlockAccount(me, password, { sessionEmail: userEmail });

        setStep("Checking your sender identities…");
        let idRes = await fetch("/api/v1/identities", { credentials: "include" });
        if (!idRes.ok) throw new Error("identities fetch failed (" + idRes.status + ")");
        let idJson = await idRes.json();
        let list = Array.isArray(idJson.identities) ? idJson.identities : [];

        if (list.length === 0) {
          setStep("Creating a default sender identity for " + userEmail + "…");
          await mintIdentity(userEmail, me.armored_public);
          idRes = await fetch("/api/v1/identities", { credentials: "include" });
          if (idRes.ok) {
            idJson = await idRes.json();
            list = Array.isArray(idJson.identities) ? idJson.identities : [];
          }
        }

        setActiveStage("done");
        setStep("Mailbox ready.");
        if (onUnlocked) onUnlocked();
      } catch (e) {
        setErr((e && e.message) ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, [password, busy, needsBootstrap, onUnlocked]);

    // bootstrapNew generates the full Skiff hierarchy (account key + first
    // identity) in the browser and uploads opaque ciphertext + KDF params.
    async function bootstrapNew(email, password) {
      const keys = await window.ElvishKeygen.bootstrap(email, password);
      const identityWrappedB64 = window.ElvishKeygen.bytesToB64(
        new TextEncoder().encode(keys.identity.wrapped_secret_armored)
      );
      const r = await fetch("/api/v1/account-key/bootstrap", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          armored_public: keys.account.armored_public,
          wrapped_secret_b64: keys.account.wrapped_secret_b64,
          kdf: keys.account.kdf,
          kdf_salt_b64: keys.account.kdf_salt_b64,
          kdf_params_json: JSON.stringify(keys.account.kdf_params || {}),
          identities: [{
            email: keys.identity.email,
            armored_public: keys.identity.armored_public,
            primary_uid: keys.identity.email,
            wrapped_secret_b64: identityWrappedB64,
            is_default: true,
          }],
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error("bootstrap upload failed: " + (j.error || r.status));
      }
    }

    // mintIdentity generates one PGP identity for email and uploads it,
    // wrapped to the in-vault account public key. Requires the account
    // key to already be unlocked? No — wrapping uses the public key only,
    // which we read from the freshly-fetched account-key response.
    async function mintIdentity(email, accountArmoredPublic) {
      const idKp = await window.openpgp.generateKey({
        type: "ecc", curve: "curve25519",
        userIDs: [{ name: email, email }],
        format: "armored",
      });
      const wrappedArmored = await window.ElvishKeygen.pgpWrapToAccount(idKp.privateKey, accountArmoredPublic);
      const wrappedB64 = window.ElvishKeygen.bytesToB64(new TextEncoder().encode(wrappedArmored));
      const r = await fetch("/api/v1/identities", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          armored_public: idKp.publicKey,
          primary_uid: email,
          wrapped_secret_b64: wrappedB64,
          is_default: true,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error("identity mint failed: " + (j.error || r.status));
      }
    }

    if (!open) return null;
    return (
      <div className="mail-unlock-backdrop" role="dialog" aria-modal="true" aria-labelledby="mail-unlock-title">
        <div className="mail-unlock-modal">
          <div className="mail-unlock-head">
            <div className="mail-unlock-head-copy">
              <span className="kind">▸ {needsBootstrap ? "FIRST RUN" : "VAULT"}</span>
              <span className="title" id="mail-unlock-title">
                {needsBootstrap ? "Finish setting up your mailbox" : "Unlock your mailbox"}
              </span>
            </div>
            {idleLockout && (
              <span
                className="status"
                title="In-memory keys were cleared after a period without mail activity. Your HTTP session is unchanged; enter your password if local restore is unavailable."
              >
                idle timeout
                {typeof window.ElvishKeyVault?.getKeyVaultIdleMs === "function" && (
                  <span className="dim">
                    {" "}· {Math.max(1, Math.round(window.ElvishKeyVault.getKeyVaultIdleMs() / 60000))} min
                  </span>
                )}
              </span>
            )}
          </div>
          <form className="mail-unlock-body" onSubmit={submit}>
            <p className="mail-unlock-explainer">
              {needsBootstrap ? (
                <>
                  This account does not have mailbox keys on file yet. ELVISH will create
                  them in your browser, wrap them with your password, upload the wrapped
                  blobs, and then open mail without leaving this page.
                </>
              ) : (
                <>
                  Enter your account password to re-derive the KEK and unwrap your account key.
                  The password never leaves the browser, and unlocked keys stay on this device
                  until you explicitly lock or log out.
                </>
              )}
            </p>
            <div className="mail-unlock-note-grid">
              <div className="mail-unlock-note">
                <strong>Local only</strong>
                <span>Your password is used in-browser only. The server never sees it.</span>
              </div>
              <div className="mail-unlock-note">
                <strong>{needsBootstrap ? "One-time setup" : "This device"}</strong>
                <span>
                  {needsBootstrap
                    ? "A default sender identity is created the first time this mailbox is opened."
                    : (window.ElvishKeyVault && window.ElvishKeyVault.isTrustedDevice && window.ElvishKeyVault.isTrustedDevice()
                    ? "This browser was marked trusted at sign-in: keys stay in memory longer; lock or log out to clear them."
                    : "The unlocked account key stays cached locally until you lock or log out.")}
                </span>
              </div>
            </div>
            <div className="mail-unlock-progress" aria-label="Mailbox unlock progress">
              {stages.map((stage, index) => {
                const state = stageState(stage.id);
                return (
                  <div key={stage.id} className={"mail-unlock-progress-item " + state}>
                    <span className="mail-unlock-progress-marker" aria-hidden="true">
                      {state === "complete" ? "✓" : state === "active" ? "…" : index + 1}
                    </span>
                    <div className="mail-unlock-progress-copy">
                      <strong>{stage.label}</strong>
                      <span>{stage.help}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <label className="mail-unlock-field">
              <span className="label">{needsBootstrap ? "Account password" : "Unlock password"}</span>
              <div className="mail-unlock-input-row">
                <input
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  placeholder={needsBootstrap ? "Use the password you chose at sign-up" : "Enter your account password"}
                  autoComplete="current-password"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="mail-unlock-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={busy}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <span className="mail-unlock-help">
                {needsBootstrap
                  ? "Use the same password from registration so this device can wrap and unlock your new account key."
                  : "This password re-derives the key that opens your encrypted mailbox locally."}
              </span>
            </label>
            {step && !err && <div className="mail-unlock-step">▸ {step}</div>}
            {err && <div className="mail-unlock-err">! {err}</div>}
            <div className="mail-unlock-actions">
              <a className="mail-unlock-link" href="/login?next=%2Fmail" tabIndex={busy ? -1 : 0}>
                Use another account
              </a>
              <div className="mail-unlock-spacer" />
              {onClose && (
                <button type="button" className="btn-sm" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn-sm primary" disabled={busy || !password}>
                {busy ? <span className="mail-unlock-spinner" aria-hidden="true"></span> : null}
                {busy ? (needsBootstrap ? "Setting up…" : "Unlocking…") : needsBootstrap ? "▸ FINISH SETUP" : "▸ UNLOCK MAIL"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // useUnlockGuard polls the key vault on a 1s interval and surfaces an
  // {unlocked, vaultHydrated, modalOpen, idleLockout} reactive state for callers.
  function useUnlockGuard(enabled, accountEmail) {
    const [vaultHydrated, setVaultHydrated] = useState(!enabled);
    const [unlocked, setUnlocked] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [idleLockout, setIdleLockout] = useState(false);
    const prevUnlockedRef = useRef(false);

    useEffect(() => {
      if (!enabled) {
        setVaultHydrated(true);
        setUnlocked(false);
        setModalOpen(false);
        setIdleLockout(false);
        prevUnlockedRef.current = false;
        return;
      }
      setVaultHydrated(false);
      let cancelled = false;
      prevUnlockedRef.current = false;
      (async () => {
        try {
          if (window.ElvishKeyVault && window.ElvishKeyVault.tryRestoreAccountFromSession) {
            await window.ElvishKeyVault.tryRestoreAccountFromSession({ sessionEmail: accountEmail });
          }
        } catch (_) { /* ignore */ }
        if (cancelled) return;
        const isUnl = !!(window.ElvishKeyVault && window.ElvishKeyVault.isUnlocked && window.ElvishKeyVault.isUnlocked());
        prevUnlockedRef.current = isUnl;
        setUnlocked(isUnl);
        setModalOpen(!isUnl);
        setVaultHydrated(true);
      })();
      return () => { cancelled = true; };
    }, [enabled, accountEmail]);

    useEffect(() => {
      if (!enabled || !vaultHydrated) return;
      let cancelled = false;
      const tick = async () => {
        if (cancelled) return;
        let isUnl = !!(window.ElvishKeyVault && window.ElvishKeyVault.isUnlocked && window.ElvishKeyVault.isUnlocked());
        if (!isUnl && accountEmail && window.ElvishKeyVault && window.ElvishKeyVault.tryRestoreAccountFromSession) {
          try {
            await window.ElvishKeyVault.tryRestoreAccountFromSession({ sessionEmail: accountEmail });
          } catch (_) { /* ignore */ }
          isUnl = !!(window.ElvishKeyVault && window.ElvishKeyVault.isUnlocked && window.ElvishKeyVault.isUnlocked());
        }
        if (cancelled) return;
        const prev = prevUnlockedRef.current;
        if (prev && !isUnl) {
          setIdleLockout(true);
          setModalOpen(true);
        }
        if (!prev && isUnl) {
          setModalOpen(false);
          setIdleLockout(false);
        }
        prevUnlockedRef.current = isUnl;
        setUnlocked(isUnl);
      };
      const t = setInterval(() => { void tick(); }, 1000);
      void tick();
      return () => { cancelled = true; clearInterval(t); };
    }, [enabled, vaultHydrated, accountEmail]);

    useEffect(() => {
      if (!enabled || !vaultHydrated) return;
      if (!unlocked) setModalOpen(true);
    }, [enabled, vaultHydrated, unlocked]);

    return {
      unlocked,
      vaultHydrated,
      modalOpen,
      idleLockout,
      openModal: () => setModalOpen(true),
      closeModal: () => setModalOpen(false),
      onUnlocked: () => {
        setUnlocked(true);
        setModalOpen(false);
        setIdleLockout(false);
      },
    };
  }

  window.ElvishMailUnlockModal = ElvishMailUnlockModal;
  window.useElvishUnlockGuard = useUnlockGuard;
})();
