// Cap widget mount for /login and /register (bundled via esbuild).
import "cap-widget";

const { useEffect, useRef } = React;

/**
 * Renders a Cap widget when widgetApiEndpoint is non-empty.
 * Reports the latest token to onTokenChange (empty string after reset or missing endpoint).
 */
function AuthCapField({ widgetApiEndpoint, onTokenChange }) {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!onTokenChange) return;
    if (!widgetApiEndpoint) {
      onTokenChange("");
      return;
    }
    onTokenChange("");
  }, [widgetApiEndpoint, onTokenChange]);

  useEffect(() => {
    const root = hostRef.current;
    if (!root || !widgetApiEndpoint) {
      return undefined;
    }
    root.replaceChildren();
    const el = document.createElement("cap-widget");
    el.setAttribute("data-cap-api-endpoint", widgetApiEndpoint);
    const onSolve = (ev) => {
      const tok = (ev && ev.detail && ev.detail.token) || "";
      if (onTokenChange) onTokenChange(tok);
    };
    const onReset = () => {
      if (onTokenChange) onTokenChange("");
    };
    el.addEventListener("solve", onSolve);
    el.addEventListener("reset", onReset);
    root.appendChild(el);
    return () => {
      el.removeEventListener("solve", onSolve);
      el.removeEventListener("reset", onReset);
      root.replaceChildren();
      if (onTokenChange) onTokenChange("");
    };
  }, [widgetApiEndpoint, onTokenChange]);

  if (!widgetApiEndpoint) {
    return null;
  }
  return <div className="auth-cap-slot" ref={hostRef} />;
}

window.AuthCapField = AuthCapField;