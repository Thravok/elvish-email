// Browser + ESM: loaded via <script> (window.*) or import from @elvish/client.

function getApiBase() {
  if (typeof window !== "undefined" && window.__ELVISH_API_BASE__ != null) {
    return String(window.__ELVISH_API_BASE__).replace(/\/$/, "");
  }
  return "";
}

function elvishApiUrl(path) {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Operator console URL (split-origin admin app or legacy mail ?view=admin). */
function elvishAdminHref(path = "/") {
  if (typeof window !== "undefined") {
    const origin = String(window.__ELVISH_ADMIN_ORIGIN__ || "").replace(/\/$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    if (origin) return `${origin}${p}`;
  }
  return "/mail?view=admin";
}

if (typeof window !== "undefined") {
  window.__ELVISH_API_BASE__ = window.__ELVISH_API_BASE__ || "";
  window.__ELVISH_ADMIN_ORIGIN__ = window.__ELVISH_ADMIN_ORIGIN__ || "";
  window.elvishApiUrl = elvishApiUrl;
  window.elvishAdminHref = elvishAdminHref;
}

export { getApiBase, elvishApiUrl, elvishAdminHref };
