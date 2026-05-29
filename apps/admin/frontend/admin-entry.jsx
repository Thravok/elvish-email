/**
 * Standalone operator console bundle (includes React).
 */
import React from "react";
import { createRoot } from "react-dom/client";

import "../../../packages/elvish-ui/src/icons.jsx";
import "../../../packages/elvish-ui/src/primitives.jsx";
import "../../../packages/elvish-ui/src/layout.jsx";

import "../src/tweaks-panel.jsx";
import "../src/shell.jsx";
import "../src/tools-data.jsx";
import "../src/modals.jsx";
import "../src/admin-state.jsx";
import "../src/admin-sections-1.jsx";
import "../src/admin-sections-2.jsx";
import "../src/admin-content-hub.jsx";
import "../src/admin-uptime.jsx";
import "../src/admin-telemetry.jsx";
import "../src/admin-platform.jsx";
import "../src/admin-auth-captcha.jsx";
import "../src/admin-performance.jsx";
import "../src/admin-email-sections.jsx";
import "../src/app-admin.jsx";

const mount = document.getElementById("admin-root");
if (mount && window.ElvishMailAdminPanel) {
  createRoot(mount).render(React.createElement(window.ElvishMailAdminPanel, { embedded: false }));
}
