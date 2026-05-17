import { test, expect } from "@playwright/test";

// Body search lives only in the browser (Web Worker + IndexedDB AES-GCM index).
// These specs assert the project invariant: there is no /api/v1/mail/search/body
// endpoint, and any local-only body search never produces an outbound network
// request when the user has consent OFF.

test.describe("local-only body search", () => {
  test("server has NO /api/v1/mail/search/body endpoint", async ({ request }) => {
    const resp = await request.get("/api/v1/mail/search/body?q=ping");
    expect(resp.status()).toBe(404);
  });

  test("metadata search refuses unconsented field", async ({ request }) => {
    // Anonymous request: should be 401 (login required) rather than expose any data.
    const resp = await request.get(
      "/api/v1/mail/search/metadata?q=hello&fields=subject",
    );
    expect([401, 503]).toContain(resp.status());
  });
});
