(function (g) {
  "use strict";

  function apiBase() {
    var v = g.__ELVISH_API_BASE__;
    if (v == null || v === "") {
      return "";
    }
    return String(v).replace(/\/$/, "");
  }

  g.elvishApiUrl = function (path) {
    path = path == null ? "/" : String(path);
    if (path.charAt(0) !== "/") {
      path = "/" + path;
    }
    var b = apiBase();
    return b ? b + path : path;
  };

  g.elvishApiFetch = function (path, init) {
    var opts = init || {};
    if (opts.credentials == null) {
      opts.credentials = "include";
    }
    return g.fetch(g.elvishApiUrl(path), opts);
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
