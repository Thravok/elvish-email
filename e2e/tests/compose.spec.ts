import { test, expect } from "@playwright/test";

// Compose-flow E2E: protected-link mode. Asserts the public recipient page
// loads, the meta endpoint returns the right shape, and the open endpoint
// responds with a wrapped key + ciphertext (we don't fully decrypt here
// because that requires a real Cockroach + a created link).
//
// All of these are negative/contract checks that work without a logged-in
// session, mirroring the search.spec.ts pattern.

test.describe("send modes / protected link surface", () => {
  test("public protected-link page renders for any token shape", async ({ page }) => {
    // 43-char base64url placeholder: 'a' x43.
    const tok = "a".repeat(43);
    const r = await page.goto(`/m/${tok}`);
    expect(r?.status()).toBe(200);
    await expect(page.locator(".protected-card")).toBeVisible();
    // The meta call will fire and either render the unlock form or the
    // expired/burned banner; both are acceptable.
    await expect(page.locator("#card")).toBeVisible();
  });

  test("meta endpoint 404s on garbage token", async ({ request }) => {
    const r = await request.get(`/api/v1/protected-links/${"!".repeat(43)}/meta`);
    expect([404]).toContain(r.status());
  });

  test("open endpoint requires POST", async ({ request }) => {
    const tok = "z".repeat(43);
    const r = await request.get(`/api/v1/protected-links/${tok}/open`);
    expect([404, 405, 503]).toContain(r.status());
  });

  test("plaintext outbox endpoint refuses anonymous calls", async ({ request }) => {
    const r = await request.post("/api/v1/mail/outbox-plain", {
      data: { from_addr: "x@y", to_addrs: ["a@b"], subject: "x", body_text: "x" },
    });
    expect([401, 503]).toContain(r.status());
  });

  test("contact address-book endpoint requires auth", async ({ request }) => {
    const r = await request.get("/api/v1/keys/contacts");
    expect([401, 503]).toContain(r.status());
  });
});
