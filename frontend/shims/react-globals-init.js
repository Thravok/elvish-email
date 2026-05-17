/**
 * Initialize React globals BEFORE any JSX modules are imported.
 * This module has no other imports, so it initializes first in the bundle.
 */
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import DOMPurify from "dompurify";

globalThis.React = React;
globalThis.ReactDOM = ReactDOM;
globalThis.DOMPurify = DOMPurify;
