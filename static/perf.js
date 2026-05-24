/* global window, document, navigator, performance, PerformanceObserver, Blob, fetch */
(function () {
  const allowedSurfaces = new Set(["admin_ui", "mail_ui", "auth_ui", "home", "public_page"]);
  const allowedOperations = new Set([
    "page_boot",
    "bootstrap_fetch",
    "section_switch",
    "save_action",
    "export_action",
    "folder_load",
    "search_init",
    "search_query",
    "search_index",
    "message_open",
    "compose_send",
    "key_unlock",
    "login_exchange",
    "register_bootstrap",
    "register_submit",
    "status_refresh",
    "first_contentful_paint",
  ]);
  const queue = [];
  const once = new Set();
  let flushTimer = null;

  function nowMs() {
    return typeof performance !== "undefined" && performance && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush(false);
    }, 1500);
  }

  function normalizeResult(result) {
    return String(result || "").trim().toLowerCase() === "failure" ? "failure" : "success";
  }

  function normalizeDuration(durationMs) {
    const n = Math.round(Number(durationMs) || 0);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  }

  function enqueue(surface, operation, durationMs, result) {
    if (!allowedSurfaces.has(surface) || !allowedOperations.has(operation)) return;
    queue.push({
      surface,
      operation,
      duration_ms: normalizeDuration(durationMs),
      result: normalizeResult(result),
    });
    if (queue.length >= 12) {
      flush(false);
      return;
    }
    scheduleFlush();
  }

  function flush(useBeacon) {
    if (!queue.length) return;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const events = queue.splice(0, Math.min(queue.length, 64));
    const body = JSON.stringify({ events });
    if (useBeacon && navigator && typeof navigator.sendBeacon === "function") {
      try {
        const beaconURL = typeof elvishApiUrl === "function" ? elvishApiUrl("/api/telemetry/browser") : "/api/telemetry/browser";
        const ok = navigator.sendBeacon(beaconURL, new Blob([body], { type: "application/json" }));
        if (ok) return;
      } catch (_) {
        // fall back to fetch below
      }
    }
    fetch(elvishApiUrl("/api/telemetry/browser"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  }

  function recordOnce(surface, operation, durationMs, result) {
    const key = `${surface}:${operation}`;
    if (once.has(key)) return;
    once.add(key);
    enqueue(surface, operation, durationMs, result);
  }

  function navigationDurationMs() {
    try {
      const entries = performance && typeof performance.getEntriesByType === "function"
        ? performance.getEntriesByType("navigation")
        : [];
      if (entries && entries[0] && entries[0].loadEventEnd > 0) return entries[0].loadEventEnd;
    } catch (_) {
      // ignore
    }
    return nowMs();
  }

  const api = {
    start() {
      return nowMs();
    },
    record(surface, operation, durationMs, result) {
      enqueue(String(surface || ""), String(operation || ""), durationMs, result);
    },
    recordOnce(surface, operation, durationMs, result) {
      recordOnce(String(surface || ""), String(operation || ""), durationMs, result);
    },
    end(surface, operation, startedAt, result) {
      const started = Number(startedAt);
      if (!Number.isFinite(started)) return;
      enqueue(String(surface || ""), String(operation || ""), nowMs() - started, result);
    },
    async timeAsync(surface, operation, fn) {
      const startedAt = nowMs();
      try {
        const out = await fn();
        enqueue(String(surface || ""), String(operation || ""), nowMs() - startedAt, "success");
        return out;
      } catch (err) {
        enqueue(String(surface || ""), String(operation || ""), nowMs() - startedAt, "failure");
        throw err;
      }
    },
    recordSinceNavigation(surface, operation, result) {
      recordOnce(String(surface || ""), String(operation || ""), navigationDurationMs(), result);
    },
    observePaint(surface) {
      if (typeof PerformanceObserver === "undefined") return;
      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry && entry.name === "first-contentful-paint") {
              recordOnce(String(surface || ""), "first_contentful_paint", entry.startTime, "success");
              obs.disconnect();
              break;
            }
          }
        });
        obs.observe({ type: "paint", buffered: true });
      } catch (_) {
        // paint observer not supported
      }
    },
    flush() {
      flush(false);
    },
  };

  window.ElvishPerf = api;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
})();
