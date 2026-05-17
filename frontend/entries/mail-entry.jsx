/**
 * Mail UI bundle: React 19 + DOMPurify globals, then legacy JSX modules that expect window.React / window.ReactDOM.
 */
import "../shims/react-globals-init.js";

// Shared UI components (must be imported before components that use them)
import "../../static/shared/icons.jsx";
import "../../static/shared/primitives.jsx";
import "../../static/shared/layout.jsx";

import "../../static/site/public-topbar.jsx";
import "../../static/mail/unlock-modal.jsx";
import "../../static/mail/compose.jsx";
import "../../static/mail/mail-app.jsx";
