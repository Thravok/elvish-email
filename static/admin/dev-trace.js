/* ELVISH admin — development tracing (plain JS; load before React/Babel). */
(function () {
  "use strict";
  var h = String(location.hostname || "");
  var dev =
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    h.endsWith(".local") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(h);
  window.__ELVISH_DEV__ = dev;

  function devLog() {
    if (!dev) return;
    var a = ["[elvish:dev]"].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, a);
  }
  window.__elvishDevLog = devLog;

  devLog("dev trace on", { href: location.href });

  window.addEventListener("error", function (ev) {
    console.error("[elvish:window.onerror]", ev.message, ev.filename + ":" + ev.lineno, ev.error || "");
  });
  window.addEventListener("unhandledrejection", function (ev) {
    console.error("[elvish:unhandledrejection]", ev.reason);
  });
})();
