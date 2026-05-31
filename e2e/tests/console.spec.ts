import { test, expect } from "@playwright/test";

const consoleBase = process.env.E2E_CONSOLE_BASE_URL || "http://127.0.0.1:8780";

test.describe("console service", () => {
  test("healthz responds", async ({ request }) => {
    const res = await request.get(`${consoleBase}/healthz`);
    expect(res.status()).toBe(200);
  });

  test("staff me is null without session", async ({ request }) => {
    const res = await request.get(`${consoleBase}/api/staff/me`);
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.staff).toBeFalsy();
  });

  test.describe("logged in staff", () => {
    test.beforeEach(async ({ page }) => {
      const email = process.env.E2E_CONSOLE_STAFF_EMAIL || process.env.E2E_ADMIN_USERNAME;
      const password = process.env.E2E_CONSOLE_STAFF_PASSWORD || process.env.E2E_ADMIN_PASSWORD;
      test.skip(!email || !password, "set E2E_CONSOLE_STAFF_EMAIL and E2E_CONSOLE_STAFF_PASSWORD");
      await page.goto(consoleBase);
      await page.getByRole("button", { name: /LOGIN/i }).click();
      await page.locator('input[type="text"]').first().fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.getByRole("button", { name: /LOGIN/i }).click();
      await expect(page.getByTestId("admin-root")).toBeVisible({ timeout: 60000 });
    });

    test("loads console shell", async ({ page }) => {
      await expect(page.getByText("CONSOLE")).toBeVisible();
      await expect(page.getByTestId("admin-shell")).toBeVisible();
    });
  });
});
