/**
 * Mail UI bundle: React 19 + DOMPurify globals, then legacy JSX modules that expect window.React / window.ReactDOM.
 */
import "../shims/react-globals-init.js";

// Shared UI components (must be imported before components that use them)
import "../../../../packages/elvish-ui/src/icons.jsx";
import "../../../../packages/elvish-ui/src/primitives.jsx";
import "../../../../packages/elvish-ui/src/layout.jsx";

import "../../../../services/api/static/site/public-topbar.jsx";
import "../../mail/unlock-modal.jsx";
import "../../mail/compose.jsx";
import "../../mail/mail-app.jsx";
