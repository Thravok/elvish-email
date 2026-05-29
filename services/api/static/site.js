/* global window, document */
(function () {
  const TWEAK_KEY = "elvish-tweaks-v1";

  function readJSONScript(id) {
    const el = document.getElementById(id);
    if (!el || !el.textContent) return null;
    try {
      return JSON.parse(el.textContent);
    } catch {
      return null;
    }
  }

  function loadTweaks() {
    const defaults = readJSONScript("elvish-tweak-defaults") || {};
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(TWEAK_KEY) || "{}");
    } catch {
      stored = {};
    }
    // Logged-in appearance is server-sourced (see templates theme-boot); never let
    // localStorage override the account theme key.
    if (document.documentElement.hasAttribute("data-user-ui-theme")) {
      delete stored.theme;
    }
    return Object.assign({}, defaults, stored);
  }

  function saveTweaks(t) {
    const copy = Object.assign({}, t);
    if (document.documentElement.hasAttribute("data-user-ui-theme")) {
      delete copy.theme;
    }
    localStorage.setItem(TWEAK_KEY, JSON.stringify(copy));
  }

  function resolveEffectiveTheme(themeRaw) {
    if (themeRaw === "dark" || themeRaw === "light") return themeRaw;
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch (_) {
      return "light";
    }
  }

  let themeMediaQuery = null;
  function wireAutoThemeListener() {
    if (themeMediaQuery) {
      try {
        themeMediaQuery.removeEventListener("change", onSystemThemeChange);
      } catch (_) {
        themeMediaQuery.removeListener(onSystemThemeChange);
      }
      themeMediaQuery = null;
    }
    const pref = document.documentElement.getAttribute("data-theme-preference") || "";
    if (pref !== "auto") return;
    themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    if (themeMediaQuery.addEventListener) {
      themeMediaQuery.addEventListener("change", onSystemThemeChange);
    } else if (themeMediaQuery.addListener) {
      themeMediaQuery.addListener(onSystemThemeChange);
    }
  }

  function onSystemThemeChange() {
    const t = loadTweaks();
    applyTweaks(t);
  }

  function applyTweaks(t) {
    const root = document.documentElement;
    let themeRaw = t.theme || "light";
    if (root.hasAttribute("data-user-ui-theme")) {
      themeRaw = root.getAttribute("data-user-ui-theme") || readJSONScript("elvish-tweak-defaults")?.theme || "auto";
    }
    root.setAttribute("data-theme", resolveEffectiveTheme(themeRaw));
    root.setAttribute("data-theme-preference", themeRaw);
    root.setAttribute("data-font", t.font || "ibm");
    document.body.classList.toggle("crosshair-on", !!t.crosshair);
    const grid = document.getElementById("fx-grid");
    if (grid) grid.style.display = t.showGrid ? "" : "none";
    const scan = document.getElementById("fx-scan");
    if (scan) scan.style.display = t.scanlines ? "" : "none";
    const amb = document.getElementById("fx-ambient");
    if (amb) amb.style.display = t.showGrid ? "none" : "";
    wireCrosshair(!!t.crosshair);
    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      wireAutoThemeListener();
    }
  }

  let crosshairMove = null;
  function wireCrosshair(on) {
    if (crosshairMove) {
      window.removeEventListener("mousemove", crosshairMove);
      crosshairMove = null;
    }
    if (!on) return;
    crosshairMove = (e) => {
      const el = document.querySelector(".crosshair");
      if (!el) return;
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };
    window.addEventListener("mousemove", crosshairMove);
  }

  function utcClock() {
    const el = document.getElementById("topbar-utc");
    if (!el) return;
    const tick = () => {
      el.textContent = new Date().toISOString().replace("T", " ").slice(0, 19) + "Z";
    };
    tick();
    setInterval(tick, 1000);
  }

  function konami() {
    const seq = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ];
    let pos = 0;
    window.addEventListener("keydown", (e) => {
      const el = e.target;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      const k = e.key;
      if (k === seq[pos]) {
        pos++;
        if (pos === seq.length) {
          pos = 0;
          document.body.classList.add("konami");
          const toast = document.getElementById("elvish-konami-toast");
          if (toast) toast.hidden = false;
          setTimeout(() => document.body.classList.remove("konami"), 1200);
          setTimeout(() => {
            if (toast) toast.hidden = true;
          }, 4000);
        }
      } else {
        pos = k === seq[0] ? 1 : 0;
      }
    });
  }

  function runTerminal() {
    const linesEl = document.getElementById("terminal-lines");
    const raw = readJSONScript("elvish-terminal-lines");
    if (!linesEl || !Array.isArray(raw)) return;
    // Accept lowercase (current) or capitalized keys from older builds.
    const lines = raw.map((L) => ({
      kind: L.kind ?? L.Kind,
      text: L.text ?? L.Text ?? "",
    }));

    const charDelay = 10;
    const lineDelay = 80;
    const startDelay = 100;

    function esc(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function renderLine(line) {
      const kind = line.kind;
      const text = line.text || "";
      if (kind === "blank") {
        return '<div style="height:1.4em">&nbsp;</div>';
      }
      if (kind === "sys" || kind === "prompt") {
        const parts = text.split("$");
        const pre = esc(parts[0] || "") + "$";
        const rest = esc(parts.slice(1).join("$"));
        return `<div><span style="color:var(--accent)">${pre}</span><span>${rest}</span></div>`;
      }
      if (kind === "log") {
        const m = text.match(/^(\[ \w+ \])(.*)$/);
        if (m) {
          return `<div><span style="color:var(--ok)">${esc(m[1])}</span><span style="color:var(--dim)">${esc(m[2])}</span></div>`;
        }
        return `<div style="color:var(--dim)">${esc(text)}</div>`;
      }
      if (kind === "head") {
        return `<div style="color:var(--fg);font-weight:700;letter-spacing:0.04em">${esc(text)}</div>`;
      }
      return `<div>${esc(text)}</div>`;
    }

    let cancelled = false;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      await sleep(startDelay);
      for (let i = 0; i < lines.length; i++) {
        if (cancelled) return;
        const line = lines[i];
        const full = line.text || "";
        for (let c = 0; c <= full.length; c++) {
          if (cancelled) return;
          const partial = Object.assign({}, line, { text: full.slice(0, c) });
          linesEl.innerHTML = lines
            .slice(0, i)
            .map((L) => renderLine(L))
            .concat(renderLine(partial))
            .join("");
          await sleep(charDelay);
        }
        await sleep(lineDelay);
      }
    })();

    window.addEventListener("beforeunload", () => {
      cancelled = true;
    });
  }

  function buildTweakPanel(root, getT, setT) {
    root.innerHTML = "";
    const mk = (html) => {
      const wrap = document.createElement("div");
      wrap.innerHTML = html.trim();
      return wrap.firstElementChild;
    };

    const title = mk('<div class="vtw-hd"><b>TWEAKS</b><button type="button" class="vtw-x" aria-label="Close">×</button></div>');
    const body = mk('<div class="vtw-body"></div>');
    root.appendChild(title);
    root.appendChild(body);

    title.querySelector(".vtw-x").addEventListener("click", () => {
      root.hidden = true;
    });

    const t = getT();
    body.appendChild(mk('<div class="vtw-sect">Appearance</div>'));

    const themeRow = mk('<div class="vtw-row"><div class="vtw-lbl"><span>Theme</span></div><div class="vtw-seg" data-kind="theme"></div></div>');
    const seg = themeRow.querySelector(".vtw-seg");
    const curTheme = t.theme || "light";
    [["auto", "Auto"], ["dark", "Dark"], ["light", "Light"]].forEach(([val, lab]) => {
      const b = mk(`<button type="button" data-value="${val}">${lab}</button>`);
      if (curTheme === val) b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", () => {
        const logged = document.documentElement.hasAttribute("data-user-ui-theme");
        if (logged) {
          window
            .fetch(elvishApiUrl("/api/auth/appearance"), {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ui_theme: val }),
            })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
              if (j && j.user && j.user.ui_theme) {
                document.documentElement.setAttribute("data-user-ui-theme", j.user.ui_theme);
                const scr = document.getElementById("elvish-tweak-defaults");
                if (scr) {
                  try {
                    const def = JSON.parse(scr.textContent || "{}");
                    def.theme = j.user.ui_theme;
                    scr.textContent = JSON.stringify(def);
                  } catch (_) {}
                }
                setT({ theme: j.user.ui_theme });
                [...seg.querySelectorAll("button")].forEach((x) => x.removeAttribute("aria-pressed"));
                b.setAttribute("aria-pressed", "true");
              }
            })
            .catch(() => {});
        } else {
          setT({ theme: val });
          [...seg.querySelectorAll("button")].forEach((x) => x.removeAttribute("aria-pressed"));
          b.setAttribute("aria-pressed", "true");
        }
      });
      seg.appendChild(b);
    });
    body.appendChild(themeRow);

    const fontRow = mk('<div class="vtw-row"><label class="vtw-lbl"><span>Font</span></label><select class="vtw-field"></select></div>');
    const sel = fontRow.querySelector("select");
    [
      ["ibm", "IBM Plex Mono"],
      ["jetbrains", "JetBrains Mono"],
      ["space", "Space Mono / Grotesk"],
      ["display", "Plex + Anton display"],
    ].forEach(([val, lab]) => {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = lab;
      sel.appendChild(o);
    });
    sel.value = t.font || "ibm";
    sel.addEventListener("change", () => setT({ font: sel.value }));
    body.appendChild(fontRow);

    body.appendChild(mk('<div class="vtw-sect">Effects</div>'));

    function toggleRow(label, key) {
      const row = mk(`<div class="vtw-row vtw-row-h"><span class="vtw-lbl">${label}</span><button type="button" class="vtw-toggle" data-on="0"></button></div>`);
      const btn = row.querySelector("button");
      const sync = () => {
        const on = !!getT()[key];
        btn.setAttribute("data-on", on ? "1" : "0");
      };
      sync();
      btn.addEventListener("click", () => {
        const cur = !!getT()[key];
        setT({ [key]: !cur });
        sync();
      });
      body.appendChild(row);
    }

    toggleRow("Background grid", "showGrid");
    toggleRow("Scanlines", "scanlines");
    toggleRow("Crosshair cursor", "crosshair");
  }

  function tweaksUI(getT, setT) {
    const fab = document.getElementById("elvish-tweak-fab");
    const panel = document.getElementById("elvish-tweak-panel");
    if (!fab || !panel) return;

    buildTweakPanel(panel, getT, setT);

    fab.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) buildTweakPanel(panel, getT, setT);
    });
  }

  function wireCmdbarFocus(input) {
    const bar = input.closest(".cmdbar");
    if (!bar) return;
    const focusInput = () => {
      try {
        input.focus({ preventScroll: false });
      } catch (_) {
        input.focus();
      }
    };
    bar.addEventListener("click", (e) => {
      if (e.target === input) return;
      const t = e.target;
      if (t && t.closest && t.closest("input.cmd-input") === input) return;
      focusInput();
    });
  }

  function toolsInteractions() {
    const grid = document.getElementById("tools-grid");
    const input = document.getElementById("tool-query");
    const counter = document.getElementById("tool-counter");
    if (!grid || !input) return;

    wireCmdbarFocus(input);

    const cards = () => [...grid.querySelectorAll(".tool-card")];

    function parseCountAttr(name, fallback) {
      const raw = grid.getAttribute(name);
      const n = parseInt(raw || "", 10);
      return Number.isFinite(n) ? n : fallback;
    }

    function applyFilter() {
      const q = input.value.trim().toLowerCase();
      let visible = 0;
      cards().forEach((card) => {
        const hay = (card.getAttribute("data-q") || "").toLowerCase();
        const ok = !q || hay.includes(q);
        card.classList.toggle("filtered-out", !ok);
        const wrap = card.closest("a.tool-card-go");
        if (wrap) wrap.classList.toggle("filtered-out", !ok);
        if (ok) visible++;
      });
      if (!counter) return;
      const listed = parseCountAttr("data-shown-count", cards().length);
      if (!q) {
        const online = parseCountAttr("data-online-count", 0);
        counter.textContent = `${online} / ${listed}`;
      } else {
        counter.textContent = `${visible} / ${listed}`;
      }
    }

    input.addEventListener("input", applyFilter);
    applyFilter();

    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const list = cards().filter((c) => !c.classList.contains("filtered-out"));
      if (!list.length) return;
      e.preventDefault();
      const el = list[0];
      const link = el.closest("a.tool-card-go");
      if (link && link.getAttribute("href")) {
        window.location.assign(link.getAttribute("href"));
        return;
      }
      el.click();
    });

    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".tool-card");
      if (!card || card.classList.contains("filtered-out")) return;
      card.classList.add("launching");
      setTimeout(() => card.classList.remove("launching"), 600);
    });

    let focusIdx = -1;
    function visibleCards() {
      return cards().filter((c) => !c.classList.contains("filtered-out"));
    }

    window.addEventListener("keydown", (e) => {
      if (
        e.key === "/" &&
        document.activeElement &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA" &&
        document.activeElement.tagName !== "SELECT"
      ) {
        e.preventDefault();
        input.focus();
      }
      if (e.key === "Escape" && document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }

      if (document.activeElement && document.activeElement.tagName === "INPUT") {
        return;
      }

      const list = visibleCards();
      if (!list.length) return;

      if (e.key === "j" || e.key === "l") {
        e.preventDefault();
        focusIdx = Math.min(list.length - 1, focusIdx < 0 ? 0 : focusIdx + 1);
        list.forEach((c) => c.classList.remove("active"));
        list[focusIdx].classList.add("active");
        list[focusIdx].focus({ preventScroll: false });
      } else if (e.key === "k" || e.key === "h") {
        e.preventDefault();
        focusIdx = Math.max(0, focusIdx < 0 ? 0 : focusIdx - 1);
        list.forEach((c) => c.classList.remove("active"));
        list[focusIdx].classList.add("active");
        list[focusIdx].focus({ preventScroll: false });
      } else if (e.key === "Enter" && focusIdx >= 0 && list[focusIdx]) {
        const el = list[focusIdx];
        const link = el.closest("a.tool-card-go");
        if (link && link.getAttribute("href")) {
          window.location.assign(link.getAttribute("href"));
          return;
        }
        el.classList.add("launching");
        setTimeout(() => el.classList.remove("launching"), 600);
      }
    });
  }

  /** When home.json sets footer.ascii_scale_to_fit, scale the SIGN <pre> to the column width. */
  function footerAsciiScaleFit() {
    const clip = document.querySelector(".footer-ascii-clip[data-ascii-scale-fit]");
    const pre = clip && clip.querySelector("pre.ascii");
    if (!clip || !pre) return;

    function measure() {
      const cw = clip.clientWidth;
      if (!cw) return null;
      /* max-width:100% caps the box; scrollWidth can then equal cw so scale was skipped and overflow-x hid the rest. */
      pre.style.maxWidth = "none";
      const nw = pre.scrollWidth;
      pre.style.maxWidth = "";
      if (nw < 1) return null;
      const baseFs = parseFloat(window.getComputedStyle(pre).fontSize);
      if (!Number.isFinite(baseFs) || baseFs < 1) return null;
      return { cw, nw, baseFs };
    }

    function apply() {
      pre.style.fontSize = "";
      pre.style.transform = "";
      pre.style.transformOrigin = "";
      pre.style.marginBottom = "";
      clip.style.height = "";

      const m = measure();
      if (!m) return;
      const s = Math.min(1, m.cw / m.nw);
      if (s >= 0.999) return;
      /* Font-size scales layout + paint together (transform does not, and overflow:hidden then clipped rows/cols). */
      pre.style.fontSize = m.baseFs * s + "px";
    }

    function scheduleApply() {
      requestAnimationFrame(() => {
        requestAnimationFrame(apply);
      });
    }

    scheduleApply();
    window.addEventListener("resize", scheduleApply);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(scheduleApply).observe(clip);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleApply).catch(() => {});
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function currentPerfSurface() {
    if (!document.body) return "public_page";
    return document.body.getAttribute("data-page") === "home" ? "home" : "public_page";
  }

  /** Refresh /status/ summary + table from /api/uptime.json (URLs omitted in API). */
  function initStatusPage() {
    if (!document.body || document.body.getAttribute("data-page") !== "status") return;
    const tbody = document.getElementById("elvish-status-tbody");
    const labels = readJSONScript("elvish-uptime-labels") || {};
    const overallEl = document.getElementById("status-overall");
    const checkedEl = document.getElementById("status-checked");
    const bannerEl = document.getElementById("status-banner");

    function rollupPct(stats, id) {
      const st = stats && stats[id];
      if (!st || st.ok + st.fail <= 0) return "—";
      return (typeof st.uptime_pct === "number" ? st.uptime_pct.toFixed(2) : "—") + "%";
    }

    function renderPayload(payload) {
      if (!payload) return;
      const live = !!payload.live;
      if (overallEl) {
        if (live && typeof payload.overall_uptime_pct === "number" && payload.overall_ok + payload.overall_fail > 0) {
          overallEl.textContent = payload.overall_uptime_pct.toFixed(2) + "%";
        } else if (live) {
          overallEl.textContent = "—";
        } else {
          overallEl.textContent = "—";
        }
      }
      if (checkedEl) {
        if (live && payload.checked_at) {
          checkedEl.textContent = String(payload.checked_at);
        } else {
          checkedEl.textContent = "—";
        }
      }
      if (bannerEl) {
        if (!live && payload.message) {
          bannerEl.style.display = "";
          bannerEl.textContent = payload.message;
        } else if (live && (!payload.targets || payload.targets.length === 0)) {
          bannerEl.style.display = "";
          bannerEl.textContent = "No probe targets in the latest snapshot.";
        } else {
          bannerEl.style.display = "none";
          bannerEl.textContent = "";
        }
      }
      if (!tbody) return;
      const targets = payload.targets || [];
      const stats = payload.stats || {};
      tbody.textContent = "";
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const tr = document.createElement("tr");
        tr.setAttribute("data-target-id", t.id);
        const name = labels[t.id] || t.id;
        const ok = !!t.ok;
        const downStyle = "border-color:#c62828;color:#e57373";
        tr.innerHTML =
          '<td class="mono dim">' +
          escapeHtml(t.id) +
          "</td>" +
          "<td>" +
          escapeHtml(name) +
          "</td>" +
          "<td>" +
          (ok
            ? '<span class="tag live">UP</span>'
            : '<span class="tag" style="' +
              downStyle +
              '">DOWN</span>') +
          "</td>" +
          '<td class="mono">' +
          escapeHtml(String(t.status_code ?? "")) +
          "</td>" +
          '<td class="mono">' +
          escapeHtml(String(t.latency_ms ?? "")) +
          " ms</td>" +
          '<td class="mono">' +
          escapeHtml(rollupPct(stats, t.id)) +
          "</td>" +
          '<td class="dim tiny">' +
          escapeHtml(t.error ? String(t.error) : "") +
          "</td>";
        tbody.appendChild(tr);
      }
    }

    renderPayload(readJSONScript("elvish-uptime-initial"));
    window.setInterval(() => {
      const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
      window
        .fetch(elvishApiUrl("/api/uptime.json"), { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j) renderPayload(j);
          if (window.ElvishPerf) window.ElvishPerf.end(currentPerfSurface(), "status_refresh", perfStartedAt, j ? "success" : "failure");
        })
        .catch(() => {
          if (window.ElvishPerf) window.ElvishPerf.end(currentPerfSurface(), "status_refresh", perfStartedAt, "failure");
        });
    }, 60000);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const { protocol, hostname } = window.location;
    if (protocol === "file:") return;
    const local =
      hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
    if (protocol !== "https:" && !local) return;
    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
      },
      { once: true }
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    let tweaks = loadTweaks();
    applyTweaks(tweaks);
    if (window.ElvishPerf) {
      window.ElvishPerf.observePaint(currentPerfSurface());
      window.ElvishPerf.recordSinceNavigation(currentPerfSurface(), "page_boot", "success");
    }

    const getT = () => tweaks;
    const setT = (patch) => {
      tweaks = Object.assign({}, tweaks, patch);
      saveTweaks(tweaks);
      applyTweaks(tweaks);
    };

    tweaksUI(getT, setT);
    utcClock();
    konami();
    footerAsciiScaleFit();
    registerServiceWorker();
  });
})();
