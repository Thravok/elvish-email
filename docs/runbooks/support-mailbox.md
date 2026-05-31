# Support mailbox and public contact configuration

This runbook covers **inbound mail** (who receives messages at your domain) and **public contact strings** (what addresses you show on the site). They are separate: the admin panel only edits `home.json` → `support` for display; SMTP delivery still requires identities and aliases in Cockroach.

## 1. Provision a support mailbox (inbound)

1. **Create a dedicated user** (recommended: not a personal account). Use `/register` or your normal provisioning flow with an address you control, e.g. `support@yourdomain.tld`.
2. **Bootstrap mail keys** for that user in `/mail` (account + identity keys in the browser, per ADR 0005).
3. **Expose public addresses** with rows in `mail_aliases` mapping each public address to that user’s identity fingerprint, or use the account’s primary `user_identity_keys.email`. Example pattern (adjust UUIDs and fingerprint):

   ```sql
   INSERT INTO mail_aliases (user_id, email, identity_fingerprint, is_default, is_active)
   VALUES (
     '00000000-0000-0000-0000-000000000001',
     'support@yourdomain.tld',
     'YOURIDENTITYFINGERPRINT40CHARSHEX',
     false,
     true
   );
   ```

4. **DNS**: point MX for `yourdomain.tld` to hosts where `ELVISH_SMTP_ADDR` listens; align `ELVISH_MAIL_DOMAIN` and any `mail_domains` verification you use (see root `README.md`).
5. **Verify**: from an external mailbox, send a test message to `support@yourdomain.tld` and confirm it appears in `/mail` for the support user after unlock.

Inbound plaintext from the Internet is **gateway-encrypted** to the recipient identity’s public key at ingest (`smtp_gateway_encrypted`); bodies are not stored in cleartext. The server may still see content briefly during processing—document this for reporters who need stronger guarantees (OpenPGP to your published key, or another channel).

## 2. Configure default + custom support emails (display)

In **Admin → Site / SEO**:

- Set **Default support email** for the primary `mailto:` target.
- Add **Custom contacts** (label + email) for security, abuse, billing, etc.

These values are saved into `site_config.home_json` (merged `home.json`). They drive:

- Footer **// SUPPORT** links (when at least one valid address is set),
- `/manifesto/` contact section,
- `/.well-known/security.txt` (`Contact:` lines).

They **do not** create SMTP routes. Every `@yourdomain.tld` address must still resolve via `IdentityForEmail` (primary identity, `mail_aliases`, or verified catch-all).

## 3. Staff access and triage

- Use the **ELVish Console** service (`elvishconsole`) for multi-staff support inbox access with key escrow (see [ADR 0018](../adr/0018-console-service-and-support-escrow.md) and [console-cutover.md](console-cutover.md)).
- Mail is **per `user_id`**. There is no shared mailbox delegation in the public mail API; Console escrow applies only to the configured support mailbox.
- **Outbound replies**: prefer OpenPGP direct (Mode A) when the customer has a key; use protected links (Mode B) for ad-hoc recipients. Avoid user-facing plaintext relay (ADR 0010) except narrow internal cases.
- **Logging**: never log message bodies, passwords, or session tokens. Use generic auth failure messages.

## 4. Security communications

- Be explicit: **TLS between MTAs** is not end-to-end over the whole path.
- Publish a **PGP key** for sensitive reports (WKD when the address lives on your managed domain).
- Keep `/.well-known/security.txt` accurate; it is generated from the same `support` block as the site.

## 5. Optional: HTTPS contact form (deferred)

A public contact form with captcha and rate limits feeding `IngestInternalPlaintext` is not shipped in this iteration; add it when you want an SMTP alternative for non-email clients.
