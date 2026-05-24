/**
 * Embedded operator panel: loads only when an admin opens Admin from /mail.
 * Uses React/ReactDOM already on globalThis from mail-bundle.js (no second React copy).
 */
import React from "react";
import ReactDOM from "react-dom/client";

Object.assign(globalThis, { React, ReactDOM });

// Shared UI components (must be imported before components that use them)
import "../../static/shared/icons.jsx";
import "../../static/shared/primitives.jsx";
import "../../static/shared/layout.jsx";

import "../../static/admin/tweaks-panel.jsx";
import "../../static/admin/shell.jsx";
import "../../static/admin/tools-data.jsx";
import "../../static/admin/modals.jsx";
import "../../static/admin/admin-primitives.jsx";
import "../../static/admin/admin-state.jsx";
import "../../static/admin/admin-sections-1.jsx";
import "../../static/admin/admin-sections-2.jsx";
import "../../static/admin/admin-content-hub.jsx";
import "../../static/admin/admin-uptime.jsx";
import "../../static/admin/admin-telemetry.jsx";
import "../../static/admin/admin-auth-captcha.jsx";
import "../../static/admin/admin-performance.jsx";
import "../../static/admin/admin-email-sections.jsx";
import "../../static/admin/app-admin.jsx";
