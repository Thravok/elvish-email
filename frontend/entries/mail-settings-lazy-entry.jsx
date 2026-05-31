/**
 * Lazy-loaded mail settings: assigns window.ElvishMailSettings after mail-bundle.js
 * has set globalThis.React / globalThis.ReactDOM (no second React copy).
 */
import React from "react";
import ReactDOM from "react-dom/client";

Object.assign(globalThis, { React, ReactDOM });

import "../../static/mail/mail-settings.jsx";
