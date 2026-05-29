import { elvishApiUrl } from "./api-config.js";

async function elvishFetch(path, init = {}) {
  const url = elvishApiUrl(path);
  const opts = { credentials: "include", ...init };
  return fetch(url, opts);
}

async function elvishApiJSON(path, init = {}) {
  const res = await elvishFetch(path, init);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.response = res;
    throw err;
  }
  return res.json();
}

if (typeof window !== "undefined") {
  window.elvishFetch = elvishFetch;
  window.elvishApiJSON = elvishApiJSON;
}

export { elvishFetch, elvishApiJSON };
