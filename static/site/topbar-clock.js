// ELVISH — UTC clock helper for static topbars
// Lightweight helper for shells that don't use the full site.js
(function () {
  function utcClock() {
    const el = document.getElementById("topbar-utc");
    if (!el) return;
    const tick = () => {
      el.textContent = new Date().toISOString().replace("T", " ").slice(0, 19) + "Z";
    };
    tick();
    setInterval(tick, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      utcClock();
    });
  } else {
    utcClock();
  }
})();
