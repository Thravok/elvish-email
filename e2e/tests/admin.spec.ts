import { test, expect } from "@playwright/test";

const MAIL_ADMIN = "/mail?view=admin";

test.describe("admin panel (mail embed)", () => {
  test("redirects /admin/ to mail operator view", async ({ page }) => {
    await page.goto("/admin/");
    await expect(page).toHaveURL(/\/mail\?view=admin/);
  });

  test("operator embed bundle rejects without session when sessions enforced", async ({ request }) => {
    const res = await request.get("/dist/mail-admin-embed.js");
    expect(res.status()).toBe(403);
  });

  test("serves admin styles for embed", async ({ request }) => {
    const res = await request.get("/admin/admin.css");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] || "").toMatch(/text\/css/);
  });

  test.describe("admin shell when logged in", () => {
    test.beforeEach(async ({ page }) => {
      const username = process.env.E2E_ADMIN_USERNAME;
      const password = process.env.E2E_ADMIN_PASSWORD;
      test.skip(!username || !password, "set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD (see e2e/README.md)");
      await page.goto(`/login?next=${encodeURIComponent(MAIL_ADMIN)}`);
      await page.locator("#username").fill(username);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: /LOGIN/i }).click();
      await page.waitForURL(/\/mail/, { timeout: 60000 });
      await page.goto(MAIL_ADMIN);
      await expect(page.getByTestId("admin-root")).toBeVisible({ timeout: 60000 });
    });

    test("loads embedded admin shell", async ({ page }) => {
      await expect(page.getByTestId("admin-shell")).toBeVisible();
    });

    test("renders users panel", async ({ page }) => {
      await page.goto(`${MAIL_ADMIN}#users`);
      await expect(page.getByTestId("admin-users-panel")).toBeVisible({ timeout: 30000 });
      await expect(page.getByText("USER DIRECTORY")).toBeVisible();
    });

    test("renders testing suite panel shell", async ({ page }) => {
      await page.goto(`${MAIL_ADMIN}#testing`);
      await expect(page.getByTestId("admin-mail-test-panel")).toBeVisible();
      await expect(page.getByText("Deliverability Readiness")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Admin Test Composer" })).toBeVisible();
    });

    test("renders system mail panel shell", async ({ page }) => {
      await page.goto(`${MAIL_ADMIN}#system-mail`);
      await expect(page.getByTestId("admin-system-mail-panel")).toBeVisible();
      await expect(page.getByText("Queue System Mail")).toBeVisible();
    });

    test("renders domains panel shell", async ({ page }) => {
      await page.goto(`${MAIL_ADMIN}#domains`);
      await expect(page.getByTestId("admin-domains-panel")).toBeVisible();
      await expect(page.getByText("Register Domain")).toBeVisible();
    });

    test("renders performance panel shell", async ({ page }) => {
      await page.goto(`${MAIL_ADMIN}#performance`);
      await expect(page.getByTestId("admin-performance-panel")).toBeVisible();
      await expect(page.getByText("privacy-safe dashboard")).toBeVisible();
    });
  });

  test("admin uptime API rejects without session", async ({ request }) => {
    const res = await request.get("/api/admin/uptime");
    expect(res.status()).toBe(401);
  });

  test("admin performance API rejects without session", async ({ request }) => {
    const res = await request.get("/api/admin/performance");
    expect(res.status()).toBe(401);
  });

  test("admin test preview API rejects without session", async ({ request }) => {
    const res = await request.post("/api/admin/test/preview", {
      data: {
        local_user_ids: [],
        external_emails: ["user@example.com"],
        from_addr: "announcements@example.com",
        subject: "test",
        body_text: "body",
        send_mode: "plaintext",
        attachments: [],
      },
    });
    expect(res.status()).toBe(401);
  });

  test("admin uptime API succeeds after admin login", async ({ request }) => {
    const username = process.env.E2E_ADMIN_USERNAME;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!username || !password, "set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD (see e2e/README.md)");
    const login = await request.post("/api/auth/login", {
      data: { username, password },
    });
    if (!login.ok()) {
      throw new Error(`login failed ${login.status()}: ${await login.text()}`);
    }
    const res = await request.get("/api/admin/uptime");
    if (!res.ok()) {
      throw new Error(`uptime failed ${res.status()}: ${await res.text()}`);
    }
    const body = await res.json();
    expect(body).toHaveProperty("settings");
  });
});
