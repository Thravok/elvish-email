/* ELVISH service worker — aggressive caching for shell assets + SWR for documents/feeds.
 * Build injects self.__ELVISH_ASSET_Q__ and self.__ELVISH_SW_VER__ before this file body. */
(function () {
  "use strict";

  const ASSET_Q = self.__ELVISH_ASSET_Q__ || "";
  const VER = self.__ELVISH_SW_VER__ || "dev";
  const PRECACHE = "elvish-pc-" + VER;
  const RUNTIME = "elvish-rt-" + VER;

  const ORIGIN = self.location.origin;

  function withQuery(path) {
    return new URL(path + ASSET_Q, ORIGIN).href;
  }

  const PRECACHE_URLS = [withQuery("/styles.css"), withQuery("/page.css"), withQuery("/site.js")];

  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches
        .open(PRECACHE)
        .then((cache) =>
          Promise.all(
            PRECACHE_URLS.map((url) =>
              cache.add(url).catch(() => {
                /* offline build or blocked; skip */
              })
            )
          )
        )
        .then(() => self.skipWaiting())
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (k) =>
                  (k.startsWith("elvish-pc-") && k !== PRECACHE) ||
                  (k.startsWith("elvish-rt-") && k !== RUNTIME)
              )
              .map((k) => caches.delete(k))
          )
        )
        .then(() => self.clients.claim())
    );
  });

  function isSameOrigin(url) {
    return url.origin === ORIGIN;
  }

  /** Never reject: a rejected respondWith() surfaces as a hard navigation failure in Firefox. */
  function respondSafe(event, maybePromise) {
    event.respondWith(
      Promise.resolve(maybePromise).catch(() => fetch(event.request).catch(() => Response.error()))
    );
  }

  function networkErrorHtmlResponse() {
    return new Response(
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Unavailable</title></head><body><p>Could not reach the server. Check your connection and try again.</p></body></html>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  async function cacheFirst(request, cacheName) {
    let cache = null;
    try {
      cache = await caches.open(cacheName);
    } catch (_) {
      try {
        return await fetch(request);
      } catch {
        return Response.error();
      }
    }
    let hit = null;
    try {
      hit = await cache.match(request, { ignoreVary: true });
    } catch (_) {
      hit = null;
    }
    if (hit) return hit;
    let res = null;
    try {
      res = await fetch(request);
    } catch (_) {
      res = null;
    }
    if (res && res.ok) {
      try {
        await cache.put(request, res.clone());
      } catch (_) {
        /* ignore quota / opaque */
      }
    }
    return res || Response.error();
  }

  async function staleWhileRevalidate(request, cacheName, event) {
    let cache = null;
    try {
      cache = await caches.open(cacheName);
    } catch (_) {
      try {
        return await fetch(request);
      } catch {
        return Response.error();
      }
    }
    let cached = null;
    try {
      cached = await cache.match(request, { ignoreVary: true });
    } catch (_) {
      cached = null;
    }
    const network = fetch(request)
      .then((res) => {
        if (res && res.ok) return cache.put(request, res.clone()).then(() => res);
        return res;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(network.catch(() => {}));
      return cached;
    }
    const fresh = await network;
    if (fresh) return fresh;
    return Response.error();
  }

  self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    let url;
    try {
      url = new URL(req.url);
    } catch (_) {
      respondSafe(event, fetch(req));
      return;
    }

    /* Google Fonts: warm cache, SWR (cross-origin). */
    if (url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com") {
      respondSafe(event, staleWhileRevalidate(req, RUNTIME, event));
      return;
    }

    if (!isSameOrigin(url)) return;

    const path = url.pathname;
    const dest = req.destination;

    /* Admin & auth UIs: always network. JSX was already uncached, but cacheFirst on *.js/*.css
     * kept /admin/dev-trace.js, admin.css, etc. frozen until SW version bumped — felt like
     * "need hard reload" while editing components. */
    if (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/auth/")) {
      respondSafe(event, fetch(req).catch(() => Response.error()));
      return;
    }

    /* /login and /register are auth HTML (URL path is not under /auth/). */
    if (path === "/login" || path === "/register") {
      respondSafe(event, fetch(req).catch(() => networkErrorHtmlResponse()));
      return;
    }

    /* Mail HTML shell: always network so SW never serves a stale/wrong document for /mail. */
    if (path === "/mail" || path === "/mail/") {
      respondSafe(event, fetch(req).catch(() => networkErrorHtmlResponse()));
      return;
    }

    /* Built React bundles: network-only so deploys take effect and we never cache HTML/error
     * bodies as if they were script (avoids MIME / parse failures on the mail client). */
    if (path.startsWith("/dist/")) {
      respondSafe(event, fetch(req).catch(() => Response.error()));
      return;
    }

    if (path.endsWith(".css") || path.endsWith(".js")) {
      respondSafe(event, cacheFirst(req, PRECACHE));
      return;
    }

    if (path === "/feed.xml" || path === "/feed.json" || path === "/atom.xml" || path === "/signing.pub") {
      respondSafe(event, staleWhileRevalidate(req, RUNTIME, event));
      return;
    }

    if (dest === "document" || req.mode === "navigate") {
      respondSafe(event, staleWhileRevalidate(req, RUNTIME, event));
      return;
    }

    if (path.endsWith(".md") || path.endsWith(".minisig") || path.endsWith(".html")) {
      respondSafe(event, staleWhileRevalidate(req, RUNTIME, event));
      return;
    }

    /* APIs (e.g. GET /api/auth/me) are session-specific. staleWhileRevalidate would return a
     * cached anonymous JSON body immediately while refreshing in the background — clients
     * that only read the response once (mail shell) would stay “logged out” until hard reload. */
    if (path.startsWith("/api/")) {
      respondSafe(event, fetch(req).catch(() => Response.error()));
      return;
    }

    respondSafe(event, staleWhileRevalidate(req, RUNTIME, event));
  });
})();
