import { test, expect } from "@playwright/test";

async function loginToMail(page, username: string, password: string) {
  await page.goto("/login?next=%2Fmail");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /LOGIN/i }).click();
  await page.waitForURL("**/mail", { timeout: 15000 });
}

test.describe("mail UI", () => {
  test("shows login guidance when anonymous", async ({ page }) => {
    await page.goto("/mail");
    await expect(page.getByTestId("mail-root")).toBeVisible();
    await expect(page.getByTestId("mail-login-hint")).toBeVisible();
    await expect(page.getByTestId("mail-login-hint")).toContainText("Not logged in");
  });

  test("loads message list shell after login with next=/mail", async ({ page }) => {
    const username = process.env.E2E_ADMIN_USERNAME;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!username || !password, "set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD (see e2e/README.md)");

    await loginToMail(page, username!, password!);

    await expect(page.getByTestId("mail-root")).toBeVisible();
    await expect(page.getByTestId("mail-msg-list")).toBeVisible();
  });

  test("custom domains settings use guided setup modal", async ({ page }) => {
    const username = process.env.E2E_ADMIN_USERNAME;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!username || !password, "set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD (see e2e/README.md)");

    const createdAt = new Date().toISOString();
    const domains: Array<Record<string, unknown>> = [];

    await page.route("**/api/v1/billing/status", async (route) => {
      await route.fulfill({ json: { paid: true } });
    });

    await page.route("**/api/v1/identities", async (route) => {
      await route.fulfill({
        json: {
          identities: [
            {
              email: "owner@example.test",
              fingerprint: "ABCDEF0123456789",
              is_active: true,
              is_default: true,
            },
          ],
        },
      });
    });

    await page.route("**/api/v1/custom-domains**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname;

      if (req.method() === "GET" && path === "/api/v1/custom-domains") {
        await route.fulfill({ json: { domains } });
        return;
      }

      if (req.method() === "POST" && path === "/api/v1/custom-domains") {
        const body = JSON.parse(req.postData() || "{}");
        const domain = String(body.domain || "").trim().toLowerCase();
        domains.splice(0, domains.length, {
          domain,
          status: "pending",
          mx_verified: false,
          spf_verified: false,
          dkim_verified: false,
          dmarc_verified: false,
          verification_txt_host: `_elvish-verify.${domain}`,
          verification_txt_value: "elvish-domain-verify=test-token",
          dns_config: {
            verification_txt: {
              type: "TXT",
              host: `_elvish-verify.${domain}`,
              value: "elvish-domain-verify=test-token",
              ttl: "Auto",
            },
            mx: {
              type: "MX",
              host: domain,
              value: "mx.elvish.test",
              ttl: "Auto",
              extra: "Priority 10",
            },
            spf: {
              type: "TXT",
              host: domain,
              value: "v=spf1 mx -all",
              ttl: "Auto",
            },
            dkim: {
              type: "TXT",
              host: `mail._domainkey.${domain}`,
              value: "v=DKIM1; k=rsa; p=test",
              ttl: "Auto",
            },
            dmarc: {
              type: "TXT",
              host: `_dmarc.${domain}`,
              value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; adkim=s; aspf=s`,
              ttl: "Auto",
            },
          },
          catchall_identity_fp: "",
          created_at: createdAt,
        });
        await route.fulfill({
          status: 201,
          json: {
            domain,
            dns_config: {
              verification_txt: {
                type: "TXT",
                host: `_elvish-verify.${domain}`,
                value: "elvish-domain-verify=test-token",
                ttl: "Auto",
              },
              mx: {
                type: "MX",
                host: domain,
                value: "mx.elvish.test",
                ttl: "Auto",
                extra: "Priority 10",
              },
              spf: {
                type: "TXT",
                host: domain,
                value: "v=spf1 mx -all",
                ttl: "Auto",
              },
              dkim: {
                type: "TXT",
                host: `mail._domainkey.${domain}`,
                value: "v=DKIM1; k=rsa; p=test",
                ttl: "Auto",
              },
              dmarc: {
                type: "TXT",
                host: `_dmarc.${domain}`,
                value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; adkim=s; aspf=s`,
                ttl: "Auto",
              },
            },
          },
        });
        return;
      }

      if (req.method() === "POST" && path.endsWith("/verify")) {
        const domain = decodeURIComponent(path.split("/").slice(-2, -1)[0] || "");
        domains.splice(0, domains.length, {
          domain,
          status: "active",
          mx_verified: true,
          spf_verified: true,
          dkim_verified: true,
          dmarc_verified: true,
          verification_txt_host: `_elvish-verify.${domain}`,
          verification_txt_value: "elvish-domain-verify=test-token",
          dns_config: {
            verification_txt: {
              type: "TXT",
              host: `_elvish-verify.${domain}`,
              value: "elvish-domain-verify=test-token",
              ttl: "Auto",
            },
            mx: {
              type: "MX",
              host: domain,
              value: "mx.elvish.test",
              ttl: "Auto",
              extra: "Priority 10",
            },
            spf: {
              type: "TXT",
              host: domain,
              value: "v=spf1 mx -all",
              ttl: "Auto",
            },
            dkim: {
              type: "TXT",
              host: `mail._domainkey.${domain}`,
              value: "v=DKIM1; k=rsa; p=test",
              ttl: "Auto",
            },
            dmarc: {
              type: "TXT",
              host: `_dmarc.${domain}`,
              value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; adkim=s; aspf=s`,
              ttl: "Auto",
            },
          },
          catchall_identity_fp: "",
          created_at: createdAt,
        });
        await route.fulfill({
          json: {
            status: "active",
            ownership_verified: true,
            mx_verified: true,
            spf_verified: true,
            dkim_verified: true,
            dmarc_verified: true,
            ready: true,
            issues: [],
            checks: {
              ownership: { ok: true, values: ["elvish-domain-verify=test-token"] },
              mx: { ok: true, values: ["mx.elvish.test"] },
              spf: { ok: true, values: ["v=spf1 include:elvish.test -all"] },
              dkim: { ok: true, values: ["v=DKIM1; k=rsa; p=test"] },
              dmarc: { ok: true, values: ["v=DMARC1; p=none"] },
            },
          },
        });
        return;
      }

      if (req.method() === "PUT" && path.endsWith("/catchall")) {
        const body = JSON.parse(req.postData() || "{}");
        if (domains[0]) {
          domains[0].catchall_identity_fp = body.identity_fingerprint || "";
        }
        await route.fulfill({ json: { ok: true } });
        return;
      }

      await route.continue();
    });

    await loginToMail(page, username!, password!);

    await page.getByRole("button", { name: /^SETTINGS$/i }).click();
    await page.getByRole("button", { name: /Custom Domains/i }).click();
    await page.getByRole("button", { name: /^Add Domain$/i }).click();
    await page.getByLabel("Domain").fill("example.test");
    await page.getByRole("button", { name: /^Add$/i }).click();

    await expect(page.getByText("Domain Setup")).toBeVisible();
    await expect(page.getByText("_elvish-verify.example.test")).toBeVisible();
    await expect(page.getByText("Publish this exact TXT record at your DNS provider.")).toBeVisible();
    await expect(page.getByText("Mail DNS Records")).toBeVisible();
    await expect(page.getByText("mx.elvish.test")).toBeVisible();
    await expect(page.getByText("v=spf1 mx -all")).toBeVisible();
    await expect(page.getByText("mail._domainkey.example.test")).toBeVisible();
    await expect(page.getByText("v=DMARC1; p=none; rua=mailto:dmarc@example.test; adkim=s; aspf=s")).toBeVisible();

    await page.getByRole("button", { name: /Verify DNS/i }).click();
    await expect(page.locator(".settings-badge").filter({ hasText: "ready" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Save Catch-All/i })).toBeVisible();
  });

  test("compose queues a signed PGP outbox payload", async ({ page }) => {
    const username = process.env.E2E_ADMIN_USERNAME;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!username || !password, "set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD (see e2e/README.md)");

    let outboxPayload = "";

    await page.route("**/api/v1/identities", async (route) => {
      await route.fulfill({
        json: {
          identities: [
            {
              email: "owner@example.test",
              fingerprint: "ABCDEF0123456789",
              armored_public: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nOWNER\n-----END PGP PUBLIC KEY BLOCK-----",
              is_active: true,
              is_default: true,
            },
          ],
        },
      });
    });

    await page.route("**/api/v1/mailbox/folders", async (route) => {
      await route.fulfill({ json: { folders: [{ name: "inbox", total: 0 }, { name: "sent", total: 0 }] } });
    });

    await page.route("**/api/v1/mail/messages**", async (route) => {
      await route.fulfill({ json: { messages: [] } });
    });

    await page.route("**/api/v1/keys/contacts/*", async (route) => {
      const req = route.request();
      if (req.method() === "GET") {
        await route.fulfill({ status: 404, json: { error: "not found" } });
        return;
      }
      await route.fulfill({ json: { ok: true } });
    });

    await page.route("**/api/v1/keys/lookup?*", async (route) => {
      await route.fulfill({
        json: {
          email: "recipient@example.test",
          armored_public: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nRECIPIENT\n-----END PGP PUBLIC KEY BLOCK-----",
          source: "lookup",
        },
      });
    });

    await page.route("**/api/v1/mail/outbox", async (route) => {
      const body = route.request().postDataJSON() as Record<string, string>;
      outboxPayload = Buffer.from(String(body.payload_ciphertext_b64 || ""), "base64").toString("utf8");
      await route.fulfill({ status: 201, json: { id: "outbox-12345678" } });
    });

    await loginToMail(page, username!, password!);
    await page.waitForFunction(() => !!window.ElvishKeyVault);
    await page.evaluate(() => {
      const w = window as any;
      const plaintext = "From: owner@example.test\r\nTo: recipient@example.test\r\nSubject: Signed subject\r\n\r\nSigned body";
      w.__signCalls = [];
      w.ElvishKeyVault.isUnlocked = () => true;
      w.ElvishKeyVault.ensureIdentityUnlockedByEmail = async () => "ABCDEF0123456789";
      w.ElvishKeyVault.encryptAndSignToRecipient = async (armoredRecipientPub: string, rawPlaintext: Uint8Array, signerFingerprint: string) => {
        const decoded = new TextDecoder().decode(rawPlaintext);
        w.__signCalls.push({ armoredRecipientPub, signerFingerprint, decoded });
        return `-----BEGIN PGP MESSAGE-----\nSIGNED:${signerFingerprint}\n${decoded}\n-----END PGP MESSAGE-----`;
      };
      w.ElvishKeyVault.encryptToRecipient = async () => "-----BEGIN PGP MESSAGE-----\nHEADER\n-----END PGP MESSAGE-----";
      w.ElvishKeyVault.tryDefaultDecrypt = async () => ({ data: plaintext, fingerprint: "ABCDEF0123456789" });
    });

    await page.getByRole("button", { name: /Compose/i }).click();
    await page.getByPlaceholder("recipient@example.com").fill("recipient@example.test");
    await page.getByPlaceholder("Subject").fill("Signed subject");
    await page.locator(".mail-compose textarea").first().fill("Signed body");
    await page.getByRole("button", { name: /ENCRYPT & SEND/i }).click();

    await expect(page.locator(".mail-toast")).toContainText("Queued signed PGP message");
    await expect.poll(() => outboxPayload).toContain("multipart/encrypted");
    await expect.poll(() => outboxPayload).toContain("SIGNED:ABCDEF0123456789");
    const signCalls = await page.evaluate(() => ((window as any).__signCalls || []));
    expect(signCalls).toHaveLength(2);
    expect(String(signCalls[0].decoded || "")).toContain("Subject: Signed subject");
  });

  test("compose attaches public key when mail settings default is on", async ({ page }) => {
    const username = process.env.E2E_ADMIN_USERNAME;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!username || !password, "set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD (see e2e/README.md)");

    await page.route("**/api/v1/mail/settings", async (route) => {
      await route.fulfill({
        json: {
          settings: {
            auto_encrypt_inbound: true,
            wkd_publish: true,
            attach_public_key_default: true,
            keyvault_idle_min: 15,
            retention_setup_completed: true,
          },
          retention_days: {},
        },
      });
    });

    await page.route("**/api/v1/identities", async (route) => {
      await route.fulfill({
        json: {
          identities: [
            {
              email: "owner@example.test",
              fingerprint: "ABCDEF0123456789",
              armored_public: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nOWNER\n-----END PGP PUBLIC KEY BLOCK-----",
              is_active: true,
              is_default: true,
            },
          ],
        },
      });
    });

    await page.route("**/api/v1/mailbox/folders", async (route) => {
      await route.fulfill({ json: { folders: [{ name: "inbox", total: 0 }, { name: "sent", total: 0 }] } });
    });

    await page.route("**/api/v1/mail/messages**", async (route) => {
      await route.fulfill({ json: { messages: [] } });
    });

    await page.route("**/api/v1/keys/contacts/*", async (route) => {
      const req = route.request();
      if (req.method() === "GET") {
        await route.fulfill({ status: 404, json: { error: "not found" } });
        return;
      }
      await route.fulfill({ json: { ok: true } });
    });

    await page.route("**/api/v1/keys/lookup?*", async (route) => {
      await route.fulfill({
        json: {
          email: "recipient@example.test",
          armored_public: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nRECIPIENT\n-----END PGP PUBLIC KEY BLOCK-----",
          source: "lookup",
        },
      });
    });

    await page.route("**/api/v1/mail/outbox", async (route) => {
      await route.fulfill({ status: 201, json: { id: "outbox-attach-key" } });
    });

    await loginToMail(page, username!, password!);
    await page.waitForFunction(() => !!window.ElvishKeyVault);
    await page.evaluate(() => {
      const w = window as any;
      w.__signCalls = [];
      w.ElvishKeyVault.isUnlocked = () => true;
      w.ElvishKeyVault.ensureIdentityUnlockedByEmail = async () => "ABCDEF0123456789";
      w.ElvishKeyVault.encryptAndSignToRecipient = async (_pub: string, rawPlaintext: Uint8Array, signerFingerprint: string) => {
        const decoded = new TextDecoder().decode(rawPlaintext);
        w.__signCalls.push({ signerFingerprint, decoded });
        return `-----BEGIN PGP MESSAGE-----\nSIGNED:${signerFingerprint}\n${decoded}\n-----END PGP MESSAGE-----`;
      };
      w.ElvishKeyVault.encryptToRecipient = async () => "-----BEGIN PGP MESSAGE-----\nHEADER\n-----END PGP MESSAGE-----";
      w.ElvishKeyVault.tryDefaultDecrypt = async () => ({ data: "", fingerprint: "ABCDEF0123456789" });
    });

    await page.getByRole("button", { name: /Compose/i }).click();
    await expect(page.getByLabel("Attach my public key")).toBeChecked();
    await page.getByPlaceholder("recipient@example.com").fill("recipient@example.test");
    await page.getByPlaceholder("Subject").fill("Key attach subject");
    await page.locator(".mail-compose textarea").first().fill("Body with key");
    await page.getByRole("button", { name: /ENCRYPT & SEND/i }).click();

    const signCalls = await page.evaluate(() => ((window as any).__signCalls || []));
    expect(signCalls.length).toBeGreaterThanOrEqual(1);
    const decoded = String(signCalls[0].decoded || "");
    expect(decoded).toContain("multipart/mixed");
    expect(decoded).toContain("application/pgp-keys");
    expect(decoded).toContain("public-owner_at_example.test.asc");
    expect(decoded).toContain("BEGIN PGP PUBLIC KEY BLOCK");
  });

  test("message detail shows verified signature status after decrypt", async ({ page }) => {
    const username = process.env.E2E_ADMIN_USERNAME;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!username || !password, "set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD (see e2e/README.md)");

    const now = new Date().toISOString();

    await page.route("**/api/v1/identities", async (route) => {
      await route.fulfill({
        json: {
          identities: [
            {
              email: "owner@example.test",
              fingerprint: "ABCDEF0123456789",
              armored_public: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nOWNER\n-----END PGP PUBLIC KEY BLOCK-----",
              is_active: true,
              is_default: true,
            },
          ],
        },
      });
    });

    await page.route("**/api/v1/mailbox/folders", async (route) => {
      await route.fulfill({ json: { folders: [{ name: "inbox", total: 1 }] } });
    });

    await page.route("**/api/v1/mail/messages/msg-1/blob", async (route) => {
      await route.fulfill({ body: "encrypted-message-placeholder" });
    });

    await page.route("**/api/v1/mail/messages**", async (route) => {
      await route.fulfill({
        json: {
          messages: [
            {
              id: "msg-1",
              subject: "Encrypted hello",
              from_addr: "Sender <sender@example.test>",
              to_addrs: ["owner@example.test"],
              preview: "Open me",
              received_at: now,
              provenance: "client_encrypted",
              read: false,
              has_attachments: false,
              headerDecrypted: true,
            },
          ],
        },
      });
    });

    await page.route("**/api/v1/keys/contacts/*", async (route) => {
      await route.fulfill({
        json: {
          email: "sender@example.test",
          armored_public: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nSENDER\n-----END PGP PUBLIC KEY BLOCK-----",
          source: "contact key",
        },
      });
    });

    await loginToMail(page, username!, password!);
    await page.waitForFunction(() => !!window.ElvishKeyVault);
    await page.evaluate(() => {
      const w = window as any;
      const decryptedBody = "From: Sender <sender@example.test>\r\nTo: owner@example.test\r\nSubject: Encrypted hello\r\n\r\nhello signed world";
      w.ElvishKeyVault.isUnlocked = () => true;
      w.ElvishKeyVault.tryDefaultDecrypt = async () => ({ data: decryptedBody, fingerprint: "ABCDEF0123456789" });
      w.ElvishKeyVault.decryptToString = async () => decryptedBody;
      w.ElvishKeyVault.decryptForIdentityResult = async () => ({
        data: decryptedBody,
        verification: { status: "verified", source: "contact key" },
      });
    });

    await page.getByText("Encrypted hello").click();
    await expect(page.getByText("hello signed world")).toBeVisible();
    await expect(page.getByText("SIGNATURE VERIFIED")).toBeVisible();
  });

  test("message detail lists public key attachment from decrypted multipart body", async ({ page }) => {
    const username = process.env.E2E_ADMIN_USERNAME;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!username || !password, "set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD (see e2e/README.md)");

    const now = new Date().toISOString();
    const decryptedBody =
      "From: Sender <sender@example.test>\r\n" +
      "To: owner@example.test\r\n" +
      "Subject: With key\r\n" +
      "MIME-Version: 1.0\r\n" +
      'Content-Type: multipart/mixed; boundary="mb"\r\n' +
      "\r\n" +
      "--mb\r\n" +
      'Content-Type: text/plain; charset="utf-8"\r\n' +
      "Content-Transfer-Encoding: 8bit\r\n" +
      "\r\n" +
      "visible body\r\n" +
      "--mb\r\n" +
      'Content-Type: application/pgp-keys; name="public-owner_at_example.test.asc"\r\n' +
      'Content-Disposition: attachment; filename="public-owner_at_example.test.asc"\r\n' +
      "Content-Transfer-Encoding: 7bit\r\n" +
      "\r\n" +
      "-----BEGIN PGP PUBLIC KEY BLOCK-----\nKEY\n-----END PGP PUBLIC KEY BLOCK-----\r\n" +
      "--mb--\r\n";

    await page.route("**/api/v1/identities", async (route) => {
      await route.fulfill({
        json: {
          identities: [
            {
              email: "owner@example.test",
              fingerprint: "ABCDEF0123456789",
              armored_public: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nOWNER\n-----END PGP PUBLIC KEY BLOCK-----",
              is_active: true,
              is_default: true,
            },
          ],
        },
      });
    });

    await page.route("**/api/v1/mailbox/folders", async (route) => {
      await route.fulfill({ json: { folders: [{ name: "inbox", total: 1 }] } });
    });

    await page.route("**/api/v1/mail/messages/msg-attach/blob", async (route) => {
      await route.fulfill({ body: "encrypted-message-placeholder" });
    });

    await page.route("**/api/v1/mail/messages**", async (route) => {
      await route.fulfill({
        json: {
          messages: [
            {
              id: "msg-attach",
              subject: "With key",
              from_addr: "Sender <sender@example.test>",
              to_addrs: ["owner@example.test"],
              preview: "…",
              received_at: now,
              provenance: "client_encrypted",
              read: false,
              has_attachments: false,
              headerDecrypted: true,
            },
          ],
        },
      });
    });

    await page.route("**/api/v1/keys/contacts/*", async (route) => {
      await route.fulfill({
        json: {
          email: "sender@example.test",
          armored_public: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nSENDER\n-----END PGP PUBLIC KEY BLOCK-----",
          source: "contact key",
        },
      });
    });

    await loginToMail(page, username!, password!);
    await page.waitForFunction(() => !!window.ElvishKeyVault);
    await page.evaluate((body) => {
      const w = window as any;
      w.ElvishKeyVault.isUnlocked = () => true;
      w.ElvishKeyVault.tryDefaultDecrypt = async () => ({ data: body, fingerprint: "ABCDEF0123456789" });
      w.ElvishKeyVault.decryptToString = async () => body;
      w.ElvishKeyVault.decryptForIdentityResult = async () => ({
        data: body,
        verification: { status: "verified", signed: true, signerKeyIDs: [], signerFingerprint: "" },
      });
      w.ElvishKeyVault.verifyNestedSignedPayloadAfterDecrypt = async () => null;
    }, decryptedBody);

    await page.getByText("With key").click();
    await expect(page.getByText("visible body")).toBeVisible();
    await expect(page.getByText("public-owner_at_example.test.asc")).toBeVisible();
  });
});
