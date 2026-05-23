(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // shims/react-global.js
  var R, react_global_default;
  var init_react_global = __esm({
    "shims/react-global.js"() {
      R = globalThis.React;
      if (!R) {
        throw new Error("[elvish] mail-admin-embed: globalThis.React missing \u2014 load /dist/mail-bundle.js first");
      }
      react_global_default = R;
    }
  });

  // shims/react-dom-client-global.js
  var M, react_dom_client_global_default;
  var init_react_dom_client_global = __esm({
    "shims/react-dom-client-global.js"() {
      M = globalThis.ReactDOM;
      if (!M) {
        throw new Error("[elvish] mail-admin-embed: globalThis.ReactDOM missing \u2014 load /dist/mail-bundle.js first");
      }
      react_dom_client_global_default = M;
    }
  });

  // ../static/shared/icons.jsx
  function Icon({ name, size, className, ...props }) {
    const icon = Icons[name];
    if (!icon) {
      console.warn(`[elvish] Unknown icon: ${name}`);
      return null;
    }
    if (size || className) {
      return react_global_default.cloneElement(icon, {
        ...props,
        width: size || icon.props.width,
        height: size || icon.props.height,
        className
      });
    }
    return icon;
  }
  var iconProps, smallIconProps, Icons;
  var init_icons = __esm({
    "../static/shared/icons.jsx"() {
      init_react_global();
      iconProps = {
        width: 18,
        height: 18,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        "aria-hidden": true
      };
      smallIconProps = {
        ...iconProps,
        width: 14,
        height: 14
      };
      Icons = {
        // Navigation / Section Icons
        account: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), /* @__PURE__ */ react_global_default.createElement("circle", { cx: "12", cy: "7", r: "4" })),
        users: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" }), /* @__PURE__ */ react_global_default.createElement("circle", { cx: "9", cy: "7", r: "4" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })),
        security: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })),
        mail: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }), /* @__PURE__ */ react_global_default.createElement("polyline", { points: "22,6 12,13 2,6" })),
        folder: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" })),
        filter: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" })),
        globe: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "2", y1: "12", x2: "22", y2: "12" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" })),
        key: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 0-7.778 7.778 5.5 5.5 0 0 0 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5l3 3" })),
        send: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("line", { x1: "22", y1: "2", x2: "11", y2: "13" }), /* @__PURE__ */ react_global_default.createElement("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })),
        file: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), /* @__PURE__ */ react_global_default.createElement("polyline", { points: "14 2 14 8 20 8" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "16", y1: "13", x2: "8", y2: "13" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "16", y1: "17", x2: "8", y2: "17" }), /* @__PURE__ */ react_global_default.createElement("polyline", { points: "10 9 9 9 8 9" })),
        help: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })),
        danger: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "9", x2: "12", y2: "13" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })),
        site: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M3 5h18v14H3z" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M3 9h18" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M8 5v4" })),
        outbox: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M22 2L11 13" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M22 2L15 22l-4-9-9-4 20-7z" })),
        testing: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M9 3h6" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M10 9V3" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M14 3v6" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M8 9h8l4 10a2 2 0 0 1-2 3H6a2 2 0 0 1-2-3L8 9z" })),
        telemetry: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M3 3v18h18" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M7 15l4-4 3 3 5-7" })),
        performance: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M22 12h-4l-3 9L9 3l-3 9H2" })),
        captcha: /* @__PURE__ */ react_global_default.createElement("svg", { ...iconProps }, /* @__PURE__ */ react_global_default.createElement("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M9 12l2 2 4-4" })),
        // Action Icons (smaller)
        search: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("circle", { cx: "11", cy: "11", r: "7" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "20", y1: "20", x2: "16.65", y2: "16.65" })),
        back: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }), /* @__PURE__ */ react_global_default.createElement("polyline", { points: "12 19 5 12 12 5" })),
        check: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("polyline", { points: "20 6 9 17 4 12" })),
        x: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" })),
        plus: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })),
        trash: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })),
        edit: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })),
        copy: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })),
        download: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), /* @__PURE__ */ react_global_default.createElement("polyline", { points: "7 10 12 15 17 10" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "15", x2: "12", y2: "3" })),
        upload: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), /* @__PURE__ */ react_global_default.createElement("polyline", { points: "17 8 12 3 7 8" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "3", x2: "12", y2: "15" })),
        refresh: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("polyline", { points: "23 4 23 10 17 10" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M20.49 15a9 9 0 1 1-2.12-9.36L23 10" })),
        lock: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })),
        unlock: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M7 11V7a5 5 0 0 1 9.9-1" })),
        star: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" })),
        info: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "16", x2: "12", y2: "12" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" })),
        warning: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "9", x2: "12", y2: "13" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })),
        arrowUp: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "19", x2: "12", y2: "5" }), /* @__PURE__ */ react_global_default.createElement("polyline", { points: "5 12 12 5 19 12" })),
        arrowDown: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), /* @__PURE__ */ react_global_default.createElement("polyline", { points: "19 12 12 19 5 12" })),
        chevronRight: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("polyline", { points: "9 18 15 12 9 6" })),
        chevronDown: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("polyline", { points: "6 9 12 15 18 9" })),
        externalLink: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }), /* @__PURE__ */ react_global_default.createElement("polyline", { points: "15 3 21 3 21 9" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "10", y1: "14", x2: "21", y2: "3" })),
        settings: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("circle", { cx: "12", cy: "12", r: "3" }), /* @__PURE__ */ react_global_default.createElement("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" })),
        menu: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("line", { x1: "3", y1: "12", x2: "21", y2: "12" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "3", y1: "6", x2: "21", y2: "6" }), /* @__PURE__ */ react_global_default.createElement("line", { x1: "3", y1: "18", x2: "21", y2: "18" })),
        save: /* @__PURE__ */ react_global_default.createElement("svg", { ...smallIconProps }, /* @__PURE__ */ react_global_default.createElement("path", { d: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" }), /* @__PURE__ */ react_global_default.createElement("polyline", { points: "17 21 17 13 7 13 7 21" }), /* @__PURE__ */ react_global_default.createElement("polyline", { points: "7 3 7 8 15 8" }))
      };
    }
  });

  // ../static/shared/primitives.jsx
  function mdRender(src) {
    if (!src) return "";
    let s = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    s = s.replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${c}</code></pre>`);
    s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    s = s.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    s = s.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/(^|\n)(- .+(?:\n- .+)*)/g, (m, pre, block) => {
      const items = block.split(/\n/).map((l) => l.replace(/^- /, "")).map((t) => `<li>${t}</li>`).join("");
      return pre + `<ul>${items}</ul>`;
    });
    s = s.split(/\n\n+/).map((p) => {
      if (/^<(h\d|ul|ol|pre|blockquote)/.test(p.trim())) return p;
      return `<p>${p.replace(/\n/g, "<br/>")}</p>`;
    }).join("\n");
    return s;
  }
  function Button({
    variant = "secondary",
    size = "md",
    disabled,
    loading,
    onClick,
    children,
    title,
    className,
    type = "button",
    ...props
  }) {
    return /* @__PURE__ */ react_global_default.createElement(
      "button",
      {
        type,
        className: `elvish-btn elvish-btn-${variant} elvish-btn-${size} settings-btn settings-btn-${variant} settings-btn-${size} ${className || ""}`,
        disabled: disabled || loading,
        onClick,
        title,
        ...props
      },
      loading && /* @__PURE__ */ react_global_default.createElement("span", { className: "elvish-btn-spinner settings-btn-spinner" }),
      children
    );
  }
  function Alert({ type = "info", title, children }) {
    const iconName = type === "error" ? "warning" : type === "success" ? "check" : "info";
    return /* @__PURE__ */ react_global_default.createElement("div", { className: `elvish-alert elvish-alert-${type} settings-alert settings-alert-${type}` }, title && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-alert-title settings-alert-title" }, /* @__PURE__ */ react_global_default.createElement(Icon, { name: iconName }), title), /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-alert-body settings-alert-body" }, children));
  }
  function Badge({ variant = "default", children }) {
    return /* @__PURE__ */ react_global_default.createElement("span", { className: `elvish-badge elvish-badge-${variant} settings-badge settings-badge-${variant}` }, children);
  }
  function EmptyState({ icon, title, description, action }) {
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-empty settings-empty" }, icon && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-empty-icon settings-empty-icon" }, typeof icon === "string" ? /* @__PURE__ */ react_global_default.createElement(Icon, { name: icon, size: 24 }) : icon), title && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-empty-title settings-empty-title" }, title), description && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-empty-desc settings-empty-desc" }, description), action && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-empty-action settings-empty-action" }, action));
  }
  function Modal({ open, onClose, title, size = "md", children }) {
    useEffect(() => {
      if (!open) return void 0;
      const onEsc = (e) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", onEsc);
      return () => document.removeEventListener("keydown", onEsc);
    }, [open, onClose]);
    if (!open) return null;
    return /* @__PURE__ */ react_global_default.createElement(
      "div",
      {
        className: "elvish-modal-overlay settings-modal-overlay",
        onClick: (e) => {
          if (e.target === e.currentTarget) onClose();
        }
      },
      /* @__PURE__ */ react_global_default.createElement("div", { className: `elvish-modal elvish-modal-${size} settings-modal settings-modal-${size}` }, /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-modal-header settings-modal-header" }, /* @__PURE__ */ react_global_default.createElement("h3", null, title), /* @__PURE__ */ react_global_default.createElement("button", { className: "elvish-modal-close settings-modal-close", onClick: onClose, type: "button" }, /* @__PURE__ */ react_global_default.createElement(Icon, { name: "x" }))), /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-modal-body settings-modal-body" }, children))
    );
  }
  function ConfirmModal({
    open,
    onClose,
    onConfirm,
    title = "Confirm",
    message,
    confirmLabel = "Confirm",
    confirmVariant = "danger",
    loading
  }) {
    if (!open) return null;
    return /* @__PURE__ */ react_global_default.createElement(
      "div",
      {
        className: "elvish-modal-overlay settings-modal-overlay",
        onClick: (e) => {
          if (e.target === e.currentTarget && !loading) onClose();
        }
      },
      /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-modal elvish-modal-sm settings-modal settings-modal-sm" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-modal-header settings-modal-header" }, /* @__PURE__ */ react_global_default.createElement("h3", null, title), /* @__PURE__ */ react_global_default.createElement(
        "button",
        {
          className: "elvish-modal-close settings-modal-close",
          onClick: onClose,
          disabled: loading,
          type: "button"
        },
        /* @__PURE__ */ react_global_default.createElement(Icon, { name: "x" })
      )), /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-modal-body settings-modal-body" }, /* @__PURE__ */ react_global_default.createElement("p", { style: { margin: 0, fontSize: 13, lineHeight: 1.6 } }, message), /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-modal-actions settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", onClick: onClose, disabled: loading }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: confirmVariant, onClick: onConfirm, loading }, confirmLabel))))
    );
  }
  function FormRow({ children, className }) {
    return /* @__PURE__ */ react_global_default.createElement("div", { className: `elvish-form-row ${className || ""}` }, children);
  }
  function SectionHeader({ title, description, icon, variant, actions, children }) {
    return /* @__PURE__ */ react_global_default.createElement("div", { className: `elvish-section-header ${variant || ""}` }, /* @__PURE__ */ react_global_default.createElement("h2", null, icon && /* @__PURE__ */ react_global_default.createElement(Icon, { name: icon }), title), description && /* @__PURE__ */ react_global_default.createElement("p", null, description), actions && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-section-actions" }, actions), children);
  }
  var useState, useEffect, useCallback, useMemo, useRef;
  var init_primitives = __esm({
    "../static/shared/primitives.jsx"() {
      init_react_global();
      init_icons();
      ({ useState, useEffect, useCallback, useMemo, useRef } = react_global_default);
    }
  });

  // ../static/shared/layout.jsx
  function SettingsShell({ children, className, wideLayout }) {
    return /* @__PURE__ */ react_global_default.createElement(
      "div",
      {
        className: `elvish-settings-shell ${className || ""}`.trim(),
        "data-settings-shell": wideLayout ? "wide" : void 0
      },
      children
    );
  }
  function Nav({
    title,
    sections,
    activeSection,
    onSectionChange,
    searchable = true,
    showDescriptions = false,
    meta,
    footer,
    footerState,
    footerActions,
    className,
    searchPlaceholder = "Search...",
    searchInputAriaLabel,
    navAriaLabel,
    emptySearchTitle = "No results",
    emptySearchDescription = "Try a different search term"
  }) {
    const [searchQuery, setSearchQuery] = useState2("");
    const filteredSections = useMemo2(() => {
      if (!searchQuery.trim()) return sections;
      const q = searchQuery.toLowerCase();
      return sections.filter((s) => {
        const kw = Array.isArray(s.searchKeywords) ? s.searchKeywords : [];
        const kwHit = kw.some((k) => String(k).toLowerCase().includes(q));
        return s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.description && s.description.toLowerCase().includes(q) || s.badge && String(s.badge).toLowerCase().includes(q) || kwHit;
      });
    }, [sections, searchQuery]);
    return /* @__PURE__ */ react_global_default.createElement("nav", { className: `elvish-nav ${className || ""}`, "aria-label": navAriaLabel || title }, /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-nav-header" }, /* @__PURE__ */ react_global_default.createElement("h2", null, title), meta && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-nav-meta" }, meta.map((item, i) => /* @__PURE__ */ react_global_default.createElement("span", { key: i, className: "elvish-nav-meta-item" }, item)))), searchable && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-nav-search" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "elvish-nav-search-icon" }, /* @__PURE__ */ react_global_default.createElement(Icon, { name: "search" })), /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        type: "search",
        className: "elvish-nav-search-input",
        placeholder: searchPlaceholder,
        value: searchQuery,
        onChange: (e) => setSearchQuery(e.target.value),
        "aria-label": searchInputAriaLabel || searchPlaceholder
      }
    )), /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-nav-items" }, filteredSections.map((section) => /* @__PURE__ */ react_global_default.createElement(
      "button",
      {
        key: section.id,
        type: "button",
        "data-testid": section.testId || void 0,
        className: `elvish-nav-item ${activeSection === section.id ? "active" : ""} ${section.variant || ""}`,
        onClick: () => onSectionChange(section.id)
      },
      section.icon && /* @__PURE__ */ react_global_default.createElement("span", { className: "elvish-nav-icon" }, typeof section.icon === "string" ? /* @__PURE__ */ react_global_default.createElement(Icon, { name: section.icon }) : section.icon),
      /* @__PURE__ */ react_global_default.createElement("span", { className: "elvish-nav-label" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "elvish-nav-label-text" }, section.label), showDescriptions && section.description && /* @__PURE__ */ react_global_default.createElement("span", { className: "elvish-nav-label-desc" }, section.description)),
      section.badge && /* @__PURE__ */ react_global_default.createElement("span", { className: "elvish-nav-badge" }, section.badge)
    )), filteredSections.length === 0 && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-nav-empty", style: { padding: "24px 20px", color: "var(--dim)" } }, /* @__PURE__ */ react_global_default.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--fg)" } }, emptySearchTitle), /* @__PURE__ */ react_global_default.createElement("div", { style: { marginTop: 6, fontSize: 11, lineHeight: 1.5 } }, emptySearchDescription))), (footer || footerState || footerActions) && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-nav-footer" }, footerState && /* @__PURE__ */ react_global_default.createElement("div", { className: `elvish-nav-footer-state ${footerState.variant || ""}` }, footerState.text), footerActions && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-nav-footer-actions" }, footerActions), footer));
  }
  function Main({ children, className, contentRef }) {
    return /* @__PURE__ */ react_global_default.createElement("main", { className: `elvish-main ${className || ""}` }, /* @__PURE__ */ react_global_default.createElement("div", { ref: contentRef, className: "elvish-main-content" }, children));
  }
  function AdminPanelLayout({
    title = "Admin Settings",
    sections,
    activeSection,
    onSectionChange,
    meta,
    footerState,
    footer,
    /** When set, replaces the default single "Save Changes" button from onSave. */
    footerActions,
    onSave,
    saveDisabled,
    children,
    wideLayout = true,
    shellClassName,
    mainClassName,
    mainContentRef,
    showDescriptions = true,
    searchable = true,
    searchPlaceholder = "Search...",
    searchInputAriaLabel,
    navAriaLabel,
    emptySearchTitle = "No results",
    emptySearchDescription = "Try a different search term"
  }) {
    const resolvedFooterActions = footerActions !== void 0 ? footerActions : onSave ? /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", onClick: onSave, disabled: saveDisabled }, "Save Changes") : void 0;
    return /* @__PURE__ */ react_global_default.createElement(SettingsShell, { className: shellClassName, wideLayout }, /* @__PURE__ */ react_global_default.createElement(
      Nav,
      {
        title,
        sections,
        activeSection,
        onSectionChange,
        showDescriptions,
        searchable,
        searchPlaceholder,
        searchInputAriaLabel,
        navAriaLabel,
        emptySearchTitle,
        emptySearchDescription,
        meta,
        footerState,
        footerActions: resolvedFooterActions,
        footer
      }
    ), /* @__PURE__ */ react_global_default.createElement(Main, { className: mainClassName, contentRef: mainContentRef }, children));
  }
  var useState2, useMemo2;
  var init_layout = __esm({
    "../static/shared/layout.jsx"() {
      init_react_global();
      init_icons();
      init_primitives();
      ({ useState: useState2, useMemo: useMemo2 } = react_global_default);
    }
  });

  // ../static/admin/tweaks-panel.jsx
  function useTweaks(defaults) {
    const [values, setValues] = React.useState(defaults);
    const setTweak = React.useCallback((keyOrEdits, val) => {
      const edits = typeof keyOrEdits === "object" && keyOrEdits !== null ? keyOrEdits : { [keyOrEdits]: val };
      setValues((prev) => ({ ...prev, ...edits }));
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*");
    }, []);
    return [values, setTweak];
  }
  function TweaksPanel({ title = "Tweaks", children }) {
    const [open, setOpen] = React.useState(false);
    const dragRef = React.useRef(null);
    const offsetRef = React.useRef({ x: 16, y: 16 });
    const PAD = 16;
    const clampToViewport = React.useCallback(() => {
      const panel = dragRef.current;
      if (!panel) return;
      const w = panel.offsetWidth, h = panel.offsetHeight;
      const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
      const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
      offsetRef.current = {
        x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
        y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
      };
      panel.style.right = offsetRef.current.x + "px";
      panel.style.bottom = offsetRef.current.y + "px";
    }, []);
    React.useEffect(() => {
      if (!open) return;
      clampToViewport();
      if (typeof ResizeObserver === "undefined") {
        window.addEventListener("resize", clampToViewport);
        return () => window.removeEventListener("resize", clampToViewport);
      }
      const ro = new ResizeObserver(clampToViewport);
      ro.observe(document.documentElement);
      return () => ro.disconnect();
    }, [open, clampToViewport]);
    React.useEffect(() => {
      const onMsg = (e) => {
        const t = e?.data?.type;
        if (t === "__activate_edit_mode") setOpen(true);
        else if (t === "__deactivate_edit_mode") setOpen(false);
      };
      window.addEventListener("message", onMsg);
      window.parent.postMessage({ type: "__edit_mode_available" }, "*");
      return () => window.removeEventListener("message", onMsg);
    }, []);
    const dismiss = () => {
      setOpen(false);
      window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*");
    };
    const onDragStart = (e) => {
      const panel = dragRef.current;
      if (!panel) return;
      const r = panel.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY;
      const startRight = window.innerWidth - r.right;
      const startBottom = window.innerHeight - r.bottom;
      const move = (ev) => {
        offsetRef.current = {
          x: startRight - (ev.clientX - sx),
          y: startBottom - (ev.clientY - sy)
        };
        clampToViewport();
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    };
    if (!open) return null;
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("style", null, __TWEAKS_STYLE), /* @__PURE__ */ React.createElement(
      "div",
      {
        ref: dragRef,
        className: "twk-panel",
        style: { right: offsetRef.current.x, bottom: offsetRef.current.y }
      },
      /* @__PURE__ */ React.createElement("div", { className: "twk-hd", onMouseDown: onDragStart }, /* @__PURE__ */ React.createElement("b", null, title), /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "twk-x",
          "aria-label": "Close tweaks",
          onMouseDown: (e) => e.stopPropagation(),
          onClick: dismiss
        },
        "\u2715"
      )),
      /* @__PURE__ */ React.createElement("div", { className: "twk-body" }, children)
    ));
  }
  function TweakSection({ label, children }) {
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "twk-sect" }, label), children);
  }
  function TweakRow({ label, value, children, inline = false }) {
    return /* @__PURE__ */ React.createElement("div", { className: inline ? "twk-row twk-row-h" : "twk-row" }, /* @__PURE__ */ React.createElement("div", { className: "twk-lbl" }, /* @__PURE__ */ React.createElement("span", null, label), value != null && /* @__PURE__ */ React.createElement("span", { className: "twk-val" }, value)), children);
  }
  function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = "", onChange }) {
    return /* @__PURE__ */ React.createElement(TweakRow, { label, value: `${value}${unit}` }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "range",
        className: "twk-slider",
        min,
        max,
        step,
        value,
        onChange: (e) => onChange(Number(e.target.value))
      }
    ));
  }
  function TweakToggle({ label, value, onChange }) {
    return /* @__PURE__ */ React.createElement("div", { className: "twk-row twk-row-h" }, /* @__PURE__ */ React.createElement("div", { className: "twk-lbl" }, /* @__PURE__ */ React.createElement("span", null, label)), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "twk-toggle",
        "data-on": value ? "1" : "0",
        role: "switch",
        "aria-checked": !!value,
        onClick: () => onChange(!value)
      },
      /* @__PURE__ */ React.createElement("i", null)
    ));
  }
  function TweakRadio({ label, value, options, onChange }) {
    const trackRef = React.useRef(null);
    const [dragging, setDragging] = React.useState(false);
    const opts = options.map((o) => typeof o === "object" ? o : { value: o, label: o });
    const idx = Math.max(0, opts.findIndex((o) => o.value === value));
    const n = opts.length;
    const valueRef = React.useRef(value);
    valueRef.current = value;
    const segAt = (clientX) => {
      const r = trackRef.current.getBoundingClientRect();
      const inner = r.width - 4;
      const i = Math.floor((clientX - r.left - 2) / inner * n);
      return opts[Math.max(0, Math.min(n - 1, i))].value;
    };
    const onPointerDown = (e) => {
      setDragging(true);
      const v0 = segAt(e.clientX);
      if (v0 !== valueRef.current) onChange(v0);
      const move = (ev) => {
        if (!trackRef.current) return;
        const v = segAt(ev.clientX);
        if (v !== valueRef.current) onChange(v);
      };
      const up = () => {
        setDragging(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
    return /* @__PURE__ */ React.createElement(TweakRow, { label }, /* @__PURE__ */ React.createElement(
      "div",
      {
        ref: trackRef,
        role: "radiogroup",
        onPointerDown,
        className: dragging ? "twk-seg dragging" : "twk-seg"
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "twk-seg-thumb",
          style: {
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`
          }
        }
      ),
      opts.map((o) => /* @__PURE__ */ React.createElement("button", { key: o.value, type: "button", role: "radio", "aria-checked": o.value === value }, o.label))
    ));
  }
  function TweakSelect({ label, value, options, onChange }) {
    return /* @__PURE__ */ React.createElement(TweakRow, { label }, /* @__PURE__ */ React.createElement("select", { className: "twk-field", value, onChange: (e) => onChange(e.target.value) }, options.map((o) => {
      const v = typeof o === "object" ? o.value : o;
      const l = typeof o === "object" ? o.label : o;
      return /* @__PURE__ */ React.createElement("option", { key: v, value: v }, l);
    })));
  }
  function TweakText({ label, value, placeholder, onChange }) {
    return /* @__PURE__ */ React.createElement(TweakRow, { label }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "twk-field",
        type: "text",
        value,
        placeholder,
        onChange: (e) => onChange(e.target.value)
      }
    ));
  }
  function TweakNumber({ label, value, min, max, step = 1, unit = "", onChange }) {
    const clamp = (n) => {
      if (min != null && n < min) return min;
      if (max != null && n > max) return max;
      return n;
    };
    const startRef = React.useRef({ x: 0, val: 0 });
    const onScrubStart = (e) => {
      e.preventDefault();
      startRef.current = { x: e.clientX, val: value };
      const decimals = (String(step).split(".")[1] || "").length;
      const move = (ev) => {
        const dx = ev.clientX - startRef.current.x;
        const raw = startRef.current.val + dx * step;
        const snapped = Math.round(raw / step) * step;
        onChange(clamp(Number(snapped.toFixed(decimals))));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
    return /* @__PURE__ */ React.createElement("div", { className: "twk-num" }, /* @__PURE__ */ React.createElement("span", { className: "twk-num-lbl", onPointerDown: onScrubStart }, label), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        value,
        min,
        max,
        step,
        onChange: (e) => onChange(clamp(Number(e.target.value)))
      }
    ), unit && /* @__PURE__ */ React.createElement("span", { className: "twk-num-unit" }, unit));
  }
  function TweakColor({ label, value, onChange }) {
    return /* @__PURE__ */ React.createElement("div", { className: "twk-row twk-row-h" }, /* @__PURE__ */ React.createElement("div", { className: "twk-lbl" }, /* @__PURE__ */ React.createElement("span", null, label)), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "color",
        className: "twk-swatch",
        value,
        onChange: (e) => onChange(e.target.value)
      }
    ));
  }
  function TweakButton({ label, onClick, secondary = false }) {
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: secondary ? "twk-btn secondary" : "twk-btn",
        onClick
      },
      label
    );
  }
  var __TWEAKS_STYLE;
  var init_tweaks_panel = __esm({
    "../static/admin/tweaks-panel.jsx"() {
      __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;width:100%;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}
`;
      Object.assign(window, {
        useTweaks,
        TweaksPanel,
        TweakSection,
        TweakRow,
        TweakSlider,
        TweakToggle,
        TweakRadio,
        TweakSelect,
        TweakText,
        TweakNumber,
        TweakColor,
        TweakButton
      });
    }
  });

  // ../static/admin/shell.jsx
  function Topbar({ active }) {
    let activeNavId = null;
    let centerAfterNav = null;
    if (active === "home" || active === "tools") {
      activeNavId = "home";
    } else if (active === "mail") {
      activeNavId = "mail";
    } else if (active === "manifesto") {
      activeNavId = "manifesto";
    } else if (active === "admin") {
      centerAfterNav = /* @__PURE__ */ React.createElement("a", { href: "/admin/", className: "navlink active", "aria-current": "page" }, "PANEL");
    } else if (active === "log") {
      centerAfterNav = /* @__PURE__ */ React.createElement("a", { href: "/log/", className: "navlink active", "aria-current": "page" }, "LOG");
    } else if (active === "modals") {
      centerAfterNav = /* @__PURE__ */ React.createElement("span", { className: "navlink active", "aria-current": "page" }, "MODALS");
    }
    return /* @__PURE__ */ React.createElement(
      window.ElvishPublicTopbar,
      {
        activeNavId,
        centerAfterNav,
        showMailLink: false,
        authContent: ({ me, loggedIn, label }) => {
          if (me === null) return /* @__PURE__ */ React.createElement("span", { className: "dim", style: { fontSize: 10 } }, "\u2026");
          if (!loggedIn) {
            return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("a", { href: "/login", className: "navlink" }, "LOGIN"), /* @__PURE__ */ React.createElement("a", { href: "/register", className: "navlink" }, "REGISTER"));
          }
          return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "nav-session dim", title: me.email || "" }, label), me.is_admin && active !== "admin" && /* @__PURE__ */ React.createElement("a", { href: "/admin/", className: "navlink" }, "PANEL"), /* @__PURE__ */ React.createElement("form", { className: "nav-inline-form", action: "/auth/logout", method: "post" }, /* @__PURE__ */ React.createElement("input", { type: "hidden", name: "next", value: window.location.pathname }), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "navlink" }, "LOGOUT")));
        }
      }
    );
  }
  function Footer() {
    return /* @__PURE__ */ React.createElement("footer", { className: "footer" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "ftk" }, "// IDENT"), /* @__PURE__ */ React.createElement("div", { className: "brand", style: { fontSize: 18, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { className: "dot" }), "ELVISH"), /* @__PURE__ */ React.createElement("div", { className: "dim" }, "An anonymous workshop.", /* @__PURE__ */ React.createElement("br", null), "Tools rendered free.", /* @__PURE__ */ React.createElement("br", null), "No login. No price. No pitch.")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "ftk" }, "// PAGES"), /* @__PURE__ */ React.createElement("ul", null, /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "/" }, "Home")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "/mail" }, "Mail")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "/manifesto/" }, "Security")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "/login" }, "Log in")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "/register" }, "Register")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "/admin/" }, "Panel")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "#" }, "Source")))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "ftk" }, "// PROTOCOL"), /* @__PURE__ */ React.createElement("ul", { className: "dim" }, /* @__PURE__ */ React.createElement("li", null, "License \u2014 AGPL-3.0"), /* @__PURE__ */ React.createElement("li", null, "Hash \u2014 e2ee01f4"), /* @__PURE__ */ React.createElement("li", null, "Build \u2014 nightly \xB7 26.05.10"), /* @__PURE__ */ React.createElement("li", null, "Encryption \u2014 OpenPGP"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "ftk" }, "// SIGN"), /* @__PURE__ */ React.createElement("div", { className: "ascii" }, `\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502   \u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588   \u2502
\u2502   \u2588\u2588 \u2588  \u2588 \u2588\u2588   \u2502
\u2502   \u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588   \u2502
\u2502        \u2588\u2588      \u2502
\u2502   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588     \u2502
\u2502   \u2588\u2588   \u2588\u2588      \u2502
\u2502   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588     \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`), /* @__PURE__ */ React.createElement("div", { className: "dim", style: { marginTop: 10, fontSize: 10 } }, "// END OF FILE")));
  }
  var init_shell = __esm({
    "../static/admin/shell.jsx"() {
      window.Topbar = Topbar;
      window.Footer = Footer;
    }
  });

  // ../static/admin/tools-data.jsx
  function Glyph({ name, animated = false }) {
    const cls = animated ? "glyph anim" : "glyph";
    const stroke = "currentColor";
    const sw = 1.25;
    const props = { width: "100%", height: "100%", viewBox: "0 0 80 80", fill: "none", stroke, strokeWidth: sw };
    switch (name) {
      case "shroud":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("rect", { x: "14", y: "14", width: "52", height: "52" }), /* @__PURE__ */ React.createElement("rect", { x: "22", y: "22", width: "36", height: "36" }), /* @__PURE__ */ React.createElement("line", { x1: "14", y1: "14", x2: "66", y2: "66" }), /* @__PURE__ */ React.createElement("line", { x1: "14", y1: "40", x2: "40", y2: "14" }), /* @__PURE__ */ React.createElement("line", { x1: "40", y1: "66", x2: "66", y2: "40" }));
      case "tessera":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("rect", { x: "14", y: "14", width: "22", height: "22" }), /* @__PURE__ */ React.createElement("rect", { x: "44", y: "14", width: "22", height: "22" }), /* @__PURE__ */ React.createElement("rect", { x: "14", y: "44", width: "22", height: "22" }), /* @__PURE__ */ React.createElement("rect", { x: "44", y: "44", width: "22", height: "22" }), /* @__PURE__ */ React.createElement("rect", { x: "38", y: "38", width: "4", height: "4", fill: stroke }));
      case "cipher":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("rect", { x: "18", y: "32", width: "44", height: "34" }), /* @__PURE__ */ React.createElement("path", { d: "M28 32 V22 a12 12 0 0 1 24 0 V32" }), /* @__PURE__ */ React.createElement("circle", { cx: "40", cy: "48", r: "3", fill: stroke }), /* @__PURE__ */ React.createElement("line", { x1: "40", y1: "51", x2: "40", y2: "58" }));
      case "ledger":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("rect", { x: "16", y: "14", width: "48", height: "52" }), /* @__PURE__ */ React.createElement("line", { x1: "16", y1: "26", x2: "64", y2: "26" }), /* @__PURE__ */ React.createElement("line", { x1: "40", y1: "26", x2: "40", y2: "66" }), /* @__PURE__ */ React.createElement("line", { x1: "22", y1: "36", x2: "36", y2: "36" }), /* @__PURE__ */ React.createElement("line", { x1: "44", y1: "36", x2: "58", y2: "36" }), /* @__PURE__ */ React.createElement("line", { x1: "22", y1: "46", x2: "36", y2: "46" }), /* @__PURE__ */ React.createElement("line", { x1: "44", y1: "46", x2: "58", y2: "46" }), /* @__PURE__ */ React.createElement("line", { x1: "22", y1: "56", x2: "36", y2: "56" }), /* @__PURE__ */ React.createElement("line", { x1: "44", y1: "56", x2: "58", y2: "56" }));
      case "vector":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("circle", { cx: "20", cy: "60", r: "4", fill: stroke }), /* @__PURE__ */ React.createElement("circle", { cx: "40", cy: "20", r: "4", fill: stroke }), /* @__PURE__ */ React.createElement("circle", { cx: "60", cy: "60", r: "4", fill: stroke }), /* @__PURE__ */ React.createElement("line", { x1: "20", y1: "60", x2: "40", y2: "20" }), /* @__PURE__ */ React.createElement("line", { x1: "40", y1: "20", x2: "60", y2: "60" }), /* @__PURE__ */ React.createElement("line", { x1: "20", y1: "60", x2: "60", y2: "60", strokeDasharray: "2 3" }));
      case "loom":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("rect", { x: "18", y: "14", width: "44", height: "52" }), /* @__PURE__ */ React.createElement("line", { x1: "24", y1: "24", x2: "56", y2: "24" }), /* @__PURE__ */ React.createElement("line", { x1: "24", y1: "32", x2: "50", y2: "32" }), /* @__PURE__ */ React.createElement("line", { x1: "24", y1: "40", x2: "56", y2: "40" }), /* @__PURE__ */ React.createElement("line", { x1: "24", y1: "48", x2: "46", y2: "48" }), /* @__PURE__ */ React.createElement("line", { x1: "24", y1: "56", x2: "56", y2: "56" }));
      case "hex":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("polygon", { points: "40,12 64,26 64,54 40,68 16,54 16,26" }), /* @__PURE__ */ React.createElement("polygon", { points: "40,26 52,33 52,47 40,54 28,47 28,33" }), /* @__PURE__ */ React.createElement("line", { x1: "40", y1: "12", x2: "40", y2: "26" }), /* @__PURE__ */ React.createElement("line", { x1: "64", y1: "26", x2: "52", y2: "33" }), /* @__PURE__ */ React.createElement("line", { x1: "64", y1: "54", x2: "52", y2: "47" }));
      case "sigil":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("rect", { x: "14", y: "14", width: "14", height: "14" }), /* @__PURE__ */ React.createElement("rect", { x: "52", y: "14", width: "14", height: "14" }), /* @__PURE__ */ React.createElement("rect", { x: "14", y: "52", width: "14", height: "14" }), /* @__PURE__ */ React.createElement("rect", { x: "18", y: "18", width: "6", height: "6", fill: stroke }), /* @__PURE__ */ React.createElement("rect", { x: "56", y: "18", width: "6", height: "6", fill: stroke }), /* @__PURE__ */ React.createElement("rect", { x: "18", y: "56", width: "6", height: "6", fill: stroke }), /* @__PURE__ */ React.createElement("rect", { x: "36", y: "36", width: "8", height: "8", fill: stroke }), /* @__PURE__ */ React.createElement("line", { x1: "36", y1: "14", x2: "44", y2: "14" }), /* @__PURE__ */ React.createElement("line", { x1: "36", y1: "22", x2: "44", y2: "22" }), /* @__PURE__ */ React.createElement("line", { x1: "56", y1: "36", x2: "66", y2: "36" }), /* @__PURE__ */ React.createElement("line", { x1: "56", y1: "44", x2: "66", y2: "44" }));
      case "drift":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("circle", { cx: "22", cy: "58", r: "3", fill: stroke }), /* @__PURE__ */ React.createElement("path", { d: "M22 44 a14 14 0 0 1 14 14" }), /* @__PURE__ */ React.createElement("path", { d: "M22 30 a28 28 0 0 1 28 28" }), /* @__PURE__ */ React.createElement("path", { d: "M22 16 a42 42 0 0 1 42 42" }));
      case "obscura":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("rect", { x: "14", y: "22", width: "52", height: "36" }), /* @__PURE__ */ React.createElement("circle", { cx: "40", cy: "40", r: "8" }), /* @__PURE__ */ React.createElement("rect", { x: "34", y: "22", width: "12", height: "36", fill: stroke, fillOpacity: "0.15" }), /* @__PURE__ */ React.createElement("line", { x1: "14", y1: "22", x2: "66", y2: "58", strokeDasharray: "2 3" }));
      case "monolith":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("rect", { x: "28", y: "10", width: "24", height: "60" }), /* @__PURE__ */ React.createElement("line", { x1: "28", y1: "20", x2: "52", y2: "20" }), /* @__PURE__ */ React.createElement("line", { x1: "28", y1: "30", x2: "52", y2: "30" }), /* @__PURE__ */ React.createElement("line", { x1: "28", y1: "40", x2: "52", y2: "40" }), /* @__PURE__ */ React.createElement("line", { x1: "28", y1: "50", x2: "52", y2: "50" }), /* @__PURE__ */ React.createElement("line", { x1: "28", y1: "60", x2: "52", y2: "60" }));
      case "echo":
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("line", { x1: "14", y1: "40", x2: "20", y2: "40" }), /* @__PURE__ */ React.createElement("line", { x1: "24", y1: "32", x2: "24", y2: "48" }), /* @__PURE__ */ React.createElement("line", { x1: "30", y1: "24", x2: "30", y2: "56" }), /* @__PURE__ */ React.createElement("line", { x1: "36", y1: "30", x2: "36", y2: "50" }), /* @__PURE__ */ React.createElement("line", { x1: "42", y1: "22", x2: "42", y2: "58" }), /* @__PURE__ */ React.createElement("line", { x1: "48", y1: "34", x2: "48", y2: "46" }), /* @__PURE__ */ React.createElement("line", { x1: "54", y1: "28", x2: "54", y2: "52" }), /* @__PURE__ */ React.createElement("line", { x1: "60", y1: "36", x2: "60", y2: "44" }), /* @__PURE__ */ React.createElement("line", { x1: "64", y1: "40", x2: "70", y2: "40" }));
      default:
        return /* @__PURE__ */ React.createElement("svg", { ...props }, /* @__PURE__ */ React.createElement("rect", { x: "14", y: "14", width: "52", height: "52" }));
    }
  }
  var TOOLS;
  var init_tools_data = __esm({
    "../static/admin/tools-data.jsx"() {
      TOOLS = [
        { id: "01", slug: "shroud", name: "SHROUD", tag: "live", desc: "Strip metadata from any file in your browser. Nothing uploaded.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "shroud", calls: "\u2014", since: "23.04", open_href: "", monitor: null },
        { id: "02", slug: "tessera", name: "TESSERA", tag: "live", desc: "Lossless image dicer. Slice, tile, atlas. Drag-drop, never leaves the tab.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "tessera", calls: "\u2014", since: "23.07", open_href: "", monitor: null },
        { id: "03", slug: "cipher-0", name: "CIPHER-0", tag: "live", desc: "Symmetric & PGP toolbox. Keys live in IndexedDB only.", signals: ["BROWSER-ONLY", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "cipher", calls: "\u2014", since: "22.11", open_href: "", monitor: null },
        { id: "04", slug: "ledger", name: "LEDGER", tag: "beta", desc: "Plaintext-first ledger. Double-entry, encrypted, exports CSV/Beancount.", signals: ["BROWSER-ONLY", "OFFLINE-CAPABLE", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "ledger", calls: "\u2014", since: "25.02", open_href: "", monitor: null },
        { id: "05", slug: "vector", name: "VECTOR", tag: "live", desc: "Tiny SVG editor for technical diagrams. Pen, grid, ortho-snap.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "vector", calls: "\u2014", since: "24.01", open_href: "", monitor: null },
        { id: "06", slug: "loom", name: "LOOM", tag: "live", desc: "Markdown to print-ready PDF. Footnotes, kerning, drop caps, no fluff.", signals: ["BROWSER-ONLY", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "loom", calls: "\u2014", since: "24.06", open_href: "", monitor: null },
        { id: "07", slug: "hex-9", name: "HEX-9", tag: "live", desc: "Hex/binary editor with templates. Inspect headers without leaving the page.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "hex", calls: "\u2014", since: "24.09", open_href: "", monitor: null },
        { id: "08", slug: "sigil", name: "SIGIL", tag: "beta", desc: "Generative QR with logo embed and error correction tuning.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "sigil", calls: "\u2014", since: "25.04", open_href: "", monitor: null },
        { id: "09", slug: "drift", name: "DRIFT", tag: "wip", desc: "Local-first feed reader. RSS, Atom, JSON-feed. Sync via your own bucket.", signals: ["LOCAL-FIRST", "OPTIONAL-SYNC", "OFFLINE-CAPABLE", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "drift", calls: "\u2014", since: "26.02", open_href: "", monitor: null },
        { id: "10", slug: "obscura", name: "OBSCURA", tag: "live", desc: "Image redactor with reversible-proof crops. Pixel hashes printed beside.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "obscura", calls: "\u2014", since: "23.12", open_href: "", monitor: null },
        { id: "11", slug: "monolith", name: "MONOLITH", tag: "beta", desc: "Bundle a whole webpage into a single offline-capable HTML file.", signals: ["BROWSER-ONLY", "OFFLINE-CAPABLE", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "monolith", calls: "\u2014", since: "25.06", open_href: "", monitor: null },
        { id: "12", slug: "echo", name: "ECHO", tag: "wip", desc: "Voice memo transcriber. Whisper-tiny in browser, no upload.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "echo", calls: "\u2014", since: "26.04", open_href: "", monitor: null }
      ];
      window.TOOLS = TOOLS;
      window.Glyph = Glyph;
    }
  });

  // ../static/admin/modals.jsx
  function genPid() {
    const b = new Uint8Array(2);
    crypto.getRandomValues(b);
    const n = b[0] << 8 | b[1];
    return "0x" + (n & 65535).toString(16).toUpperCase().padStart(4, "0");
  }
  function Modal2({ open, onClose, title, kind = "MODAL", status, size, children, footer, dismissable = true }) {
    const pidRef = useR_m(genPid());
    useE_m(() => {
      if (!open || !dismissable) return;
      const onKey = (e) => {
        if (e.key === "Escape") onClose && onClose();
      };
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }, [open, dismissable, onClose]);
    if (!open) return null;
    return /* @__PURE__ */ React.createElement("div", { className: "modal-root" }, /* @__PURE__ */ React.createElement("div", { className: "modal-backdrop", onClick: dismissable ? onClose : void 0 }), /* @__PURE__ */ React.createElement("div", { className: "modal" + (size ? " " + size : ""), role: "dialog", "aria-modal": "true" }, /* @__PURE__ */ React.createElement("span", { className: "br-bl" }), /* @__PURE__ */ React.createElement("span", { className: "br-br" }), /* @__PURE__ */ React.createElement("div", { className: "mod-bar" }, /* @__PURE__ */ React.createElement("span", { className: "pid" }, "\u25B8 ", kind), /* @__PURE__ */ React.createElement("span", { className: "ttl" }, title), /* @__PURE__ */ React.createElement("span", { className: "stat" }, status || `PID ${pidRef.current}`), /* @__PURE__ */ React.createElement("button", { className: "mod-close", onClick: onClose, "aria-label": "close" }, "\xD7")), /* @__PURE__ */ React.createElement("div", { className: "mod-body" }, children), footer && /* @__PURE__ */ React.createElement("div", { className: "mod-foot" }, footer)));
  }
  function ConfirmDestroyModal({ open, onClose, onConfirm, target, label = "DELETE", phrase = "DELETE" }) {
    const [t, setT] = useS_m("");
    useE_m(() => {
      if (open) setT("");
    }, [open]);
    const armed = t === phrase;
    return /* @__PURE__ */ React.createElement(Modal2, { open, onClose, title: label + " \xB7 " + (target?.name || "ITEM"), kind: "CONFIRM", status: "DESTRUCTIVE" }, /* @__PURE__ */ React.createElement("div", { className: "mod-head-block" }, /* @__PURE__ */ React.createElement("div", { className: "mod-icon warn" }, /* @__PURE__ */ React.createElement("span", { className: "b1" }), /* @__PURE__ */ React.createElement("span", { className: "b2" }), /* @__PURE__ */ React.createElement("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("path", { d: "M12 3 L22 20 L2 20 Z" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "10", x2: "12", y2: "15" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "17.5", r: "0.6", fill: "currentColor" }))), /* @__PURE__ */ React.createElement("div", { className: "txt" }, /* @__PURE__ */ React.createElement("h2", null, "This cannot be undone."), /* @__PURE__ */ React.createElement("p", null, "The record will be removed from the working state. If already published, the next deploy will remove it from the live site and feeds. Mirrors and archives may retain copies."))), target && /* @__PURE__ */ React.createElement("div", { className: "confirm-row" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "\u25B8 Target"), /* @__PURE__ */ React.createElement("div", { className: "val" }, target.name), target.path && /* @__PURE__ */ React.createElement("div", { className: "dim mono", style: { fontSize: 10, marginTop: 6 } }, target.path), target.detail && /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 11, marginTop: 6 } }, target.detail)), /* @__PURE__ */ React.createElement("div", { className: "confirm-type" }, /* @__PURE__ */ React.createElement("div", { className: "lbl" }, "Type ", /* @__PURE__ */ React.createElement("code", null, phrase), " to confirm"), /* @__PURE__ */ React.createElement("input", { className: "inp", autoFocus: true, value: t, onChange: (e) => setT(e.target.value.toUpperCase()) })), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14, fontSize: 10, color: "var(--dim)", letterSpacing: "0.14em", textTransform: "uppercase" } }, "\u25BE on confirm: state.update \u2192 diff queued \u2192 next commit"), /* @__PURE__ */ React.createElement("div", { className: "mod-foot", style: { margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }, /* @__PURE__ */ React.createElement("kbd", null, "esc"), " cancel \xB7 ", /* @__PURE__ */ React.createElement("kbd", null, "\u21B5"), " confirm when armed"), /* @__PURE__ */ React.createElement("div", { className: "r" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: onClose }, "cancel"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", disabled: !armed, onClick: () => {
      onConfirm && onConfirm();
      onClose();
    } }, armed ? "\u25B8 DESTROY" : "ARMED ON " + phrase))));
  }
  function ToolPreviewModal({ open, onClose, tool }) {
    if (!tool) return null;
    return /* @__PURE__ */ React.createElement(Modal2, { open, onClose, title: "/" + tool.slug, kind: "PREVIEW", status: "GLYPH \xB7 " + tool.glyph, size: "wide" }, /* @__PURE__ */ React.createElement("div", { className: "tool-preview" }, /* @__PURE__ */ React.createElement("div", { className: "tool-preview-left" }, /* @__PURE__ */ React.createElement("div", { className: "big-glyph" }, /* @__PURE__ */ React.createElement(window.Glyph, { name: tool.glyph })), /* @__PURE__ */ React.createElement("div", { className: "nm" }, tool.name), /* @__PURE__ */ React.createElement("span", { className: "tag " + tool.tag }, tool.tag), /* @__PURE__ */ React.createElement("div", { className: "dim tiny" }, "ID \xB7 ", tool.id)), /* @__PURE__ */ React.createElement("div", { className: "tool-preview-right" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dim tiny" }, "// DESCRIPTION"), /* @__PURE__ */ React.createElement("p", { style: { marginTop: 6, fontSize: 13.5, lineHeight: 1.6 } }, tool.desc)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dim tiny", style: { marginBottom: 6 } }, "// STACK"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, (tool.signals ?? tool.stack ?? []).map((s) => /* @__PURE__ */ React.createElement("span", { key: s, className: "stack-chip" }, s)))), /* @__PURE__ */ React.createElement("div", { className: "specs" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "k" }, "CALLS"), /* @__PURE__ */ React.createElement("div", { className: "v" }, tool.calls)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "k" }, "SINCE"), /* @__PURE__ */ React.createElement("div", { className: "v" }, tool.since)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "k" }, "SLUG"), /* @__PURE__ */ React.createElement("div", { className: "v", style: { fontSize: 12 } }, "/", tool.slug)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "k" }, "STATUS"), /* @__PURE__ */ React.createElement("div", { className: "v", style: { color: "var(--accent)" } }, tool.tag.toUpperCase()))))), /* @__PURE__ */ React.createElement("div", { className: "mod-foot", style: { margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }, "read-only \xB7 derived from ", /* @__PURE__ */ React.createElement("kbd", null, "tools[]")), /* @__PURE__ */ React.createElement("div", { className: "r" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: onClose }, "close"), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn-sm primary",
        title: "Opens the public home in a new tab (tool grid; no per-slug route).",
        onClick: () => {
          window.open("/", "_blank", "noopener,noreferrer");
          onClose && onClose();
        }
      },
      "\u25B8 open site \xB7 /",
      tool.slug
    ))));
  }
  function CommandPaletteModal({ open, onClose, commands, onRun }) {
    const [q, setQ] = useS_m("");
    const [idx, setIdx] = useS_m(0);
    useE_m(() => {
      if (open) {
        setQ("");
        setIdx(0);
      }
    }, [open]);
    const filtered = useM_m(() => {
      if (!q) return commands;
      const ql = q.toLowerCase();
      return commands.filter((c) => (c.name + " " + c.scope + " " + (c.alias || "")).toLowerCase().includes(ql));
    }, [q, commands]);
    useE_m(() => {
      setIdx(0);
    }, [q]);
    useE_m(() => {
      if (!open) return;
      const onKey = (e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIdx((i) => Math.min(filtered.length - 1, i + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setIdx((i) => Math.max(0, i - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          const c = filtered[idx];
          if (c) {
            onRun && onRun(c);
            onClose && onClose();
          }
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [open, filtered, idx, onRun, onClose]);
    return /* @__PURE__ */ React.createElement(Modal2, { open, onClose, title: "COMMAND PALETTE", kind: "CMDP", status: `${filtered.length}/${commands.length}` }, /* @__PURE__ */ React.createElement("div", { className: "cmdp" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "cmdp-input",
        autoFocus: true,
        placeholder: "run command, jump to section, find tool\u2026  e.g. `tools`, `new post`, `deploy`",
        value: q,
        onChange: (e) => setQ(e.target.value)
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "cmdp-list" }, filtered.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "cmdp-empty" }, "// no match \u2014 try a different word"), filtered.map((c, i) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: c.id,
        className: "cmdp-row" + (i === idx ? " on" : ""),
        onMouseEnter: () => setIdx(i),
        onClick: () => {
          onRun && onRun(c);
          onClose && onClose();
        }
      },
      /* @__PURE__ */ React.createElement("span", { className: "ic" }, c.glyph || "\u25B8"),
      /* @__PURE__ */ React.createElement("span", { className: "nm" }, c.name),
      /* @__PURE__ */ React.createElement("span", { className: "scope" }, c.scope),
      /* @__PURE__ */ React.createElement("span", { className: "kbd" }, c.shortcut || "")
    ))), /* @__PURE__ */ React.createElement("div", { className: "cmdp-foot" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("kbd", null, "\u2191"), /* @__PURE__ */ React.createElement("kbd", null, "\u2193"), " nav"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("kbd", null, "\u21B5"), " run"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("kbd", null, "esc"), " close"), /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto" } }, "\u25B8 ", filtered.length, " results"))));
  }
  function ShortcutsModal({ open, onClose }) {
    const groups = [
      { h: "GLOBAL", rows: [
        { l: "Open command palette", k: ["\u2318", "K"] },
        { l: "Toggle this overlay", k: ["?"] },
        { l: "Focus search", k: ["/"] },
        { l: "Blur / cancel", k: ["esc"] },
        { l: "Konami", k: ["\u2191\u2191\u2193\u2193\u2190\u2192\u2190\u2192BA"] }
      ] },
      { h: "TOOL GRID", rows: [
        { l: "Focus next", k: ["j"] },
        { l: "Focus prev", k: ["k"] },
        { l: "Open focused", k: ["\u21B5"] },
        { l: "Preview", k: ["space"] }
      ] },
      { h: "ADMIN", rows: [
        { l: "Commit changes", k: ["\u2318", "S"] },
        { l: "New post", k: ["\u2318", "N"] },
        { l: "New tool", k: ["\u2318", "\u21E7", "N"] },
        { l: "Goto site", k: ["g", "s"] },
        { l: "Goto tools", k: ["g", "t"] },
        { l: "Goto posts", k: ["g", "p"] }
      ] },
      { h: "POST EDITOR", rows: [
        { l: "Bold", k: ["\u2318", "B"] },
        { l: "Italic", k: ["\u2318", "I"] },
        { l: "Inline code", k: ["\u2318", "E"] },
        { l: "Save as draft", k: ["\u2318", "D"] },
        { l: "Publish", k: ["\u2318", "\u21B5"] }
      ] }
    ];
    return /* @__PURE__ */ React.createElement(Modal2, { open, onClose, title: "KEYBOARD", kind: "HELP", status: "ALL BINDINGS", size: "wide" }, /* @__PURE__ */ React.createElement("div", { className: "mod-head-block" }, /* @__PURE__ */ React.createElement("div", { className: "mod-icon" }, /* @__PURE__ */ React.createElement("span", { className: "b1" }), /* @__PURE__ */ React.createElement("span", { className: "b2" }), /* @__PURE__ */ React.createElement("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("rect", { x: "2", y: "6", width: "20", height: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "6", y1: "10", x2: "6", y2: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "10", y1: "10", x2: "10", y2: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "14", y1: "10", x2: "14", y2: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "18", y1: "10", x2: "18", y2: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "7", y1: "14", x2: "17", y2: "14" }))), /* @__PURE__ */ React.createElement("div", { className: "txt" }, /* @__PURE__ */ React.createElement("h2", null, "Drive everything from the keyboard."), /* @__PURE__ */ React.createElement("p", null, "Elvish is built for the \u2318K crowd. Press ", /* @__PURE__ */ React.createElement("kbd", null, "?"), " at any time to bring this card back."))), /* @__PURE__ */ React.createElement("div", { className: "shortcuts" }, groups.map((g) => /* @__PURE__ */ React.createElement("div", { key: g.h, className: "shortcut-section" }, /* @__PURE__ */ React.createElement("h4", null, "// ", g.h), g.rows.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "shortcut-row" }, /* @__PURE__ */ React.createElement("span", { className: "lab" }, r.l), /* @__PURE__ */ React.createElement("span", { className: "keys" }, r.k.map((k, j) => /* @__PURE__ */ React.createElement("kbd", { key: j }, k)))))))), /* @__PURE__ */ React.createElement("div", { className: "mod-foot", style: { margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }, "ELVISH shortcut sheet \xB7 v0.7.4"), /* @__PURE__ */ React.createElement("div", { className: "r" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", onClick: onClose }, "got it"))));
  }
  function AuthModal({ open, onClose, onAuth, emailHint }) {
    const [u, setU] = useS_m("");
    const [p, setP] = useS_m("");
    const [phase, setPhase] = useS_m("idle");
    const [errDetail, setErrDetail] = useS_m("");
    useE_m(() => {
      if (open) {
        setU(emailHint || "");
        setP("");
        setPhase("idle");
        setErrDetail("");
      }
    }, [open, emailHint]);
    const submit = async () => {
      const username = (emailHint || u || "").trim().toLowerCase();
      if (!username || !p) {
        setPhase("err");
        setErrDetail("username and password required");
        return;
      }
      setPhase("checking");
      setErrDetail("");
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password: p })
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPhase("err");
          setErrDetail(j.error || "login failed");
          return;
        }
        setPhase("ok");
        const disp = j.user && j.user.username || username;
        setTimeout(() => {
          onAuth && onAuth({ user: disp });
          onClose && onClose();
        }, 400);
      } catch (e) {
        setPhase("err");
        setErrDetail("network error");
      }
    };
    return /* @__PURE__ */ React.createElement(Modal2, { open, onClose, title: "RE-AUTHENTICATE", kind: "AUTH", status: phase.toUpperCase(), size: "narrow", dismissable: phase !== "checking" }, /* @__PURE__ */ React.createElement("div", { className: "mod-head-block" }, /* @__PURE__ */ React.createElement("div", { className: "mod-icon" }, /* @__PURE__ */ React.createElement("span", { className: "b1" }), /* @__PURE__ */ React.createElement("span", { className: "b2" }), /* @__PURE__ */ React.createElement("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("rect", { x: "5", y: "11", width: "14", height: "10" }), /* @__PURE__ */ React.createElement("path", { d: "M8 11 V7 a4 4 0 0 1 8 0 V11" }))), /* @__PURE__ */ React.createElement("div", { className: "txt" }, /* @__PURE__ */ React.createElement("h2", null, "Confirm your password."), /* @__PURE__ */ React.createElement("p", null, "Required before sensitive actions (OpenPGP key upload, content migration). Uses the same session cookie as login."))), /* @__PURE__ */ React.createElement("div", { className: "auth-form" }, /* @__PURE__ */ React.createElement("div", { className: "auth-line" }, /* @__PURE__ */ React.createElement("span", { className: "pmt" }, "elvish:~$"), " ", /* @__PURE__ */ React.createElement("span", { className: "dim" }, "login \u2014")), /* @__PURE__ */ React.createElement("div", { className: "auth-line" }, /* @__PURE__ */ React.createElement("span", { className: "dim", style: { width: 80 } }, "USER"), /* @__PURE__ */ React.createElement("input", { type: "text", autoFocus: !emailHint, readOnly: !!emailHint, value: emailHint || u, onChange: (e) => !emailHint && setU(e.target.value), placeholder: "username", disabled: phase === "checking", onKeyDown: (e) => e.key === "Enter" && submit() })), /* @__PURE__ */ React.createElement("div", { className: "auth-line" }, /* @__PURE__ */ React.createElement("span", { className: "dim", style: { width: 80 } }, "PASSWORD"), /* @__PURE__ */ React.createElement("input", { type: "password", autoFocus: !!emailHint, value: p, onChange: (e) => setP(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", disabled: phase === "checking", onKeyDown: (e) => e.key === "Enter" && submit() })), /* @__PURE__ */ React.createElement("div", { className: "auth-status " + (phase === "err" ? "err" : phase === "ok" ? "ok" : "") }, phase === "idle" && "\u25B8 awaiting input", phase === "checking" && "\u25B8 verifying\u2026 \u25CF", phase === "err" && "\u2715 " + (errDetail || "AUTH FAILED"), phase === "ok" && "\u2713 SESSION REFRESHED")), /* @__PURE__ */ React.createElement("div", { className: "mod-foot", style: { margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }, "HTTP-only cookie \xB7 Valkey-backed session"), /* @__PURE__ */ React.createElement("div", { className: "r" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: onClose, disabled: phase === "checking" }, "cancel"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", disabled: phase === "checking" || phase === "ok", onClick: submit }, "\u25B8 CONFIRM"))));
  }
  function RegisterModal({ open, onClose, onDone }) {
    const [username, setUsername] = useS_m("");
    const [password, setPassword] = useS_m("");
    const [name, setName] = useS_m("");
    const [phase, setPhase] = useS_m("idle");
    const [errDetail, setErrDetail] = useS_m("");
    useE_m(() => {
      if (open) {
        setUsername("");
        setPassword("");
        setName("");
        setPhase("idle");
        setErrDetail("");
      }
    }, [open]);
    const submit = async () => {
      const u = username.trim().toLowerCase();
      if (!u || password.length < 10) {
        setPhase("err");
        setErrDetail("username required \xB7 password min 10 chars");
        return;
      }
      setPhase("checking");
      setErrDetail("");
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: u, password, name: name.trim(), company: "" })
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPhase("err");
          setErrDetail(j.error || "register failed");
          return;
        }
        setPhase("ok");
        setTimeout(() => {
          onDone && onDone(j);
          onClose && onClose();
        }, 400);
      } catch (e) {
        setPhase("err");
        setErrDetail("network error");
      }
    };
    return /* @__PURE__ */ React.createElement(Modal2, { open, onClose, title: "REGISTER", kind: "AUTH", status: phase.toUpperCase(), size: "narrow", dismissable: phase !== "checking" }, /* @__PURE__ */ React.createElement("div", { className: "mod-head-block" }, /* @__PURE__ */ React.createElement("div", { className: "mod-icon ok" }, /* @__PURE__ */ React.createElement("span", { className: "b1" }), /* @__PURE__ */ React.createElement("span", { className: "b2" }), /* @__PURE__ */ React.createElement("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }), /* @__PURE__ */ React.createElement("circle", { cx: "9", cy: "7", r: "4" }), /* @__PURE__ */ React.createElement("line", { x1: "19", y1: "8", x2: "19", y2: "14" }), /* @__PURE__ */ React.createElement("line", { x1: "22", y1: "11", x2: "16", y2: "11" }))), /* @__PURE__ */ React.createElement("div", { className: "txt" }, /* @__PURE__ */ React.createElement("h2", null, "Create an account."), /* @__PURE__ */ React.createElement("p", null, "Password is hashed server-side (bcrypt). Session is stored in Valkey with an HTTP-only cookie."))), /* @__PURE__ */ React.createElement("div", { className: "auth-form" }, /* @__PURE__ */ React.createElement("div", { className: "auth-line" }, /* @__PURE__ */ React.createElement("span", { className: "dim", style: { width: 80 } }, "USER"), /* @__PURE__ */ React.createElement("input", { type: "text", autoFocus: true, value: username, onChange: (e) => setUsername(e.target.value), disabled: phase === "checking" })), /* @__PURE__ */ React.createElement("div", { className: "auth-line" }, /* @__PURE__ */ React.createElement("span", { className: "dim", style: { width: 80 } }, "DISPLAY"), /* @__PURE__ */ React.createElement("input", { type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "optional", disabled: phase === "checking" })), /* @__PURE__ */ React.createElement("div", { className: "auth-line" }, /* @__PURE__ */ React.createElement("span", { className: "dim", style: { width: 80 } }, "PASSWORD"), /* @__PURE__ */ React.createElement("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "min 10 characters", disabled: phase === "checking", onKeyDown: (e) => e.key === "Enter" && submit() })), /* @__PURE__ */ React.createElement("div", { className: "auth-status " + (phase === "err" ? "err" : phase === "ok" ? "ok" : "") }, phase === "idle" && "\u25B8 awaiting input", phase === "checking" && "\u25B8 creating account\u2026 \u25CF", phase === "err" && "\u2715 " + errDetail, phase === "ok" && "\u2713 REGISTERED \xB7 logged in")), /* @__PURE__ */ React.createElement("div", { className: "mod-foot", style: { margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }, "requires MongoDB + Valkey"), /* @__PURE__ */ React.createElement("div", { className: "r" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: onClose, disabled: phase === "checking" }, "cancel"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", disabled: phase === "checking" || phase === "ok", onClick: submit }, "\u25B8 REGISTER"))));
  }
  function LoginModal({ open, onClose, onDone }) {
    const [username, setUsername] = useS_m("");
    const [password, setPassword] = useS_m("");
    const [phase, setPhase] = useS_m("idle");
    const [errDetail, setErrDetail] = useS_m("");
    useE_m(() => {
      if (open) {
        setUsername("");
        setPassword("");
        setPhase("idle");
        setErrDetail("");
      }
    }, [open]);
    const submit = async () => {
      const u = username.trim().toLowerCase();
      if (!u || !password) {
        setPhase("err");
        setErrDetail("username and password required");
        return;
      }
      setPhase("checking");
      setErrDetail("");
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: u, password })
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPhase("err");
          setErrDetail(j.error || "login failed");
          return;
        }
        if (j && j.mfa_required) {
          window.location.href = "/login?next=" + encodeURIComponent("/admin/");
          return;
        }
        setPhase("ok");
        setTimeout(() => {
          onDone && onDone(j);
          onClose && onClose();
        }, 400);
      } catch (e) {
        setPhase("err");
        setErrDetail("network error");
      }
    };
    return /* @__PURE__ */ React.createElement(Modal2, { open, onClose, title: "LOGIN", kind: "AUTH", status: phase.toUpperCase(), size: "narrow", dismissable: phase !== "checking" }, /* @__PURE__ */ React.createElement("div", { className: "mod-head-block" }, /* @__PURE__ */ React.createElement("div", { className: "mod-icon" }, /* @__PURE__ */ React.createElement("span", { className: "b1" }), /* @__PURE__ */ React.createElement("span", { className: "b2" }), /* @__PURE__ */ React.createElement("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("rect", { x: "5", y: "11", width: "14", height: "10" }), /* @__PURE__ */ React.createElement("path", { d: "M8 11 V7 a4 4 0 0 1 8 0 V11" }))), /* @__PURE__ */ React.createElement("div", { className: "txt" }, /* @__PURE__ */ React.createElement("h2", null, "Sign in"), /* @__PURE__ */ React.createElement("p", null, "Session cookie is set for this origin only (", /* @__PURE__ */ React.createElement("code", null, "/api/*"), ")."))), /* @__PURE__ */ React.createElement("div", { className: "auth-form" }, /* @__PURE__ */ React.createElement("div", { className: "auth-line" }, /* @__PURE__ */ React.createElement("span", { className: "dim", style: { width: 80 } }, "USER"), /* @__PURE__ */ React.createElement("input", { type: "text", autoFocus: true, value: username, onChange: (e) => setUsername(e.target.value), disabled: phase === "checking" })), /* @__PURE__ */ React.createElement("div", { className: "auth-line" }, /* @__PURE__ */ React.createElement("span", { className: "dim", style: { width: 80 } }, "PASSWORD"), /* @__PURE__ */ React.createElement("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), disabled: phase === "checking", onKeyDown: (e) => e.key === "Enter" && submit() })), /* @__PURE__ */ React.createElement("div", { className: "auth-status " + (phase === "err" ? "err" : phase === "ok" ? "ok" : "") }, phase === "idle" && "\u25B8 awaiting input", phase === "checking" && "\u25B8 verifying\u2026 \u25CF", phase === "err" && "\u2715 " + errDetail, phase === "ok" && "\u2713 LOGGED IN")), /* @__PURE__ */ React.createElement("div", { className: "mod-foot", style: { margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }, "MongoDB + Valkey required"), /* @__PURE__ */ React.createElement("div", { className: "r" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: onClose, disabled: phase === "checking" }, "cancel"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", disabled: phase === "checking" || phase === "ok", onClick: submit }, "\u25B8 LOGIN"))));
  }
  function PublishModal({ open, onClose, onCommitLocal, onSaveMongo, persistHome, dirty, diff, initialNotes = "" }) {
    const [msg, setMsg] = useS_m("");
    const [signed, setSigned] = useS_m(true);
    const [busy, setBusy] = useS_m(false);
    const [err, setErr] = useS_m("");
    useE_m(() => {
      if (open) {
        setMsg(typeof initialNotes === "string" ? initialNotes : "");
        setSigned(true);
        setBusy(false);
        setErr("");
      }
    }, [open, initialNotes]);
    const counts = useM_m(() => {
      const c = { add: 0, mod: 0, del: 0 };
      (diff || []).forEach((d) => {
        c[d.kind] = (c[d.kind] || 0) + 1;
      });
      return c;
    }, [diff]);
    return /* @__PURE__ */ React.createElement(Modal2, { open, onClose, title: "PUBLISH \xB7 REVIEW", kind: "PUBLISH", status: `\u0394 ${(diff || []).length} CHANGES`, size: "wide" }, /* @__PURE__ */ React.createElement("div", { className: "mod-head-block" }, /* @__PURE__ */ React.createElement("div", { className: "mod-icon ok" }, /* @__PURE__ */ React.createElement("span", { className: "b1" }), /* @__PURE__ */ React.createElement("span", { className: "b2" }), /* @__PURE__ */ React.createElement("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("polyline", { points: "4,12 10,18 20,6" }))), /* @__PURE__ */ React.createElement("div", { className: "txt" }, /* @__PURE__ */ React.createElement("h2", null, "Review changes before saving."), /* @__PURE__ */ React.createElement("p", null, persistHome ? /* @__PURE__ */ React.createElement(React.Fragment, null, "Writes the reviewed bundle to ", /* @__PURE__ */ React.createElement("code", null, "site_config.home_json"), " via ", /* @__PURE__ */ React.createElement("code", null, "PUT /api/admin/site/home"), ". The public site picks it up after the content cache TTL.") : /* @__PURE__ */ React.createElement(React.Fragment, null, "This server is running without a MongoDB site store (", /* @__PURE__ */ React.createElement("code", null, "ELVISH_ALLOW_EMPTY_DB"), " or missing ", /* @__PURE__ */ React.createElement("code", null, "MONGODB_URI"), "). Home JSON cannot be saved from the panel \u2014 edit ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "content/home.json"), " on disk instead.")))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: "1px solid var(--line)", marginBottom: 16 } }, [
      { k: "ADDED", v: counts.add || 0, c: "var(--ok)" },
      { k: "MODIFIED", v: counts.mod || 0, c: "var(--accent)" },
      { k: "REMOVED", v: counts.del || 0, c: "var(--accent)" },
      { k: "TOTAL", v: (diff || []).length, c: "var(--fg)" }
    ].map((c, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { padding: 12, borderRight: i < 3 ? "1px solid var(--line)" : 0 } }, /* @__PURE__ */ React.createElement("div", { className: "dim tiny" }, c.k), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 700, marginTop: 4, color: c.c } }, c.v)))), /* @__PURE__ */ React.createElement("div", { className: "dim tiny", style: { marginBottom: 8 } }, "// CHANGES"), /* @__PURE__ */ React.createElement("div", { className: "diff-list" }, (diff || []).map((d, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "diff-row " + d.kind }, /* @__PURE__ */ React.createElement("span", { className: "sym" }, d.kind === "add" ? "+" : d.kind === "del" ? "\u2212" : "~"), /* @__PURE__ */ React.createElement("span", { className: "scope" }, d.scope), /* @__PURE__ */ React.createElement("span", null, d.path))), (diff || []).length === 0 && /* @__PURE__ */ React.createElement("div", { className: "diff-row" }, /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("span", { className: "dim" }, "// no changes"), /* @__PURE__ */ React.createElement("span", null))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 18, display: "flex", flexDirection: "column", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { className: "dim tiny" }, "// PUBLISH NOTES"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "txa",
        placeholder: "content: update tool descriptions and v0.7.4 release notes",
        value: msg,
        onChange: (e) => setMsg(e.target.value)
      }
    ), /* @__PURE__ */ React.createElement("label", { className: "tgl" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: signed, onChange: (e) => setSigned(e.target.checked) }), /* @__PURE__ */ React.createElement("span", { className: "tgl-track" }), /* @__PURE__ */ React.createElement("span", null, "Require OpenPGP-detached signature on log posts (API)"))), err && /* @__PURE__ */ React.createElement("div", { className: "auth-status err", style: { marginTop: 12 } }, err), /* @__PURE__ */ React.createElement("div", { className: "mod-foot", style: { margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }, persistHome ? /* @__PURE__ */ React.createElement("code", null, "/api/admin/site/home") : /* @__PURE__ */ React.createElement("span", { className: "dim" }, "no Mongo site store")), /* @__PURE__ */ React.createElement("div", { className: "r" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: onClose, disabled: busy }, "cancel"), persistHome && typeof onSaveMongo === "function" && /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn-sm primary",
        disabled: busy || !dirty || (diff || []).length === 0,
        onClick: async () => {
          setErr("");
          setBusy(true);
          try {
            await onSaveMongo({ msg: msg.trim() || "site update", signed });
            onCommitLocal && onCommitLocal({ msg: msg.trim() || "site update", signed });
            onClose && onClose();
          } catch (e) {
            setErr(String(e.message || e));
          } finally {
            setBusy(false);
          }
        }
      },
      busy ? "\u2026" : "save to site"
    ))));
  }
  function SigningKeyModal({ open, onClose, onUpload }) {
    const [file, setFile] = useS_m(null);
    const [fp, setFp] = useS_m("");
    const [armored, setArmored] = useS_m("");
    const [phase, setPhase] = useS_m("idle");
    const [errDetail, setErrDetail] = useS_m("");
    useE_m(() => {
      if (open) {
        setFile(null);
        setFp("");
        setArmored("");
        setPhase("idle");
        setErrDetail("");
      }
    }, [open]);
    const onFile = (f) => {
      if (!f) return;
      setFile(f);
      setFp("");
      setArmored("");
      setErrDetail("");
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || "");
        if (/BEGIN PGP PRIVATE KEY/i.test(text) || /BEGIN PRIVATE KEY/i.test(text)) {
          setErrDetail("refused: private key material");
          setFile(null);
          return;
        }
        setArmored(text);
        const m = text.match(/([A-F0-9]{16})\s*$/im);
        setFp(m ? m[1].toUpperCase() : "(server will fingerprint)");
      };
      reader.readAsText(f);
    };
    const install = async () => {
      if (!armored.trim()) return;
      setPhase("checking");
      setErrDetail("");
      if (onUpload) {
        onUpload({ file, armored, fingerprint: fp });
        setPhase("ok");
        setTimeout(() => onClose && onClose(), 300);
        return;
      }
      try {
        const res = await fetch("/api/pgp/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ armored: armored.trim(), label: file ? file.name : "" })
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPhase("idle");
          setErrDetail(j.error || "upload failed");
          return;
        }
        setPhase("ok");
        setFp(j.fingerprint16 || fp);
        setTimeout(() => onClose && onClose(), 500);
      } catch (e) {
        setPhase("idle");
        setErrDetail("network error");
      }
    };
    return /* @__PURE__ */ React.createElement(Modal2, { open, onClose, title: "UPLOAD \xB7 OpenPGP PUBLIC KEY", kind: "KEY", status: phase === "checking" ? "UPLOAD" : phase.toUpperCase() }, /* @__PURE__ */ React.createElement("div", { className: "mod-head-block" }, /* @__PURE__ */ React.createElement("div", { className: "mod-icon warn" }, /* @__PURE__ */ React.createElement("span", { className: "b1" }), /* @__PURE__ */ React.createElement("span", { className: "b2" }), /* @__PURE__ */ React.createElement("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "14", r: "4" }), /* @__PURE__ */ React.createElement("line", { x1: "11", y1: "14", x2: "22", y2: "14" }), /* @__PURE__ */ React.createElement("line", { x1: "18", y1: "14", x2: "18", y2: "18" }), /* @__PURE__ */ React.createElement("line", { x1: "22", y1: "14", x2: "22", y2: "18" }))), /* @__PURE__ */ React.createElement("div", { className: "txt" }, /* @__PURE__ */ React.createElement("h2", null, "Armored public key only."), /* @__PURE__ */ React.createElement("p", null, "Used to verify detached signatures on log posts. Stored in MongoDB; served under ", /* @__PURE__ */ React.createElement("code", null, "/pgp/key/<id>.asc"), " and listed in ", /* @__PURE__ */ React.createElement("code", null, "/pgp/keys.json"), "."))), /* @__PURE__ */ React.createElement(
      "div",
      {
        style: { border: "1px dashed var(--accent)", padding: 24, textAlign: "center", background: "rgba(255,87,34,0.03)" },
        onDragOver: (e) => e.preventDefault(),
        onDrop: (e) => {
          e.preventDefault();
          onFile(e.dataTransfer.files[0]);
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, letterSpacing: "0.2em", color: "var(--accent)", marginBottom: 8 } }, "\u25B8 DROP .asc / .txt HERE"),
      /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 11 } }, "or"),
      /* @__PURE__ */ React.createElement("label", { className: "btn-sm primary", style: { display: "inline-block", marginTop: 10, cursor: "pointer" } }, "choose file", /* @__PURE__ */ React.createElement("input", { type: "file", accept: ".asc,.txt,.pub", style: { display: "none" }, onChange: (e) => onFile(e.target.files[0]) })),
      file && /* @__PURE__ */ React.createElement("div", { className: "dim", style: { marginTop: 12, fontSize: 11 } }, file.name, " \xB7 ", file.size, "B")
    ), fp && /* @__PURE__ */ React.createElement("div", { className: "fingerprint", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "lbl" }, "// FINGERPRINT"), fp), errDetail && /* @__PURE__ */ React.createElement("div", { className: "auth-status err", style: { marginTop: 12 } }, errDetail), /* @__PURE__ */ React.createElement("div", { className: "readonly-note", style: { marginTop: 14 } }, "Logged-in session required. Private OpenPGP blocks are rejected."), /* @__PURE__ */ React.createElement("div", { className: "mod-foot", style: { margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }, "also linked from ", /* @__PURE__ */ React.createElement("code", null, "/signing.pub"), " when no minisign key on disk"), /* @__PURE__ */ React.createElement("div", { className: "r" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: onClose }, "cancel"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", disabled: !armored.trim() || phase === "checking", onClick: install }, "\u25B8 UPLOAD KEY"))));
  }
  function AboutModal({ open, onClose, site }) {
    return /* @__PURE__ */ React.createElement(Modal2, { open, onClose, title: "ABOUT \xB7 ELVISH", kind: "META", status: "v0.7.4-NIGHTLY", size: "narrow" }, /* @__PURE__ */ React.createElement("div", { className: "about-block" }, /* @__PURE__ */ React.createElement("div", { className: "ascii" }, `\u2588\u2580\u2584 \u2588\u2580\u2580 \u2588\u2580\u2588 \u2588\u2580\u2588 \u2584\u2580\u2588 \u2588\u2580\u2588
\u2588\u2580  \u2588\u2588\u2584 \u2588\u2584\u2588 \u2588\u2580\u2580 \u2588\u2580\u2588 \u2588\u2580\u2584
     V A N T A`), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12, color: "var(--dim)", lineHeight: 1.6 } }, "End-to-end encrypted mail with browser-held keys, OpenPGP interoperability, and zero-access storage. No ads. No tracking. AGPL-3.0."), /* @__PURE__ */ React.createElement("dl", null, /* @__PURE__ */ React.createElement("dt", null, "Build"), /* @__PURE__ */ React.createElement("dd", null, site?.build_label || "nightly", " \xB7 ", site?.build_date || "26.04.28"), /* @__PURE__ */ React.createElement("dt", null, "Hash"), /* @__PURE__ */ React.createElement("dd", { className: "accent mono" }, site?.hash_short || "d4f3a2c1"), /* @__PURE__ */ React.createElement("dt", null, "License"), /* @__PURE__ */ React.createElement("dd", null, site?.license_line || "AGPL-3.0"), /* @__PURE__ */ React.createElement("dt", null, "Runtime"), /* @__PURE__ */ React.createElement("dd", null, "edge \xB7 webassembly"), /* @__PURE__ */ React.createElement("dt", null, "Modes"), /* @__PURE__ */ React.createElement("dd", null, "OpenPGP \xB7 Protected link \xB7 Relay"), /* @__PURE__ */ React.createElement("dt", null, "Source"), /* @__PURE__ */ React.createElement("dd", { className: "accent" }, "elvishserver \xB7 MongoDB \xB7 Valkey"))), /* @__PURE__ */ React.createElement("div", { className: "mod-foot", style: { margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }, "// END OF FILE"), /* @__PURE__ */ React.createElement("div", { className: "r" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", onClick: onClose }, "close"))));
  }
  function NotifyModal({ open, onClose, kind = "ok", title, body }) {
    const iconKind = kind === "warn" ? "warn" : kind === "err" ? "warn" : "ok";
    return /* @__PURE__ */ React.createElement(Modal2, { open, onClose, title: kind.toUpperCase(), kind: "NOTIFY", status: "", size: "narrow" }, /* @__PURE__ */ React.createElement("div", { className: "mod-head-block" }, /* @__PURE__ */ React.createElement("div", { className: "mod-icon " + iconKind }, /* @__PURE__ */ React.createElement("span", { className: "b1" }), /* @__PURE__ */ React.createElement("span", { className: "b2" }), kind === "ok" && /* @__PURE__ */ React.createElement("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("polyline", { points: "4,12 10,18 20,6" })), kind === "warn" && /* @__PURE__ */ React.createElement("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("path", { d: "M12 3 L22 20 L2 20 Z" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "10", x2: "12", y2: "15" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "17.5", r: "0.6", fill: "currentColor" })), kind === "err" && /* @__PURE__ */ React.createElement("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" }), /* @__PURE__ */ React.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }))), /* @__PURE__ */ React.createElement("div", { className: "txt" }, /* @__PURE__ */ React.createElement("h2", null, title), /* @__PURE__ */ React.createElement("p", null, body))), /* @__PURE__ */ React.createElement("div", { className: "mod-foot", style: { margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }), /* @__PURE__ */ React.createElement("div", { className: "r" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", onClick: onClose }, "ok"))));
  }
  var useS_m, useE_m, useM_m, useR_m;
  var init_modals = __esm({
    "../static/admin/modals.jsx"() {
      ({ useState: useS_m, useEffect: useE_m, useMemo: useM_m, useRef: useR_m } = React);
      window.VModals = { Modal: Modal2, ConfirmDestroyModal, ToolPreviewModal, CommandPaletteModal, ShortcutsModal, AuthModal, RegisterModal, LoginModal, PublishModal, SigningKeyModal, AboutModal, NotifyModal };
    }
  });

  // ../static/admin/admin-primitives.jsx
  function FRow({ label, hint, req, children }) {
    return /* @__PURE__ */ React.createElement("div", { className: "f-row" }, /* @__PURE__ */ React.createElement("div", { className: "f-label" }, /* @__PURE__ */ React.createElement("div", { className: "f-label-line" }, label, req && /* @__PURE__ */ React.createElement("span", { className: "req" }, "*")), hint && /* @__PURE__ */ React.createElement("div", { className: "f-hint" }, hint)), /* @__PURE__ */ React.createElement("div", { className: "f-ctrl" }, children));
  }
  function Input({ value, onChange, placeholder, type = "text", validate }) {
    const v = validate ? validate(value) : null;
    return /* @__PURE__ */ React.createElement("div", { className: v ? "elvish-input-with-validate" : "inp-with-validate" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp elvish-input",
        type,
        value: value || "",
        placeholder,
        onChange: (e) => onChange(e.target.value)
      }
    ), v && /* @__PURE__ */ React.createElement("span", { className: "elvish-validate-badge", style: { color: v.ok ? "var(--ok)" : "var(--accent)" } }, v.ok ? "\u2713 OK" : "\u2715 " + v.msg));
  }
  function Textarea({ value, onChange, placeholder, tall }) {
    return /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "txa elvish-textarea" + (tall ? " tall" : ""),
        value: value || "",
        placeholder,
        onChange: (e) => onChange(e.target.value)
      }
    );
  }
  function Select({ value, onChange, options }) {
    return /* @__PURE__ */ React.createElement("select", { className: "sel elvish-select", value: value || "", onChange: (e) => onChange(e.target.value) }, options.map((o) => /* @__PURE__ */ React.createElement("option", { key: o.value || o, value: o.value || o }, o.label || o)));
  }
  function Toggle({ checked, onChange, label }) {
    return /* @__PURE__ */ React.createElement("label", { className: "tgl elvish-toggle" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: !!checked, onChange: (e) => onChange(e.target.checked) }), /* @__PURE__ */ React.createElement("span", { className: "tgl-track elvish-toggle-track" }), label && /* @__PURE__ */ React.createElement("span", null, label));
  }
  function Seg({ value, onChange, options }) {
    return /* @__PURE__ */ React.createElement("div", { className: "seg elvish-seg" }, options.map((o) => /* @__PURE__ */ React.createElement("button", { key: o.value, type: "button", className: value === o.value ? "on" : "", onClick: () => onChange(o.value) }, o.label)));
  }
  function Chips({ values, onChange, suggestions }) {
    const [draft, setDraft] = useS_a("");
    const add = () => {
      const v = draft.trim();
      if (!v) return;
      if (!values.includes(v)) onChange([...values, v]);
      setDraft("");
    };
    return /* @__PURE__ */ React.createElement("div", { className: "chips elvish-chips" }, values.map((v, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "chip elvish-chip" }, v, /* @__PURE__ */ React.createElement("span", { className: "x", onClick: () => onChange(values.filter((_, j) => j !== i)) }, "\xD7"))), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp elvish-input",
        style: { width: 140 },
        value: draft,
        placeholder: "add\u2026",
        onChange: (e) => setDraft(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }
      }
    ), suggestions && suggestions.filter((s) => !values.includes(s)).map((s) => /* @__PURE__ */ React.createElement("span", { key: s, className: "chip-add elvish-chip-add", onClick: () => onChange([...values, s]) }, "+ ", s)));
  }
  function Repeater({ items, onChange, render, addLabel, newItem }) {
    const move = (i, dir) => {
      const j = i + dir;
      if (j < 0 || j >= items.length) return;
      const copy = items.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      onChange(copy);
    };
    const remove = (i) => onChange(items.filter((_, j) => j !== i));
    const update = (i, next) => onChange(items.map((it, j) => j === i ? next : it));
    return /* @__PURE__ */ React.createElement("div", { className: "rep elvish-repeater" }, items.map((it, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "rep-row elvish-repeater-row" }, /* @__PURE__ */ React.createElement("div", { className: "rep-handle elvish-repeater-handle", title: "reorder" }, "\u22EE\u22EE"), /* @__PURE__ */ React.createElement("div", { className: "rep-body elvish-repeater-body" }, render(it, i, (next) => update(i, next))), /* @__PURE__ */ React.createElement("div", { className: "rep-actions elvish-repeater-actions" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm elvish-btn elvish-btn-sm elvish-btn-ghost", onClick: () => move(i, -1), disabled: i === 0 }, "\u2191"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm elvish-btn elvish-btn-sm elvish-btn-ghost", onClick: () => move(i, 1), disabled: i === items.length - 1 }, "\u2193"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm danger elvish-btn elvish-btn-sm elvish-btn-danger", onClick: () => remove(i) }, "\xD7")))), /* @__PURE__ */ React.createElement("div", { className: "rep-add elvish-repeater-add", onClick: () => onChange([...items, newItem()]) }, "+ ", addLabel || "add"));
  }
  function Card({ title, right, children }) {
    return /* @__PURE__ */ React.createElement("div", { className: "adm-card elvish-card" }, /* @__PURE__ */ React.createElement("div", { className: "adm-card-h elvish-card-header" }, /* @__PURE__ */ React.createElement("div", { className: "l elvish-card-header-text" }, /* @__PURE__ */ React.createElement("h3", { className: "elvish-card-title" }, title)), /* @__PURE__ */ React.createElement("div", { className: "r elvish-card-actions" }, right)), /* @__PURE__ */ React.createElement("div", { className: "adm-card-b elvish-card-body" }, children));
  }
  function H({ num, title, sub }) {
    const t = title && String(title).trim();
    const heading = [num, t].filter(Boolean).join(" \xB7 ");
    const desc = sub && String(sub).trim();
    return /* @__PURE__ */ React.createElement(SectionHeader, { title: heading, description: desc || void 0 });
  }
  var useS_a, useE_a, useR_a, useM_a, useC_a;
  var init_admin_primitives = __esm({
    "../static/admin/admin-primitives.jsx"() {
      init_primitives();
      init_icons();
      ({ useState: useS_a, useEffect: useE_a, useRef: useR_a, useMemo: useM_a, useCallback: useC_a } = React);
      window.adm = {
        mdRender,
        FRow,
        Input,
        Textarea,
        Select,
        Toggle,
        Seg,
        Chips,
        Repeater,
        Card,
        H,
        Button,
        Alert,
        Badge,
        EmptyState,
        Modal,
        ConfirmModal,
        SectionHeader,
        FormRow,
        Icon,
        Icons
      };
    }
  });

  // ../static/admin/admin-state.jsx
  function mergeAdminStateWithDefaults(saved, defaults) {
    if (Array.isArray(defaults)) {
      return Array.isArray(saved) ? saved : defaults.slice();
    }
    if (defaults !== null && typeof defaults === "object") {
      var src = saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
      var merged = {};
      for (var k in defaults) {
        if (!Object.prototype.hasOwnProperty.call(defaults, k)) continue;
        merged[k] = mergeAdminStateWithDefaults(src[k], defaults[k]);
      }
      for (var k2 in src) {
        if (!Object.prototype.hasOwnProperty.call(src, k2)) continue;
        if (!Object.prototype.hasOwnProperty.call(merged, k2)) merged[k2] = src[k2];
      }
      return merged;
    }
    return saved !== void 0 ? saved : defaults;
  }
  var ADMIN_STATE_INITIAL;
  var init_admin_state = __esm({
    "../static/admin/admin-state.jsx"() {
      ADMIN_STATE_INITIAL = {
        site: {
          title: "ELVISH \u2014 end-to-end encrypted mail",
          description: "End-to-end encrypted mail with browser-held keys, OpenPGP interoperability, and zero-access storage.",
          base_url: "https://elvish.example",
          blog_signing: { public_key_url: "/signing.pub" },
          version: "v0.8.0",
          build_label: "NIGHTLY",
          license_line: "AGPL-3.0",
          hash_short: "e2ee01f4",
          build_date: "26.05.10"
        },
        tweak_defaults: {
          theme: "dark",
          font: "ibm",
          crosshair: false,
          scanlines: true,
          show_grid: true
        },
        support: {
          default_email: "",
          contacts: []
        },
        nav: [
          { id: "home", href: "/", label: "HOME" },
          { id: "mail", href: "/mail", label: "MAIL" },
          { id: "manifesto", href: "/manifesto/", label: "SECURITY" }
        ],
        footer: {
          tagline: "Encrypted email.\nYour keys, your messages.\nZero-access architecture.\n",
          pages: [
            { href: "/", label: "Home" },
            { href: "/mail", label: "Mail" },
            { href: "/manifesto/", label: "Security" },
            { href: "/login", label: "Log in" },
            { href: "/register", label: "Register" },
            { href: "/admin/", label: "Panel" },
            { href: "#", label: "Source" }
          ],
          protocol: [
            "License \u2014 AGPL-3.0",
            "Hash \u2014 e2ee01f4",
            "Build \u2014 nightly \xB7 26.05.10",
            "Encryption \u2014 OpenPGP"
          ],
          ascii_block: "\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502   \u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588   \u2502\n\u2502   \u2588\u2588 \u2588  \u2588 \u2588\u2588   \u2502\n\u2502   \u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588   \u2502\n\u2502        \u2588\u2588      \u2502\n\u2502   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588     \u2502\n\u2502   \u2588\u2588   \u2588\u2588      \u2502\n\u2502   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588     \u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
          ascii_scale_to_fit: false
        },
        hero: {
          section_index: "00",
          section_title: "E2EE MAIL",
          lines: [
            { parts: [{ stripe: true, text: "END-TO-END" }, { stripe: false, text: " ENCRYPTED" }] },
            { parts: [{ stripe: false, text: "MAIL." }] },
            { parts: [{ stripe: true, text: "ZERO-ACCESS" }, { stripe: false, text: " DELIVERY." }] }
          ],
          lede_markdown: "**ELVISH** is an end-to-end encrypted mail platform. Messages are encrypted in your browser before storage or delivery. Use OpenPGP inboxes, protected links, or relay mode without giving the server your plaintext. // zero-access by design",
          stats: [
            { key: "ENCRYPTION", value: "OPENPGP" },
            { key: "KEYS", value: "BROWSER-HELD" },
            { key: "DELIVERY", value: "SMTP + LINK" },
            { key: "STORAGE", value: "CIPHERTEXT" }
          ],
          load_bar_heights: [24, 32, 28, 40, 36, 52, 46, 38, 44, 50, 42, 30, 36, 48, 40],
          sys_rows: [
            { label: "SERVER", value: "CIPHERTEXT ONLY", status: "ok" },
            { label: "PRIVATE KEYS", value: "LOCAL ONLY", status: "ok" },
            { label: "SEARCH", value: "LOCAL BODY INDEX", status: "ok" },
            { label: "PORTABILITY", value: "OPENPGP EXPORT", status: "dim" }
          ],
          keyboard_rows: [
            { label: "FOCUS NEXT", key: "j" },
            { label: "FOCUS PREV", key: "k" },
            { label: "SEARCH", key: "/" },
            { label: "OPEN", key: "\u21B5" }
          ],
          tools_section: { section_index: "01", section_title: "DELIVERY", hint: "PGP DIRECT \xB7 PROTECTED LINKS \xB7 PLAINTEXT RELAY" }
        },
        terminal: {
          lines: [
            { kind: "sys", text: "elvish:~$ ./boot --mail" },
            { kind: "log", text: "[ OK ] mounting local key vault" },
            { kind: "log", text: "[ OK ] resolving mail + delivery modules" },
            { kind: "log", text: "[ OK ] telemetry default: off. anonymous export only." },
            { kind: "log", text: "[ OK ] storage mode: ciphertext at rest" },
            { kind: "log", text: "[ OK ] handshake: ELVISH/0.8.0-nightly" },
            { kind: "blank", text: "" },
            { kind: "head", text: "// END-TO-END MAIL. BROWSER KEYS. CIPHERTEXT AT REST." },
            { kind: "head", text: "// OPENPGP INBOXES. PROTECTED LINKS. PLAINTEXT RELAY." },
            { kind: "blank", text: "" },
            { kind: "prompt", text: "elvish:~$ open /mail" }
          ]
        },
        tools: [
          { id: "01", slug: "shroud", name: "SHROUD", tag: "live", desc: "Strip metadata from any file in your browser. Nothing uploaded.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "shroud", calls: "\u2014", since: "23.04", open_href: "", monitor: null },
          { id: "02", slug: "tessera", name: "TESSERA", tag: "live", desc: "Lossless image dicer. Slice, tile, atlas. Drag-drop, never leaves the tab.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "tessera", calls: "\u2014", since: "23.07", open_href: "", monitor: null },
          { id: "03", slug: "cipher-0", name: "CIPHER-0", tag: "live", desc: "Symmetric & PGP toolbox. Keys live in IndexedDB only.", signals: ["BROWSER-ONLY", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "cipher", calls: "\u2014", since: "22.11", open_href: "", monitor: null },
          { id: "04", slug: "ledger", name: "LEDGER", tag: "beta", desc: "Plaintext-first ledger. Double-entry, encrypted, exports CSV/Beancount.", signals: ["BROWSER-ONLY", "OFFLINE-CAPABLE", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "ledger", calls: "\u2014", since: "25.02", open_href: "", monitor: null },
          { id: "05", slug: "vector", name: "VECTOR", tag: "live", desc: "Tiny SVG editor for technical diagrams. Pen, grid, ortho-snap.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "vector", calls: "\u2014", since: "24.01", open_href: "", monitor: null },
          { id: "06", slug: "loom", name: "LOOM", tag: "live", desc: "Markdown to print-ready PDF. Footnotes, kerning, drop caps, no fluff.", signals: ["BROWSER-ONLY", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "loom", calls: "\u2014", since: "24.06", open_href: "", monitor: null },
          { id: "07", slug: "hex-9", name: "HEX-9", tag: "live", desc: "Hex/binary editor with templates. Inspect headers without leaving the page.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "hex", calls: "\u2014", since: "24.09", open_href: "", monitor: null },
          { id: "08", slug: "sigil", name: "SIGIL", tag: "beta", desc: "Generative QR with logo embed and error correction tuning.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "sigil", calls: "\u2014", since: "25.04", open_href: "", monitor: null },
          { id: "09", slug: "drift", name: "DRIFT", tag: "wip", desc: "Local-first feed reader. RSS, Atom, JSON-feed. Sync via your own bucket.", signals: ["LOCAL-FIRST", "OPTIONAL-SYNC", "OFFLINE-CAPABLE", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "drift", calls: "\u2014", since: "26.02", open_href: "", monitor: null },
          { id: "10", slug: "obscura", name: "OBSCURA", tag: "live", desc: "Image redactor with reversible-proof crops. Pixel hashes printed beside.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "obscura", calls: "\u2014", since: "23.12", open_href: "", monitor: null },
          { id: "11", slug: "monolith", name: "MONOLITH", tag: "beta", desc: "Bundle a whole webpage into a single offline-capable HTML file.", signals: ["BROWSER-ONLY", "OFFLINE-CAPABLE", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "monolith", calls: "\u2014", since: "25.06", open_href: "", monitor: null },
          { id: "12", slug: "echo", name: "ECHO", tag: "wip", desc: "Voice memo transcriber. Whisper-tiny in browser, no upload.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "echo", calls: "\u2014", since: "26.04", open_href: "", monitor: null }
        ],
        log_page: {
          section_index: "LOG",
          section_title: "CHRONOLOGY",
          headlines: [
            { parts: [{ stripe: false, text: "THE " }, { stripe: true, text: "LOG" }] },
            { parts: [{ stripe: false, text: "IS THE PRODUCT" }] },
            { parts: [{ stripe: false, text: "CHANGELOG." }] }
          ],
          intro_markdown: "Releases, audit notes, the occasional essay. Nothing scheduled. No newsletter. Bookmark or scrape; both are blessed.",
          tagline_accent: "// reverse-chronological. tail -f the world.",
          filters: [
            { id: "all", label: "ALL" },
            { id: "release", label: "RELEASE" },
            { id: "essay", label: "ESSAY" },
            { id: "security", label: "SECURITY" },
            { id: "notes", label: "NOTES" },
            { id: "infra", label: "INFRA" }
          ],
          ticker: ["END OF LOG", "NO COMMENTS", "NO TRACKERS", "NO PAYWALL", "SUBSCRIBE VIA RSS OR DON'T", "I'M NOT KEEPING SCORE"]
        },
        ticker_home: ["NO ACCOUNTS", "TELEMETRY OFF BY DEFAULT", "NO ADS", "NO FOMO", "OPEN SOURCE", "OFFLINE-CAPABLE", "EDGE-EXECUTED", "PUBLIC DOMAIN INTENT", "SIGNED BY ANON", "BUILD \u2014 NIGHTLY", "HASH \u2014 D4F3A2C1", "ELVISH \u2014 V0.7.4"],
        posts: [
          { date: "26.05.03", time: "12:00", title: "Welcome to the log", slug: "welcome", type: "notes", tags: ["notes"], draft: false, body: "This is the default entry. Replace it with your own posts under `content/blog/` (or publish via the API when MongoDB is configured).", openpgp_sig: "", minisig: "" }
        ],
        metrics: {
          welcome: { bytes: "1KB", reach: "\u2014" }
        }
      };
      window.ADMIN_STATE_INITIAL = ADMIN_STATE_INITIAL;
      window.mergeAdminStateWithDefaults = mergeAdminStateWithDefaults;
      window.GLYPHS = ["shroud", "tessera", "cipher", "ledger", "vector", "loom", "hex", "sigil", "drift", "obscura", "monolith", "echo"];
      window.TERMINAL_KINDS = ["sys", "log", "head", "prompt", "blank"];
      window.TWEAK_FONT_OPTIONS = [
        { value: "ibm", label: "IBM Plex Mono" },
        { value: "jetbrains", label: "JetBrains Mono" },
        { value: "space", label: "Space Mono / Grotesk" },
        { value: "display", label: "Plex + Anton display" }
      ];
    }
  });

  // ../static/admin/admin-sections-1.jsx
  function SecSite({ state, set }) {
    const td = state.tweak_defaults || {};
    const setTd = (k, v) => set({ ...state, tweak_defaults: { ...td, [k]: v } });
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A.H, { num: "01", title: "SITE", sub: "content/home.json" }), /* @__PURE__ */ React.createElement(A.Card, { title: "DEFAULT THEME / TWEAKS", right: /* @__PURE__ */ React.createElement("span", { className: "dim" }, "applies on first visit \xB7 users can override") }, /* @__PURE__ */ React.createElement(A.FRow, { label: "Theme", hint: "Must match what site.js expects." }, /* @__PURE__ */ React.createElement(A.Seg, { value: td.theme, onChange: (v) => setTd("theme", v), options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }] })), /* @__PURE__ */ React.createElement(A.FRow, { label: "Font" }, /* @__PURE__ */ React.createElement(A.Select, { value: td.font, onChange: (v) => setTd("font", v), options: window.TWEAK_FONT_OPTIONS })), /* @__PURE__ */ React.createElement(A.FRow, { label: "Background grid" }, /* @__PURE__ */ React.createElement(A.Toggle, { checked: td.show_grid, onChange: (v) => setTd("show_grid", v), label: td.show_grid ? "ON" : "OFF" })), /* @__PURE__ */ React.createElement(A.FRow, { label: "Scanlines" }, /* @__PURE__ */ React.createElement(A.Toggle, { checked: td.scanlines, onChange: (v) => setTd("scanlines", v), label: td.scanlines ? "ON" : "OFF" })), /* @__PURE__ */ React.createElement(A.FRow, { label: "Crosshair cursor" }, /* @__PURE__ */ React.createElement(A.Toggle, { checked: td.crosshair, onChange: (v) => setTd("crosshair", v), label: td.crosshair ? "ON" : "OFF" }))), /* @__PURE__ */ React.createElement(A.Card, { title: "SUPPORT EMAILS", right: /* @__PURE__ */ React.createElement("span", { className: "dim" }, "public \xB7 mailto + security.txt") }, /* @__PURE__ */ React.createElement("div", { className: "adm-explain", style: { marginBottom: 12 } }, "Default and optional labeled addresses shown on the security page, site footer, and ", /* @__PURE__ */ React.createElement("code", null, "/.well-known/security.txt"), ". This does ", /* @__PURE__ */ React.createElement("strong", null, "not"), " create mail routes \u2014 provision ", /* @__PURE__ */ React.createElement("code", null, "mail_aliases"), " and MX for each address on your domain."), /* @__PURE__ */ React.createElement(A.FRow, { label: "Default support email", hint: "Primary contact (optional)." }, /* @__PURE__ */ React.createElement(
      A.Input,
      {
        value: state.support && state.support.default_email || "",
        onChange: (v) => set({ ...state, support: { ...state.support || {}, default_email: v, contacts: state.support && state.support.contacts || [] } }),
        placeholder: "support@example.com"
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 10, letterSpacing: "0.12em", marginBottom: 8 } }, "CUSTOM CONTACTS"), /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: state.support && state.support.contacts || [],
        onChange: (next) => set({ ...state, support: { ...state.support || {}, default_email: state.support && state.support.default_email || "", contacts: next } }),
        addLabel: "add contact",
        newItem: () => ({ label: "", email: "" }),
        render: (it, i, upd) => /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, /* @__PURE__ */ React.createElement(A.Input, { value: it.label, onChange: (v) => upd({ ...it, label: v }), placeholder: "Label (e.g. Security)" }), /* @__PURE__ */ React.createElement(A.Input, { value: it.email, onChange: (v) => upd({ ...it, email: v }), placeholder: "email@example.com" }))
      }
    ))));
  }
  function SecNav({ state, set }) {
    const setNav = (next) => set({ ...state, nav: next });
    const setFooter = (k, v) => set({ ...state, footer: { ...state.footer, [k]: v } });
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A.H, { num: "02", title: "NAV & FOOTER", sub: "top nav, footer columns, ASCII signature" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Top-nav ", /* @__PURE__ */ React.createElement("code", null, "id"), " drives active state in ", /* @__PURE__ */ React.createElement("code", null, "setNavActive"), " \u2014 keep ", /* @__PURE__ */ React.createElement("code", null, "tools"), " and ", /* @__PURE__ */ React.createElement("code", null, "log"), " ids so highlighting works."), /* @__PURE__ */ React.createElement(A.Card, { title: "TOP NAVIGATION" }, /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: state.nav,
        onChange: setNav,
        addLabel: "add nav item",
        newItem: () => ({ id: "", href: "#", label: "NEW" }),
        render: (it, i, upd) => /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 10 } }, /* @__PURE__ */ React.createElement(A.Input, { value: it.id, onChange: (v) => upd({ ...it, id: v }), placeholder: "id" }), /* @__PURE__ */ React.createElement(A.Input, { value: it.label, onChange: (v) => upd({ ...it, label: v }), placeholder: "LABEL" }), /* @__PURE__ */ React.createElement(A.Input, { value: it.href, onChange: (v) => upd({ ...it, href: v }), placeholder: "href" }))
      }
    )), /* @__PURE__ */ React.createElement(A.Card, { title: "FOOTER \xB7 TAGLINE" }, /* @__PURE__ */ React.createElement(A.Textarea, { value: state.footer.tagline, onChange: (v) => setFooter("tagline", v) })), /* @__PURE__ */ React.createElement(A.Card, { title: "FOOTER \xB7 PAGES" }, /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: state.footer.pages,
        onChange: (v) => setFooter("pages", v),
        addLabel: "add link",
        newItem: () => ({ href: "#", label: "Link" }),
        render: (it, i, upd) => /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, /* @__PURE__ */ React.createElement(A.Input, { value: it.label, onChange: (v) => upd({ ...it, label: v }), placeholder: "label" }), /* @__PURE__ */ React.createElement(A.Input, { value: it.href, onChange: (v) => upd({ ...it, href: v }), placeholder: "href" }))
      }
    )), /* @__PURE__ */ React.createElement(A.Card, { title: "FOOTER \xB7 PROTOCOL LINES" }, /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: state.footer.protocol,
        onChange: (v) => setFooter("protocol", v),
        addLabel: "add line",
        newItem: () => "New line",
        render: (it, i, upd) => /* @__PURE__ */ React.createElement(A.Input, { value: it, onChange: upd })
      }
    )), /* @__PURE__ */ React.createElement(A.Card, { title: "FOOTER \xB7 ASCII SIGNATURE", right: /* @__PURE__ */ React.createElement("span", { className: "dim" }, "monospace \xB7 preserves whitespace") }, /* @__PURE__ */ React.createElement(A.Textarea, { tall: true, value: state.footer.ascii_block, onChange: (v) => setFooter("ascii_block", v) }), /* @__PURE__ */ React.createElement(
      A.FRow,
      {
        label: "Scale ASCII to column",
        hint: "On: shrink to fit the SIGN cell (no horizontal scroll). Off: fixed size with horizontal scroll if needed."
      },
      /* @__PURE__ */ React.createElement(
        A.Toggle,
        {
          checked: !!state.footer.ascii_scale_to_fit,
          onChange: (v) => setFooter("ascii_scale_to_fit", v),
          label: state.footer.ascii_scale_to_fit ? "FIT WIDTH" : "NATURAL"
        }
      )
    ), /* @__PURE__ */ React.createElement("div", { className: "live-well", style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("pre", { style: { fontSize: 11, color: "var(--dim)", lineHeight: 1.1, fontFamily: "var(--font)" } }, state.footer.ascii_block))));
  }
  function HeadlineEditor({ lines, onChange }) {
    return /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: lines,
        onChange,
        addLabel: "add line",
        newItem: () => ({ parts: [{ stripe: false, text: "NEW LINE" }] }),
        render: (line, i, upd) => /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" } }, "LINE ", i + 1, " \xB7 ", line.parts.length, " parts"), /* @__PURE__ */ React.createElement(
          A.Repeater,
          {
            items: line.parts,
            onChange: (parts) => upd({ ...line, parts }),
            addLabel: "add part",
            newItem: () => ({ stripe: false, text: " text " }),
            render: (p, j, updP) => /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 100px", gap: 8 } }, /* @__PURE__ */ React.createElement(A.Input, { value: p.text, onChange: (v) => updP({ ...p, text: v }) }), /* @__PURE__ */ React.createElement(A.Toggle, { checked: p.stripe, onChange: (v) => updP({ ...p, stripe: v }), label: "STRIPE" }))
          }
        ))
      }
    );
  }
  function SecHero({ state, set }) {
    const h = state.hero;
    const setH = (k, v) => set({ ...state, hero: { ...state.hero, [k]: v } });
    const setTs = (k, v) => set({ ...state, hero: { ...state.hero, tools_section: { ...state.hero.tools_section, [k]: v } } });
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A.H, { num: "03", title: "HERO", sub: "lines \xB7 lede \xB7 stats \xB7 sys \xB7 keyboard \xB7 bars" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "The big block at the top of the home page. Headlines are split into ", /* @__PURE__ */ React.createElement("code", null, "parts"), " so you can stripe sub-words; lede is Markdown."), /* @__PURE__ */ React.createElement(A.Card, { title: "SECTION HEADER" }, /* @__PURE__ */ React.createElement("div", { className: "split-2" }, /* @__PURE__ */ React.createElement(A.FRow, { label: "Section index" }, /* @__PURE__ */ React.createElement(A.Input, { value: h.section_index, onChange: (v) => setH("section_index", v) })), /* @__PURE__ */ React.createElement(A.FRow, { label: "Section title" }, /* @__PURE__ */ React.createElement(A.Input, { value: h.section_title, onChange: (v) => setH("section_title", v) })))), /* @__PURE__ */ React.createElement(A.Card, { title: "HEADLINES", right: /* @__PURE__ */ React.createElement("span", { className: "dim" }, "stripe = orange highlight word") }, /* @__PURE__ */ React.createElement(HeadlineEditor, { lines: h.lines, onChange: (v) => setH("lines", v) }), /* @__PURE__ */ React.createElement("div", { className: "live-well", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "display", style: { fontSize: 56 } }, h.lines.map((ln, i) => /* @__PURE__ */ React.createElement("div", { key: i }, ln.parts.map((p, j) => p.stripe ? /* @__PURE__ */ React.createElement("span", { key: j, style: { background: "var(--accent)", color: "#0a0a0a", padding: "0 0.08em" } }, p.text) : /* @__PURE__ */ React.createElement("span", { key: j }, p.text))))))), /* @__PURE__ */ React.createElement(A.Card, { title: "LEDE \xB7 MARKDOWN", right: /* @__PURE__ */ React.createElement("span", { className: "dim" }, "GFM") }, /* @__PURE__ */ React.createElement("div", { className: "md-editor" }, /* @__PURE__ */ React.createElement("textarea", { value: h.lede_markdown, onChange: (e) => setH("lede_markdown", e.target.value) }), /* @__PURE__ */ React.createElement("div", { className: "md-preview", dangerouslySetInnerHTML: { __html: A.mdRender(h.lede_markdown) } }))), /* @__PURE__ */ React.createElement(A.Card, { title: "STATS \xB7 4-UP META" }, /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: h.stats,
        onChange: (v) => setH("stats", v),
        addLabel: "add stat",
        newItem: () => ({ key: "KEY", value: "0" }),
        render: (it, i, upd) => /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, /* @__PURE__ */ React.createElement(A.Input, { value: it.key, onChange: (v) => upd({ ...it, key: v }), placeholder: "key" }), /* @__PURE__ */ React.createElement(A.Input, { value: it.value, onChange: (v) => upd({ ...it, value: v }), placeholder: "value" }))
      }
    )), /* @__PURE__ */ React.createElement(A.Card, { title: "LOAD BAR HEIGHTS", right: /* @__PURE__ */ React.createElement("span", { className: "dim" }, h.load_bar_heights.length, " bars") }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "flex-end", gap: 4, height: 80, border: "1px solid var(--line)", padding: 8 } }, h.load_bar_heights.map((v, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { flex: 1, background: i === 10 ? "var(--accent)" : "var(--fg)", height: `${v}px`, position: "relative" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "0",
        max: "80",
        value: v,
        onChange: (e) => {
          const next = h.load_bar_heights.slice();
          next[i] = parseInt(e.target.value || "0", 10);
          setH("load_bar_heights", next);
        },
        style: { position: "absolute", bottom: -22, left: -4, right: -4, fontSize: 9, padding: 1, background: "transparent", border: 0, color: "var(--dim)", textAlign: "center", fontFamily: "var(--font)" }
      }
    )))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 32, display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => setH("load_bar_heights", [...h.load_bar_heights, 32]) }, "+ bar"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => setH("load_bar_heights", h.load_bar_heights.slice(0, -1)), disabled: h.load_bar_heights.length <= 1 }, "\u2212 bar"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => {
      const a = new Uint8Array(h.load_bar_heights.length);
      crypto.getRandomValues(a);
      setH("load_bar_heights", h.load_bar_heights.map((_, i) => 20 + a[i] % 40));
    } }, "shuffle"))), /* @__PURE__ */ React.createElement(A.Card, { title: "SYSTEM STATUS ROWS" }, /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: h.sys_rows,
        onChange: (v) => setH("sys_rows", v),
        addLabel: "add row",
        newItem: () => ({ label: "LABEL", value: "\u25CF VALUE", status: "ok" }),
        render: (it, i, upd) => /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 200px", gap: 10 } }, /* @__PURE__ */ React.createElement(A.Input, { value: it.label, onChange: (v) => upd({ ...it, label: v }), placeholder: "label" }), /* @__PURE__ */ React.createElement(A.Input, { value: it.value, onChange: (v) => upd({ ...it, value: v }), placeholder: "value" }), /* @__PURE__ */ React.createElement(A.Seg, { value: it.status, onChange: (v) => upd({ ...it, status: v }), options: [
          { value: "ok", label: "OK" },
          { value: "accent", label: "ACCENT" },
          { value: "dim", label: "DIM" }
        ] }))
      }
    )), /* @__PURE__ */ React.createElement(A.Card, { title: "KEYBOARD ROWS" }, /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: h.keyboard_rows,
        onChange: (v) => setH("keyboard_rows", v),
        addLabel: "add row",
        newItem: () => ({ label: "LABEL", key: "k" }),
        render: (it, i, upd) => /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 100px", gap: 10 } }, /* @__PURE__ */ React.createElement(A.Input, { value: it.label, onChange: (v) => upd({ ...it, label: v }), placeholder: "label" }), /* @__PURE__ */ React.createElement(A.Input, { value: it.key, onChange: (v) => upd({ ...it, key: v }), placeholder: "key" }))
      }
    )), /* @__PURE__ */ React.createElement(A.Card, { title: "TOOLS BAND LABEL" }, /* @__PURE__ */ React.createElement("div", { className: "split-3" }, /* @__PURE__ */ React.createElement(A.FRow, { label: "Index" }, /* @__PURE__ */ React.createElement(A.Input, { value: h.tools_section.section_index, onChange: (v) => setTs("section_index", v) })), /* @__PURE__ */ React.createElement(A.FRow, { label: "Title" }, /* @__PURE__ */ React.createElement(A.Input, { value: h.tools_section.section_title, onChange: (v) => setTs("section_title", v) })), /* @__PURE__ */ React.createElement(A.FRow, { label: "Hint" }, /* @__PURE__ */ React.createElement(A.Input, { value: h.tools_section.hint, onChange: (v) => setTs("hint", v) })))));
  }
  function SecTerminal({ state, set }) {
    const setLines = (v) => set({ ...state, terminal: { ...state.terminal, lines: v } });
    const KIND_PRESETS = [
      { kind: "sys", text: "elvish:~$ " },
      { kind: "log", text: "[ OK ] " },
      { kind: "log", text: "[ WARN ] " },
      { kind: "log", text: "[ FAIL ] " },
      { kind: "head", text: "// " },
      { kind: "prompt", text: "elvish:~$ " },
      { kind: "blank", text: "" }
    ];
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A.H, { num: "04", title: "TERMINAL BOOT", sub: "content/home.json \xB7 terminal.lines[]" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Each line has a ", /* @__PURE__ */ React.createElement("code", null, "kind"), " that drives styling: ", /* @__PURE__ */ React.createElement("code", null, "sys"), " (prompt highlighted), ", /* @__PURE__ */ React.createElement("code", null, "log"), " (gray with optional ", /* @__PURE__ */ React.createElement("code", null, "[ STATUS ]"), " prefix), ", /* @__PURE__ */ React.createElement("code", null, "head"), " (white emphasized), ", /* @__PURE__ */ React.createElement("code", null, "prompt"), " (final prompt line), ", /* @__PURE__ */ React.createElement("code", null, "blank"), " (spacer). Kind must match site.js."), /* @__PURE__ */ React.createElement(A.Card, { title: "LINES", right: /* @__PURE__ */ React.createElement("span", { className: "dim" }, state.terminal.lines.length, " lines") }, /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: state.terminal.lines,
        onChange: setLines,
        addLabel: "add line",
        newItem: () => ({ kind: "log", text: "[ OK ] " }),
        render: (it, i, upd) => /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 } }, /* @__PURE__ */ React.createElement(A.Select, { value: it.kind, onChange: (v) => upd({ ...it, kind: v }), options: window.TERMINAL_KINDS }), /* @__PURE__ */ React.createElement(A.Input, { value: it.text, onChange: (v) => upd({ ...it, text: v }), placeholder: it.kind === "blank" ? "(blank line)" : "text" }))
      }
    ), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { className: "dim", style: { fontSize: 10, letterSpacing: "0.18em", padding: "4px 0" } }, "PRESETS \u25B8"), KIND_PRESETS.map((p, i) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: i,
        className: "btn-sm",
        onClick: () => setLines([...state.terminal.lines, { ...p }])
      },
      "+ ",
      p.kind,
      ": ",
      p.text || "blank"
    )))), /* @__PURE__ */ React.createElement(A.Card, { title: "LIVE PREVIEW" }, /* @__PURE__ */ React.createElement("div", { className: "live-well" }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, lineHeight: 1.5 } }, state.terminal.lines.map((l, i) => {
      if (l.kind === "blank") return /* @__PURE__ */ React.createElement("div", { key: i }, "\xA0");
      if (l.kind === "sys" || l.kind === "prompt") {
        const split = l.text.indexOf("$");
        if (split > 0) return /* @__PURE__ */ React.createElement("div", { key: i }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent)" } }, l.text.slice(0, split + 1)), /* @__PURE__ */ React.createElement("span", null, l.text.slice(split + 1)));
        return /* @__PURE__ */ React.createElement("div", { key: i, style: { color: "var(--accent)" } }, l.text);
      }
      if (l.kind === "log") {
        const m = l.text.match(/^(\[ \w+ \])(.*)$/);
        if (m) return /* @__PURE__ */ React.createElement("div", { key: i }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ok)" } }, m[1]), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--dim)" } }, m[2]));
        return /* @__PURE__ */ React.createElement("div", { key: i, style: { color: "var(--dim)" } }, l.text);
      }
      return /* @__PURE__ */ React.createElement("div", { key: i, style: { fontWeight: 700 } }, l.text);
    })))));
  }
  function SecLogPage({ state, set }) {
    const lp = state.log_page;
    const setLp = (k, v) => set({ ...state, log_page: { ...state.log_page, [k]: v } });
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A.H, { num: "06", title: "LOG PAGE CHROME", sub: "hero \xB7 filters \xB7 ticker on /log" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Filter ", /* @__PURE__ */ React.createElement("code", null, "id"), "s should match post tags (case-insensitive). Use ", /* @__PURE__ */ React.createElement("code", null, "all"), " for the no-op default."), /* @__PURE__ */ React.createElement(A.Card, { title: "SECTION HEADER" }, /* @__PURE__ */ React.createElement("div", { className: "split-2" }, /* @__PURE__ */ React.createElement(A.FRow, { label: "Index" }, /* @__PURE__ */ React.createElement(A.Input, { value: lp.section_index, onChange: (v) => setLp("section_index", v) })), /* @__PURE__ */ React.createElement(A.FRow, { label: "Title" }, /* @__PURE__ */ React.createElement(A.Input, { value: lp.section_title, onChange: (v) => setLp("section_title", v) })))), /* @__PURE__ */ React.createElement(A.Card, { title: "HEADLINES" }, /* @__PURE__ */ React.createElement(HeadlineEditor, { lines: lp.headlines, onChange: (v) => setLp("headlines", v) })), /* @__PURE__ */ React.createElement(A.Card, { title: "INTRO \xB7 MARKDOWN" }, /* @__PURE__ */ React.createElement("div", { className: "md-editor" }, /* @__PURE__ */ React.createElement("textarea", { value: lp.intro_markdown, onChange: (e) => setLp("intro_markdown", e.target.value) }), /* @__PURE__ */ React.createElement("div", { className: "md-preview", dangerouslySetInnerHTML: { __html: A.mdRender(lp.intro_markdown) } }))), /* @__PURE__ */ React.createElement(A.Card, { title: "ACCENT TAGLINE" }, /* @__PURE__ */ React.createElement(A.Input, { value: lp.tagline_accent, onChange: (v) => setLp("tagline_accent", v) })), /* @__PURE__ */ React.createElement(A.Card, { title: "FILTERS", right: /* @__PURE__ */ React.createElement("span", { className: "dim" }, "id matches post tags") }, /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: lp.filters,
        onChange: (v) => setLp("filters", v),
        addLabel: "add filter",
        newItem: () => ({ id: "tag", label: "TAG" }),
        render: (it, i, upd) => /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, /* @__PURE__ */ React.createElement(A.Input, { value: it.id, onChange: (v) => upd({ ...it, id: v }), placeholder: "id (lowercase)" }), /* @__PURE__ */ React.createElement(A.Input, { value: it.label, onChange: (v) => upd({ ...it, label: v }), placeholder: "LABEL" }))
      }
    )), /* @__PURE__ */ React.createElement(A.Card, { title: "LOG TICKER", right: /* @__PURE__ */ React.createElement("span", { className: "dim" }, lp.ticker.length, " strings") }, /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: lp.ticker,
        onChange: (v) => setLp("ticker", v),
        addLabel: "add line",
        newItem: () => "NEW",
        render: (it, i, upd) => /* @__PURE__ */ React.createElement(A.Input, { value: it, onChange: upd })
      }
    )));
  }
  function SecTicker({ state, set }) {
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A.H, { num: "07", title: "HOME TICKER", sub: "strings scrolling above the footer" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Plain string list. Repeated automatically client-side to fill the marquee."), /* @__PURE__ */ React.createElement(A.Card, { title: "TICKER STRINGS", right: /* @__PURE__ */ React.createElement("span", { className: "dim" }, state.ticker_home.length, " entries") }, /* @__PURE__ */ React.createElement(
      A.Repeater,
      {
        items: state.ticker_home,
        onChange: (v) => set({ ...state, ticker_home: v }),
        addLabel: "add string",
        newItem: () => "NEW",
        render: (it, i, upd) => /* @__PURE__ */ React.createElement(A.Input, { value: it, onChange: upd })
      }
    )));
  }
  var A, useS_a2;
  var init_admin_sections_1 = __esm({
    "../static/admin/admin-sections-1.jsx"() {
      A = window.adm;
      ({ useState: useS_a2 } = React);
      window.SecSite = SecSite;
      window.SecNav = SecNav;
      window.SecHero = SecHero;
      window.SecTerminal = SecTerminal;
      window.SecLogPage = SecLogPage;
      window.SecTicker = SecTicker;
    }
  });

  // ../static/admin/admin-sections-2.jsx
  function parseToolMonitorExpectStatus(s) {
    const out = [];
    String(s || "").split(/[\s,]+/).forEach((p) => {
      const n = parseInt(p, 10);
      if (!Number.isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }
  function ToolMonitorEditor({ row, onChange, onClear }) {
    const set = (patch) => onChange({ ...row, ...patch });
    const t = row.type || "http";
    return /* @__PURE__ */ React.createElement("div", { className: "adm-card", style: { marginTop: 10, borderColor: "var(--line)" } }, /* @__PURE__ */ React.createElement("div", { className: "adm-card-h" }, /* @__PURE__ */ React.createElement("div", { className: "l" }, "UPTIME \xB7 ", row.name || row.id), /* @__PURE__ */ React.createElement("div", { className: "r" }, typeof onClear === "function" && /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm danger", onClick: onClear }, "remove check"))), /* @__PURE__ */ React.createElement("div", { className: "adm-card-b" }, /* @__PURE__ */ React.createElement("div", { className: "split-2" }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "Enabled" }, /* @__PURE__ */ React.createElement(A2.Toggle, { checked: !!row.enabled, onChange: (v) => set({ enabled: v }), label: row.enabled ? "ON" : "OFF" })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "ID", hint: "Stable uuid \u2014 do not change after first save." }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.id, onChange: (v) => set({ id: v.trim() }) }))), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Name", req: true }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.name, onChange: (v) => set({ name: v }) })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Check type", req: true, hint: "How the worker runs this check (stubs are listed but not executed yet)." }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, TOOL_MONITOR_TYPES.map((o) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: o.value,
        type: "button",
        className: "btn-sm" + (t === o.value ? " primary" : ""),
        onClick: () => set({ type: o.value })
      },
      o.label
    )))), (t === "http" || t === "http_keyword" || t === "http_json") && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A2.FRow, { label: "URL", req: true, hint: "Full https URL for off-site services." }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.url || "", onChange: (v) => set({ url: v }) })), /* @__PURE__ */ React.createElement("div", { className: "split-2" }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "Method", hint: "GET or HEAD; keyword/json force GET." }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.method || "GET", onChange: (v) => set({ method: v.toUpperCase() }), placeholder: "GET" })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Expect status", hint: "Comma list, e.g. 200,204. Empty = any 2xx/3xx." }, /* @__PURE__ */ React.createElement(A2.Input, { value: (Array.isArray(row.expect_status) ? row.expect_status : []).join(","), onChange: (v) => set({ expect_status: parseToolMonitorExpectStatus(v) }), placeholder: "200" }))), t === "http_keyword" && /* @__PURE__ */ React.createElement(A2.FRow, { label: "Keyword", req: true, hint: "Body must contain this substring (first 512 KiB)." }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.keyword || "", onChange: (v) => set({ keyword: v }) })), t === "http_json" && /* @__PURE__ */ React.createElement("div", { className: "split-2" }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "JSON path", req: true, hint: "Dot path, e.g. data.status" }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.json_path || "", onChange: (v) => set({ json_path: v }) })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Expected value", req: true, hint: "String match at path." }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.json_value || "", onChange: (v) => set({ json_value: v }) })))), (t === "tcp" || t === "ping") && /* @__PURE__ */ React.createElement("div", { className: "split-2" }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "Hostname", req: true }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.hostname || "", onChange: (v) => set({ hostname: v }) })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Port", hint: t === "ping" ? "Default 443 if empty." : "Required for TCP." }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.port ? String(row.port) : "", onChange: (v) => set({ port: parseInt(v, 10) || 0 }), placeholder: t === "ping" ? "443" : "443" }))), t === "dns" && /* @__PURE__ */ React.createElement("div", { className: "split-3" }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "DNS name", req: true }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.dns_name || "", onChange: (v) => set({ dns_name: v }) })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Record", req: true, hint: "A, TXT, or CNAME" }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.dns_record_type || "A", onChange: (v) => set({ dns_record_type: v.toUpperCase() }) })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Expect contains", hint: "Substring in joined lookup result." }, /* @__PURE__ */ React.createElement(A2.Input, { value: row.dns_expected || "", onChange: (v) => set({ dns_expected: v }) }))), (t === "websocket" || t === "push") && /* @__PURE__ */ React.createElement("p", { className: "readonly-note", style: { marginTop: 8 } }, "Worker returns not-implemented for now \u2014 add HTTP/TCP/DNS rows instead.")));
  }
  function GlyphPicker({ value, onChange }) {
    return /* @__PURE__ */ React.createElement("div", { className: "glyph-grid" }, window.GLYPHS.map((g) => /* @__PURE__ */ React.createElement("div", { key: g, className: "glyph-tile" + (value === g ? " on" : ""), onClick: () => onChange(g) }, /* @__PURE__ */ React.createElement(window.Glyph, { name: g }), /* @__PURE__ */ React.createElement("span", { className: "lab" }, g))));
  }
  function ToolEditor({ tool, onChange, onClose, onDelete }) {
    const [probeBusy, setProbeBusy] = React.useState(false);
    const [probeOut, setProbeOut] = React.useState(null);
    const [probeErr, setProbeErr] = React.useState("");
    if (!tool || typeof tool !== "object") {
      return /* @__PURE__ */ React.createElement("div", { className: "adm-card", style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "adm-card-b" }, /* @__PURE__ */ React.createElement("p", { className: "dim" }, "No tool selected.")));
    }
    const rawMon = tool.monitor;
    const mon = rawMon != null && typeof rawMon === "object" && !Array.isArray(rawMon) ? rawMon : null;
    const runProbeTest = async () => {
      setProbeErr("");
      setProbeOut(null);
      setProbeBusy(true);
      try {
        const r = await fetch("/api/admin/uptime/test-probe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: tool.slug,
            open_href: tool.open_href || "",
            monitor: mon
          })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setProbeErr(j.error || "HTTP " + r.status);
          return;
        }
        setProbeOut(j);
      } catch (e) {
        setProbeErr(String(e));
      } finally {
        setProbeBusy(false);
      }
    };
    const addMonitor = () => {
      const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "m" + Date.now();
      onChange({
        ...tool,
        monitor: {
          id,
          enabled: true,
          name: "UPTIME CHECK",
          type: "http",
          url: "https://",
          method: "GET",
          expect_status: []
        }
      });
    };
    const clearMonitor = () => onChange({ ...tool, monitor: null });
    return /* @__PURE__ */ React.createElement("div", { className: "adm-card", style: { marginTop: 14, borderColor: "var(--accent)" } }, /* @__PURE__ */ React.createElement("div", { className: "adm-card-h", style: { background: "rgba(255,87,34,0.06)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }, "EDITING \xB7 ", tool.name || "(unnamed)"), /* @__PURE__ */ React.createElement("div", { className: "r" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: onClose }, "close"))), /* @__PURE__ */ React.createElement("div", { className: "adm-card-b" }, /* @__PURE__ */ React.createElement("div", { className: "split-3" }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "ID", hint: "display order, e.g. 01" }, /* @__PURE__ */ React.createElement(A2.Input, { value: tool.id, onChange: (v) => onChange({ ...tool, id: v }) })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Slug", req: true, hint: "url-safe, unique" }, /* @__PURE__ */ React.createElement(A2.Input, { value: tool.slug, onChange: (v) => onChange({ ...tool, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "-") }) })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Name", req: true }, /* @__PURE__ */ React.createElement(A2.Input, { value: tool.name, onChange: (v) => onChange({ ...tool, name: v }) }))), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Description", req: true }, /* @__PURE__ */ React.createElement(A2.Textarea, { value: tool.desc, onChange: (v) => onChange({ ...tool, desc: v }) })), /* @__PURE__ */ React.createElement("div", { className: "split-2" }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "Tag" }, /* @__PURE__ */ React.createElement(
      A2.Seg,
      {
        value: tool.tag,
        onChange: (v) => onChange({ ...tool, tag: v }),
        options: [{ value: "live", label: "LIVE" }, { value: "beta", label: "BETA" }, { value: "wip", label: "WIP" }]
      }
    )), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Calls", hint: "\u2014, /, live, auto, or empty = live GET /go/slug count; other text is fixed. Toggle below off to always show Calls as written." }, /* @__PURE__ */ React.createElement(A2.Input, { value: tool.calls, onChange: (v) => onChange({ ...tool, calls: v }) }))), /* @__PURE__ */ React.createElement("div", { className: "split-2", style: { marginTop: 8 } }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "Live call count", hint: "On: sentinels use Valkey (GET /go/slug only). Off: Calls column is exactly what you type." }, /* @__PURE__ */ React.createElement(A2.Toggle, { checked: !tool.calls_static, onChange: (v) => onChange({ ...tool, calls_static: !v }), label: tool.calls_static ? "OFF (static)" : "ON (Valkey)" })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Since" }, /* @__PURE__ */ React.createElement(A2.Input, { value: tool.since, onChange: (v) => onChange({ ...tool, since: v }) }))), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Show on home", hint: "When off, the card is hidden from the public grid and skipped by automatic uptime probes for this slug." }, /* @__PURE__ */ React.createElement(A2.Toggle, { checked: !tool.hidden, onChange: (v) => onChange({ ...tool, hidden: !v }), label: tool.hidden ? "HIDDEN" : "LISTED" })), /* @__PURE__ */ React.createElement("div", { className: "adm-probe-box", style: { marginTop: 14, padding: "12px 14px", border: "1px solid var(--line)", background: "rgba(255,255,255,0.02)" } }, /* @__PURE__ */ React.createElement("div", { className: "adm-subhead", style: { marginBottom: 8 } }, "// LINKS & UPTIME"), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Open href", hint: "GET /go/<slug>/ redirect for visitors only. Not the uptime probe unless you leave uptime unset below." }, /* @__PURE__ */ React.createElement(A2.Input, { value: tool.open_href || "", onChange: (v) => onChange({ ...tool, open_href: v }), placeholder: "/shroud/ or https://\u2026" })), /* @__PURE__ */ React.createElement(
      A2.FRow,
      {
        label: "Uptime",
        hint: "DEFAULT = worker HEAD/GET using open href rules, else /{slug}/ on the probe base. CUSTOM = one separate check (HTTP variants, TCP, DNS, \u2026)."
      },
      /* @__PURE__ */ React.createElement(
        A2.Seg,
        {
          value: mon ? "custom" : "default",
          onChange: (v) => {
            if (v === "default") clearMonitor();
            else if (!mon) addMonitor();
          },
          options: [
            { value: "default", label: "DEFAULT" },
            { value: "custom", label: "CUSTOM" }
          ]
        }
      )
    ), mon && /* @__PURE__ */ React.createElement(ToolMonitorEditor, { row: mon, onChange: (next) => onChange({ ...tool, monitor: next }) }), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", disabled: probeBusy, onClick: runProbeTest }, probeBusy ? "testing\u2026" : "test probe now"), /* @__PURE__ */ React.createElement("span", { className: "dim", style: { fontSize: 10 } }, "Runs this check once from the server (same paths as the worker). Uses uptime/home base URL if unset below.")), probeErr && /* @__PURE__ */ React.createElement("div", { className: "readonly-note", style: { marginTop: 8 } }, probeErr), probeOut && probeOut.result && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10, padding: "10px 12px", border: "1px solid var(--line)", fontSize: 11, fontFamily: "var(--mono)", background: "rgba(0,0,0,0.2)" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "base"), " ", probeOut.base_url), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "id"), " ", probeOut.result.id, " \xB7 ", /* @__PURE__ */ React.createElement("span", { className: "dim" }, "ok"), " ", String(probeOut.result.ok), " \xB7 ", /* @__PURE__ */ React.createElement("span", { className: "dim" }, "ms"), " ", probeOut.result.latency_ms, " \xB7 ", /* @__PURE__ */ React.createElement("span", { className: "dim" }, "status"), " ", probeOut.result.status_code || "\u2014"), probeOut.result.method && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "method"), " ", probeOut.result.method), probeOut.result.url && /* @__PURE__ */ React.createElement("div", { style: { wordBreak: "break-all" } }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "url"), " ", probeOut.result.url), probeOut.result.error && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--accent)", marginTop: 6 } }, probeOut.result.error))), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Trust / data signals", hint: "Short posture chips on each card (browser-only, no-upload, \u2026)." }, /* @__PURE__ */ React.createElement(
      A2.Chips,
      {
        values: tool.signals ?? tool.stack ?? [],
        onChange: (v) => onChange({ ...tool, signals: v, stack: void 0 }),
        suggestions: ["BROWSER-ONLY", "NO-UPLOAD", "OFFLINE-CAPABLE", "OPTIONAL-SYNC", "OPEN-SOURCE", "NO-ACCOUNT", "LOCAL-FIRST"]
      }
    )), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Glyph", req: true, hint: "Must be one of the registered glyph keys." }, /* @__PURE__ */ React.createElement(GlyphPicker, { value: tool.glyph, onChange: (v) => onChange({ ...tool, glyph: v }) })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 14 } }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm danger", onClick: onDelete }, "delete tool"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", onClick: onClose }, "save & close"))));
  }
  function SecTools({ state, set }) {
    const [editIdx, setEditIdx] = useS_a3(-1);
    const [q, setQ] = useS_a3("");
    const [pendingDel, setPendingDel] = useS_a3(null);
    const [pendingBulkDel, setPendingBulkDel] = useS_a3(null);
    const [sel, setSel] = useS_a3(() => /* @__PURE__ */ new Set());
    const headSelRef = useR_a2(null);
    const M2 = window.VModals;
    const setTools = (v) => set({ ...state, tools: v });
    const filtered = state.tools.map((t, i) => ({ t, i })).filter(({ t }) => !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.slug.includes(q.toLowerCase()));
    const allFilteredSelected = filtered.length > 0 && filtered.every(({ i }) => sel.has(i));
    const someFilteredSelected = filtered.some(({ i }) => sel.has(i));
    useE_a2(() => {
      const el = headSelRef.current;
      if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
    }, [someFilteredSelected, allFilteredSelected]);
    const toggleSel = (i) => {
      setSel((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      });
    };
    const toggleSelectFiltered = () => {
      const idxs = filtered.map(({ i }) => i);
      setSel((prev) => {
        const next = new Set(prev);
        const allOn = idxs.length > 0 && idxs.every((j) => next.has(j));
        if (allOn) idxs.forEach((j) => next.delete(j));
        else idxs.forEach((j) => next.add(j));
        return next;
      });
    };
    const clearSel = () => setSel(() => /* @__PURE__ */ new Set());
    const move = (i, dir) => {
      const j = i + dir;
      if (j < 0 || j >= state.tools.length) return;
      const next = state.tools.slice();
      [next[i], next[j]] = [next[j], next[i]];
      setTools(next);
    };
    const dup = (i) => {
      const t = state.tools[i];
      const { monitors: _mon, health_href: _hh, ...baseT } = t;
      const next = state.tools.slice();
      next.splice(i + 1, 0, {
        ...baseT,
        id: "00",
        slug: t.slug + "-copy",
        name: t.name + " (COPY)",
        open_href: t.open_href || "",
        monitor: t.monitor && typeof t.monitor === "object" ? {
          ...t.monitor,
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "m" + Date.now()
        } : null
      });
      setTools(next);
    };
    const del = (i) => {
      setTools(state.tools.filter((_, j) => j !== i));
      setEditIdx(-1);
      setSel(() => /* @__PURE__ */ new Set());
    };
    const delMany = (indices) => {
      const sorted = [...new Set(indices)].sort((a, b) => b - a);
      let next = state.tools.slice();
      for (const idx of sorted) next = next.filter((_, j) => j !== idx);
      setTools(next);
      setEditIdx(-1);
      setSel(() => /* @__PURE__ */ new Set());
    };
    const add = () => {
      const next = [...state.tools, { id: String(state.tools.length + 1).padStart(2, "0"), slug: "new-tool", name: "NEW TOOL", tag: "wip", desc: "Describe what it does.", signals: [], glyph: "shroud", calls: "\u2014", since: "\u2014", open_href: "", hidden: false, calls_static: false, monitor: null }];
      setTools(next);
      setEditIdx(next.length - 1);
    };
    const slugDupes = useM_a2(() => {
      const counts = {};
      state.tools.forEach((t) => {
        counts[t.slug] = (counts[t.slug] || 0) + 1;
      });
      return new Set(Object.entries(counts).filter(([_, n]) => n > 1).map(([s]) => s));
    }, [state.tools]);
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A2.H, { num: "05", title: "TOOLS GRID", sub: `${state.tools.length} tools \xB7 CRUD + reorder + multi-select + glyph picker` }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Slugs must be unique and URL-safe. Glyph must be one of the registered keys; new art means extending ", /* @__PURE__ */ React.createElement("code", null, "glyphs.go"), " in the repo. Turn the ", /* @__PURE__ */ React.createElement("code", null, "home"), " toggle off to hide a card from the public index and skip its uptime row. Optional ", /* @__PURE__ */ React.createElement("strong", null, "uptime check"), " (one per tool) overrides the default ", /* @__PURE__ */ React.createElement("code", null, "tool_<slug>"), " HTTP probe when enabled."), /* @__PURE__ */ React.createElement(A2.Card, { title: "LIBRARY", right: /* @__PURE__ */ React.createElement(React.Fragment, null, sel.size > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "dim", style: { fontSize: 10, marginRight: 8, letterSpacing: "0.12em" } }, sel.size, " selected"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", style: { marginRight: 6 }, onClick: clearSel }, "clear"), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn-sm danger",
        style: { marginRight: 8 },
        onClick: () => {
          const indices = [...sel].filter((j) => j >= 0 && j < state.tools.length);
          if (indices.length === 0) return;
          const picked = indices.map((j) => state.tools[j]).filter(Boolean);
          const preview = picked.slice(0, 5).map((x) => x.name || x.slug).join(" \xB7 ");
          const extra = picked.length > 5 ? ` (+${picked.length - 5} more)` : "";
          setPendingBulkDel({
            indices,
            target: {
              name: `Delete ${picked.length} tool${picked.length === 1 ? "" : "s"}`,
              path: "",
              detail: (preview || "selected rows") + extra + " \xB7 removed from working tools[] until next save."
            }
          });
        }
      },
      "delete selected"
    )), /* @__PURE__ */ React.createElement("input", { className: "inp", style: { width: 200, marginRight: 8 }, placeholder: "search\u2026", value: q, onChange: (e) => setQ(e.target.value) }), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", onClick: add }, "+ new tool")) }, /* @__PURE__ */ React.createElement("div", { className: "rep", style: { border: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "tool-row head" }, /* @__PURE__ */ React.createElement("span", { className: "tool-sel", title: "Select visible rows" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        ref: headSelRef,
        type: "checkbox",
        "aria-label": "Select all visible tools",
        checked: allFilteredSelected,
        onChange: toggleSelectFiltered
      }
    )), /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("span", null, "id"), /* @__PURE__ */ React.createElement("span", null, "name \xB7 slug \xB7 desc"), /* @__PURE__ */ React.createElement("span", null, "signals"), /* @__PURE__ */ React.createElement("span", null, "tag \xB7 calls"), /* @__PURE__ */ React.createElement("span", null, "home"), /* @__PURE__ */ React.createElement("span", null, "glyph"), /* @__PURE__ */ React.createElement("span", null)), filtered.map(({ t, i }) => /* @__PURE__ */ React.createElement("div", { key: i, className: "tool-row" + (editIdx === i ? " editing" : "") + (sel.has(i) ? " selected" : "") }, /* @__PURE__ */ React.createElement("label", { className: "tool-sel", title: "Select for bulk actions", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: sel.has(i),
        onChange: () => toggleSel(i),
        "aria-label": `Select ${t.name || t.slug}`
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2, padding: 4 } }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", style: { padding: "1px 4px", fontSize: 9 }, onClick: () => move(i, -1), disabled: i === 0 }, "\u2191"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", style: { padding: "1px 4px", fontSize: 9 }, onClick: () => move(i, 1), disabled: i === state.tools.length - 1 }, "\u2193")), /* @__PURE__ */ React.createElement("span", { className: "id" }, t.id), /* @__PURE__ */ React.createElement("div", { style: { minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "nm" }, t.name), /* @__PURE__ */ React.createElement("div", { style: { color: slugDupes.has(t.slug) ? "var(--accent)" : "var(--dim)", fontSize: 10 } }, "/", t.slug, slugDupes.has(t.slug) && " \xB7 DUPE"), /* @__PURE__ */ React.createElement("div", { className: "desc dim", style: { fontSize: 10 } }, t.desc)), /* @__PURE__ */ React.createElement("div", { className: "tag-cell" }, (t.signals ?? t.stack ?? []).slice(0, 3).map((s) => /* @__PURE__ */ React.createElement("span", { key: s, className: "stack-chip", style: { fontSize: 9 } }, s)), (t.signals ?? t.stack ?? []).length > 3 && /* @__PURE__ */ React.createElement("span", { className: "dim", style: { fontSize: 10 } }, "+", (t.signals ?? t.stack ?? []).length - 3)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "tag " + t.tag, style: { fontSize: 9 } }, t.tag), /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 10, marginTop: 4 } }, t.calls)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React.createElement(A2.Toggle, { checked: !t.hidden, onChange: (v) => setTools(state.tools.map((x, j) => j === i ? { ...x, hidden: !v } : x)), label: t.hidden ? "off" : "on" })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "center", color: "var(--accent)" } }, /* @__PURE__ */ React.createElement("div", { style: { width: 28, height: 28 } }, /* @__PURE__ */ React.createElement(window.Glyph, { name: t.glyph }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => setEditIdx(editIdx === i ? -1 : i) }, editIdx === i ? "close" : "edit"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => dup(i) }, "dup"))))), editIdx >= 0 && state.tools[editIdx] && /* @__PURE__ */ React.createElement(
      ToolEditor,
      {
        tool: state.tools[editIdx],
        onChange: (t) => setTools(state.tools.map((x, i) => i === editIdx ? t : x)),
        onClose: () => setEditIdx(-1),
        onDelete: () => {
          const t = state.tools[editIdx];
          setPendingDel({
            index: editIdx,
            target: {
              name: t.name || "TOOL",
              path: "/" + (t.slug || ""),
              detail: "Removes this row from the tools grid in working state."
            }
          });
        }
      }
    )), M2 && pendingDel && /* @__PURE__ */ React.createElement(
      M2.ConfirmDestroyModal,
      {
        open: true,
        onClose: () => setPendingDel(null),
        phrase: "DELETE",
        target: pendingDel.target,
        onConfirm: () => {
          del(pendingDel.index);
          setPendingDel(null);
        }
      }
    ), M2 && pendingBulkDel && /* @__PURE__ */ React.createElement(
      M2.ConfirmDestroyModal,
      {
        open: true,
        onClose: () => setPendingBulkDel(null),
        phrase: "DELETE",
        target: pendingBulkDel.target,
        onConfirm: () => {
          delMany(pendingBulkDel.indices);
        }
      }
    ));
  }
  function PostEditor({ post, metricsPreview, onChange, onClose, onDelete }) {
    const [tab, setTab] = useS_a3("write");
    const setF = (k, v) => onChange({ ...post, [k]: v });
    const mp = metricsPreview || {};
    return /* @__PURE__ */ React.createElement("div", { className: "adm-card", style: { marginTop: 14, borderColor: "var(--accent)" } }, /* @__PURE__ */ React.createElement("div", { className: "adm-card-h", style: { background: "rgba(255,87,34,0.06)" } }, /* @__PURE__ */ React.createElement("div", { className: "l" }, "EDITING \xB7 ", post.title || "(untitled)"), /* @__PURE__ */ React.createElement("div", { className: "r", style: { display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement("div", { className: "seg", style: { marginRight: 8 } }, /* @__PURE__ */ React.createElement("button", { className: tab === "write" ? "on" : "", onClick: () => setTab("write") }, "WRITE"), /* @__PURE__ */ React.createElement("button", { className: tab === "meta" ? "on" : "", onClick: () => setTab("meta") }, "META"), /* @__PURE__ */ React.createElement("button", { className: tab === "raw" ? "on" : "", onClick: () => setTab("raw") }, "RAW")), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: onClose }, "close"))), /* @__PURE__ */ React.createElement("div", { className: "adm-card-b" }, tab === "write" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "split-2" }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "Slug", req: true, hint: "URL path /log/<slug>/" }, /* @__PURE__ */ React.createElement(A2.Input, { value: post.slug, onChange: (v) => setF("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "-")) })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Visibility", hint: "draft = hidden from site & feeds" }, /* @__PURE__ */ React.createElement(A2.Toggle, { checked: !post.draft, onChange: (v) => setF("draft", !v), label: post.draft ? "DRAFT" : "PUBLIC" }))), /* @__PURE__ */ React.createElement("div", { className: "split-2" }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "Type", hint: "e.g. security, release \u2014 used in log chrome" }, /* @__PURE__ */ React.createElement(
      A2.Select,
      {
        value: post.type,
        onChange: (v) => setF("type", v),
        options: [{ value: "notes", label: "notes" }, { value: "release", label: "release" }, { value: "essay", label: "essay" }, { value: "security", label: "security" }, { value: "infra", label: "infra" }]
      }
    )), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Tags", hint: "drives /log/tags/<tag>/" }, /* @__PURE__ */ React.createElement(
      A2.Chips,
      {
        values: post.tags,
        onChange: (v) => setF("tags", v),
        suggestions: ["release", "essay", "security", "notes", "infra"]
      }
    ))), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Title", req: true }, /* @__PURE__ */ React.createElement(A2.Input, { value: post.title, onChange: (v) => setF("title", v) })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Body \xB7 Markdown", hint: "GFM with unsafe HTML allowed by your renderer." }, /* @__PURE__ */ React.createElement("div", { className: "md-editor", style: { minHeight: 380 } }, /* @__PURE__ */ React.createElement("textarea", { value: post.body, onChange: (e) => setF("body", e.target.value) }), /* @__PURE__ */ React.createElement("div", { className: "md-preview", dangerouslySetInnerHTML: { __html: A2.mdRender(post.body) } }))), /* @__PURE__ */ React.createElement("hr", { style: { margin: "16px 0" } }), /* @__PURE__ */ React.createElement("div", { className: "dim tiny", style: { marginBottom: 8 } }, "// DETACHED SIGS \xB7 API / Mongo (optional; verified server-side on POST /api/posts). Use only one of OpenPGP or minisig per post."), /* @__PURE__ */ React.createElement(A2.FRow, { label: "OpenPGP detached (armored)", hint: "Full ASCII block; only one of OpenPGP or minisign." }, /* @__PURE__ */ React.createElement("textarea", { className: "inp", style: { width: "100%", minHeight: 72, fontFamily: "monospace", fontSize: 10 }, value: post.openpgp_sig || "", onChange: (e) => setF("openpgp_sig", e.target.value), placeholder: "-----BEGIN PGP SIGNATURE----- \u2026" })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Minisig (detached)", hint: "Paste full .minisig file; must verify against signing.pub on server." }, /* @__PURE__ */ React.createElement("textarea", { className: "inp", style: { width: "100%", minHeight: 56, fontFamily: "monospace", fontSize: 10 }, value: post.minisig || "", onChange: (e) => setF("minisig", e.target.value), placeholder: "untrusted comment: \u2026" }))), tab === "meta" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "split-3" }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "Date", req: true, hint: "YYYY.MM.DD or YYYY-MM-DD" }, /* @__PURE__ */ React.createElement(A2.Input, { value: post.date, onChange: (v) => setF("date", v) })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Time UTC" }, /* @__PURE__ */ React.createElement(A2.Input, { value: post.time, onChange: (v) => setF("time", v), placeholder: "HH:MM" })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Filename" }, /* @__PURE__ */ React.createElement("div", { className: "dim mono", style: { fontSize: 11 } }, "content/blog/", post.date.replace(/\./g, "-"), "-", post.slug, ".md"))), /* @__PURE__ */ React.createElement("hr", { style: { margin: "16px 0" } }), /* @__PURE__ */ React.createElement("div", { className: "dim tiny", style: { marginBottom: 10 } }, "// METRICS \xB7 dynamic overlay (", /* @__PURE__ */ React.createElement("code", null, "content/blog/metrics.json"), " keyed by slug)"), /* @__PURE__ */ React.createElement("div", { className: "split-2", style: { fontSize: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim tiny" }, "BYTES"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 4 } }, mp.bytes || "\u2014")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim tiny" }, "REACH"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 4 } }, mp.reach || "\u2014"))), /* @__PURE__ */ React.createElement("p", { className: "dim", style: { fontSize: 10, marginTop: 12 } }, "Bytes and reach are not edited per-post here; update metrics or front matter at publish time.")), tab === "raw" && /* @__PURE__ */ React.createElement("pre", { className: "yaml-view" }, `---
title: ${JSON.stringify(post.title)}
date: ${post.date.replace(/\./g, "-")}
time: ${post.time || ""}
slug: ${post.slug}
type: ${post.type}
tags: [${post.tags.join(", ")}]
draft: ${post.draft ? "true" : "false"}
# bytes / reach \u2192 metrics.json or build pipeline
---

${post.body}
${(post.openpgp_sig || "").trim() ? `
# + detached OpenPGP armored (${(post.openpgp_sig || "").trim().length} chars) \u2192 POST /api/posts as detached_openpgp_sig
` : ""}${(post.minisig || "").trim() ? `
# + minisig (${(post.minisig || "").trim().length} chars) \u2192 POST /api/posts as detached_minisig
` : ""}`), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 14 } }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm danger", onClick: onDelete }, "delete post"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => setF("draft", true) }, "save as draft"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", onClick: () => {
      setF("draft", false);
      onClose();
    } }, "publish & close")))));
  }
  function SecPosts({ state, set }) {
    const [editIdx, setEditIdx] = useS_a3(-1);
    const [filter, setFilter] = useS_a3("all");
    const [q, setQ] = useS_a3("");
    const [pendingDel, setPendingDel] = useS_a3(null);
    const M2 = window.VModals;
    const setPosts = (v) => set({ ...state, posts: v });
    const filtered = state.posts.map((p, i) => ({ p, i })).filter(({ p }) => {
      if (filter === "draft" && !p.draft) return false;
      if (filter === "public" && p.draft) return false;
      if (filter !== "all" && filter !== "draft" && filter !== "public" && !p.tags.includes(filter)) return false;
      if (q && !(p.title + p.slug + p.body).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    const add = () => {
      const today = /* @__PURE__ */ new Date();
      const d = `${String(today.getFullYear()).slice(-2)}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
      const next = [{ date: d, time: "00:00", title: "Untitled", slug: "untitled-" + Date.now().toString(36), type: "notes", tags: [], draft: true, body: "", openpgp_sig: "", minisig: "" }, ...state.posts];
      setPosts(next);
      setEditIdx(0);
    };
    const del = (i) => {
      setPosts(state.posts.filter((_, j) => j !== i));
      setEditIdx(-1);
    };
    const counts = useM_a2(() => ({
      all: state.posts.length,
      draft: state.posts.filter((p) => p.draft).length,
      public: state.posts.filter((p) => !p.draft).length,
      signed: state.posts.filter(
        (p) => !!(p.openpgp_sig || "").trim() || !!(p.minisig || "").trim() || !!(p.signature_kind || "").trim() || p.signed
      ).length
    }), [state.posts]);
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A2.H, { num: "08", title: "BLOG POSTS", sub: `${state.posts.length} posts \xB7 ${counts.draft} drafts \xB7 ${counts.signed} signed` }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Posts live at ", /* @__PURE__ */ React.createElement("code", null, "content/blog/YYYY-MM-DD-slug.md"), " with YAML front matter. Drafts are excluded from site and feeds. Bytes/reach come from ", /* @__PURE__ */ React.createElement("code", null, "content/blog/metrics.json"), " (slug overlay), not the per-post editor."), /* @__PURE__ */ React.createElement(A2.Card, { title: "POSTS", right: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("input", { className: "inp", style: { width: 200, marginRight: 8 }, placeholder: "search title/body\u2026", value: q, onChange: (e) => setQ(e.target.value) }), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", onClick: add }, "+ new post")) }, /* @__PURE__ */ React.createElement("div", { className: "cl-filterbar", style: { borderTop: 0, borderLeft: 0, borderRight: 0 } }, /* @__PURE__ */ React.createElement("span", { className: "tiny dim" }, "FILTER \u25B8"), [
      { id: "all", label: `ALL (${counts.all})` },
      { id: "public", label: `PUBLIC (${counts.public})` },
      { id: "draft", label: `DRAFT (${counts.draft})` },
      { id: "release", label: "RELEASE" },
      { id: "essay", label: "ESSAY" },
      { id: "security", label: "SECURITY" },
      { id: "notes", label: "NOTES" }
    ].map((f) => /* @__PURE__ */ React.createElement("span", { key: f.id, className: "cl-filter" + (filter === f.id ? " on" : ""), onClick: () => setFilter(f.id) }, f.label))), /* @__PURE__ */ React.createElement("div", { className: "post-row head" }, /* @__PURE__ */ React.createElement("span", null, "date"), /* @__PURE__ */ React.createElement("span", null, "title \xB7 slug"), /* @__PURE__ */ React.createElement("span", null, "tags"), /* @__PURE__ */ React.createElement("span", null, "type"), /* @__PURE__ */ React.createElement("span", null, "signed"), /* @__PURE__ */ React.createElement("span", null, "metrics"), /* @__PURE__ */ React.createElement("span", null)), filtered.map(({ p, i }) => {
      const m = state.metrics[p.slug] || {};
      return /* @__PURE__ */ React.createElement("div", { key: i, className: "post-row" + (p.draft ? " draft" : "") + (editIdx === i ? "" : "") }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700 } }, p.date), /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 10 } }, p.time)), /* @__PURE__ */ React.createElement("div", { style: { minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "ttl" }, p.title, p.draft && /* @__PURE__ */ React.createElement("span", { className: "cl-tag", style: { marginLeft: 8, borderColor: "var(--warn)", color: "var(--warn)", fontSize: 9 } }, "DRAFT")), /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 10 } }, "/", p.slug)), /* @__PURE__ */ React.createElement("div", { className: "tag-cell" }, p.tags.map((t) => /* @__PURE__ */ React.createElement("span", { key: t, className: "cl-tag", style: { fontSize: 9 } }, t))), /* @__PURE__ */ React.createElement("div", { className: "dim" }, p.type), /* @__PURE__ */ React.createElement("div", null, !!(p.openpgp_sig || "").trim() || !!(p.minisig || "").trim() || p.signature_kind && p.signature_kind !== "" || p.signed ? /* @__PURE__ */ React.createElement("span", { className: "signed", title: p.signature_kind || "local" }, "\u25CF SIG") : /* @__PURE__ */ React.createElement("span", { className: "unsigned" }, "\u25CB \u2014")), /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 10 } }, m.bytes || "\u2014", " \xB7 ", m.reach || "\u2014"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => setEditIdx(editIdx === i ? -1 : i) }, editIdx === i ? "close" : "edit")));
    }), filtered.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: 24, textAlign: "center", color: "var(--dim)" } }, "// no posts match"), editIdx >= 0 && state.posts[editIdx] && /* @__PURE__ */ React.createElement(
      PostEditor,
      {
        post: state.posts[editIdx],
        metricsPreview: state.metrics[state.posts[editIdx].slug] || {},
        onChange: (p) => {
          const old = state.posts[editIdx];
          const newPosts = state.posts.map((x, i) => i === editIdx ? p : x);
          let newMetrics = state.metrics;
          if (old.slug !== p.slug && state.metrics[old.slug]) {
            newMetrics = { ...state.metrics, [p.slug]: state.metrics[old.slug] };
            delete newMetrics[old.slug];
          }
          set({ ...state, posts: newPosts, metrics: newMetrics });
        },
        onClose: () => setEditIdx(-1),
        onDelete: () => {
          const p = state.posts[editIdx];
          setPendingDel({
            index: editIdx,
            target: {
              name: p.title || "POST",
              path: "/log/" + (p.slug || "") + "/",
              detail: (p.draft ? "Draft \xB7 " : "Public \xB7 ") + "removes this entry from working posts."
            }
          });
        }
      }
    )), M2 && pendingDel && /* @__PURE__ */ React.createElement(
      M2.ConfirmDestroyModal,
      {
        open: true,
        onClose: () => setPendingDel(null),
        phrase: "DELETE",
        target: pendingDel.target,
        onConfirm: () => {
          del(pendingDel.index);
          setPendingDel(null);
        }
      }
    ), /* @__PURE__ */ React.createElement(A2.Card, { title: "SIGNING \xB7 PUBLIC KEY", right: /* @__PURE__ */ React.createElement("span", { className: "dim" }, "/signing.pub") }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "Public key file", hint: "content/blog/signing.pub \u2192 copied to /signing.pub at build" }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("input", { type: "file", style: { display: "none" }, id: "pubkey-up" }), /* @__PURE__ */ React.createElement("label", { htmlFor: "pubkey-up", className: "btn-sm", style: { cursor: "pointer" } }, "upload .pub"), /* @__PURE__ */ React.createElement("span", { className: "dim", style: { alignSelf: "center", fontSize: 11 } }, "signing.pub \xB7 uploaded 26.04.28"))), /* @__PURE__ */ React.createElement("div", { className: "readonly-note" }, "Private key never lives here. Sign offline with ", /* @__PURE__ */ React.createElement("code", null, "elvishsign"), " in trusted environment.")));
  }
  function SecSigningPGP() {
    const [keys, setKeys] = useS_a3([]);
    const [listErr, setListErr] = useS_a3("");
    const [armored, setArmored] = useS_a3("");
    const [label, setLabel] = useS_a3("");
    const [phase, setPhase] = useS_a3("idle");
    const [msg, setMsg] = useS_a3("");
    const refresh = () => {
      setListErr("");
      fetch("/pgp/keys.json", { credentials: "same-origin" }).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }).then((data) => setKeys(Array.isArray(data) ? data : [])).catch(() => {
        setKeys([]);
        setListErr("Could not load keys (empty Mongo, or server error).");
      });
    };
    useE_a2(() => {
      refresh();
    }, []);
    const upload = async () => {
      setMsg("");
      if (!armored.trim()) {
        setMsg("Paste an armored public key block (BEGIN PGP PUBLIC KEY BLOCK).");
        return;
      }
      if (/BEGIN PGP PRIVATE KEY/i.test(armored) || /BEGIN PRIVATE KEY/i.test(armored)) {
        setMsg("Private key blocks are rejected.");
        return;
      }
      setPhase("uploading");
      try {
        const res = await fetch("/api/pgp/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ armored: armored.trim(), label: label.trim() })
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPhase("idle");
          setMsg(j.error || "upload failed");
          return;
        }
        setPhase("ok");
        setArmored("");
        setLabel("");
        setMsg("Stored \xB7 fingerprint " + (j.fingerprint16 || ""));
        refresh();
        setTimeout(() => setPhase("idle"), 1500);
      } catch (e) {
        setPhase("idle");
        setMsg("network error");
      }
    };
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A2.H, { num: "09", title: "OPENPGP \xB7 PUBLIC KEYS", sub: "armored upload \xB7 verify log posts" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Keys are stored in MongoDB and published at ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "/pgp/keys.json"), " and ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "/pgp/key/<fp16>.asc"), ". Upload requires an ", /* @__PURE__ */ React.createElement("a", { href: "/login" }, "admin"), " session. Import disk posts with ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "go run ./cmd/elvishserver -root . -migrate"), " (Mongo) or ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "POST /api/migrate/posts"), " as admin."), /* @__PURE__ */ React.createElement(A2.Card, { title: "INSTALLED KEYS", right: /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", onClick: refresh }, "refresh") }, listErr && /* @__PURE__ */ React.createElement("div", { className: "readonly-note", style: { marginBottom: 10 } }, listErr), keys.length === 0 && !listErr && /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No keys yet."), /* @__PURE__ */ React.createElement("ul", { style: { listStyle: "none", padding: 0, margin: 0 } }, keys.map((k) => /* @__PURE__ */ React.createElement("li", { key: k.fingerprint16, style: { borderBottom: "1px solid var(--line)", padding: "10px 0", fontSize: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent)", fontWeight: 700 } }, k.fingerprint16), k.label && /* @__PURE__ */ React.createElement("span", { className: "dim", style: { marginLeft: 10 } }, k.label), /* @__PURE__ */ React.createElement("div", { className: "dim mono", style: { marginTop: 4, fontSize: 11 } }, /* @__PURE__ */ React.createElement("a", { href: k.url, style: { color: "var(--accent)" } }, k.url)))))), /* @__PURE__ */ React.createElement(A2.Card, { title: "UPLOAD ARMORED PUBLIC KEY" }, /* @__PURE__ */ React.createElement(A2.FRow, { label: "Label", hint: "optional note" }, /* @__PURE__ */ React.createElement(A2.Input, { value: label, onChange: setLabel, placeholder: "e.g. laptop primary" })), /* @__PURE__ */ React.createElement(A2.FRow, { label: "Armored key", req: true, hint: "BEGIN PGP PUBLIC KEY BLOCK \u2026 END PGP PUBLIC KEY BLOCK" }, /* @__PURE__ */ React.createElement(A2.Textarea, { value: armored, onChange: setArmored, tall: true, placeholder: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n...\n-----END PGP PUBLIC KEY BLOCK-----" })), msg && /* @__PURE__ */ React.createElement("div", { className: "auth-status " + (phase === "ok" ? "ok" : "err"), style: { marginTop: 8 } }, msg), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm primary", disabled: phase === "uploading", onClick: upload }, phase === "uploading" ? "\u2026" : "\u25B8 upload to server"))));
  }
  var A2, useS_a3, useM_a2, useE_a2, useR_a2, TOOL_MONITOR_TYPES;
  var init_admin_sections_2 = __esm({
    "../static/admin/admin-sections-2.jsx"() {
      A2 = window.adm;
      ({ useState: useS_a3, useMemo: useM_a2, useEffect: useE_a2, useRef: useR_a2 } = React);
      TOOL_MONITOR_TYPES = [
        { value: "http", label: "HTTP(S)" },
        { value: "http_keyword", label: "HTTP keyword" },
        { value: "http_json", label: "HTTP JSON" },
        { value: "tcp", label: "TCP" },
        { value: "ping", label: "Ping (TCP open)" },
        { value: "dns", label: "DNS" },
        { value: "websocket", label: "WebSocket (stub)" },
        { value: "push", label: "Push (stub)" }
      ];
      window.SecTools = SecTools;
      window.SecPosts = SecPosts;
      window.SecSigningPGP = SecSigningPGP;
    }
  });

  // ../static/admin/admin-uptime.jsx
  function SecUptime() {
    const [me, setMe] = useS_u(null);
    const [data, setData] = useS_u(null);
    const [err, setErr] = useS_u("");
    const [msg, setMsg] = useS_u("");
    const [form, setForm] = useS_u({
      enabled: true,
      interval: "5m",
      base_url: "",
      include_tools_from_home: true,
      endpoints: []
    });
    const [saving, setSaving] = useS_u(false);
    const [showClearConfirm, setShowClearConfirm] = useS_u(false);
    const [clearing, setClearing] = useS_u(false);
    useE_u(() => {
      fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json()).then((j) => setMe(j.user || null)).catch(() => setMe(null));
    }, []);
    const load = () => {
      setErr("");
      setMsg("");
      fetch("/api/admin/uptime", { credentials: "include" }).then((r) => {
        if (r.status === 401 || r.status === 403) throw new Error("admin login required");
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }).then((d) => {
        setData(d);
        if (d.settings) {
          setForm({
            enabled: d.settings.enabled !== false,
            interval: d.settings.interval || "5m",
            base_url: d.settings.base_url || "",
            include_tools_from_home: d.settings.include_tools_from_home !== false,
            endpoints: Array.isArray(d.settings.endpoints) ? d.settings.endpoints.map((x) => ({ ...x })) : []
          });
        }
      }).catch((e) => setErr(String(e.message || e)));
    };
    useE_u(() => {
      if (me && me.is_admin) load();
    }, [me]);
    const save = () => {
      setSaving(true);
      setErr("");
      setMsg("");
      fetch("/api/admin/uptime", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || String(r.status));
        return j;
      }).then(() => {
        setMsg("Saved.");
        load();
      }).catch((e) => setErr(String(e.message || e))).finally(() => setSaving(false));
    };
    const addEndpoint = () => {
      setForm((f) => ({
        ...f,
        endpoints: [...f.endpoints, { id: "check_" + Date.now().toString(36), url: "/", method: "HEAD" }]
      }));
    };
    const setEp = (i, patch) => {
      setForm((f) => {
        const next = f.endpoints.slice();
        next[i] = { ...next[i], ...patch };
        return { ...f, endpoints: next };
      });
    };
    const delEp = (i) => {
      setForm((f) => ({ ...f, endpoints: f.endpoints.filter((_, j) => j !== i) }));
    };
    if (!me) {
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A3.H, { num: "11", title: "UPTIME", sub: "HTTP checks \xB7 logs \xB7 admin only" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, /* @__PURE__ */ React.createElement("a", { href: "/login" }, "Log in"), " to manage uptime."));
    }
    if (!me.is_admin) {
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(A3.H, { num: "11", title: "UPTIME", sub: "HTTP checks \xB7 logs \xB7 admin only" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Your account is not an admin. Set ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "ELVISH_ADMIN_EMAILS"), " or promote the first registered user."));
    }
    const latest = data && data.latest;
    const agg = data && data.aggregate;
    const runs = data && data.runs || [];
    return /* @__PURE__ */ React.createElement("div", { "data-testid": "admin-uptime-panel" }, /* @__PURE__ */ React.createElement(A3.H, { num: "11", title: "UPTIME", sub: "in-process probes \xB7 SQL logs \xB7 public /api/uptime.json" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Monitoring is ", /* @__PURE__ */ React.createElement("strong", null, "on by default"), " (5m). Interval, probe base URL, and ", /* @__PURE__ */ React.createElement("strong", null, "other HTTP checks"), " below persist in CockroachDB/Postgres when enabled. Static rows live in ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "content/uptime.json"), "; per-tool monitors live under ", /* @__PURE__ */ React.createElement("strong", null, "TOOLS"), ". Use ", /* @__PURE__ */ React.createElement("strong", null, "other checks"), " for extra hosts (CDN, Vaultwarden, APIs) that are not a home tool card."), data && data.note && /* @__PURE__ */ React.createElement("div", { className: "readonly-note", style: { marginBottom: 12 } }, data.note), err && /* @__PURE__ */ React.createElement("div", { className: "auth-status err", style: { marginBottom: 12 } }, err), msg && /* @__PURE__ */ React.createElement("div", { className: "auth-status ok", style: { marginBottom: 12 } }, msg), /* @__PURE__ */ React.createElement(A3.Card, { title: "SETTINGS", right: /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm primary", disabled: saving || !data?.persist, onClick: save }, saving ? "\u2026" : "\u25B8 save") }, !data?.persist && /* @__PURE__ */ React.createElement("div", { className: "readonly-note", style: { marginBottom: 12 } }, "Save disabled until the database pool is configured."), /* @__PURE__ */ React.createElement(A3.FRow, { label: "Enabled", hint: "Turn all HTTP checks off without restarting the server." }, /* @__PURE__ */ React.createElement(A3.Toggle, { checked: form.enabled, onChange: (v) => setForm((f) => ({ ...f, enabled: v })), label: form.enabled ? "ON" : "OFF" })), /* @__PURE__ */ React.createElement(A3.FRow, { label: "Interval", req: true, hint: "Go duration, e.g. 5m, 10m, 1h (minimum 10s enforced server-side)." }, /* @__PURE__ */ React.createElement(A3.Input, { value: form.interval, onChange: (v) => setForm((f) => ({ ...f, interval: v })) })), /* @__PURE__ */ React.createElement(A3.FRow, { label: "Probe base URL", hint: "Leave empty to use ELVISH_UPTIME_BASE_URL / listen address fallback." }, /* @__PURE__ */ React.createElement(A3.Input, { value: form.base_url, onChange: (v) => setForm((f) => ({ ...f, base_url: v })), placeholder: "https://your-public-host" })), /* @__PURE__ */ React.createElement(A3.FRow, { label: "Include tools from home", hint: "Adds GET/HEAD per tool: default open_href rules else /{slug}/; skipped when a tool has an enabled uptime monitor (that check runs separately). Hidden tools omitted." }, /* @__PURE__ */ React.createElement(A3.Toggle, { checked: form.include_tools_from_home, onChange: (v) => setForm((f) => ({ ...f, include_tools_from_home: v })), label: form.include_tools_from_home ? "YES" : "NO" })), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" } }, /* @__PURE__ */ React.createElement("div", { className: "ftk", style: { marginBottom: 6 } }, "// OTHER MONITORING"), /* @__PURE__ */ React.createElement("p", { className: "dim", style: { fontSize: 11, lineHeight: 1.5, margin: "0 0 10px" } }, "Arbitrary HTTP targets (HEAD or GET). Each row needs a stable ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "id"), " (shows on ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "/status/"), ") and a full URL or a path under the probe base above. Saved with ", /* @__PURE__ */ React.createElement("strong", null, "\u25B8 save"), "."), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm primary", disabled: !data?.persist, onClick: addEndpoint }, "+ add check")), form.endpoints.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "dim", style: { marginTop: 10, fontSize: 11 } }, "No extra checks \u2014 optional."), form.endpoints.map((ep, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "split-3", style: { marginTop: 12, alignItems: "flex-end" } }, /* @__PURE__ */ React.createElement(A3.FRow, { label: "ID", req: true, hint: "Probe key, e.g. cdn_edge or vault_health." }, /* @__PURE__ */ React.createElement(A3.Input, { value: ep.id, onChange: (v) => setEp(i, { id: v }) })), /* @__PURE__ */ React.createElement(A3.FRow, { label: "URL or path", req: true, hint: "https://\u2026 or /path under probe base." }, /* @__PURE__ */ React.createElement(A3.Input, { value: ep.url, onChange: (v) => setEp(i, { url: v }) })), /* @__PURE__ */ React.createElement(A3.FRow, { label: "Method" }, /* @__PURE__ */ React.createElement(A3.Seg, { value: (ep.method || "HEAD").toUpperCase(), onChange: (v) => setEp(i, { method: v }), options: [{ value: "HEAD", label: "HEAD" }, { value: "GET", label: "GET" }] })), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm danger", onClick: () => delEp(i) }, "remove")))), /* @__PURE__ */ React.createElement(A3.Card, { title: "LIVE SNAPSHOT", right: /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", onClick: load }, "refresh") }, !latest && /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No probe completed yet."), latest && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "checked_at"), " \xB7 ", String(latest.checked_at || "")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8 } }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "monthly (UTC)"), latest.stats_period_utc ? /* @__PURE__ */ React.createElement("span", { className: "dim" }, " \xB7 ", latest.stats_period_utc) : null, " ", "\xB7 ", latest.overall_uptime_pct != null ? latest.overall_uptime_pct.toFixed(2) : "\u2014", "%", " ", "(", latest.overall_ok || 0, " ok / ", (latest.overall_ok || 0) + (latest.overall_fail || 0), " total)"), /* @__PURE__ */ React.createElement("table", { className: "adm-mini-table", style: { width: "100%", marginTop: 12, borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { align: "left" }, "id"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "url"), /* @__PURE__ */ React.createElement("th", null, "ok"), /* @__PURE__ */ React.createElement("th", null, "ms"), /* @__PURE__ */ React.createElement("th", null, "status"))), /* @__PURE__ */ React.createElement("tbody", null, (latest.targets || []).map((t) => /* @__PURE__ */ React.createElement("tr", { key: t.id + t.url }, /* @__PURE__ */ React.createElement("td", { style: { fontFamily: "var(--mono)" } }, t.id), /* @__PURE__ */ React.createElement("td", { className: "dim", style: { maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, t.url), /* @__PURE__ */ React.createElement("td", null, t.ok ? "\u25CF" : "\u25CB"), /* @__PURE__ */ React.createElement("td", null, t.latency_ms), /* @__PURE__ */ React.createElement("td", null, t.status_code, t.error ? /* @__PURE__ */ React.createElement("span", { className: "dim" }, " \xB7 ", t.error) : null))))))), /* @__PURE__ */ React.createElement(A3.Card, { title: "THIS MONTH (UTC) \xB7 AGGREGATE" }, !agg && /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No aggregate yet (first successful probe with Mongo will create it)."), agg && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12 } }, agg.period_ym && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "period_ym"), " \xB7 ", agg.period_ym), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "started_at"), " \xB7 ", agg.started_at || "\u2014"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "updated_at"), " \xB7 ", agg.updated_at || "\u2014"), /* @__PURE__ */ React.createElement("table", { className: "adm-mini-table", style: { width: "100%", marginTop: 12, borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { align: "left" }, "target"), /* @__PURE__ */ React.createElement("th", null, "ok"), /* @__PURE__ */ React.createElement("th", null, "fail"), /* @__PURE__ */ React.createElement("th", null, "%"))), /* @__PURE__ */ React.createElement("tbody", null, Object.entries(agg.targets || {}).map(([k, v]) => {
      const t = v || {};
      const n = (t.ok || 0) + (t.fail || 0);
      const pct = n ? (100 * (t.ok || 0) / n).toFixed(2) : "\u2014";
      return /* @__PURE__ */ React.createElement("tr", { key: k }, /* @__PURE__ */ React.createElement("td", { style: { fontFamily: "var(--mono)" } }, t.id || k), /* @__PURE__ */ React.createElement("td", null, t.ok || 0), /* @__PURE__ */ React.createElement("td", null, t.fail || 0), /* @__PURE__ */ React.createElement("td", null, pct));
    }))))), /* @__PURE__ */ React.createElement(
      A3.Card,
      {
        title: "RUN LOG",
        right: /* @__PURE__ */ React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "newest first"), /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            className: "btn-sm danger",
            disabled: !data?.persist || runs.length === 0,
            title: "Deletes all documents in uptime_runs (does not reset monthly counters)",
            onClick: () => setShowClearConfirm(true)
          },
          "clear log"
        ))
      },
      runs.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No runs logged yet."),
      runs.map((run) => /* @__PURE__ */ React.createElement("details", { key: run._id || run.at, style: { marginBottom: 10, borderBottom: "1px solid var(--line)", paddingBottom: 8 } }, /* @__PURE__ */ React.createElement("summary", { style: { cursor: "pointer", fontSize: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent)" } }, "\u25B8"), " ", run.at, " \xB7 ", (run.results || []).length, " targets"), /* @__PURE__ */ React.createElement("table", { className: "adm-mini-table", style: { width: "100%", marginTop: 8, fontSize: 11, borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("tbody", null, (run.results || []).map((t, j) => /* @__PURE__ */ React.createElement("tr", { key: j }, /* @__PURE__ */ React.createElement("td", null, t.id), /* @__PURE__ */ React.createElement("td", { className: "dim", style: { maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" } }, t.url), /* @__PURE__ */ React.createElement("td", null, t.ok ? "ok" : "FAIL"), /* @__PURE__ */ React.createElement("td", null, t.latency_ms, "ms")))))))
    ), showClearConfirm && /* @__PURE__ */ React.createElement("div", { className: "modal-overlay", onClick: (e) => {
      if (e.target === e.currentTarget && !clearing) setShowClearConfirm(false);
    } }, /* @__PURE__ */ React.createElement("div", { style: { background: "var(--bg)", border: "1px solid var(--fg)", maxWidth: 420, width: "90%", position: "relative" } }, /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: -1, left: -1, width: 6, height: 6, background: "var(--accent)" } }), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: -1, right: -1, width: 6, height: 6, background: "var(--accent)" } }), /* @__PURE__ */ React.createElement("div", { style: { padding: "14px 18px", borderBottom: "1px solid var(--fg)", display: "flex", alignItems: "center", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" } }, "Confirm Clear"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-close", onClick: () => setShowClearConfirm(false), disabled: clearing }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { padding: 18 } }, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 } }, "Delete all uptime run log entries? This cannot be undone."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10 } }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", onClick: () => setShowClearConfirm(false), disabled: clearing }, "Cancel"), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn-sm danger",
        disabled: clearing,
        onClick: () => {
          setClearing(true);
          setErr("");
          setMsg("");
          fetch("/api/admin/uptime/runs", { method: "DELETE", credentials: "include" }).then(async (r) => {
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || String(r.status));
            return j;
          }).then((j) => {
            setMsg(`Cleared run log (${j.deleted ?? 0} deleted).`);
            setShowClearConfirm(false);
            load();
          }).catch((e) => setErr(String(e.message || e))).finally(() => setClearing(false));
        }
      },
      clearing ? "Clearing..." : "Clear Log"
    ))))));
  }
  var A3, useS_u, useE_u;
  var init_admin_uptime = __esm({
    "../static/admin/admin-uptime.jsx"() {
      A3 = window.adm;
      ({ useState: useS_u, useEffect: useE_u } = React);
      window.SecUptime = SecUptime;
    }
  });

  // ../static/admin/admin-telemetry.jsx
  function SecTelemetry() {
    const [me, setMe] = useS_t(null);
    const [data, setData] = useS_t(null);
    const [err, setErr] = useS_t("");
    const [msg, setMsg] = useS_t("");
    const [saving, setSaving] = useS_t(false);
    const [exporting, setExporting] = useS_t(false);
    const [exportDays, setExportDays] = useS_t("30");
    const [form, setForm] = useS_t({
      enabled: false,
      retention_days: 30,
      export_enabled: true
    });
    useE_t(() => {
      fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json()).then((j) => setMe(j.user || null)).catch(() => setMe(null));
    }, []);
    const load = () => {
      setErr("");
      setMsg("");
      fetch("/api/admin/telemetry", { credentials: "include" }).then((r) => {
        if (r.status === 401 || r.status === 403) throw new Error("admin login required");
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }).then((d) => {
        setData(d);
        if (d.settings) {
          setForm({
            enabled: d.settings.enabled === true,
            retention_days: Number(d.settings.retention_days || 30),
            export_enabled: d.settings.export_enabled !== false
          });
          setExportDays(String(d.settings.retention_days || 30));
        }
      }).catch((e) => setErr(String(e.message || e)));
    };
    useE_t(() => {
      if (me && me.is_admin) load();
    }, [me]);
    const save = () => {
      setSaving(true);
      setErr("");
      setMsg("");
      fetch("/api/admin/telemetry", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: !!form.enabled,
          retention_days: Number(form.retention_days || 30),
          export_enabled: !!form.export_enabled
        })
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || String(r.status));
        return j;
      }).then(() => {
        setMsg("Saved.");
        load();
      }).catch((e) => setErr(String(e.message || e))).finally(() => setSaving(false));
    };
    const downloadExport = async () => {
      setExporting(true);
      setErr("");
      setMsg("");
      try {
        const r = await fetch("/api/admin/telemetry/export", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: Number(exportDays || 30) })
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || String(r.status));
        }
        const blob = await r.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        const cd = r.headers.get("Content-Disposition") || "";
        const m = cd.match(/filename="([^"]+)"/);
        a.href = url;
        a.download = m && m[1] || "elvish-telemetry-export.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setMsg("Export downloaded.");
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setExporting(false);
      }
    };
    if (!me) {
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(AT.H, { num: "07", title: "TELEMETRY", sub: "anonymous operational rollups \xB7 admin only" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, /* @__PURE__ */ React.createElement("a", { href: "/login" }, "Log in"), " to manage telemetry."));
    }
    if (!me.is_admin) {
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(AT.H, { num: "07", title: "TELEMETRY", sub: "anonymous operational rollups \xB7 admin only" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Your account is not an admin. Set ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "ELVISH_ADMIN_EMAILS"), " or promote the first registered user."));
    }
    const summary = data && data.summary || [];
    const recent = data && data.recent || [];
    return /* @__PURE__ */ React.createElement("div", { "data-testid": "admin-telemetry-panel" }, /* @__PURE__ */ React.createElement(AT.H, { num: "07", title: "TELEMETRY", sub: "opt-in \xB7 aggregate-only \xB7 no identifiers" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Telemetry is ", /* @__PURE__ */ React.createElement("strong", null, "off by default"), ". When enabled, the server stores only coarse operational rollups such as request outcomes, background job runtimes, and delivery health. It does ", /* @__PURE__ */ React.createElement("strong", null, "not"), " persist user IDs, emails, IPs, message IDs, raw paths, domains, or any unique identifier. Export is manual only."), data && data.note && /* @__PURE__ */ React.createElement("div", { className: "readonly-note", style: { marginBottom: 12 } }, data.note), err && /* @__PURE__ */ React.createElement("div", { className: "auth-status err", style: { marginBottom: 12 } }, err), msg && /* @__PURE__ */ React.createElement("div", { className: "auth-status ok", style: { marginBottom: 12 } }, msg), /* @__PURE__ */ React.createElement(AT.Card, { title: "SETTINGS", right: /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm primary", disabled: saving || !data?.persist, onClick: save }, saving ? "\u2026" : "\u25B8 save") }, !data?.persist && /* @__PURE__ */ React.createElement("div", { className: "readonly-note", style: { marginBottom: 12 } }, "Save disabled until the database pool is configured."), /* @__PURE__ */ React.createElement(AT.FRow, { label: "Enabled", hint: "Opt in to local anonymous operational telemetry for this instance." }, /* @__PURE__ */ React.createElement(AT.Toggle, { checked: form.enabled, onChange: (v) => setForm((f) => ({ ...f, enabled: v })), label: form.enabled ? "ON" : "OFF" })), /* @__PURE__ */ React.createElement(AT.FRow, { label: "Retention (days)", req: true, hint: "Hourly aggregates kept in Cockroach/Postgres. Bounded to a short rolling window." }, /* @__PURE__ */ React.createElement(AT.Input, { value: String(form.retention_days || 30), onChange: (v) => setForm((f) => ({ ...f, retention_days: Number(v || 30) })) })), /* @__PURE__ */ React.createElement(AT.FRow, { label: "Manual export", hint: "Allow admins to download a bounded aggregate JSON report for optional sharing later." }, /* @__PURE__ */ React.createElement(AT.Toggle, { checked: form.export_enabled, onChange: (v) => setForm((f) => ({ ...f, export_enabled: v })), label: form.export_enabled ? "ON" : "OFF" }))), /* @__PURE__ */ React.createElement(AT.Card, { title: "MANUAL EXPORT", right: /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", disabled: exporting || !data?.persist || !form.export_enabled, onClick: downloadExport }, exporting ? "\u2026" : "download json") }, /* @__PURE__ */ React.createElement(AT.FRow, { label: "Window", hint: "Export bounded aggregate rollups only." }, /* @__PURE__ */ React.createElement(AT.Seg, { value: String(exportDays), onChange: (v) => setExportDays(String(v)), options: [
      { value: "7", label: "7D" },
      { value: "30", label: "30D" },
      { value: "90", label: "90D" }
    ] }))), /* @__PURE__ */ React.createElement(AT.Card, { title: "SUMMARY \xB7 LAST 7 DAYS" }, summary.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No telemetry summary yet."), summary.length > 0 && /* @__PURE__ */ React.createElement("table", { className: "adm-mini-table", style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { align: "left" }, "metric"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "area"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "result"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "status"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "transport"), /* @__PURE__ */ React.createElement("th", null, "count"), /* @__PURE__ */ React.createElement("th", null, "avg ms"), /* @__PURE__ */ React.createElement("th", null, "max ms"))), /* @__PURE__ */ React.createElement("tbody", null, summary.map((row, i) => /* @__PURE__ */ React.createElement("tr", { key: row.metric_name + row.feature_area + row.result + row.status_class + row.transport + i }, /* @__PURE__ */ React.createElement("td", { style: { fontFamily: "var(--mono)" } }, row.metric_name), /* @__PURE__ */ React.createElement("td", null, row.feature_area), /* @__PURE__ */ React.createElement("td", null, row.result), /* @__PURE__ */ React.createElement("td", null, row.status_class), /* @__PURE__ */ React.createElement("td", null, row.transport), /* @__PURE__ */ React.createElement("td", null, row.count || 0), /* @__PURE__ */ React.createElement("td", null, row.avg_ms != null ? Number(row.avg_ms).toFixed(1) : "\u2014"), /* @__PURE__ */ React.createElement("td", null, row.max_ms || 0)))))), /* @__PURE__ */ React.createElement(AT.Card, { title: "RECENT HOURLY ROLLUPS", right: /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", onClick: load }, "refresh") }, recent.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No recent rollups yet."), recent.length > 0 && /* @__PURE__ */ React.createElement("table", { className: "adm-mini-table", style: { width: "100%", borderCollapse: "collapse", fontSize: 11 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { align: "left" }, "bucket"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "metric"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "area"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "result"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "status"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "transport"), /* @__PURE__ */ React.createElement("th", null, "count"), /* @__PURE__ */ React.createElement("th", null, "sum ms"))), /* @__PURE__ */ React.createElement("tbody", null, recent.map((row, i) => /* @__PURE__ */ React.createElement("tr", { key: row.bucket_start + row.metric_name + row.feature_area + i }, /* @__PURE__ */ React.createElement("td", { className: "dim" }, row.bucket_start), /* @__PURE__ */ React.createElement("td", { style: { fontFamily: "var(--mono)" } }, row.metric_name), /* @__PURE__ */ React.createElement("td", null, row.feature_area), /* @__PURE__ */ React.createElement("td", null, row.result), /* @__PURE__ */ React.createElement("td", null, row.status_class), /* @__PURE__ */ React.createElement("td", null, row.transport), /* @__PURE__ */ React.createElement("td", null, row.count || 0), /* @__PURE__ */ React.createElement("td", null, row.sum_ms || 0)))))));
  }
  var AT, useS_t, useE_t;
  var init_admin_telemetry = __esm({
    "../static/admin/admin-telemetry.jsx"() {
      AT = window.adm;
      ({ useState: useS_t, useEffect: useE_t } = React);
      window.SecTelemetry = SecTelemetry;
    }
  });

  // ../static/admin/admin-auth-captcha.jsx
  function SecAuthCaptcha() {
    const [me, setMe] = useS_c(null);
    const [data, setData] = useS_c(null);
    const [err, setErr] = useS_c("");
    const [msg, setMsg] = useS_c("");
    const [saving, setSaving] = useS_c(false);
    const [form, setForm] = useS_c({
      enabled: false,
      widget_api_endpoint: "",
      secret: ""
    });
    useE_c(() => {
      fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json()).then((j) => setMe(j.user || null)).catch(() => setMe(null));
    }, []);
    const load = () => {
      setErr("");
      setMsg("");
      fetch("/api/admin/auth-captcha", { credentials: "include" }).then((r) => {
        if (r.status === 401 || r.status === 403) throw new Error("admin login required");
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }).then((d) => {
        setData(d);
        const st2 = d.settings || {};
        setForm({
          enabled: st2.enabled === true,
          widget_api_endpoint: typeof st2.widget_api_endpoint === "string" ? st2.widget_api_endpoint : "",
          secret: ""
        });
      }).catch((e) => setErr(String(e.message || e)));
    };
    useE_c(() => {
      if (me && me.is_admin) load();
    }, [me]);
    const save = () => {
      setSaving(true);
      setErr("");
      setMsg("");
      fetch("/api/admin/auth-captcha", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: !!form.enabled,
          widget_api_endpoint: String(form.widget_api_endpoint || "").trim(),
          secret: String(form.secret || "").trim()
        })
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || String(r.status));
        return j;
      }).then(() => {
        setMsg("Saved.");
        setForm((f) => ({ ...f, secret: "" }));
        load();
      }).catch((e) => setErr(String(e.message || e))).finally(() => setSaving(false));
    };
    if (!me) {
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(AT2.H, { num: "09", title: "LOGIN CAPTCHA", sub: "Cap \xB7 admin only" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, /* @__PURE__ */ React.createElement("a", { href: "/login" }, "Log in"), " to manage captcha settings."));
    }
    if (!me.is_admin) {
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(AT2.H, { num: "09", title: "LOGIN CAPTCHA", sub: "Cap \xB7 admin only" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Your account is not an admin."));
    }
    const st = data && data.settings || {};
    const persist = data && data.persist;
    return /* @__PURE__ */ React.createElement("div", { "data-testid": "admin-auth-captcha-panel" }, /* @__PURE__ */ React.createElement(AT2.H, { num: "09", title: "LOGIN CAPTCHA", sub: "Cap self-hosted \xB7 /login and /register" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Configure your ", /* @__PURE__ */ React.createElement("a", { href: "https://trycap.dev/", target: "_blank", rel: "noreferrer" }, "Cap"), " instance. Use the widget API URL from the Cap dashboard (form ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "https://your-host/<site-key>/"), "). The server verifies tokens at ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "/siteverify"), " on the same host."), !persist && /* @__PURE__ */ React.createElement("div", { className: "readonly-note", style: { marginBottom: 12 } }, "Database not configured \u2014 settings cannot be persisted."), err && /* @__PURE__ */ React.createElement("div", { className: "auth-status err", style: { marginBottom: 12 } }, err), msg && /* @__PURE__ */ React.createElement("div", { className: "auth-status ok", style: { marginBottom: 12 } }, msg), /* @__PURE__ */ React.createElement(AT2.Card, { title: "CAP SETTINGS", right: /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm primary", disabled: saving || !persist, onClick: save }, saving ? "\u2026" : "\u25B8 save") }, /* @__PURE__ */ React.createElement(AT2.FRow, { label: "Enabled", hint: "When on, /login and /register require a solved Cap token before SRP or registration proceeds." }, /* @__PURE__ */ React.createElement(AT2.Toggle, { checked: form.enabled, onChange: (v) => setForm((f) => ({ ...f, enabled: v })), label: form.enabled ? "ON" : "OFF" })), /* @__PURE__ */ React.createElement(AT2.FRow, { label: "Widget API URL", req: form.enabled, hint: "Exact Cap widget endpoint (https, includes site key path, trailing slash recommended)." }, /* @__PURE__ */ React.createElement(AT2.Input, { value: form.widget_api_endpoint, onChange: (v) => setForm((f) => ({ ...f, widget_api_endpoint: v })), placeholder: "https://cap.example.com/your-site-key/" })), /* @__PURE__ */ React.createElement(AT2.FRow, { label: "Secret", hint: "Site secret for server-side verification. Leave blank when saving to keep the current secret." }, /* @__PURE__ */ React.createElement(AT2.Input, { value: form.secret, onChange: (v) => setForm((f) => ({ ...f, secret: v })), placeholder: st.secret_configured ? "\u2022\u2022\u2022\u2022\u2022\u2022 (unchanged if empty)" : "paste secret from Cap dashboard" })), st.fully_active && /* @__PURE__ */ React.createElement("div", { className: "dim", style: { marginTop: 8 } }, "Status: ", /* @__PURE__ */ React.createElement("strong", null, "active"), " on public login and registration."), form.enabled && !st.fully_active && persist && /* @__PURE__ */ React.createElement("div", { className: "readonly-note", style: { marginTop: 8 } }, "Enabled but not active until both URL and secret are set.")));
  }
  var AT2, useS_c, useE_c;
  var init_admin_auth_captcha = __esm({
    "../static/admin/admin-auth-captcha.jsx"() {
      AT2 = window.adm;
      ({ useState: useS_c, useEffect: useE_c } = React);
      window.SecAuthCaptcha = SecAuthCaptcha;
    }
  });

  // ../static/admin/admin-performance.jsx
  function perfNum(value) {
    return Number(value || 0).toLocaleString();
  }
  function perfMS(value) {
    const n = Number(value || 0);
    if (!n) return "0 ms";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + " s";
    return n.toFixed(0) + " ms";
  }
  function perfPct(value) {
    const n = Number(value || 0);
    return (n * 100).toFixed(1) + "%";
  }
  function perfBucketLabel(name) {
    return {
      "lt_50ms": "<50ms",
      "ms_50_99": "50-99ms",
      "ms_100_249": "100-249ms",
      "ms_250_499": "250-499ms",
      "ms_500_999": "500-999ms",
      "ms_1000_1999": "1-2s",
      "ms_2000_4999": "2-5s",
      "ms_5000_9999": "5-10s",
      "ms_10000_plus": "10s+"
    }[name] || name;
  }
  function perfScopeFor(featureArea, transport) {
    const area = String(featureArea || "").toLowerCase();
    const tx = String(transport || "").toLowerCase();
    if (area === "admin_ui" || area === "admin_api") return "admin";
    if (area === "auth_ui" || area === "auth_api") return "auth";
    if (area === "home" || area === "public_page" || area === "site_api" || area === "static_asset") return "public";
    if (area.includes("mail") || area.includes("smtp") || area.includes("outbox") || area.includes("protected_link")) return "mail";
    if (tx === "browser") return "public";
    return "backend";
  }
  function perfMatchesScope(featureArea, transport, scope) {
    if (scope === "all") return true;
    if (scope === "backend") return String(transport || "").toLowerCase() !== "browser";
    return perfScopeFor(featureArea, transport) === scope;
  }
  function buildOverview(summaryRows, latencyRows, queue, uptime) {
    const out = {
      totalCount: 0,
      failureCount: 0,
      avgMS: 0,
      maxMS: 0,
      slowCount: 0,
      queuePending: Number(queue && queue.pending || 0),
      queueSending: Number(queue && queue.sending || 0),
      uptimePct: Number(uptime && uptime.overall_uptime_pct || 0)
    };
    let sumMS = 0;
    for (const row of summaryRows) {
      if (row.metric_name === "queue_health") continue;
      out.totalCount += Number(row.count || 0);
      if (row.result && row.result !== "success" && row.result !== "observed") {
        out.failureCount += Number(row.count || 0);
      }
      sumMS += Number(row.sum_ms || 0);
      out.maxMS = Math.max(out.maxMS, Number(row.max_ms || 0));
    }
    for (const row of latencyRows) {
      if (row.latency_bucket === "ms_2000_4999" || row.latency_bucket === "ms_5000_9999" || row.latency_bucket === "ms_10000_plus") {
        out.slowCount += Number(row.count || 0);
      }
    }
    if (out.totalCount > 0) out.avgMS = sumMS / out.totalCount;
    return out;
  }
  function buildLatencyTrend(rows) {
    const buckets = /* @__PURE__ */ new Map();
    for (const row of rows) {
      if (row.metric_name === "queue_health") continue;
      const hour = String(row.bucket_start || "");
      if (!hour) continue;
      const entry = buckets.get(hour) || { bucket: hour, browserSum: 0, browserCount: 0, backendSum: 0, backendCount: 0 };
      if (String(row.transport || "").toLowerCase() === "browser") {
        entry.browserSum += Number(row.sum_ms || 0);
        entry.browserCount += Number(row.count || 0);
      } else {
        entry.backendSum += Number(row.sum_ms || 0);
        entry.backendCount += Number(row.count || 0);
      }
      buckets.set(hour, entry);
    }
    return Array.from(buckets.values()).sort((a, b) => String(a.bucket).localeCompare(String(b.bucket))).map((row) => ({
      bucket: row.bucket,
      browser: row.browserCount ? row.browserSum / row.browserCount : 0,
      backend: row.backendCount ? row.backendSum / row.backendCount : 0
    }));
  }
  function buildFailureTrend(rows) {
    const buckets = /* @__PURE__ */ new Map();
    for (const row of rows) {
      if (row.metric_name === "queue_health") continue;
      const hour = String(row.bucket_start || "");
      if (!hour) continue;
      const entry = buckets.get(hour) || { bucket: hour, total: 0, failures: 0 };
      entry.total += Number(row.count || 0);
      if (row.result && row.result !== "success" && row.result !== "observed") {
        entry.failures += Number(row.count || 0);
      }
      buckets.set(hour, entry);
    }
    return Array.from(buckets.values()).sort((a, b) => String(a.bucket).localeCompare(String(b.bucket))).map((row) => ({
      bucket: row.bucket,
      failureRate: row.total ? row.failures / row.total : 0,
      failures: row.failures
    }));
  }
  function buildLatencyBuckets(rows) {
    const order = ["lt_50ms", "ms_50_99", "ms_100_249", "ms_250_499", "ms_500_999", "ms_1000_1999", "ms_2000_4999", "ms_5000_9999", "ms_10000_plus"];
    const counts = {};
    for (const key of order) counts[key] = 0;
    for (const row of rows) {
      counts[row.latency_bucket] = (counts[row.latency_bucket] || 0) + Number(row.count || 0);
    }
    return order.map((key) => ({ key, label: perfBucketLabel(key), count: counts[key] || 0 }));
  }
  function PerfLineChart({ title, points, keys }) {
    if (!points.length) return /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No data for this filter.");
    const width = 720;
    const height = 180;
    const pad = 18;
    const maxY = Math.max(1, ...points.flatMap((point) => keys.map((key) => Number(point[key.id] || 0))));
    const stepX = points.length <= 1 ? width - pad * 2 : (width - pad * 2) / (points.length - 1);
    const mkLine = (id) => points.map((point, idx) => {
      const value = Number(point[id] || 0);
      const x = pad + idx * stepX;
      const y = height - pad - (height - pad * 2) * value / maxY;
      return `${x},${y}`;
    }).join(" ");
    return /* @__PURE__ */ React.createElement("div", { className: "perf-chart-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "perf-chart-title" }, title), /* @__PURE__ */ React.createElement("svg", { className: "perf-chart", viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none" }, /* @__PURE__ */ React.createElement("line", { x1: pad, y1: height - pad, x2: width - pad, y2: height - pad, className: "perf-axis" }), /* @__PURE__ */ React.createElement("line", { x1: pad, y1: pad, x2: pad, y2: height - pad, className: "perf-axis" }), keys.map((key) => /* @__PURE__ */ React.createElement("polyline", { key: key.id, fill: "none", stroke: key.color, strokeWidth: "2.5", points: mkLine(key.id) }))), /* @__PURE__ */ React.createElement("div", { className: "perf-legend" }, keys.map((key) => /* @__PURE__ */ React.createElement("span", { key: key.id }, /* @__PURE__ */ React.createElement("span", { className: "perf-legend-dot", style: { background: key.color } }), key.label))), /* @__PURE__ */ React.createElement("div", { className: "perf-chart-labels" }, /* @__PURE__ */ React.createElement("span", null, String(points[0].bucket || "").slice(5, 16)), /* @__PURE__ */ React.createElement("span", null, String(points[points.length - 1].bucket || "").slice(5, 16))));
  }
  function PerfBarChart({ rows }) {
    const max = Math.max(1, ...rows.map((row) => Number(row.count || 0)));
    if (!rows.length) return /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No latency buckets yet.");
    return /* @__PURE__ */ React.createElement("div", { className: "perf-bars" }, rows.map((row) => /* @__PURE__ */ React.createElement("div", { key: row.key, className: "perf-bar-row" }, /* @__PURE__ */ React.createElement("span", { className: "perf-bar-label" }, row.label), /* @__PURE__ */ React.createElement("div", { className: "perf-bar-track" }, /* @__PURE__ */ React.createElement("span", { className: "perf-bar-fill", style: { width: `${row.count / max * 100}%` } })), /* @__PURE__ */ React.createElement("span", { className: "perf-bar-value" }, perfNum(row.count)))));
  }
  function SecPerformance() {
    const [me, setMe] = useS_p(null);
    const [data, setData] = useS_p(null);
    const [err, setErr] = useS_p("");
    const [msg, setMsg] = useS_p("");
    const [days, setDays] = useS_p("1");
    const [scope, setScope] = useS_p("all");
    const [loading, setLoading] = useS_p(false);
    const [exporting, setExporting] = useS_p(false);
    useE_p(() => {
      fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json()).then((j) => setMe(j.user || null)).catch(() => setMe(null));
    }, []);
    const load = () => {
      setLoading(true);
      setErr("");
      setMsg("");
      fetch(`/api/admin/performance?days=${encodeURIComponent(days)}`, { credentials: "include" }).then((r) => {
        if (r.status === 401 || r.status === 403) throw new Error("admin login required");
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }).then((j) => setData(j)).catch((e) => setErr(String(e.message || e))).finally(() => setLoading(false));
    };
    useE_p(() => {
      if (me && me.is_admin) load();
    }, [me, days]);
    const downloadExport = async () => {
      const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
      setExporting(true);
      setErr("");
      setMsg("");
      try {
        const r = await fetch("/api/admin/performance/export", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: Number(days || 7) })
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || String(r.status));
        }
        const blob = await r.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        const cd = r.headers.get("Content-Disposition") || "";
        const match = cd.match(/filename="([^"]+)"/);
        a.href = url;
        a.download = match && match[1] || "elvish-performance-export.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setMsg("Export downloaded.");
        if (window.ElvishPerf) window.ElvishPerf.end("admin_ui", "export_action", perfStartedAt, "success");
      } catch (e) {
        setErr(String(e.message || e));
        if (window.ElvishPerf) window.ElvishPerf.end("admin_ui", "export_action", perfStartedAt, "failure");
      } finally {
        setExporting(false);
      }
    };
    const summary = useM_p(() => (data && data.summary || []).filter((row) => perfMatchesScope(row.feature_area, row.transport, scope)), [data, scope]);
    const recent = useM_p(() => (data && data.recent || []).filter((row) => perfMatchesScope(row.feature_area, row.transport, scope)), [data, scope]);
    const latencySummary = useM_p(() => (data && data.latency_summary || []).filter((row) => perfMatchesScope(row.feature_area, row.transport, scope)), [data, scope]);
    const hotspots = useM_p(() => (data && data.hotspots || []).filter((row) => perfMatchesScope(row.feature_area, row.transport, scope)), [data, scope]);
    const queue = data && data.queue ? data.queue : {};
    const uptime = data && data.uptime ? data.uptime : {};
    const overview = useM_p(() => buildOverview(summary, latencySummary, queue, uptime), [summary, latencySummary, queue, uptime]);
    const latencyTrend = useM_p(() => buildLatencyTrend(recent), [recent]);
    const failureTrend = useM_p(() => buildFailureTrend(recent), [recent]);
    const latencyBuckets = useM_p(() => buildLatencyBuckets(latencySummary), [latencySummary]);
    if (!me) {
      return /* @__PURE__ */ React.createElement("div", { "data-testid": "admin-performance-panel" }, /* @__PURE__ */ React.createElement(AP.H, { num: "08", title: "PERFORMANCE", sub: "privacy-safe dashboard \xB7 admin only" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, /* @__PURE__ */ React.createElement("a", { href: "/login" }, "Log in"), " to inspect performance."));
    }
    if (!me.is_admin) {
      return /* @__PURE__ */ React.createElement("div", { "data-testid": "admin-performance-panel" }, /* @__PURE__ */ React.createElement(AP.H, { num: "08", title: "PERFORMANCE", sub: "privacy-safe dashboard \xB7 admin only" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Your account is not an admin. Set ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "ELVISH_ADMIN_EMAILS"), " or promote the first registered user."));
    }
    return /* @__PURE__ */ React.createElement("div", { "data-testid": "admin-performance-panel" }, /* @__PURE__ */ React.createElement(AP.H, { num: "08", title: "PERFORMANCE", sub: "aggregate-only \xB7 manual export \xB7 no identifiers" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "This dashboard extends anonymous telemetry with bounded latency buckets and browser beacons. It keeps the same privacy contract: no user IDs, emails, IPs, raw URLs, domains, message IDs, search text, or free-form labels. Export is manual and bounded."), data && data.note && /* @__PURE__ */ React.createElement("div", { className: "readonly-note", style: { marginBottom: 12 } }, data.note), err && /* @__PURE__ */ React.createElement("div", { className: "auth-status err", style: { marginBottom: 12 } }, err), msg && /* @__PURE__ */ React.createElement("div", { className: "auth-status ok", style: { marginBottom: 12 } }, msg), /* @__PURE__ */ React.createElement(AP.Card, { title: "FILTERS", right: /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", onClick: load }, loading ? "\u2026" : "refresh") }, /* @__PURE__ */ React.createElement("div", { className: "perf-filter-grid" }, /* @__PURE__ */ React.createElement(AP.FRow, { label: "Window" }, /* @__PURE__ */ React.createElement(AP.Seg, { value: days, onChange: setDays, options: PERF_WINDOWS })), /* @__PURE__ */ React.createElement(AP.FRow, { label: "Surface" }, /* @__PURE__ */ React.createElement(AP.Seg, { value: scope, onChange: setScope, options: PERF_SCOPES })))), /* @__PURE__ */ React.createElement("div", { className: "perf-kpis" }, /* @__PURE__ */ React.createElement("div", { className: "stat" }, /* @__PURE__ */ React.createElement("span", null, "events"), /* @__PURE__ */ React.createElement("strong", null, perfNum(overview.totalCount))), /* @__PURE__ */ React.createElement("div", { className: "stat" }, /* @__PURE__ */ React.createElement("span", null, "failure rate"), /* @__PURE__ */ React.createElement("strong", null, overview.totalCount ? perfPct(overview.failureCount / overview.totalCount) : "0.0%")), /* @__PURE__ */ React.createElement("div", { className: "stat" }, /* @__PURE__ */ React.createElement("span", null, "avg latency"), /* @__PURE__ */ React.createElement("strong", null, perfMS(overview.avgMS))), /* @__PURE__ */ React.createElement("div", { className: "stat" }, /* @__PURE__ */ React.createElement("span", null, "max latency"), /* @__PURE__ */ React.createElement("strong", null, perfMS(overview.maxMS))), /* @__PURE__ */ React.createElement("div", { className: "stat" }, /* @__PURE__ */ React.createElement("span", null, "slow 2s+"), /* @__PURE__ */ React.createElement("strong", null, perfNum(overview.slowCount))), /* @__PURE__ */ React.createElement("div", { className: "stat" }, /* @__PURE__ */ React.createElement("span", null, "uptime"), /* @__PURE__ */ React.createElement("strong", null, uptime && uptime.live ? Number(uptime.overall_uptime_pct || 0).toFixed(2) + "%" : "\u2014"))), /* @__PURE__ */ React.createElement("div", { className: "perf-grid" }, /* @__PURE__ */ React.createElement(AP.Card, { title: "LATENCY TREND" }, /* @__PURE__ */ React.createElement(
      PerfLineChart,
      {
        title: "hourly average latency",
        points: latencyTrend,
        keys: [
          { id: "browser", label: "browser", color: "var(--accent)" },
          { id: "backend", label: "backend", color: "var(--ok)" }
        ]
      }
    )), /* @__PURE__ */ React.createElement(AP.Card, { title: "FAILURE TREND" }, /* @__PURE__ */ React.createElement(
      PerfLineChart,
      {
        title: "hourly failure rate",
        points: failureTrend,
        keys: [{ id: "failureRate", label: "failure rate", color: "var(--warn)" }]
      }
    )), /* @__PURE__ */ React.createElement(AP.Card, { title: "LATENCY BUCKETS" }, /* @__PURE__ */ React.createElement(PerfBarChart, { rows: latencyBuckets })), /* @__PURE__ */ React.createElement(
      AP.Card,
      {
        title: "QUEUE / EXPORT",
        right: /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm primary", disabled: exporting || !(data && data.persist), onClick: downloadExport }, exporting ? "\u2026" : "download json")
      },
      /* @__PURE__ */ React.createElement("div", { className: "perf-queue" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "pending"), /* @__PURE__ */ React.createElement("strong", null, perfNum(queue.pending))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "sending"), /* @__PURE__ */ React.createElement("strong", null, perfNum(queue.sending))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "sent"), /* @__PURE__ */ React.createElement("strong", null, perfNum(queue.sent))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "failed"), /* @__PURE__ */ React.createElement("strong", null, perfNum(queue.failed)))),
      /* @__PURE__ */ React.createElement("div", { className: "dim", style: { marginTop: 12, fontSize: 11 } }, "Export includes only aggregate KPIs, hourly rollups, latency buckets, hotspot summaries, queue totals, and safe runtime context. Admin-only diagnostics like raw probe URLs stay out of the bundle.")
    )), /* @__PURE__ */ React.createElement(AP.Card, { title: "HOTSPOTS" }, hotspots.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No hotspots yet.") : /* @__PURE__ */ React.createElement("table", { className: "adm-mini-table perf-table", style: { width: "100%", borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { align: "left" }, "metric"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "area"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "operation"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "transport"), /* @__PURE__ */ React.createElement("th", null, "count"), /* @__PURE__ */ React.createElement("th", null, "failure"), /* @__PURE__ */ React.createElement("th", null, "avg ms"), /* @__PURE__ */ React.createElement("th", null, "max ms"))), /* @__PURE__ */ React.createElement("tbody", null, hotspots.map((row, idx) => /* @__PURE__ */ React.createElement("tr", { key: `${row.metric_name || row.metricName}-${row.feature_area || row.featureArea}-${idx}` }, /* @__PURE__ */ React.createElement("td", { className: "mono" }, row.metric_name || row.metricName), /* @__PURE__ */ React.createElement("td", null, row.feature_area || row.featureArea), /* @__PURE__ */ React.createElement("td", null, row.status_class || row.statusClass), /* @__PURE__ */ React.createElement("td", null, row.transport), /* @__PURE__ */ React.createElement("td", null, perfNum(row.count)), /* @__PURE__ */ React.createElement("td", null, perfPct(row.failure_rate || row.failureRate || 0)), /* @__PURE__ */ React.createElement("td", null, perfMS(row.avg_ms || row.avgMS)), /* @__PURE__ */ React.createElement("td", null, perfMS(row.max_ms || row.maxMS))))))), /* @__PURE__ */ React.createElement(AP.Card, { title: "RAW HOURLY ROLLUPS" }, recent.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No rollups for this filter.") : /* @__PURE__ */ React.createElement("table", { className: "adm-mini-table perf-table", style: { width: "100%", borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { align: "left" }, "bucket"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "metric"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "area"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "result"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "operation"), /* @__PURE__ */ React.createElement("th", { align: "left" }, "transport"), /* @__PURE__ */ React.createElement("th", null, "count"), /* @__PURE__ */ React.createElement("th", null, "avg ms"), /* @__PURE__ */ React.createElement("th", null, "max ms"))), /* @__PURE__ */ React.createElement("tbody", null, recent.slice(0, 80).map((row, idx) => /* @__PURE__ */ React.createElement("tr", { key: `${row.bucket_start}-${row.metric_name}-${idx}` }, /* @__PURE__ */ React.createElement("td", { className: "dim" }, row.bucket_start), /* @__PURE__ */ React.createElement("td", { className: "mono" }, row.metric_name), /* @__PURE__ */ React.createElement("td", null, row.feature_area), /* @__PURE__ */ React.createElement("td", null, row.result), /* @__PURE__ */ React.createElement("td", null, row.status_class), /* @__PURE__ */ React.createElement("td", null, row.transport), /* @__PURE__ */ React.createElement("td", null, perfNum(row.count)), /* @__PURE__ */ React.createElement("td", null, row.count ? perfMS(Number(row.sum_ms || 0) / Number(row.count || 1)) : "0 ms"), /* @__PURE__ */ React.createElement("td", null, perfMS(row.max_ms))))))));
  }
  var AP, useS_p, useE_p, useM_p, PERF_WINDOWS, PERF_SCOPES;
  var init_admin_performance = __esm({
    "../static/admin/admin-performance.jsx"() {
      AP = window.adm;
      ({ useState: useS_p, useEffect: useE_p, useMemo: useM_p } = React);
      PERF_WINDOWS = [
        { value: "1", label: "24H" },
        { value: "7", label: "7D" },
        { value: "30", label: "30D" }
      ];
      PERF_SCOPES = [
        { value: "all", label: "ALL" },
        { value: "backend", label: "BACKEND" },
        { value: "mail", label: "MAIL" },
        { value: "auth", label: "AUTH" },
        { value: "admin", label: "ADMIN" },
        { value: "public", label: "PUBLIC" }
      ];
      window.SecPerformance = SecPerformance;
    }
  });

  // ../static/admin/admin-email-sections.jsx
  async function apiJSON(url, opts) {
    const res = await fetch(url, {
      credentials: "include",
      ...opts || {},
      headers: {
        "Content-Type": "application/json",
        ...opts && opts.headers || {}
      }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.message || String(res.status));
    return json;
  }
  async function apiForm(url, formData) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      body: formData
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.message || String(res.status));
    return json;
  }
  function fmtDT(v) {
    if (!v) return "\u2014";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  }
  function fmtBytes(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let idx = 0;
    let cur = n;
    while (cur >= 1024 && idx < units.length - 1) {
      cur /= 1024;
      idx += 1;
    }
    return `${cur >= 10 || idx === 0 ? cur.toFixed(0) : cur.toFixed(1)} ${units[idx]}`;
  }
  function splitEmail(addr) {
    const raw = String(addr || "").trim().toLowerCase();
    const at = raw.lastIndexOf("@");
    if (at <= 0 || at === raw.length - 1) return { local: "", domain: "" };
    return { local: raw.slice(0, at), domain: raw.slice(at + 1) };
  }
  function splitRecipientEmails(raw) {
    return Array.from(new Set(String(raw || "").split(/[\n,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)));
  }
  function bytesToB64(bytes) {
    if (window.ElvishKeygen && typeof window.ElvishKeygen.bytesToB64 === "function") {
      return window.ElvishKeygen.bytesToB64(bytes);
    }
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function sanitizeAttachmentName(name) {
    return String(name || "attachment.bin").replace(/[\r\n"]/g, "").trim() || "attachment.bin";
  }
  function sanitizeAttachmentType(type) {
    const raw = String(type || "").trim().toLowerCase();
    return raw && !/[\r\n]/.test(raw) ? raw : "application/octet-stream";
  }
  async function readFileBytes(file) {
    return new Uint8Array(await file.arrayBuffer());
  }
  async function buildProtectedLinkCipherPayload({ from, to, subject, body, password, attachments }) {
    if (!window.ElvishKeygen) throw new Error("crypto subsystem not loaded");
    const mimeBytes = await buildMimeMessageBytes({ from, to, subject, body, attachments });
    const msgKeyBytes = window.ElvishKeygen.randomBytes(32);
    const msgKey = await crypto.subtle.importKey("raw", msgKeyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
    const msgNonce = window.ElvishKeygen.randomBytes(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: msgNonce }, msgKey, mimeBytes));
    const payloadCt = new Uint8Array(msgNonce.length + ct.length);
    payloadCt.set(msgNonce, 0);
    payloadCt.set(ct, msgNonce.length);
    const salt = window.ElvishKeygen.randomBytes(16);
    const { kdf, key: kek, params } = await window.ElvishKeygen.deriveKEK(password, salt);
    const wrapped = await window.ElvishKeygen.aesWrap(kek, msgKeyBytes);
    msgKeyBytes.fill(0);
    return {
      kdf,
      kdf_salt_b64: bytesToB64(salt),
      kdf_params_json: JSON.stringify(params || {}),
      wrapped_msg_key_b64: bytesToB64(wrapped),
      body_ciphertext_b64: bytesToB64(payloadCt)
    };
  }
  async function buildMimeMessageBytes({ from, to, subject, body, attachments }) {
    const lines = [];
    const recipients = Array.isArray(to) ? to.filter(Boolean) : [];
    lines.push(`From: ${from || "anonymous"}`);
    lines.push(`To: ${recipients.join(", ")}`);
    if (subject) lines.push(`Subject: ${subject}`);
    lines.push("MIME-Version: 1.0");
    if (!attachments || attachments.length === 0) {
      lines.push("Content-Type: text/plain; charset=utf-8");
      lines.push("Content-Transfer-Encoding: 8bit");
      lines.push("");
      lines.push(body || "");
      return new TextEncoder().encode(lines.join("\r\n"));
    }
    const boundary = `elvish-admin-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("Content-Transfer-Encoding: 8bit");
    lines.push("");
    lines.push(body || "");
    for (const attachment of attachments) {
      const bytes = attachment.bytes || await readFileBytes(attachment.file);
      const name = sanitizeAttachmentName(attachment.file_name || attachment.file && attachment.file.name);
      const contentType = sanitizeAttachmentType(attachment.content_type || attachment.file && attachment.file.type);
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${contentType}; name="${name}"`);
      lines.push(`Content-Disposition: attachment; filename="${name}"`);
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      const b64 = bytesToB64(bytes);
      for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
    }
    lines.push(`--${boundary}--`);
    lines.push("");
    return new TextEncoder().encode(lines.join("\r\n"));
  }
  function validateSystemMailPayload(payload, selectedUsers) {
    if (!String(payload.from_addr || "").trim()) return "Choose a verified sender domain before previewing.";
    if (!String(payload.subject || "").trim()) return "Enter a subject before previewing.";
    if (!String(payload.body_text || "").trim()) return "Enter a message body before previewing.";
    if (payload.audience_kind === "selected" && (!Array.isArray(selectedUsers) || selectedUsers.length === 0)) {
      return "Select at least one user recipient before previewing.";
    }
    return "";
  }
  function StatusPill({ tone, children }) {
    return /* @__PURE__ */ React.createElement("span", { className: "status-pill" + (tone ? " " + tone : "") }, children);
  }
  function JsonBlock({ value }) {
    if (!value) return null;
    return /* @__PURE__ */ React.createElement("pre", { className: "test-output" }, JSON.stringify(value, null, 2));
  }
  function relativeDNSName(name, domain) {
    const fqdn = String(name || "").trim().toLowerCase().replace(/\.$/, "");
    const base = String(domain || "").trim().toLowerCase().replace(/\.$/, "");
    if (!fqdn || !base) return fqdn || "\u2014";
    if (fqdn === base) return "@";
    const suffix = "." + base;
    return fqdn.endsWith(suffix) ? fqdn.slice(0, -suffix.length) || "@" : fqdn;
  }
  function buildReadinessDNSGuide(readiness) {
    const delivery = readiness && readiness.delivery;
    const domain = String(delivery && delivery.domain || "").trim().toLowerCase();
    if (!domain) return [];
    const records = [];
    if (!delivery.mx || !delivery.mx.ok) {
      records.push({
        id: "mx",
        label: "MX",
        type: "MX",
        host: "@",
        value: domain,
        ttl: "Auto",
        extra: "Priority 10",
        note: `Point this at the hostname receiving inbound SMTP for ${domain}. If you use a dedicated mail host such as mx.${domain}, publish that target instead and make sure it has A/AAAA records.`
      });
    }
    if (!delivery.spf || !delivery.spf.ok) {
      records.push({
        id: "spf",
        label: "SPF",
        type: "TXT",
        host: "@",
        value: "v=spf1 mx -all",
        ttl: "Auto",
        note: "This is the usual minimal self-hosted SPF record. Start with ~all instead of -all if you want a softer rollout."
      });
    }
    if (!delivery.dkim || !delivery.dkim.ok) {
      const dkimName = String(delivery.dkim && delivery.dkim.name || (delivery.dkim_dns_name || "")).trim();
      const dkimValue = String(delivery.dkim && delivery.dkim.expected || "").trim();
      if (dkimName && dkimValue) {
        records.push({
          id: "dkim",
          label: "DKIM",
          type: "TXT",
          host: relativeDNSName(dkimName, domain),
          fqdn: dkimName,
          value: dkimValue,
          ttl: "Auto",
          note: "Publish the exact DKIM TXT value generated by the active signer."
        });
      }
    }
    if (!delivery.dmarc || !delivery.dmarc.ok) {
      records.push({
        id: "dmarc",
        label: "DMARC",
        type: "TXT",
        host: "_dmarc",
        fqdn: `_dmarc.${domain}`,
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; adkim=s; aspf=s`,
        ttl: "Auto",
        note: "Start with p=none while testing. After SPF and DKIM pass reliably, move to quarantine or reject."
      });
    }
    return records;
  }
  function UserDetailModal({ user, onClose, onDisable, onDelete, busy }) {
    const [detailUser, setDetailUser] = useSt(user);
    useEf(() => {
      if (!user) {
        setDetailUser(null);
        return;
      }
      setDetailUser(user);
      let cancelled = false;
      (async () => {
        try {
          const d = await apiJSON(`/api/admin/users/${encodeURIComponent(user.id)}?expand=mail`);
          if (!cancelled) setDetailUser((prev) => ({ ...prev, ...d }));
        } catch (_) {
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user]);
    if (!user) return null;
    const u = detailUser || user;
    return /* @__PURE__ */ React.createElement("div", { className: "modal-overlay", onClick: onClose }, /* @__PURE__ */ React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "modal-head" }, /* @__PURE__ */ React.createElement("h3", null, "User Details"), /* @__PURE__ */ React.createElement("button", { className: "btn-close", onClick: onClose }, "\xD7")), /* @__PURE__ */ React.createElement("div", { className: "modal-body mail-detail-grid" }, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "ID"), /* @__PURE__ */ React.createElement("span", null, u.id)), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Email"), /* @__PURE__ */ React.createElement("span", null, u.email)), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Name"), /* @__PURE__ */ React.createElement("span", null, u.name || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Admin"), /* @__PURE__ */ React.createElement("span", null, u.is_admin ? "Yes" : "No")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Created"), /* @__PURE__ */ React.createElement("span", null, fmtDT(u.created_at))), u.identity_count != null && /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Active identities"), /* @__PURE__ */ React.createElement("span", null, u.identity_count)), u.owned_domain_count != null && /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Owned mail domains"), /* @__PURE__ */ React.createElement("span", null, u.owned_domain_count)), u.shared_domain_allowlist_count != null && /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Shared-domain allowlists"), /* @__PURE__ */ React.createElement("span", null, u.shared_domain_allowlist_count))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm warn", onClick: onDisable, disabled: busy }, "Disable"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm danger", onClick: onDelete, disabled: busy }, "Delete"))));
  }
  function DomainDetailModal({ domain, onClose, onVerify, onDelete, busy, onSharingSaved }) {
    const [detail, setDetail] = useSt(null);
    const [loadErr, setLoadErr] = useSt("");
    const [shareMode, setShareMode] = useSt("owner_only");
    const [allowlist, setAllowlist] = useSt([]);
    const [userQuery, setUserQuery] = useSt("");
    const [userHits, setUserHits] = useSt([]);
    const [shareBusy, setShareBusy] = useSt(false);
    const [shareErr, setShareErr] = useSt("");
    const [shareOk, setShareOk] = useSt("");
    useEf(() => {
      if (!domain) {
        setDetail(null);
        return;
      }
      let cancelled = false;
      setLoadErr("");
      (async () => {
        try {
          const d2 = await apiJSON(`/api/admin/domains/${encodeURIComponent(domain.domain)}`);
          if (cancelled) return;
          setDetail(d2);
          setShareMode(String(d2.share_mode || "owner_only"));
          setAllowlist(Array.isArray(d2.allowlist) ? d2.allowlist.map((x) => ({ user_id: x.user_id, email: x.email })) : []);
        } catch (e) {
          if (!cancelled) setLoadErr(String(e.message || e));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [domain && domain.domain]);
    useEf(() => {
      if (!userQuery.trim()) {
        setUserHits([]);
        return;
      }
      let cancelled = false;
      const t = setTimeout(async () => {
        try {
          const data = await apiJSON(`/api/admin/users?q=${encodeURIComponent(userQuery.trim())}&limit=12`);
          if (cancelled) return;
          setUserHits(data.users || []);
        } catch (_) {
          if (!cancelled) setUserHits([]);
        }
      }, 200);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [userQuery]);
    if (!domain) return null;
    const addAllow = (u) => {
      if (!u || !u.id) return;
      if (allowlist.some((a) => a.user_id === u.id)) return;
      setAllowlist((prev) => [...prev, { user_id: u.id, email: u.email }]);
      setUserQuery("");
      setUserHits([]);
    };
    const removeAllow = (id) => {
      setAllowlist((prev) => prev.filter((a) => a.user_id !== id));
    };
    const saveSharing = async () => {
      setShareBusy(true);
      setShareErr("");
      setShareOk("");
      try {
        const body = {
          share_mode: shareMode,
          allowlist_user_ids: shareMode === "allowlist" ? allowlist.map((a) => a.user_id) : []
        };
        await apiJSON(`/api/admin/domains/${encodeURIComponent(domain.domain)}/sharing`, {
          method: "PATCH",
          body: JSON.stringify(body)
        });
        setShareOk("Sharing saved.");
        try {
          const d2 = await apiJSON(`/api/admin/domains/${encodeURIComponent(domain.domain)}`);
          setDetail(d2);
          setShareMode(String(d2.share_mode || "owner_only"));
          setAllowlist(Array.isArray(d2.allowlist) ? d2.allowlist.map((x) => ({ user_id: x.user_id, email: x.email })) : []);
        } catch (_) {
        }
        if (typeof onSharingSaved === "function") onSharingSaved();
      } catch (e) {
        setShareErr(String(e.message || e));
      }
      setShareBusy(false);
    };
    const d = detail || domain;
    return /* @__PURE__ */ React.createElement("div", { className: "modal-overlay", onClick: onClose }, /* @__PURE__ */ React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation(), style: { maxWidth: 520 } }, /* @__PURE__ */ React.createElement("div", { className: "modal-head" }, /* @__PURE__ */ React.createElement("h3", null, "Domain Details"), /* @__PURE__ */ React.createElement("button", { className: "btn-close", onClick: onClose }, "\xD7")), /* @__PURE__ */ React.createElement("div", { className: "modal-body mail-detail-grid" }, loadErr && /* @__PURE__ */ React.createElement("div", { className: "f-err", style: { gridColumn: "1 / -1" } }, loadErr), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Domain"), /* @__PURE__ */ React.createElement("span", null, d.domain)), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Owner"), /* @__PURE__ */ React.createElement("span", null, d.owner_email || d.owner_user_id || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Status"), /* @__PURE__ */ React.createElement("span", null, d.status || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Share mode"), /* @__PURE__ */ React.createElement("span", null, d.share_mode || "owner_only")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "TXT host"), /* @__PURE__ */ React.createElement("span", null, d.verification_txt_host || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "TXT value"), /* @__PURE__ */ React.createElement("span", null, d.verification_txt_value || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Catch-all FP"), /* @__PURE__ */ React.createElement("span", null, d.catchall_identity_fp || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "MX"), /* @__PURE__ */ React.createElement("span", null, d.mx_verified ? "Verified" : "Missing")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "SPF"), /* @__PURE__ */ React.createElement("span", null, d.spf_verified ? "Verified" : "Missing")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "DKIM"), /* @__PURE__ */ React.createElement("span", null, d.dkim_verified ? "Verified" : "Missing")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "DMARC"), /* @__PURE__ */ React.createElement("span", null, d.dmarc_verified ? "Verified" : "Missing")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Created"), /* @__PURE__ */ React.createElement("span", null, fmtDT(d.created_at))), /* @__PURE__ */ React.createElement("div", { className: "f-help", style: { gridColumn: "1 / -1", marginTop: 8 } }, "Sharing controls who may create mailbox identities @ this domain once it is active with MX verified. DNS, DKIM files, and catch-all routing stay with the listed owner; shared users do not receive owner-only catch-all behavior for addresses they did not register."), /* @__PURE__ */ React.createElement("div", { style: { gridColumn: "1 / -1", marginTop: 12 } }, /* @__PURE__ */ React.createElement("label", { className: "dim", style: { display: "block", marginBottom: 6 } }, "Identity sharing"), /* @__PURE__ */ React.createElement("select", { className: "inp", value: shareMode, onChange: (e) => setShareMode(e.target.value), style: { width: "100%", maxWidth: 360 } }, /* @__PURE__ */ React.createElement("option", { value: "owner_only" }, "Owner only (default)"), /* @__PURE__ */ React.createElement("option", { value: "all_verified_users" }, "All signed-in users"), /* @__PURE__ */ React.createElement("option", { value: "allowlist" }, "Allowlisted users only"))), shareMode === "allowlist" && /* @__PURE__ */ React.createElement("div", { style: { gridColumn: "1 / -1" } }, /* @__PURE__ */ React.createElement("div", { className: "f-help", style: { marginBottom: 8 } }, "Search users by email and add to the allowlist."), /* @__PURE__ */ React.createElement("div", { className: "search-bar", style: { marginBottom: 8 } }, /* @__PURE__ */ React.createElement("input", { className: "inp", placeholder: "Search users\u2026", value: userQuery, onChange: (e) => setUserQuery(e.target.value) })), userHits.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { border: "1px solid var(--line)", maxHeight: 140, overflow: "auto", marginBottom: 8 } }, userHits.map((u) => /* @__PURE__ */ React.createElement("div", { key: u.id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderBottom: "1px solid var(--line)" } }, /* @__PURE__ */ React.createElement("span", null, u.email), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", onClick: () => addAllow(u) }, "Add")))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8 } }, allowlist.length === 0 && /* @__PURE__ */ React.createElement("span", { className: "dim" }, "No users allowlisted yet."), allowlist.map((a) => /* @__PURE__ */ React.createElement("div", { key: a.user_id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" } }, /* @__PURE__ */ React.createElement("span", null, a.email), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm danger", onClick: () => removeAllow(a.user_id) }, "Remove"))))), shareErr && /* @__PURE__ */ React.createElement("div", { className: "f-err", style: { gridColumn: "1 / -1" } }, shareErr), shareOk && /* @__PURE__ */ React.createElement("div", { className: "f-ok", style: { gridColumn: "1 / -1" } }, shareOk), /* @__PURE__ */ React.createElement("div", { style: { gridColumn: "1 / -1", marginTop: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm primary", onClick: saveSharing, disabled: shareBusy || !!loadErr }, shareBusy ? "Saving\u2026" : "Save sharing"))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: onVerify, disabled: busy }, "Verify DNS"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm danger", onClick: onDelete, disabled: busy }, "Delete"))));
  }
  function SecUsers() {
    const [users, setUsers] = useSt([]);
    const [total, setTotal] = useSt(0);
    const [page, setPage] = useSt(1);
    const [query, setQuery] = useSt("");
    const [loading, setLoading] = useSt(false);
    const [selected, setSelected] = useSt(null);
    const [busy, setBusy] = useSt(false);
    const [confirmAction, setConfirmAction] = useSt(null);
    const [actionError, setActionError] = useSt("");
    const load = useCb(async () => {
      setLoading(true);
      try {
        const url = `/api/admin/users?page=${page}&limit=${ADMIN_USER_PAGE}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
        const data = await apiJSON(url);
        setUsers(data.users || []);
        setTotal(data.total || 0);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }, [page, query]);
    const userPageStart = (page - 1) * ADMIN_USER_PAGE;
    const userHasNext = userPageStart + users.length < total;
    useEf(() => {
      load();
    }, [load]);
    const closeModal = () => {
      setSelected(null);
      setBusy(false);
      load();
    };
    return /* @__PURE__ */ React.createElement("div", { "data-testid": "admin-users-panel" }, /* @__PURE__ */ React.createElement(A4.H, { num: "02", title: "USERS", sub: `${total} total \xB7 search \xB7 targeted notices` }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Use this directory to inspect accounts before targeted system sends. System mail in this admin panel is limited to existing platform users."), /* @__PURE__ */ React.createElement(A4.Card, { title: "USER DIRECTORY", right: loading ? "loading\u2026" : `${users.length} on page \xB7 ${total} total` }, /* @__PURE__ */ React.createElement("form", { className: "search-bar", onSubmit: (e) => {
      e.preventDefault();
      setPage(1);
      load();
    } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "inp",
        placeholder: "Search by email\u2026",
        value: query,
        onChange: (e) => setQuery(e.target.value)
      }
    ), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn-sm" }, "Search")), /* @__PURE__ */ React.createElement("table", { className: "admin-table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Email"), /* @__PURE__ */ React.createElement("th", null, "Name"), /* @__PURE__ */ React.createElement("th", null, "Admin"), /* @__PURE__ */ React.createElement("th", null, "Created"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, loading && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: "5", className: "dim" }, "Loading\u2026")), !loading && users.length === 0 && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: "5", className: "dim" }, "No users found")), users.map((u) => /* @__PURE__ */ React.createElement("tr", { key: u.id }, /* @__PURE__ */ React.createElement("td", null, u.email), /* @__PURE__ */ React.createElement("td", null, u.name || "\u2014"), /* @__PURE__ */ React.createElement("td", null, u.is_admin ? "\u2713" : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "dim" }, fmtDT(u.created_at)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => setSelected(u) }, "View")))))), /* @__PURE__ */ React.createElement("div", { className: "pagination" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", disabled: page <= 1, onClick: () => setPage((p) => p - 1) }, "Prev"), /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Page ", page, total > 0 ? ` \xB7 ${userPageStart + 1}\u2013${userPageStart + users.length} of ${total}` : ""), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", disabled: !userHasNext, onClick: () => setPage((p) => p + 1) }, "Next"))), /* @__PURE__ */ React.createElement(
      UserDetailModal,
      {
        user: selected,
        busy,
        onClose: closeModal,
        onDisable: () => {
          if (selected) setConfirmAction({ type: "disable", user: selected });
        },
        onDelete: () => {
          if (selected) setConfirmAction({ type: "delete", user: selected });
        }
      }
    ), confirmAction && /* @__PURE__ */ React.createElement("div", { className: "modal-overlay", onClick: (e) => {
      if (e.target === e.currentTarget && !busy) {
        setConfirmAction(null);
        setActionError("");
      }
    } }, /* @__PURE__ */ React.createElement("div", { style: { background: "var(--bg)", border: "1px solid var(--fg)", maxWidth: 440, width: "90%", position: "relative" } }, /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: -1, left: -1, width: 6, height: 6, background: "var(--accent)" } }), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: -1, right: -1, width: 6, height: 6, background: "var(--accent)" } }), /* @__PURE__ */ React.createElement("div", { style: { padding: "14px 18px", borderBottom: "1px solid var(--fg)", display: "flex", alignItems: "center", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" } }, confirmAction.type === "disable" ? "Disable User" : "Delete User"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-close", onClick: () => {
      setConfirmAction(null);
      setActionError("");
    }, disabled: busy }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { padding: 18 } }, actionError && /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 12px", marginBottom: 14, border: "1px solid rgba(255,80,80,0.5)", color: "#ff6b6b", fontSize: 12 } }, actionError), /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 } }, confirmAction.type === "disable" ? `Disable user "${confirmAction.user.email}"? They will not be able to log in.` : `DELETE user "${confirmAction.user.email}" permanently? This action cannot be undone.`), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10 } }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", onClick: () => {
      setConfirmAction(null);
      setActionError("");
    }, disabled: busy }, "Cancel"), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn-sm danger",
        disabled: busy,
        onClick: async () => {
          setBusy(true);
          setActionError("");
          try {
            if (confirmAction.type === "disable") {
              await apiJSON(`/api/admin/users/${confirmAction.user.id}/disable`, { method: "POST" });
            } else {
              await apiJSON(`/api/admin/users/${confirmAction.user.id}`, { method: "DELETE" });
            }
            setConfirmAction(null);
            closeModal();
          } catch (e) {
            setActionError(String(e.message || e));
            setBusy(false);
          }
        }
      },
      busy ? "Working\u2026" : confirmAction.type === "disable" ? "Disable" : "Delete Forever"
    ))))));
  }
  function SecOutbox() {
    const [stats, setStats] = useSt({ pending: 0, sending: 0, sent: 0, failed: 0 });
    const [items, setItems] = useSt([]);
    const [page, setPage] = useSt(1);
    const [status, setStatus] = useSt("");
    const [source, setSource] = useSt("");
    const [loading, setLoading] = useSt(false);
    const load = useCb(async () => {
      setLoading(true);
      try {
        const statsData = await apiJSON("/api/admin/outbox/stats");
        setStats(statsData || {});
        const url = `/api/admin/outbox?page=${page}&limit=20${status ? `&status=${encodeURIComponent(status)}` : ""}${source ? `&source=${encodeURIComponent(source)}` : ""}`;
        const listData = await apiJSON(url);
        setItems(listData.items || []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }, [page, status, source]);
    useEf(() => {
      load();
    }, [load]);
    return /* @__PURE__ */ React.createElement("div", { "data-testid": "admin-outbox-panel" }, /* @__PURE__ */ React.createElement(A4.H, { num: "03", title: "OUTBOX", sub: "queue status \xB7 retries \xB7 admin/system tagging" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Admin and system mail now reuse the same secure outbox and worker path as the rest of the platform. The table below stays metadata-only and never exposes stored message bodies."), /* @__PURE__ */ React.createElement("div", { className: "stats-row" }, /* @__PURE__ */ React.createElement("div", { className: "stat" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Pending"), /* @__PURE__ */ React.createElement("span", null, stats.pending || 0)), /* @__PURE__ */ React.createElement("div", { className: "stat" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Sending"), /* @__PURE__ */ React.createElement("span", null, stats.sending || 0)), /* @__PURE__ */ React.createElement("div", { className: "stat" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Sent"), /* @__PURE__ */ React.createElement("span", { className: "ok" }, stats.sent || 0)), /* @__PURE__ */ React.createElement("div", { className: "stat" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Failed"), /* @__PURE__ */ React.createElement("span", { className: "warn" }, stats.failed || 0))), /* @__PURE__ */ React.createElement(A4.Card, { title: "FILTERS", right: /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: load }, "Refresh") }, /* @__PURE__ */ React.createElement("div", { className: "filters" }, ["", "pending", "sending", "sent", "failed"].map((v) => /* @__PURE__ */ React.createElement("button", { key: v || "all", className: "btn-sm" + (status === v ? " active" : ""), onClick: () => {
      setStatus(v);
      setPage(1);
    } }, v || "ALL"))), /* @__PURE__ */ React.createElement("div", { className: "filters", style: { marginTop: 8 } }, [
      ["", "ALL SOURCES"],
      ["admin_system", "SYSTEM MAIL"],
      ["admin_test", "TEST PROBES"],
      ["protected_link_notice", "PROTECTED LINK"],
      ["user_mail", "USER MAIL"]
    ].map(([value, label], idx) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: label + idx,
        className: "btn-sm" + (source === value ? " active" : ""),
        onClick: () => {
          setSource(value);
          setPage(1);
        }
      },
      label
    )))), /* @__PURE__ */ React.createElement(A4.Card, { title: "OUTBOX ROWS", right: loading ? "loading\u2026" : `${items.length} visible` }, /* @__PURE__ */ React.createElement("table", { className: "admin-table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null, "Source"), /* @__PURE__ */ React.createElement("th", null, "Kind"), /* @__PURE__ */ React.createElement("th", null, "Recipient"), /* @__PURE__ */ React.createElement("th", null, "Run"), /* @__PURE__ */ React.createElement("th", null, "Created"), /* @__PURE__ */ React.createElement("th", null, "Error"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, loading && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: "8", className: "dim" }, "Loading\u2026")), !loading && items.length === 0 && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: "8", className: "dim" }, "No outbox items")), items.map((it) => /* @__PURE__ */ React.createElement("tr", { key: it.ID }, /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement(StatusPill, { tone: it.Status === "failed" ? "warn" : it.Status === "sent" ? "ok" : "" }, it.Status)), /* @__PURE__ */ React.createElement("td", null, it.Source || "user_mail"), /* @__PURE__ */ React.createElement("td", null, it.Kind || "pgp"), /* @__PURE__ */ React.createElement("td", null, it.RecipientSummary || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "mono tiny" }, it.AdminRunID && it.AdminRunID !== "00000000-0000-0000-0000-000000000000" ? it.AdminRunID.slice(0, 8) : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "dim" }, fmtDT(it.CreatedAt)), /* @__PURE__ */ React.createElement("td", { className: "dim" }, it.LastError ? String(it.LastError).slice(0, 64) : "\u2014"), /* @__PURE__ */ React.createElement("td", null, it.Status === "failed" && /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: async () => {
      await apiJSON(`/api/admin/outbox/${it.ID}/retry`, { method: "POST" });
      load();
    } }, "Retry")))))), /* @__PURE__ */ React.createElement("div", { className: "pagination" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", disabled: page <= 1, onClick: () => setPage((p) => p - 1) }, "Prev"), /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Page ", page), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", disabled: items.length < 20, onClick: () => setPage((p) => p + 1) }, "Next"))));
  }
  function SecDomains() {
    const [domains, setDomains] = useSt([]);
    const [total, setTotal] = useSt(0);
    const [page, setPage] = useSt(1);
    const [loading, setLoading] = useSt(false);
    const [busy, setBusy] = useSt("");
    const [selected, setSelected] = useSt(null);
    const [msg, setMsg] = useSt("");
    const [err, setErr] = useSt("");
    const [addResult, setAddResult] = useSt(null);
    const [form, setForm] = useSt({ domain: "", owner_email: "" });
    const [confirmDelete, setConfirmDelete] = useSt(null);
    const load = useCb(async () => {
      setLoading(true);
      try {
        const data = await apiJSON(`/api/admin/domains?page=${page}&limit=${ADMIN_DOMAIN_PAGE}`);
        const next = data.domains || [];
        setDomains(next);
        setTotal(data.total || 0);
        setSelected((curr) => curr ? next.find((d) => d.domain === curr.domain) || null : null);
      } catch (e) {
        setErr(String(e.message || e));
      }
      setLoading(false);
    }, [page]);
    const domainPageStart = (page - 1) * ADMIN_DOMAIN_PAGE;
    const domainHasNext = domainPageStart + domains.length < total;
    useEf(() => {
      load();
    }, [load]);
    const registerDomain = async (e) => {
      e.preventDefault();
      setBusy("add");
      setErr("");
      setMsg("");
      setAddResult(null);
      try {
        const res = await apiJSON("/api/admin/domains", {
          method: "POST",
          body: JSON.stringify({
            domain: form.domain,
            owner_email: form.owner_email
          })
        });
        setMsg(`Registered ${res.domain} for ${res.owner_email}. Publish the TXT record, then run verification.`);
        setAddResult(res);
        setForm({ domain: "", owner_email: "" });
        await load();
      } catch (e2) {
        setErr(String(e2.message || e2));
      }
      setBusy("");
    };
    const verifyDomain = async (domainName) => {
      setBusy(`verify:${domainName}`);
      setErr("");
      setMsg("");
      try {
        const res = await apiJSON(`/api/admin/domains/${encodeURIComponent(domainName)}/verify`, { method: "POST" });
        const checks = [
          `Ownership ${res.ownership_verified ? "ok" : "missing"}`,
          `MX ${res.mx_verified ? "ok" : "missing"}`,
          `SPF ${res.spf_verified ? "ok" : "missing"}`,
          `DKIM ${res.dkim_verified ? "ok" : "missing"}`,
          `DMARC ${res.dmarc_verified ? "ok" : "missing"}`
        ];
        const suffix = Array.isArray(res.issues) && res.issues.length ? ` \xB7 ${res.issues.join(" | ")}` : "";
        setMsg(`Verified ${domainName}: ${checks.join(" \xB7 ")}${suffix}`);
        await load();
      } catch (e2) {
        setErr(String(e2.message || e2));
      }
      setBusy("");
    };
    const deleteDomain = (domainName) => {
      setConfirmDelete(domainName);
    };
    const executeDeleteDomain = async () => {
      if (!confirmDelete) return;
      const domainName = confirmDelete;
      setBusy(`delete:${domainName}`);
      setErr("");
      setMsg("");
      try {
        await apiJSON(`/api/admin/domains/${encodeURIComponent(domainName)}`, { method: "DELETE" });
        setMsg(`Deleted ${domainName}.`);
        setSelected((curr) => curr && curr.domain === domainName ? null : curr);
        setConfirmDelete(null);
        await load();
      } catch (e2) {
        setErr(String(e2.message || e2));
      }
      setBusy("");
    };
    return /* @__PURE__ */ React.createElement("div", { "data-testid": "admin-domains-panel" }, /* @__PURE__ */ React.createElement(A4.H, { num: "04", title: "DOMAINS", sub: `${total} custom domains \xB7 verification state` }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "Admin system mail is restricted to verified sender domains. SPF, DKIM, and DMARC verification state shown here directly affects which domains are eligible."), err && /* @__PURE__ */ React.createElement("div", { className: "f-err" }, err), msg && /* @__PURE__ */ React.createElement("div", { className: "f-ok" }, msg), /* @__PURE__ */ React.createElement(A4.Card, { title: "REGISTER DOMAIN", right: "admin-managed" }, /* @__PURE__ */ React.createElement("form", { className: "search-bar", onSubmit: registerDomain }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        placeholder: "Owner email",
        value: form.owner_email,
        onChange: (e) => setForm((f) => ({ ...f, owner_email: e.target.value }))
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        placeholder: "example.com",
        value: form.domain,
        onChange: (e) => setForm((f) => ({ ...f, domain: e.target.value }))
      }
    ), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", type: "submit", disabled: busy === "add" }, busy === "add" ? "Adding\u2026" : "Add Domain")), /* @__PURE__ */ React.createElement("div", { className: "f-help" }, "Register a custom domain against an existing user, then publish the TXT record and run verification from this panel."), /* @__PURE__ */ React.createElement(JsonBlock, { value: addResult && addResult.dns_config ? addResult.dns_config : null })), /* @__PURE__ */ React.createElement(A4.Card, { title: "OWNED DOMAINS", right: loading ? "loading\u2026" : `${domains.length} on page \xB7 ${total} total` }, /* @__PURE__ */ React.createElement("table", { className: "admin-table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Domain"), /* @__PURE__ */ React.createElement("th", null, "Owner"), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null, "Sharing"), /* @__PURE__ */ React.createElement("th", null, "Allowlist"), /* @__PURE__ */ React.createElement("th", null, "MX"), /* @__PURE__ */ React.createElement("th", null, "SPF"), /* @__PURE__ */ React.createElement("th", null, "DKIM"), /* @__PURE__ */ React.createElement("th", null, "DMARC"), /* @__PURE__ */ React.createElement("th", null, "Created"), /* @__PURE__ */ React.createElement("th", null, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, loading && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: "11", className: "dim" }, "Loading\u2026")), !loading && domains.length === 0 && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: "11", className: "dim" }, "No custom domains")), domains.map((d) => /* @__PURE__ */ React.createElement("tr", { key: d.domain }, /* @__PURE__ */ React.createElement("td", null, d.domain), /* @__PURE__ */ React.createElement("td", { className: "dim" }, d.owner_email || "\u2014"), /* @__PURE__ */ React.createElement("td", null, d.status), /* @__PURE__ */ React.createElement("td", { className: "dim tiny" }, d.share_mode || "owner_only"), /* @__PURE__ */ React.createElement("td", { className: "dim" }, d.allowlist_count != null ? d.allowlist_count : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: d.mx_verified ? "ok" : "dim" }, d.mx_verified ? "\u2713" : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: d.spf_verified ? "ok" : "dim" }, d.spf_verified ? "\u2713" : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: d.dkim_verified ? "ok" : "dim" }, d.dkim_verified ? "\u2713" : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: d.dmarc_verified ? "ok" : "dim" }, d.dmarc_verified ? "\u2713" : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "dim" }, fmtDT(d.created_at)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("div", { className: "row", style: { gap: 8 } }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => setSelected(d) }, "View"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => verifyDomain(d.domain), disabled: busy === `verify:${d.domain}` }, "Verify"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm danger", onClick: () => deleteDomain(d.domain), disabled: busy === `delete:${d.domain}` }, "Delete"))))))), /* @__PURE__ */ React.createElement("div", { className: "pagination" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", disabled: page <= 1, onClick: () => setPage((p) => p - 1) }, "Prev"), /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Page ", page, total > 0 ? ` \xB7 ${domainPageStart + 1}\u2013${domainPageStart + domains.length} of ${total}` : ""), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", disabled: !domainHasNext, onClick: () => setPage((p) => p + 1) }, "Next"))), /* @__PURE__ */ React.createElement(
      DomainDetailModal,
      {
        domain: selected,
        busy: !!busy,
        onClose: () => setSelected(null),
        onVerify: () => selected && verifyDomain(selected.domain),
        onDelete: () => selected && deleteDomain(selected.domain),
        onSharingSaved: load
      }
    ), confirmDelete && /* @__PURE__ */ React.createElement("div", { className: "modal-overlay", onClick: (e) => {
      if (e.target === e.currentTarget && !busy) setConfirmDelete(null);
    } }, /* @__PURE__ */ React.createElement("div", { style: { background: "var(--bg)", border: "1px solid var(--fg)", maxWidth: 420, width: "90%", position: "relative" } }, /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: -1, left: -1, width: 6, height: 6, background: "var(--accent)" } }), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: -1, right: -1, width: 6, height: 6, background: "var(--accent)" } }), /* @__PURE__ */ React.createElement("div", { style: { padding: "14px 18px", borderBottom: "1px solid var(--fg)", display: "flex", alignItems: "center", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" } }, "Delete Domain"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-close", onClick: () => setConfirmDelete(null), disabled: !!busy }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { padding: 18 } }, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 } }, 'Are you sure you want to delete domain "', confirmDelete, '"? This action cannot be undone.'), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10 } }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", onClick: () => setConfirmDelete(null), disabled: !!busy }, "Cancel"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm danger", disabled: !!busy, onClick: executeDeleteDomain }, busy ? "Deleting\u2026" : "Delete Domain"))))));
  }
  function SecMailTest() {
    const M2 = window.VModals;
    const [health, setHealth] = useSt(null);
    const [readiness, setReadiness] = useSt(null);
    const [authPosture, setAuthPosture] = useSt(null);
    const [privacyPosture, setPrivacyPosture] = useSt(null);
    const [keyMaterial, setKeyMaterial] = useSt(null);
    const [mailConfig, setMailConfig] = useSt(null);
    const [echoResult, setEchoResult] = useSt(null);
    const [keyserverResult, setKeyserverResult] = useSt(null);
    const [wrapResult, setWrapResult] = useSt(null);
    const [testSearchQuery, setTestSearchQuery] = useSt("");
    const [testSearchResults, setTestSearchResults] = useSt([]);
    const [testSearching, setTestSearching] = useSt(false);
    const [selectedTestUsers, setSelectedTestUsers] = useSt([]);
    const [testAttachments, setTestAttachments] = useSt([]);
    const [testPreview, setTestPreview] = useSt(null);
    const [testResult, setTestResult] = useSt(null);
    const [testErr, setTestErr] = useSt("");
    const [testMsg, setTestMsg] = useSt("");
    const [testSending, setTestSending] = useSt(false);
    const [keyMsg, setKeyMsg] = useSt("");
    const [keyAlert, setKeyAlert] = useSt(null);
    const [form, setForm] = useSt({
      recipient_email: "",
      from_addr: "",
      key_email: "",
      wrap_kdf: "argon2id",
      dkim_pem: "",
      dkim_selector: "mail",
      dkim_domain: "",
      test_local_part: "announcements",
      test_domain: "",
      test_send_mode: "plaintext",
      test_subject: "Elvish admin mail test",
      test_body_text: "This is a test message queued from the admin panel.",
      test_external_emails: "",
      test_notify_recipients: true,
      test_ttl_days: 7,
      test_max_views: 3,
      test_password: "",
      test_password_confirm: ""
    });
    const [confirmKeyAction, setConfirmKeyAction] = useSt(null);
    const [keyActionBusy, setKeyActionBusy] = useSt(false);
    const readinessDNSGuide = useMm(() => buildReadinessDNSGuide(readiness), [readiness]);
    const closeKeyAlert = useCb(() => setKeyAlert(null), []);
    const showKeyAlert = useCb((fallbackTitle, err) => {
      const raw = String(err && err.message || err || "Unexpected error").trim();
      const splitAt = raw.indexOf(": ");
      const title = splitAt > 0 && splitAt < 72 ? raw.slice(0, splitAt) : fallbackTitle;
      const body = splitAt > 0 && splitAt < 72 ? raw.slice(splitAt + 2) : raw;
      setKeyAlert({ kind: "err", title, body });
    }, []);
    const runHealth = async () => {
      setHealth({ loading: true });
      try {
        setHealth(await apiJSON("/api/admin/test/health"));
      } catch (e) {
        setHealth({ error: String(e.message || e) });
      }
    };
    const runReadiness = async () => {
      setReadiness({ loading: true });
      try {
        setReadiness(await apiJSON("/api/admin/test/readiness"));
      } catch (e) {
        setReadiness({ error: String(e.message || e) });
      }
    };
    const runAuthPosture = async () => {
      setAuthPosture({ loading: true });
      try {
        setAuthPosture(await apiJSON("/api/admin/test/auth-posture"));
      } catch (e) {
        setAuthPosture({ error: String(e.message || e) });
      }
    };
    const runPrivacyPosture = async () => {
      setPrivacyPosture({ loading: true });
      try {
        setPrivacyPosture(await apiJSON("/api/admin/test/privacy-posture"));
      } catch (e) {
        setPrivacyPosture({ error: String(e.message || e) });
      }
    };
    const loadKeyMaterial = async () => {
      setKeyMaterial({ loading: true });
      try {
        const data = await apiJSON("/api/admin/test/key-material");
        setKeyMaterial(data);
        setForm((f) => ({
          ...f,
          dkim_selector: data && data.dkim && data.dkim.selector || f.dkim_selector || "mail",
          dkim_domain: data && data.dkim && data.dkim.domain || f.dkim_domain || ""
        }));
      } catch (e) {
        setKeyMaterial({ error: String(e.message || e) });
      }
    };
    const loadMailConfig = async () => {
      try {
        const data = await apiJSON("/api/admin/system-mail");
        setMailConfig(data);
        const preferredFrom = splitEmail(data.default_from_addr || "");
        const fallbackDomain = data.sender_domains && data.sender_domains[0] && data.sender_domains[0].domain || "";
        setForm((f) => ({
          ...f,
          test_local_part: f.test_local_part || preferredFrom.local || "announcements",
          test_domain: f.test_domain || preferredFrom.domain || fallbackDomain
        }));
      } catch (e) {
        setTestErr(String(e.message || e));
      }
    };
    const runEcho = async () => {
      setEchoResult({ loading: true });
      try {
        setEchoResult(await apiJSON("/api/admin/test/echo", {
          method: "POST",
          body: JSON.stringify({
            recipient_email: form.recipient_email,
            from_addr: form.from_addr
          })
        }));
      } catch (e) {
        setEchoResult({ error: String(e.message || e) });
      }
    };
    const runKeyserver = async () => {
      setKeyserverResult({ loading: true });
      try {
        setKeyserverResult(await apiJSON("/api/admin/test/keyserver-probe", {
          method: "POST",
          body: JSON.stringify({ email: form.key_email })
        }));
      } catch (e) {
        setKeyserverResult({ error: String(e.message || e) });
      }
    };
    const runWrap = async () => {
      setWrapResult({ loading: true });
      try {
        setWrapResult(await apiJSON("/api/admin/test/wrap-roundtrip", {
          method: "POST",
          body: JSON.stringify({ kdf: form.wrap_kdf })
        }));
      } catch (e) {
        setWrapResult({ error: String(e.message || e) });
      }
    };
    const searchTestUsers = async () => {
      setTestSearching(true);
      try {
        const data = await apiJSON(`/api/admin/users?page=1&limit=10&q=${encodeURIComponent(testSearchQuery)}`);
        const next = (data.users || []).filter((u) => !selectedTestUsers.some((s) => s.id === u.id));
        setTestSearchResults(next);
      } catch (e) {
        setTestErr(String(e.message || e));
      }
      setTestSearching(false);
    };
    useEf(() => {
      runHealth();
      runReadiness();
      runAuthPosture();
      runPrivacyPosture();
      loadKeyMaterial();
      loadMailConfig();
    }, []);
    const dkimSelectorPreview = String(form.dkim_selector || (keyMaterial && keyMaterial.dkim && keyMaterial.dkim.selector || "mail")).trim().toLowerCase();
    const dkimDomainPreview = String(form.dkim_domain || (keyMaterial && keyMaterial.dkim && keyMaterial.dkim.domain || "")).trim().toLowerCase();
    const dkimDNSPreview = dkimSelectorPreview && dkimDomainPreview ? `${dkimSelectorPreview}._domainkey.${dkimDomainPreview}` : "";
    const senderDomains = mailConfig && mailConfig.sender_domains || [];
    const computedTestFromAddr = form.test_domain ? `${String(form.test_local_part || "").trim() || "announcements"}@${form.test_domain}` : "";
    const testRecipientEmails = useMm(() => {
      const emails = [
        ...selectedTestUsers.map((u) => String(u.email || "").trim().toLowerCase()).filter(Boolean),
        ...splitRecipientEmails(form.test_external_emails)
      ];
      return Array.from(new Set(emails));
    }, [selectedTestUsers, form.test_external_emails]);
    const buildAttachmentPayload = useCb(() => testAttachments.map((att) => ({
      upload_id: att.upload_id || "",
      file_name: att.file_name,
      content_type: att.content_type,
      size_bytes: att.size_bytes
    })), [testAttachments]);
    const buildTestPayload = useCb((extraProtectedLink) => ({
      local_user_ids: selectedTestUsers.map((u) => u.id),
      external_emails: splitRecipientEmails(form.test_external_emails),
      from_addr: computedTestFromAddr,
      subject: String(form.test_subject || "").trim(),
      body_text: String(form.test_body_text || "").trim(),
      send_mode: form.test_send_mode,
      attachments: buildAttachmentPayload(),
      protected_link: {
        notify_recipients: !!form.test_notify_recipients,
        ttl_seconds: Math.max(1, Number(form.test_ttl_days || 7)) * 86400,
        max_views: Math.max(0, Number(form.test_max_views || 0)),
        ...extraProtectedLink || {}
      }
    }), [selectedTestUsers, form, computedTestFromAddr, buildAttachmentPayload]);
    const validateTestComposer = useCb((forSend) => {
      if (!computedTestFromAddr) return "Choose a verified sender domain before testing mail delivery.";
      if (!String(form.test_subject || "").trim()) return "Enter a subject before previewing or sending.";
      if (!String(form.test_body_text || "").trim()) return "Enter a message body before previewing or sending.";
      if (selectedTestUsers.length === 0 && splitRecipientEmails(form.test_external_emails).length === 0) {
        return "Add at least one recipient before previewing or sending.";
      }
      if (forSend && form.test_send_mode === "protected_link") {
        if (!String(form.test_password || "").trim()) return "Enter a protected-link password before sending.";
        if (String(form.test_password) !== String(form.test_password_confirm)) return "Protected-link passwords do not match.";
      }
      return "";
    }, [computedTestFromAddr, form, selectedTestUsers]);
    const ensurePlaintextUploads = useCb(async () => {
      const next = [...testAttachments];
      for (let i = 0; i < next.length; i += 1) {
        if (next[i].upload_id || !next[i].file) continue;
        next[i] = { ...next[i], uploading: true, error: "" };
        setTestAttachments([...next]);
        const fd = new FormData();
        fd.append("file", next[i].file, next[i].file_name);
        try {
          const uploaded = await apiForm("/api/admin/test/uploads", fd);
          next[i] = {
            ...next[i],
            uploading: false,
            upload_id: uploaded.upload_id,
            file_name: uploaded.file_name,
            content_type: uploaded.content_type,
            size_bytes: uploaded.size_bytes
          };
          setTestAttachments([...next]);
        } catch (e) {
          next[i] = { ...next[i], uploading: false, error: String(e.message || e) };
          setTestAttachments([...next]);
          throw e;
        }
      }
    }, [testAttachments]);
    const runTestPreview = useCb(async () => {
      setTestErr("");
      setTestMsg("");
      setTestResult(null);
      const validationErr = validateTestComposer(false);
      if (validationErr) {
        setTestPreview(null);
        setTestErr(validationErr);
        return;
      }
      try {
        if (form.test_send_mode === "plaintext") await ensurePlaintextUploads();
        setTestPreview(await apiJSON("/api/admin/test/preview", {
          method: "POST",
          body: JSON.stringify(buildTestPayload())
        }));
      } catch (e) {
        setTestPreview(null);
        setTestErr(String(e.message || e));
      }
    }, [validateTestComposer, form.test_send_mode, ensurePlaintextUploads, buildTestPayload]);
    const runTestSend = useCb(async () => {
      setTestErr("");
      setTestMsg("");
      setTestSending(true);
      try {
        const validationErr = validateTestComposer(true);
        if (validationErr) throw new Error(validationErr);
        let payload = buildTestPayload();
        if (form.test_send_mode === "plaintext") {
          await ensurePlaintextUploads();
          payload = buildTestPayload();
        } else {
          const protectedLink = await buildProtectedLinkCipherPayload({
            from: computedTestFromAddr,
            to: testRecipientEmails,
            subject: String(form.test_subject || "").trim(),
            body: String(form.test_body_text || "").trim(),
            password: String(form.test_password || ""),
            attachments: testAttachments
          });
          payload = buildTestPayload(protectedLink);
        }
        const res = await apiJSON("/api/admin/test/send", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setTestResult(res);
        setTestMsg(res.url ? `Protected link ready: ${res.url}` : `Test mail queued for ${res.queued_count || 0} recipient(s).`);
        setTestAttachments((list) => list.map((att) => ({ ...att, upload_id: "" })));
      } catch (e) {
        setTestErr(String(e.message || e));
      } finally {
        setTestSending(false);
      }
    }, [validateTestComposer, buildTestPayload, form, ensurePlaintextUploads, computedTestFromAddr, testRecipientEmails, testAttachments]);
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { "data-testid": "admin-mail-test-panel" }, /* @__PURE__ */ React.createElement(A4.H, { num: "05", title: "TESTING", sub: "deliverability \xB7 crypto \xB7 bounded probes" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "These tools are authenticated admin diagnostics. The send-path probe stays inside the normal relay-wrapped outbox flow, key lookups are explicit and rate-limited, and no tool exposes stored message bodies."), keyMsg && /* @__PURE__ */ React.createElement("div", { className: "f-ok" }, keyMsg), /* @__PURE__ */ React.createElement("div", { className: "mail-grid" }, /* @__PURE__ */ React.createElement("div", { className: "test-card" }, /* @__PURE__ */ React.createElement("h3", null, "Infrastructure Health"), /* @__PURE__ */ React.createElement("p", { className: "dim" }, "Check the core stores used by the mail subsystem."), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: runHealth }, health && health.loading ? "Checking\u2026" : "Run Health Check"), health && health.checks && /* @__PURE__ */ React.createElement("div", { className: "test-results" }, Object.entries(health.checks).map(([k, v]) => /* @__PURE__ */ React.createElement("div", { key: k, className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, k), /* @__PURE__ */ React.createElement("span", { className: v.ok ? "ok" : "warn" }, v.ok ? "OK" : v.error || "FAIL")))), health && health.error && /* @__PURE__ */ React.createElement("div", { className: "f-err" }, health.error)), /* @__PURE__ */ React.createElement("div", { className: "test-card" }, /* @__PURE__ */ React.createElement("h3", null, "Deliverability Readiness"), /* @__PURE__ */ React.createElement("p", { className: "dim" }, "Verify relay key, sender domains, and the DNS records the outbound path depends on."), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: runReadiness }, readiness && readiness.loading ? "Checking\u2026" : "Run Readiness"), readiness && (readiness.sender_domains || readiness.delivery) && /* @__PURE__ */ React.createElement("div", { className: "test-results" }, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Relay key"), /* @__PURE__ */ React.createElement("span", { className: readiness.relay_enabled ? "ok" : "warn" }, readiness.relay_enabled ? "Ready" : "Missing")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "DKIM signer"), /* @__PURE__ */ React.createElement("span", { className: readiness.dkim_configured ? "ok" : "warn" }, readiness.dkim_configured ? "Configured" : "Missing")), readiness.delivery && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "DKIM domain"), /* @__PURE__ */ React.createElement("span", null, readiness.delivery.domain || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "DKIM DNS"), /* @__PURE__ */ React.createElement("span", { className: readiness.delivery.dkim && readiness.delivery.dkim.ok ? "ok" : "warn" }, readiness.delivery.dkim && readiness.delivery.dkim.ok ? "Published" : "Missing / mismatch")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "MX"), /* @__PURE__ */ React.createElement("span", { className: readiness.delivery.mx && readiness.delivery.mx.ok ? "ok" : "warn" }, readiness.delivery.mx && readiness.delivery.mx.ok ? "Present" : "Missing")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "SPF"), /* @__PURE__ */ React.createElement("span", { className: readiness.delivery.spf && readiness.delivery.spf.ok ? "ok" : "warn" }, readiness.delivery.spf && readiness.delivery.spf.ok ? "Present" : "Missing")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "DMARC"), /* @__PURE__ */ React.createElement("span", { className: readiness.delivery.dmarc && readiness.delivery.dmarc.ok ? "ok" : "warn" }, readiness.delivery.dmarc && readiness.delivery.dmarc.ok ? "Present" : "Missing"))), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Keyserver"), /* @__PURE__ */ React.createElement("span", { className: readiness.keyserver_enabled ? "ok" : "warn" }, readiness.keyserver_enabled ? "Enabled" : "Missing")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Sender domains"), /* @__PURE__ */ React.createElement("span", null, (readiness.sender_domains || []).length)), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Ready"), /* @__PURE__ */ React.createElement("span", { className: readiness.ready_for_system_mail ? "ok" : "warn" }, readiness.ready_for_system_mail ? "Yes" : "No"))), readiness && Array.isArray(readiness.issues) && readiness.issues.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "test-results", style: { marginTop: 8 } }, readiness.issues.map((issue, idx) => /* @__PURE__ */ React.createElement("div", { key: issue + idx, className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Issue"), /* @__PURE__ */ React.createElement("span", { className: "warn" }, issue)))), readinessDNSGuide.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "test-results", style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Guide"), /* @__PURE__ */ React.createElement("span", null, "Publish these DNS records, wait for DNS to propagate, then rerun readiness.")), readinessDNSGuide.map((record) => /* @__PURE__ */ React.createElement("details", { key: record.id, style: { marginTop: 8 } }, /* @__PURE__ */ React.createElement("summary", { className: "dim" }, record.label, " setup"), /* @__PURE__ */ React.createElement("div", { className: "test-results", style: { marginTop: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Type"), /* @__PURE__ */ React.createElement("span", null, record.type)), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Host"), /* @__PURE__ */ React.createElement("span", { className: "mono" }, record.host || "@")), record.fqdn && /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "FQDN"), /* @__PURE__ */ React.createElement("span", { className: "mono tiny" }, record.fqdn)), record.extra && /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Extra"), /* @__PURE__ */ React.createElement("span", null, record.extra)), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "TTL"), /* @__PURE__ */ React.createElement("span", null, record.ttl || "Auto")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Value"), /* @__PURE__ */ React.createElement("span", { className: "mono tiny" }, record.value)), record.note && /* @__PURE__ */ React.createElement("div", { className: "f-help", style: { marginTop: 6 } }, record.note))))), readiness && readiness.error && /* @__PURE__ */ React.createElement("div", { className: "f-err" }, readiness.error)), /* @__PURE__ */ React.createElement("div", { className: "test-card" }, /* @__PURE__ */ React.createElement("h3", null, "SRP / Browser Auth"), /* @__PURE__ */ React.createElement("p", { className: "dim" }, "Audit the live browser-auth posture: SRP routes, user migration counts, and whether secure shells load the expected auth runtime."), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: runAuthPosture }, authPosture && authPosture.loading ? "Checking\u2026" : "Run Auth Audit"), authPosture && !authPosture.loading && !authPosture.error && /* @__PURE__ */ React.createElement("div", { className: "test-results" }, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "SRP enabled"), /* @__PURE__ */ React.createElement("span", { className: authPosture.srp_enabled ? "ok" : "warn" }, authPosture.srp_enabled ? "Yes" : "No")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Sessions"), /* @__PURE__ */ React.createElement("span", { className: authPosture.sessions_configured ? "ok" : "warn" }, authPosture.sessions_configured ? "Configured" : "Missing")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "SRP group"), /* @__PURE__ */ React.createElement("span", null, authPosture.srp_group || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "SRP hash"), /* @__PURE__ */ React.createElement("span", null, authPosture.srp_hash || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Users (total)"), /* @__PURE__ */ React.createElement("span", null, authPosture.store && authPosture.store.total_users != null ? authPosture.store.total_users : "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Users (SRP)"), /* @__PURE__ */ React.createElement("span", null, authPosture.store && authPosture.store.srp_users != null ? authPosture.store.srp_users : "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Legacy auth users"), /* @__PURE__ */ React.createElement("span", { className: authPosture.store && Number(authPosture.store.legacy_users || 0) === 0 ? "ok" : "warn" }, authPosture.store && authPosture.store.legacy_users != null ? authPosture.store.legacy_users : "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Disabled users"), /* @__PURE__ */ React.createElement("span", null, authPosture.store && authPosture.store.disabled_users != null ? authPosture.store.disabled_users : "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Live SRP challenges"), /* @__PURE__ */ React.createElement("span", null, authPosture.active_srp_challenges != null ? authPosture.active_srp_challenges : "\u2014")), authPosture.pages && Object.entries(authPosture.pages).map(([name, page]) => /* @__PURE__ */ React.createElement("div", { key: name, className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, name, " shell"), /* @__PURE__ */ React.createElement("span", { className: page && page.ok ? "ok" : "warn" }, page && page.ok ? "Ready" : "Needs review"))), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Unlock persistence"), /* @__PURE__ */ React.createElement("span", { className: authPosture.unlock_memory_only ? "ok" : "warn" }, authPosture.unlock_memory_only ? "Memory-only" : "Persistent"))), authPosture && authPosture.error && /* @__PURE__ */ React.createElement("div", { className: "f-err" }, authPosture.error), /* @__PURE__ */ React.createElement(JsonBlock, { value: authPosture && !authPosture.loading && !authPosture.error ? authPosture : null })), /* @__PURE__ */ React.createElement("div", { className: "test-card" }, /* @__PURE__ */ React.createElement("h3", null, "Ultra-Private Posture"), /* @__PURE__ */ React.createElement("p", { className: "dim" }, "Check encrypted-by-default metadata, secure-shell headers, inbound SMTP gateway encryption, and whether user-authored plaintext relay is shut off."), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: runPrivacyPosture }, privacyPosture && privacyPosture.loading ? "Checking\u2026" : "Run Privacy Audit"), privacyPosture && !privacyPosture.loading && !privacyPosture.error && /* @__PURE__ */ React.createElement("div", { className: "test-results" }, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Metadata default"), /* @__PURE__ */ React.createElement("span", { className: privacyPosture.default_metadata_encrypted ? "ok" : "warn" }, privacyPosture.default_metadata_encrypted ? "Encrypted / opt-in" : "Readable by default")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Plaintext relay (user)"), /* @__PURE__ */ React.createElement("span", { className: privacyPosture.user_plaintext_relay_disabled ? "ok" : "warn" }, privacyPosture.user_plaintext_relay_disabled ? "Disabled" : "Enabled")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Unlock persistence"), /* @__PURE__ */ React.createElement("span", { className: privacyPosture.unlock_memory_only ? "ok" : "warn" }, privacyPosture.unlock_memory_only ? "Memory-only" : "Persistent")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "SMTP plaintext ingress"), /* @__PURE__ */ React.createElement("span", { className: privacyPosture.smtp_plaintext_gateway_encryption ? "ok" : "warn" }, privacyPosture.smtp_plaintext_gateway_encryption ? "Gateway-encrypted" : "Needs review")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Referrer policy"), /* @__PURE__ */ React.createElement("span", null, privacyPosture.secure_headers && privacyPosture.secure_headers.referrer_policy || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Frame protection"), /* @__PURE__ */ React.createElement("span", null, privacyPosture.secure_headers && privacyPosture.secure_headers.x_frame_options || "\u2014")), privacyPosture.pages && Object.entries(privacyPosture.pages).map(([name, page]) => /* @__PURE__ */ React.createElement("div", { key: name, className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, name, " shell"), /* @__PURE__ */ React.createElement("span", { className: page && page.ok ? "ok" : "warn" }, page && page.ok ? "Clean" : "Needs review")))), privacyPosture && privacyPosture.error && /* @__PURE__ */ React.createElement("div", { className: "f-err" }, privacyPosture.error), /* @__PURE__ */ React.createElement(JsonBlock, { value: privacyPosture && !privacyPosture.loading && !privacyPosture.error ? privacyPosture : null })), /* @__PURE__ */ React.createElement("div", { className: "test-card" }, /* @__PURE__ */ React.createElement("h3", null, "Relay Key"), /* @__PURE__ */ React.createElement("p", { className: "dim" }, "Manage the server-side relay key used to wrap plaintext-relay mail at rest."), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: loadKeyMaterial }, keyMaterial && keyMaterial.loading ? "Loading\u2026" : "Refresh Key Status"), keyMaterial && keyMaterial.relay && /* @__PURE__ */ React.createElement("div", { className: "test-results" }, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Present"), /* @__PURE__ */ React.createElement("span", { className: keyMaterial.relay.present ? "ok" : "warn" }, keyMaterial.relay.present ? "Yes" : "No")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Path"), /* @__PURE__ */ React.createElement("span", { className: "mono" }, keyMaterial.relay.path || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Fingerprint"), /* @__PURE__ */ React.createElement("span", { className: "mono tiny" }, keyMaterial.relay.fingerprint || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Public hash"), /* @__PURE__ */ React.createElement("span", { className: "mono tiny" }, keyMaterial.relay.public_hash || "\u2014")), keyMaterial.relay.error && /* @__PURE__ */ React.createElement("div", { className: "f-err" }, keyMaterial.relay.error)), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", style: { marginTop: 10 }, onClick: () => setConfirmKeyAction("relay") }, "Generate / Rotate Relay Key")), /* @__PURE__ */ React.createElement("div", { className: "test-card" }, /* @__PURE__ */ React.createElement("h3", null, "DKIM Key"), /* @__PURE__ */ React.createElement("p", { className: "dim" }, "Manage the active DKIM signer domain/selector, then generate a key or upload an existing PEM. Changes hot-reload into the outbound worker."), keyMaterial && keyMaterial.dkim && /* @__PURE__ */ React.createElement("div", { className: "test-results" }, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Present"), /* @__PURE__ */ React.createElement("span", { className: keyMaterial.dkim.present ? "ok" : "warn" }, keyMaterial.dkim.present ? "Yes" : "No")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Configured"), /* @__PURE__ */ React.createElement("span", { className: keyMaterial.dkim.configured ? "ok" : "warn" }, keyMaterial.dkim.configured ? "Yes" : "No")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Path"), /* @__PURE__ */ React.createElement("span", { className: "mono" }, keyMaterial.dkim.path || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Selector"), /* @__PURE__ */ React.createElement("span", null, keyMaterial.dkim.selector || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Domain"), /* @__PURE__ */ React.createElement("span", null, keyMaterial.dkim.domain || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "DNS name"), /* @__PURE__ */ React.createElement("span", { className: "mono tiny" }, keyMaterial.dkim.dns_name || "\u2014")), keyMaterial.dkim.public_txt && /* @__PURE__ */ React.createElement("details", { style: { marginTop: 8 } }, /* @__PURE__ */ React.createElement("summary", { className: "dim" }, "DKIM DNS TXT"), /* @__PURE__ */ React.createElement("pre", { className: "test-output" }, keyMaterial.dkim.public_txt)), keyMaterial.dkim.error && /* @__PURE__ */ React.createElement("div", { className: "f-err" }, keyMaterial.dkim.error)), /* @__PURE__ */ React.createElement("div", { className: "system-mail-grid", style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        placeholder: "Selector",
        value: form.dkim_selector,
        onChange: (e) => setForm((f) => ({ ...f, dkim_selector: e.target.value }))
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        placeholder: "example.com",
        value: form.dkim_domain,
        onChange: (e) => setForm((f) => ({ ...f, dkim_domain: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "f-help" }, "DNS name preview: ", /* @__PURE__ */ React.createElement("code", null, dkimDNSPreview || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "mail-actions" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: async () => {
      setKeyMsg("");
      closeKeyAlert();
      try {
        const res = await apiJSON("/api/admin/test/key-material/dkim/config", {
          method: "POST",
          body: JSON.stringify({
            selector: form.dkim_selector,
            domain: form.dkim_domain
          })
        });
        setKeyMsg(`DKIM settings saved. Active DNS name: ${res.dns_name || "configure a domain to derive it"}.`);
        await loadKeyMaterial();
        await runReadiness();
      } catch (e) {
        showKeyAlert("DKIM config update failed", e);
      }
    } }, "Save DKIM Settings"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", onClick: () => setConfirmKeyAction("dkim") }, "Generate DKIM Key"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: async () => {
      setKeyMsg("");
      closeKeyAlert();
      try {
        const res = await apiJSON("/api/admin/test/key-material/dkim/upload", {
          method: "POST",
          body: JSON.stringify({ pem: form.dkim_pem })
        });
        setKeyMsg(`DKIM key uploaded. Active DNS name: ${res.dns_name || "configured name"}.`);
        setForm((f) => ({ ...f, dkim_pem: "" }));
        await loadKeyMaterial();
        await runReadiness();
      } catch (e) {
        showKeyAlert("DKIM key upload failed", e);
      }
    } }, "Upload DKIM PEM")), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "txa tall",
        style: { marginTop: 10 },
        placeholder: "Paste a PKCS#1 or PKCS#8 RSA private key PEM to replace the current DKIM key\u2026",
        value: form.dkim_pem,
        onChange: (e) => setForm((f) => ({ ...f, dkim_pem: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "test-card", style: { gridColumn: "1 / -1" } }, /* @__PURE__ */ React.createElement("h3", null, "Admin Test Composer"), /* @__PURE__ */ React.createElement("p", { className: "dim" }, "Send plaintext or protected-link test messages to selected Elvish users, external inboxes, or both."), testErr && /* @__PURE__ */ React.createElement("div", { className: "f-err" }, testErr), testMsg && /* @__PURE__ */ React.createElement("div", { className: "f-ok" }, testMsg), /* @__PURE__ */ React.createElement("div", { className: "col", style: { gap: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 11, marginBottom: 6 } }, "Sender"), /* @__PURE__ */ React.createElement("div", { className: "system-mail-grid" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        placeholder: "Local part",
        value: form.test_local_part,
        onChange: (e) => setForm((f) => ({ ...f, test_local_part: e.target.value }))
      }
    ), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "sel",
        value: form.test_domain,
        onChange: (e) => setForm((f) => ({ ...f, test_domain: e.target.value }))
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "Select a verified domain\u2026"),
      senderDomains.map((d) => /* @__PURE__ */ React.createElement("option", { key: d.domain, value: d.domain }, d.domain, d.is_default ? " (default)" : "", " (", d.source, ")"))
    )), /* @__PURE__ */ React.createElement("div", { className: "f-help" }, "From address preview: ", /* @__PURE__ */ React.createElement("code", null, computedTestFromAddr || "\u2014"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 11, marginBottom: 6 } }, "Recipients"), /* @__PURE__ */ React.createElement("div", { className: "search-bar" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        placeholder: "Search platform users by email\u2026",
        value: testSearchQuery,
        onChange: (e) => setTestSearchQuery(e.target.value)
      }
    ), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: searchTestUsers }, testSearching ? "Searching\u2026" : "Search")), /* @__PURE__ */ React.createElement("div", { className: "selected-users", style: { marginTop: 8 } }, selectedTestUsers.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No platform users selected."), selectedTestUsers.map((u) => /* @__PURE__ */ React.createElement("div", { key: u.id, className: "selected-user" }, /* @__PURE__ */ React.createElement("div", { className: "col" }, /* @__PURE__ */ React.createElement("strong", null, u.email), /* @__PURE__ */ React.createElement("span", { className: "dim" }, u.name || "No name", " \xB7 ", u.id.slice(0, 8))), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => setSelectedTestUsers((list) => list.filter((x) => x.id !== u.id)) }, "Remove")))), testSearchResults.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "search-results", style: { marginTop: 8 } }, testSearchResults.map((u) => /* @__PURE__ */ React.createElement("div", { key: u.id, className: "search-result-row" }, /* @__PURE__ */ React.createElement("div", { className: "col" }, /* @__PURE__ */ React.createElement("strong", null, u.email), /* @__PURE__ */ React.createElement("span", { className: "dim" }, u.name || "No name", " \xB7 created ", fmtDT(u.created_at))), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", onClick: () => setSelectedTestUsers((list) => [...list, u]) }, "Add")))), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "txa",
        style: { marginTop: 8 },
        placeholder: "External inboxes (comma or newline separated)\nqa@example.com\ndeliverability@external.test",
        value: form.test_external_emails,
        onChange: (e) => setForm((f) => ({ ...f, test_external_emails: e.target.value }))
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "f-help" }, "Resolved recipient set: ", /* @__PURE__ */ React.createElement("code", null, testRecipientEmails.length))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 11, marginBottom: 6 } }, "Mode"), /* @__PURE__ */ React.createElement(
      A4.Seg,
      {
        value: form.test_send_mode,
        onChange: (v) => {
          setForm((f) => ({ ...f, test_send_mode: v }));
          setTestPreview(null);
          setTestResult(null);
          setTestErr("");
        },
        options: [
          { value: "plaintext", label: "Plaintext relay" },
          { value: "protected_link", label: "Protected link" }
        ]
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 11, marginBottom: 6 } }, "Subject"), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        placeholder: "Announcement subject",
        value: form.test_subject,
        onChange: (e) => setForm((f) => ({ ...f, test_subject: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 11, marginBottom: 6 } }, "Body"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "txa tall",
        placeholder: "Compose the test message body\u2026",
        value: form.test_body_text,
        onChange: (e) => setForm((f) => ({ ...f, test_body_text: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 11, marginBottom: 6 } }, "Attachments"), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        type: "file",
        multiple: true,
        onChange: (e) => {
          const files = Array.from(e.target.files || []);
          if (!files.length) return;
          setTestAttachments((list) => list.concat(files.map((file, idx) => ({
            local_id: `${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
            file,
            file_name: sanitizeAttachmentName(file.name),
            content_type: sanitizeAttachmentType(file.type),
            size_bytes: Number(file.size || 0),
            upload_id: "",
            uploading: false,
            error: ""
          }))));
          e.target.value = "";
        }
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "selected-users", style: { marginTop: 8 } }, testAttachments.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No attachments selected."), testAttachments.map((att) => /* @__PURE__ */ React.createElement("div", { key: att.local_id, className: "selected-user" }, /* @__PURE__ */ React.createElement("div", { className: "col" }, /* @__PURE__ */ React.createElement("strong", null, att.file_name), /* @__PURE__ */ React.createElement("span", { className: "dim" }, fmtBytes(att.size_bytes), " \xB7 ", att.content_type || "application/octet-stream", att.uploading ? " \xB7 uploading\u2026" : att.upload_id ? " \xB7 uploaded for plaintext send" : ""), att.error && /* @__PURE__ */ React.createElement("span", { className: "warn" }, att.error)), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => setTestAttachments((list) => list.filter((x) => x.local_id !== att.local_id)) }, "Remove"))))), form.test_send_mode === "protected_link" && /* @__PURE__ */ React.createElement("div", { className: "test-results" }, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Notify recipients"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: !!form.test_notify_recipients,
        onChange: (e) => setForm((f) => ({ ...f, test_notify_recipients: e.target.checked }))
      }
    ), /* @__PURE__ */ React.createElement("span", null, "Send the protected-link notice email through the normal mail path."))), /* @__PURE__ */ React.createElement("div", { className: "system-mail-grid", style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        type: "password",
        placeholder: "Protected-link password",
        value: form.test_password,
        onChange: (e) => setForm((f) => ({ ...f, test_password: e.target.value }))
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        type: "password",
        placeholder: "Confirm password",
        value: form.test_password_confirm,
        onChange: (e) => setForm((f) => ({ ...f, test_password_confirm: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "system-mail-grid", style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        type: "number",
        min: "1",
        max: "30",
        placeholder: "TTL (days)",
        value: form.test_ttl_days,
        onChange: (e) => setForm((f) => ({ ...f, test_ttl_days: e.target.value }))
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "inp",
        type: "number",
        min: "0",
        max: "1000",
        placeholder: "Max views (0 = unlimited)",
        value: form.test_max_views,
        onChange: (e) => setForm((f) => ({ ...f, test_max_views: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "f-help" }, "Protected-link payloads are encrypted in this browser tab before upload. Attachments stay client-side until the encrypted package is created.")), /* @__PURE__ */ React.createElement("div", { className: "mail-actions" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: runTestPreview }, "Preview"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", disabled: testSending, onClick: runTestSend }, testSending ? "Sending\u2026" : "Send Test Mail")), testPreview && /* @__PURE__ */ React.createElement("div", { className: "test-results" }, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Mode"), /* @__PURE__ */ React.createElement("span", null, testPreview.send_mode || "plaintext")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Recipients"), /* @__PURE__ */ React.createElement("span", null, testPreview.recipient_count || 0)), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Local delivery"), /* @__PURE__ */ React.createElement("span", null, testPreview.local_recipient_count || 0)), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "External delivery"), /* @__PURE__ */ React.createElement("span", null, testPreview.external_recipient_count || 0)), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Attachments"), /* @__PURE__ */ React.createElement("span", null, testPreview.attachment_count || 0, " \xB7 ", fmtBytes(testPreview.attachment_bytes || 0))), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Relay ready"), /* @__PURE__ */ React.createElement("span", { className: testPreview.relay_enabled ? "ok" : "warn" }, testPreview.relay_enabled ? "Yes" : "No")), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Protected-link ready"), /* @__PURE__ */ React.createElement("span", { className: testPreview.protected_link_enabled ? "ok" : "warn" }, testPreview.protected_link_enabled ? "Yes" : "No"))), /* @__PURE__ */ React.createElement(JsonBlock, { value: testPreview && testPreview.sample ? testPreview : null }), /* @__PURE__ */ React.createElement(JsonBlock, { value: testResult }))), /* @__PURE__ */ React.createElement("div", { className: "test-card" }, /* @__PURE__ */ React.createElement("h3", null, "Keyserver Probe"), /* @__PURE__ */ React.createElement("p", { className: "dim" }, "Resolve one public key through the configured lookup chain."), /* @__PURE__ */ React.createElement("input", { className: "inp", placeholder: "user@example.com", value: form.key_email, onChange: (e) => setForm((f) => ({ ...f, key_email: e.target.value })) }), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", style: { marginTop: 10 }, onClick: runKeyserver }, keyserverResult && keyserverResult.loading ? "Running\u2026" : "Run Probe"), /* @__PURE__ */ React.createElement(JsonBlock, { value: keyserverResult && !keyserverResult.loading ? keyserverResult : null })), /* @__PURE__ */ React.createElement("div", { className: "test-card" }, /* @__PURE__ */ React.createElement("h3", null, "Wrap Roundtrip"), /* @__PURE__ */ React.createElement("p", { className: "dim" }, "Verify the same KDF + AES-GCM cycle the browser depends on."), /* @__PURE__ */ React.createElement("select", { className: "sel", value: form.wrap_kdf, onChange: (e) => setForm((f) => ({ ...f, wrap_kdf: e.target.value })) }, /* @__PURE__ */ React.createElement("option", { value: "argon2id" }, "argon2id"), /* @__PURE__ */ React.createElement("option", { value: "pbkdf2-sha256" }, "pbkdf2-sha256")), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", style: { marginTop: 10 }, onClick: runWrap }, wrapResult && wrapResult.loading ? "Running\u2026" : "Run Check"), /* @__PURE__ */ React.createElement(JsonBlock, { value: wrapResult && !wrapResult.loading ? wrapResult : null })))), M2 && /* @__PURE__ */ React.createElement(
      M2.NotifyModal,
      {
        open: !!keyAlert,
        onClose: closeKeyAlert,
        kind: keyAlert?.kind,
        title: keyAlert?.title,
        body: keyAlert?.body
      }
    ), confirmKeyAction && /* @__PURE__ */ React.createElement("div", { className: "modal-overlay", onClick: (e) => {
      if (e.target === e.currentTarget && !keyActionBusy) setConfirmKeyAction(null);
    } }, /* @__PURE__ */ React.createElement("div", { style: { background: "var(--bg)", border: "1px solid var(--fg)", maxWidth: 480, width: "90%", position: "relative" } }, /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: -1, left: -1, width: 6, height: 6, background: "var(--accent)" } }), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: -1, right: -1, width: 6, height: 6, background: "var(--accent)" } }), /* @__PURE__ */ React.createElement("div", { style: { padding: "14px 18px", borderBottom: "1px solid var(--fg)", display: "flex", alignItems: "center", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" } }, confirmKeyAction === "relay" ? "Generate Relay Key" : "Generate DKIM Key"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-close", onClick: () => setConfirmKeyAction(null), disabled: keyActionBusy }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { padding: 18 } }, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 } }, confirmKeyAction === "relay" ? "Generate or rotate the relay key? Existing queued plaintext-relay payloads encrypted to the old key may stop decrypting." : "Generate a new DKIM private key and replace the current one?"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10 } }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-sm", onClick: () => setConfirmKeyAction(null), disabled: keyActionBusy }, "Cancel"), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn-sm primary",
        disabled: keyActionBusy,
        onClick: async () => {
          setKeyActionBusy(true);
          setKeyMsg("");
          closeKeyAlert();
          try {
            if (confirmKeyAction === "relay") {
              const res = await apiJSON("/api/admin/test/key-material/relay/generate", { method: "POST", body: "{}" });
              setKeyMsg(`Relay key active: ${String(res.fingerprint || "").slice(-16)}.`);
            } else {
              const res = await apiJSON("/api/admin/test/key-material/dkim/generate", { method: "POST", body: "{}" });
              setKeyMsg(`DKIM key generated. Publish TXT at ${res.dns_name || "the configured DNS name"}.`);
            }
            setConfirmKeyAction(null);
            await loadKeyMaterial();
            await runReadiness();
          } catch (e) {
            showKeyAlert(confirmKeyAction === "relay" ? "Relay key action failed" : "DKIM key generation failed", e);
          } finally {
            setKeyActionBusy(false);
          }
        }
      },
      keyActionBusy ? "Working\u2026" : "Generate Key"
    ))))));
  }
  function SecSystemMail() {
    const [config, setConfig] = useSt(null);
    const [runs, setRuns] = useSt([]);
    const [searchQuery, setSearchQuery] = useSt("");
    const [searchResults, setSearchResults] = useSt([]);
    const [searching, setSearching] = useSt(false);
    const [selectedUsers, setSelectedUsers] = useSt([]);
    const [form, setForm] = useSt({
      audience_kind: "selected",
      local_part: "announcements",
      domain: "",
      subject: "",
      body_text: ""
    });
    const [preview, setPreview] = useSt(null);
    const [sending, setSending] = useSt(false);
    const [confirmBulk, setConfirmBulk] = useSt(false);
    const [msg, setMsg] = useSt("");
    const [err, setErr] = useSt("");
    const senderDomains = config && config.sender_domains || [];
    const computedFromAddr = form.domain ? `${form.local_part.trim() || "announcements"}@${form.domain}` : "";
    const load = useCb(async () => {
      try {
        const cfg = await apiJSON("/api/admin/system-mail");
        setConfig(cfg);
        setRuns((await apiJSON("/api/admin/system-mail/runs")).items || []);
        const fallbackDomain = cfg.sender_domains && cfg.sender_domains[0] && cfg.sender_domains[0].domain || "";
        const preferredFrom = splitEmail(cfg.default_from_addr || "");
        setForm((f) => ({
          ...f,
          local_part: f.local_part || preferredFrom.local || "announcements",
          domain: f.domain || preferredFrom.domain || fallbackDomain
        }));
      } catch (e) {
        setErr(String(e.message || e));
      }
    }, []);
    useEf(() => {
      load();
    }, [load]);
    const searchUsers = async () => {
      setSearching(true);
      try {
        const data = await apiJSON(`/api/admin/users?page=1&limit=10&q=${encodeURIComponent(searchQuery)}`);
        const next = (data.users || []).filter((u) => !selectedUsers.some((s) => s.id === u.id));
        setSearchResults(next);
      } catch (e) {
        setErr(String(e.message || e));
      }
      setSearching(false);
    };
    const payload = useMm(() => ({
      audience_kind: form.audience_kind,
      user_ids: selectedUsers.map((u) => u.id),
      from_addr: computedFromAddr,
      subject: String(form.subject || "").trim(),
      body_text: String(form.body_text || "").trim()
    }), [form, selectedUsers, computedFromAddr]);
    const needsConfirm = form.audience_kind !== "selected" || (preview && preview.recipient_count || selectedUsers.length) > 1;
    return /* @__PURE__ */ React.createElement("div", { "data-testid": "admin-system-mail-panel" }, /* @__PURE__ */ React.createElement(A4.H, { num: "06", title: "SYSTEM MAIL", sub: "preview \xB7 queue securely \xB7 audit recent runs" }), /* @__PURE__ */ React.createElement("div", { className: "adm-explain" }, "System email is queued through the same relay-wrapped outbox and worker path as other server-authored mail. The server stores only wrapped payloads at rest, sender domains are restricted, and bulk sends require an explicit confirmation step."), err && /* @__PURE__ */ React.createElement("div", { className: "f-err" }, err), msg && /* @__PURE__ */ React.createElement("div", { className: "f-ok" }, msg), /* @__PURE__ */ React.createElement(A4.Card, { title: "COMPOSE SYSTEM MAIL", right: config ? `${config.active_user_count || 0} active users` : "loading\u2026" }, /* @__PURE__ */ React.createElement(A4.FRow, { label: "Audience", hint: "Target selected users or queue a platform-wide announcement to all active users." }, /* @__PURE__ */ React.createElement(
      A4.Seg,
      {
        value: form.audience_kind,
        onChange: (v) => {
          setForm((f) => ({ ...f, audience_kind: v }));
          setPreview(null);
          setConfirmBulk(false);
        },
        options: [
          { value: "selected", label: "Selected users" },
          { value: "all_active", label: "All active users" }
        ]
      }
    )), form.audience_kind === "selected" && /* @__PURE__ */ React.createElement(A4.FRow, { label: "Recipients", hint: "Search by email, add one or more platform users, then preview before queueing." }, /* @__PURE__ */ React.createElement("div", { className: "col", style: { gap: 10 } }, /* @__PURE__ */ React.createElement("div", { className: "search-bar" }, /* @__PURE__ */ React.createElement("input", { className: "inp", placeholder: "Search users by email\u2026", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value) }), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: searchUsers }, searching ? "Searching\u2026" : "Search")), /* @__PURE__ */ React.createElement("div", { className: "selected-users" }, selectedUsers.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "dim" }, "No users selected."), selectedUsers.map((u) => /* @__PURE__ */ React.createElement("div", { key: u.id, className: "selected-user" }, /* @__PURE__ */ React.createElement("div", { className: "col" }, /* @__PURE__ */ React.createElement("strong", null, u.email), /* @__PURE__ */ React.createElement("span", { className: "dim" }, u.name || "No name", " \xB7 ", u.id.slice(0, 8))), /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: () => setSelectedUsers((list) => list.filter((x) => x.id !== u.id)) }, "Remove")))), searchResults.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "search-results" }, searchResults.map((u) => /* @__PURE__ */ React.createElement("div", { key: u.id, className: "search-result-row" }, /* @__PURE__ */ React.createElement("div", { className: "col" }, /* @__PURE__ */ React.createElement("strong", null, u.email), /* @__PURE__ */ React.createElement("span", { className: "dim" }, u.name || "No name", " \xB7 created ", fmtDT(u.created_at))), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", onClick: () => setSelectedUsers((list) => [...list, u]) }, "Add")))))), /* @__PURE__ */ React.createElement(A4.FRow, { label: "Sender", hint: "The domain must come from the verified sender-domain list." }, /* @__PURE__ */ React.createElement("div", { className: "system-mail-grid" }, /* @__PURE__ */ React.createElement("input", { className: "inp", placeholder: "Local part", value: form.local_part, onChange: (e) => setForm((f) => ({ ...f, local_part: e.target.value })) }), /* @__PURE__ */ React.createElement("select", { className: "sel", value: form.domain, onChange: (e) => setForm((f) => ({ ...f, domain: e.target.value })) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select a verified domain\u2026"), senderDomains.map((d) => /* @__PURE__ */ React.createElement("option", { key: d.domain, value: d.domain }, d.domain, d.is_default ? " (default)" : "", " (", d.source, ")")))), /* @__PURE__ */ React.createElement("div", { className: "f-help" }, "From address preview: ", /* @__PURE__ */ React.createElement("code", null, computedFromAddr || "\u2014"))), /* @__PURE__ */ React.createElement(A4.FRow, { label: "Subject", req: true }, /* @__PURE__ */ React.createElement(A4.Input, { value: form.subject, onChange: (v) => setForm((f) => ({ ...f, subject: v })), placeholder: "Announcement subject" })), /* @__PURE__ */ React.createElement(A4.FRow, { label: "Body", req: true, hint: "Text-only in the first version to keep the send path constrained and auditable." }, /* @__PURE__ */ React.createElement(A4.Textarea, { tall: true, value: form.body_text, onChange: (v) => setForm((f) => ({ ...f, body_text: v })), placeholder: "System announcement body\u2026" })), /* @__PURE__ */ React.createElement("div", { className: "mail-actions" }, /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: async () => {
      setErr("");
      setMsg("");
      setConfirmBulk(false);
      const validationErr = validateSystemMailPayload(payload, selectedUsers);
      if (validationErr) {
        setPreview(null);
        setErr(validationErr);
        return;
      }
      try {
        setPreview(await apiJSON("/api/admin/system-mail/preview", {
          method: "POST",
          body: JSON.stringify(payload)
        }));
      } catch (e) {
        setPreview(null);
        setErr(String(e.message || e));
      }
    } }, "Preview"), /* @__PURE__ */ React.createElement("button", { className: "btn-sm primary", disabled: !preview || sending || needsConfirm && !confirmBulk, onClick: async () => {
      setSending(true);
      setErr("");
      setMsg("");
      const validationErr = validateSystemMailPayload(payload, selectedUsers);
      if (validationErr) {
        setSending(false);
        setErr(validationErr);
        return;
      }
      try {
        const res = await apiJSON("/api/admin/system-mail/send", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setMsg(`Queued ${res.queued_count} message(s). Run ${String(res.run_id || "").slice(0, 8)} created.`);
        setPreview(res);
        setSelectedUsers([]);
        setSearchResults([]);
        setSearchQuery("");
        setConfirmBulk(false);
        load();
      } catch (e) {
        setErr(String(e.message || e));
      }
      setSending(false);
    } }, sending ? "Queueing\u2026" : "Queue System Mail")), needsConfirm && /* @__PURE__ */ React.createElement("label", { className: "tgl", style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: confirmBulk, onChange: (e) => setConfirmBulk(e.target.checked) }), /* @__PURE__ */ React.createElement("span", { className: "tgl-track" }), "Confirm this ", form.audience_kind === "all_active" ? "bulk" : "multi-recipient", " send."), preview && /* @__PURE__ */ React.createElement("div", { className: "preview-box" }, /* @__PURE__ */ React.createElement("div", { className: "preview-row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "From"), /* @__PURE__ */ React.createElement("span", null, preview.from_addr || computedFromAddr)), /* @__PURE__ */ React.createElement("div", { className: "preview-row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Recipients"), /* @__PURE__ */ React.createElement("span", null, preview.recipient_count || preview.queued_count || 0)), /* @__PURE__ */ React.createElement("div", { className: "preview-row" }, /* @__PURE__ */ React.createElement("span", { className: "dim" }, "Body chars"), /* @__PURE__ */ React.createElement("span", null, preview.body_chars || form.body_text.length)), Array.isArray(preview.sample) && preview.sample.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "preview-list" }, preview.sample.map((u) => /* @__PURE__ */ React.createElement("span", { key: u.id || u.email, className: "chip" }, u.email))), Array.isArray(preview.errors) && preview.errors.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "f-err", style: { marginTop: 10 } }, preview.errors.join(" | ")))), /* @__PURE__ */ React.createElement(A4.Card, { title: "RECENT SYSTEM MAIL RUNS", right: /* @__PURE__ */ React.createElement("button", { className: "btn-sm", onClick: load }, "Refresh") }, /* @__PURE__ */ React.createElement("table", { className: "admin-table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Subject"), /* @__PURE__ */ React.createElement("th", null, "Audience"), /* @__PURE__ */ React.createElement("th", null, "Sender"), /* @__PURE__ */ React.createElement("th", null, "Queued"), /* @__PURE__ */ React.createElement("th", null, "Pending"), /* @__PURE__ */ React.createElement("th", null, "Sent"), /* @__PURE__ */ React.createElement("th", null, "Failed"), /* @__PURE__ */ React.createElement("th", null, "Created"))), /* @__PURE__ */ React.createElement("tbody", null, runs.length === 0 && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: "8", className: "dim" }, "No system mail runs yet.")), runs.map((run) => /* @__PURE__ */ React.createElement("tr", { key: run.id }, /* @__PURE__ */ React.createElement("td", null, run.subject), /* @__PURE__ */ React.createElement("td", null, run.audience_kind), /* @__PURE__ */ React.createElement("td", null, run.sender_addr), /* @__PURE__ */ React.createElement("td", null, run.queued_count, "/", run.recipient_count), /* @__PURE__ */ React.createElement("td", null, run.pending_count), /* @__PURE__ */ React.createElement("td", { className: "ok" }, run.sent_count), /* @__PURE__ */ React.createElement("td", { className: run.failed_count ? "warn" : "" }, run.failed_count), /* @__PURE__ */ React.createElement("td", { className: "dim" }, fmtDT(run.created_at))))))));
  }
  var A4, useSt, useEf, useCb, useMm, ADMIN_USER_PAGE, ADMIN_DOMAIN_PAGE;
  var init_admin_email_sections = __esm({
    "../static/admin/admin-email-sections.jsx"() {
      A4 = window.adm;
      ({ useState: useSt, useEffect: useEf, useCallback: useCb, useMemo: useMm } = React);
      ADMIN_USER_PAGE = 20;
      ADMIN_DOMAIN_PAGE = 20;
      window.SecUsers = SecUsers;
      window.SecOutbox = SecOutbox;
      window.SecDomains = SecDomains;
      window.SecMailTest = SecMailTest;
      window.SecSystemMail = SecSystemMail;
    }
  });

  // ../static/admin/app-admin.jsx
  function healAdminStateShape(state) {
    const s = window.mergeAdminStateWithDefaults(state, window.ADMIN_STATE_INITIAL);
    if (Array.isArray(s.tools)) {
      s.tools = s.tools.map((t) => {
        const { monitors, health_href, ...rest } = t;
        let monitor = t.monitor && typeof t.monitor === "object" ? { ...t.monitor } : null;
        if (!monitor && Array.isArray(monitors) && monitors.length > 0) {
          monitor = { ...monitors[0] };
        }
        if (!monitor && health_href) {
          monitor = {
            id: "primary",
            enabled: true,
            name: "HTTP",
            type: "http",
            url: health_href,
            method: "GET",
            expect_status: []
          };
        }
        return { ...rest, monitor };
      });
    }
    return s;
  }
  function mergeServerBootstrap(prev, payload) {
    if (!payload || typeof payload !== "object") return prev;
    const keys = [...BOOTSTRAP_HOME_KEYS, "posts"];
    const next = { ...prev };
    for (const k of keys) {
      if (payload[k] !== void 0 && payload[k] !== null) next[k] = payload[k];
    }
    return healAdminStateShape(next);
  }
  function buildHomeAdminPayload(state) {
    const keys = ["site", "tweak_defaults", "terminal", "tools", "log_page", "ticker_home", "support"];
    const o = {};
    for (const k of keys) {
      if (state[k] !== void 0) o[k] = state[k];
    }
    return o;
  }
  function buildAdminDiff(savedJson, currentState) {
    let prev = {};
    try {
      prev = JSON.parse(savedJson);
    } catch (_) {
      return [{ kind: "mod", scope: "state", path: "saved snapshot unreadable \xB7 full save" }];
    }
    const rows = [];
    for (const k of ADMIN_DIFF_KEYS) {
      let a = "";
      let b = "";
      try {
        a = JSON.stringify(prev[k]);
        b = JSON.stringify(currentState[k]);
      } catch (_) {
        b = "err";
      }
      if (a !== b) {
        rows.push({ kind: "mod", scope: k, path: "admin bundle \xB7 differs from last saved" });
      }
    }
    if (rows.length === 0) {
      rows.push({ kind: "mod", scope: "state", path: "working copy \xB7 unsaved (snapshot mismatch)" });
    }
    return rows;
  }
  function AdminApp({ embedded, onLeaveEmbedded } = {}) {
    const sections = useM_app(() => {
      return ADMIN_SECTION_DEFS.map((s) => {
        const Comp2 = window[s.key];
        const Resolved = typeof Comp2 === "function" ? Comp2 : function AdminSectionMissing() {
          return /* @__PURE__ */ React.createElement("div", { className: "adm-page", style: { padding: 24 } }, /* @__PURE__ */ React.createElement("div", { className: "ftk" }, "// LOAD ERROR"), /* @__PURE__ */ React.createElement("p", { style: { marginTop: 8 } }, "Missing component ", /* @__PURE__ */ React.createElement("code", null, s.key), " for section ", /* @__PURE__ */ React.createElement("code", null, s.id), ". Check the console and script order in ", /* @__PURE__ */ React.createElement("code", null, "admin/index.html"), "."));
        };
        return {
          id: s.id,
          label: s.label,
          description: s.description,
          icon: s.icon,
          badge: s.num,
          testId: "admin-nav-" + s.id,
          searchKeywords: s.searchKeywords,
          Comp: Resolved
        };
      });
    }, []);
    const T = window.useTweaks(
      embedded ? { theme: "dark", font: "ibm", scanlines: false, showGrid: false } : { theme: "dark", font: "ibm", scanlines: false, showGrid: true }
    );
    const [tweak, setTweak] = T;
    useE_app(() => {
      if (embedded) return void 0;
      document.documentElement.setAttribute("data-theme", tweak.theme);
      document.documentElement.setAttribute("data-font", tweak.font);
      return void 0;
    }, [tweak.theme, tweak.font, embedded]);
    useE_app(() => {
      devLog("AdminApp mounted");
      if (window.ElvishPerf) {
        window.ElvishPerf.observePaint("admin_ui");
        window.ElvishPerf.recordSinceNavigation("admin_ui", "page_boot", "success");
      }
    }, []);
    const [state, setState] = useS_app(() => __ADMIN_INITIAL__);
    const [savedSnapshot, setSavedSnapshot] = useS_app(() => JSON.stringify(__ADMIN_INITIAL__));
    const [persistHome, setPersistHome] = useS_app(false);
    const dirty = useM_app(() => JSON.stringify(state) !== savedSnapshot, [state, savedSnapshot]);
    useE_app(() => {
      try {
        localStorage.removeItem("elvish-admin-state");
      } catch (_) {
      }
    }, []);
    useE_app(() => {
      let cancelled = false;
      const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
      (async () => {
        try {
          devLog("admin bootstrap: GET /api/bootstrap.json");
          let r = await fetch("/api/bootstrap.json", { cache: "no-store" });
          if (!r.ok) {
            devLog("admin bootstrap: falling back to /admin/bootstrap.json", r.status);
            r = await fetch("/admin/bootstrap.json", { cache: "no-store" });
          }
          if (!r.ok || cancelled) {
            devLog("admin bootstrap: no JSON (offline or 404)", r.status, "cancelled=", cancelled);
            return;
          }
          const payload = await r.json();
          devLog("admin bootstrap: OK keys=", Object.keys(payload || {}));
          setPersistHome(!!payload.persist_home);
          setState((prev) => {
            const next = mergeServerBootstrap(prev, payload);
            Promise.resolve().then(() => {
              if (!cancelled) setSavedSnapshot(JSON.stringify(next));
            });
            return next;
          });
          if (window.ElvishPerf) window.ElvishPerf.end("admin_ui", "bootstrap_fetch", perfStartedAt, "success");
        } catch (err) {
          devLog("admin bootstrap: fetch error", err);
          if (window.ElvishPerf) window.ElvishPerf.end("admin_ui", "bootstrap_fetch", perfStartedAt, "failure");
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);
    const [active, setActive] = useS_app(() => location.hash.replace("#", "") || "site");
    const mainRef = useR_app(null);
    const perfInitialSectionRef = useR_app(true);
    useE_app(() => {
      const onHash = () => setActive(location.hash.replace("#", "") || "site");
      window.addEventListener("hashchange", onHash);
      return () => window.removeEventListener("hashchange", onHash);
    }, []);
    const goto = (id) => {
      location.hash = id;
      setActive(id);
      window.scrollTo(0, 0);
    };
    useE_app(() => {
      if (mainRef.current) mainRef.current.scrollTop = 0;
    }, [active]);
    useE_app(() => {
      if (!window.ElvishPerf) return;
      if (perfInitialSectionRef.current) {
        perfInitialSectionRef.current = false;
        return;
      }
      window.ElvishPerf.record("admin_ui", "section_switch", 1, "success");
    }, [active]);
    const sec = sections.find((s) => s.id === active) || sections[0];
    const Comp = sec.Comp;
    const M2 = window.VModals;
    const [cmdpOpen, setCmdpOpen] = useS_app(false);
    const [dialog, setDialog] = useS_app(null);
    const [notify, setNotify] = useS_app(null);
    const closeDialog = () => setDialog(null);
    const publishDiff = useM_app(() => buildAdminDiff(savedSnapshot, state), [savedSnapshot, state]);
    const markAdminSynced = (msgNote) => {
      setSavedSnapshot(JSON.stringify(state));
      const body = msgNote && String(msgNote).trim() ? String(msgNote).trim().slice(0, 240) : "Site home JSON updated in MongoDB.";
      setNotify({ kind: "ok", title: "Saved", body });
    };
    const requestSave = () => {
      if (dirty) setDialog("publish");
      else setNotify({ kind: "ok", title: "In sync", body: "No unsaved changes." });
    };
    const runCommand = (c) => {
      const id = c.id;
      if (id.startsWith("goto.")) {
        const secId = id.replace("goto.", "");
        if (sections.some((s) => s.id === secId)) goto(secId);
        return;
      }
      if (id === "commit") {
        if (dirty) setDialog("publish");
        else setNotify({ kind: "ok", title: "In sync", body: "No unsaved changes." });
        return;
      }
      if (id === "palette.modals") {
        window.location.href = "/admin/modals.html";
        return;
      }
      if (id === "about") {
        setDialog("about");
        return;
      }
      if (id === "auth.login") {
        setDialog("login");
        return;
      }
      if (id === "auth.register") {
        setDialog("register");
        return;
      }
      if (id === "log.open") {
        window.open("/log/", "_blank", "noopener,noreferrer");
      }
    };
    useE_app(() => {
      const onKey = (e) => {
        const t = e.target && e.target.tagName;
        const editable = t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.target && e.target.isContentEditable;
        if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === "k") {
          e.preventDefault();
          setCmdpOpen((v) => !v);
          return;
        }
        if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === "s") {
          e.preventDefault();
          if (dirty) setDialog("publish");
          else setNotify({ kind: "ok", title: "In sync", body: "No unsaved changes." });
          return;
        }
        if (e.key === "?" && !editable && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          setCmdpOpen(false);
          setDialog("shortcuts");
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [dirty]);
    const site = state.site || {};
    const siteVersion = site.version && String(site.version).trim() || "0.7.4";
    const siteBuildLabel = site.build_label && String(site.build_label).trim() || "nightly";
    return /* @__PURE__ */ React.createElement(React.Fragment, null, !embedded && tweak.showGrid && /* @__PURE__ */ React.createElement("div", { className: "bg-grid" }), !embedded && tweak.scanlines && /* @__PURE__ */ React.createElement("div", { className: "scanline" }), /* @__PURE__ */ React.createElement("div", { className: "frame", "data-testid": "admin-root", "data-admin-embedded": embedded ? "1" : void 0 }, /* @__PURE__ */ React.createElement("header", { className: "admin-topbar" }, /* @__PURE__ */ React.createElement("div", { className: "admin-topbar-left" }, /* @__PURE__ */ React.createElement("a", { href: "/", className: "admin-brand" }, /* @__PURE__ */ React.createElement("span", { className: "admin-brand-dot" }), "ELVISH"), /* @__PURE__ */ React.createElement("span", { className: "admin-brand-sep" }, "/"), /* @__PURE__ */ React.createElement("span", { className: "admin-brand-section" }, "ADMIN")), /* @__PURE__ */ React.createElement("div", { className: "admin-topbar-center" }, /* @__PURE__ */ React.createElement("div", { className: `admin-topbar-status ${dirty ? "unsaved" : "synced"}` }, dirty ? "\u25CF UNSAVED" : "\u25CF SYNCED"), persistHome && /* @__PURE__ */ React.createElement("div", { className: "admin-topbar-status synced" }, "MONGO")), /* @__PURE__ */ React.createElement("div", { className: "admin-topbar-right" }, embedded && typeof onLeaveEmbedded === "function" ? /* @__PURE__ */ React.createElement("button", { type: "button", className: "admin-topbar-link", onClick: onLeaveEmbedded }, "INBOX") : /* @__PURE__ */ React.createElement("a", { href: "/mail", className: "admin-topbar-link" }, "MAIL"), /* @__PURE__ */ React.createElement("a", { href: "/", className: "admin-topbar-link" }, "SITE"), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "admin-topbar-save",
        disabled: !dirty,
        onClick: requestSave
      },
      dirty ? "SAVE CHANGES" : "IN SYNC"
    ))), /* @__PURE__ */ React.createElement("div", { className: "admin-shell", "data-testid": "admin-shell" }, /* @__PURE__ */ React.createElement(
      AdminPanelLayout,
      {
        shellClassName: "admin-settings-shell",
        title: "Admin panel",
        sections,
        activeSection: active,
        onSectionChange: (id) => goto(id),
        showDescriptions: true,
        searchPlaceholder: "Search sections...",
        searchInputAriaLabel: "Search admin sections",
        navAriaLabel: "Admin sections",
        emptySearchTitle: "No matching sections",
        emptySearchDescription: "Try a different keyword or clear the search to see the full admin navigation.",
        meta: [
          "v" + siteVersion,
          siteBuildLabel,
          ...persistHome ? ["Mongo sync"] : []
        ],
        footerState: {
          variant: dirty ? "unsaved" : "synced",
          text: dirty ? "Unsaved changes in working copy." : "Everything is in sync."
        },
        footerActions: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Button, { variant: "primary", size: "sm", disabled: !dirty, onClick: requestSave }, "Save changes"), /* @__PURE__ */ React.createElement(Button, { variant: "secondary", size: "sm", onClick: () => setDialog("reset") }, "Reset copy")),
        footer: /* @__PURE__ */ React.createElement("div", { className: "adm-side-foot-links" }, /* @__PURE__ */ React.createElement("a", { href: "/login" }, "login"), /* @__PURE__ */ React.createElement("span", { className: "adm-side-foot-dot" }, " \xB7 "), /* @__PURE__ */ React.createElement("a", { href: "/register" }, "register")),
        mainClassName: "admin-settings-main",
        mainContentRef: mainRef,
        wideLayout: true
      },
      /* @__PURE__ */ React.createElement("div", { className: "adm-page" }, /* @__PURE__ */ React.createElement(Comp, { state, set: setState, dirty, onPublish: requestSave }))
    )), /* @__PURE__ */ React.createElement(window.TweaksPanel, { title: "TWEAKS" }, /* @__PURE__ */ React.createElement(window.TweakSection, { title: "Appearance" }, /* @__PURE__ */ React.createElement(
      window.TweakRadio,
      {
        label: "Theme",
        value: tweak.theme,
        onChange: (v) => setTweak("theme", v),
        options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]
      }
    ), /* @__PURE__ */ React.createElement(window.TweakSelect, { label: "Font", value: tweak.font, onChange: (v) => setTweak("font", v), options: window.TWEAK_FONT_OPTIONS })), /* @__PURE__ */ React.createElement(window.TweakSection, { title: "Effects" }, /* @__PURE__ */ React.createElement(window.TweakToggle, { label: "Background grid", value: tweak.showGrid, onChange: (v) => setTweak("showGrid", v) }), /* @__PURE__ */ React.createElement(window.TweakToggle, { label: "Scanlines", value: tweak.scanlines, onChange: (v) => setTweak("scanlines", v) })), /* @__PURE__ */ React.createElement(window.TweakSection, { title: "Modals" }, /* @__PURE__ */ React.createElement(window.TweakButton, { label: "Command palette (\u2318K)", onClick: () => setCmdpOpen(true) }), /* @__PURE__ */ React.createElement(window.TweakButton, { label: "Keyboard shortcuts (?)", onClick: () => {
      setCmdpOpen(false);
      setDialog("shortcuts");
    } }), /* @__PURE__ */ React.createElement(window.TweakButton, { label: "About", onClick: () => {
      setCmdpOpen(false);
      setDialog("about");
    } })))), M2 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      M2.CommandPaletteModal,
      {
        open: cmdpOpen,
        onClose: () => setCmdpOpen(false),
        commands: ADMIN_COMMANDS,
        onRun: (c) => {
          setCmdpOpen(false);
          runCommand(c);
        }
      }
    ), /* @__PURE__ */ React.createElement(M2.ShortcutsModal, { open: dialog === "shortcuts", onClose: closeDialog }), /* @__PURE__ */ React.createElement(
      M2.PublishModal,
      {
        open: dialog === "publish",
        onClose: closeDialog,
        diff: publishDiff,
        dirty,
        persistHome,
        initialNotes: "",
        onCommitLocal: (p) => {
          markAdminSynced(p && p.msg);
        },
        onSaveMongo: persistHome ? async () => {
          const r = await fetch("/api/admin/site/home", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildHomeAdminPayload(state))
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
        } : null
      }
    ), /* @__PURE__ */ React.createElement(
      M2.ConfirmDestroyModal,
      {
        open: dialog === "reset",
        onClose: closeDialog,
        label: "RESET",
        phrase: "RESET",
        target: {
          name: "ADMIN WORKING COPY",
          path: "in-memory only (not written to SQL until you save)",
          detail: "All sections revert to the HTML seed for this build; reload to pull bootstrap again."
        },
        onConfirm: () => {
          setState(window.ADMIN_STATE_INITIAL);
          setSavedSnapshot(JSON.stringify(window.ADMIN_STATE_INITIAL));
          setNotify({ kind: "ok", title: "Reset complete", body: "Defaults restored." });
        }
      }
    ), /* @__PURE__ */ React.createElement(M2.AboutModal, { open: dialog === "about", onClose: closeDialog, site: state.site }), /* @__PURE__ */ React.createElement(
      M2.LoginModal,
      {
        open: dialog === "login",
        onClose: closeDialog,
        onDone: () => {
          window.dispatchEvent(new CustomEvent("elvish:sessionChanged"));
          setNotify({ kind: "ok", title: "Logged in", body: "Session cookie set." });
        }
      }
    ), /* @__PURE__ */ React.createElement(
      M2.RegisterModal,
      {
        open: dialog === "register",
        onClose: closeDialog,
        onDone: () => {
          window.dispatchEvent(new CustomEvent("elvish:sessionChanged"));
          setNotify({ kind: "ok", title: "Registered", body: "Session cookie set." });
        }
      }
    ), /* @__PURE__ */ React.createElement(
      M2.NotifyModal,
      {
        open: !!notify,
        onClose: () => setNotify(null),
        kind: notify?.kind,
        title: notify?.title,
        body: notify?.body
      }
    )));
  }
  function ElvishMailAdminPanel(props) {
    return /* @__PURE__ */ React.createElement(AdminErrorBoundary, null, /* @__PURE__ */ React.createElement(AdminApp, { embedded: !!(props && props.embedded), onLeaveEmbedded: props && props.onLeaveEmbedded }));
  }
  var useS_app, useE_app, useM_app, useR_app, devLog, __ADMIN_INITIAL__, BOOTSTRAP_HOME_KEYS, ADMIN_SECTION_DEFS, ADMIN_DIFF_KEYS, ADMIN_COMMANDS, AdminErrorBoundary;
  var init_app_admin = __esm({
    "../static/admin/app-admin.jsx"() {
      init_layout();
      init_primitives();
      ({ useState: useS_app, useEffect: useE_app, useMemo: useM_app, useRef: useR_app } = React);
      devLog = (...args) => {
        if (typeof window.__elvishDevLog === "function") window.__elvishDevLog(...args);
      };
      __ADMIN_INITIAL__ = healAdminStateShape(window.ADMIN_STATE_INITIAL);
      BOOTSTRAP_HOME_KEYS = [
        "site",
        "tweak_defaults",
        "nav",
        "footer",
        "hero",
        "terminal",
        "tools",
        "log_page",
        "ticker_home",
        "metrics",
        "support"
      ];
      ADMIN_SECTION_DEFS = [
        {
          id: "site",
          num: "01",
          label: "Site / SEO",
          description: "Home bundle defaults, content blocks, and public presentation.",
          key: "SecSite",
          icon: "site"
        },
        {
          id: "users",
          num: "02",
          label: "Users",
          description: "Inspect accounts and take targeted moderation actions.",
          key: "SecUsers",
          icon: "users"
        },
        {
          id: "outbox",
          num: "03",
          label: "Outbox",
          description: "Track queued delivery, retries, and system/admin sends.",
          key: "SecOutbox",
          icon: "outbox"
        },
        {
          id: "domains",
          num: "04",
          label: "Domains",
          description: "Review mail domain readiness, routing, and verification state.",
          key: "SecDomains",
          icon: "globe"
        },
        {
          id: "testing",
          num: "05",
          label: "Testing",
          description: "Run probes and validate the mail transport pipeline.",
          key: "SecMailTest",
          icon: "testing"
        },
        {
          id: "system-mail",
          num: "06",
          label: "System Mail",
          description: "Compose and send operator notices through the platform outbox.",
          key: "SecSystemMail",
          icon: "mail"
        },
        {
          id: "telemetry",
          num: "07",
          label: "Telemetry",
          description: "Inspect anonymous operational signals and aggregated health data.",
          key: "SecTelemetry",
          icon: "telemetry"
        },
        {
          id: "performance",
          num: "08",
          label: "Performance",
          description: "Track latency, failures, queue health, and manual investigation exports.",
          key: "SecPerformance",
          icon: "performance"
        },
        {
          id: "auth-captcha",
          num: "09",
          label: "Cap \xB7 Login CAPTCHA",
          description: "Self-hosted Cap (trycap.dev): widget URL, secret, and /siteverify for /login and /register.",
          key: "SecAuthCaptcha",
          icon: "captcha",
          searchKeywords: ["cap", "captcha", "trycap", "login", "register", "siteverify", "widget", "srp"]
        }
      ];
      ADMIN_DIFF_KEYS = [
        "site"
      ];
      ADMIN_COMMANDS = [
        { id: "goto.site", name: "Goto \xB7 Site / SEO", scope: "ADMIN", glyph: "\u25B8", shortcut: "g s" },
        { id: "goto.users", name: "Goto \xB7 Users", scope: "ADMIN", glyph: "\u25B8", shortcut: "g u" },
        { id: "goto.outbox", name: "Goto \xB7 Outbox", scope: "ADMIN", glyph: "\u25B8", shortcut: "g o" },
        { id: "goto.domains", name: "Goto \xB7 Domains", scope: "ADMIN", glyph: "\u25B8", shortcut: "g d" },
        { id: "goto.testing", name: "Goto \xB7 Testing", scope: "ADMIN", glyph: "\u25B8", shortcut: "g t" },
        { id: "goto.system-mail", name: "Goto \xB7 System mail", scope: "ADMIN", glyph: "\u25B8" },
        { id: "goto.telemetry", name: "Goto \xB7 Telemetry", scope: "ADMIN", glyph: "\u25B8" },
        { id: "goto.performance", name: "Goto \xB7 Performance", scope: "ADMIN", glyph: "\u25B8" },
        { id: "goto.auth-captcha", name: "Goto \xB7 Cap / Login CAPTCHA", scope: "ADMIN", glyph: "\u25B8", shortcut: "g c" },
        { id: "commit", name: "Save site bundle (MongoDB)", scope: "STATE", glyph: "\u25B8", shortcut: "\u2318S" },
        { id: "about", name: "About ELVISH", scope: "META", glyph: "\u25B8" },
        { id: "auth.login", name: "Login (modal)", scope: "AUTH", glyph: "\u25B8" },
        { id: "auth.register", name: "Register (modal)", scope: "AUTH", glyph: "\u25B8" }
      ];
      AdminErrorBoundary = class extends React.Component {
        constructor(props) {
          super(props);
          this.state = { err: null };
        }
        static getDerivedStateFromError(err) {
          return { err };
        }
        componentDidCatch(err, info) {
          console.error("[elvish admin] componentDidCatch", err, info && info.componentStack);
        }
        render() {
          if (this.state.err) {
            const msg = String(this.state.err && this.state.err.stack || this.state.err || "unknown error");
            return /* @__PURE__ */ React.createElement("div", { style: { padding: 24, maxWidth: 720, margin: "40px auto", fontFamily: "ui-monospace, monospace", color: "var(--fg,#111)" } }, /* @__PURE__ */ React.createElement("h1", { style: { fontSize: 16, marginBottom: 12 } }, "Admin panel crashed"), /* @__PURE__ */ React.createElement("pre", { style: { fontSize: 11, overflow: "auto", whiteSpace: "pre-wrap", border: "1px solid", padding: 12 } }, msg), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12, marginTop: 16, opacity: 0.75 } }, "Reload the page. If this persists, check the browser console for details."));
          }
          return this.props.children;
        }
      };
      window.ElvishMailAdminPanel = ElvishMailAdminPanel;
      (function mountAdminStandalone() {
        if (document.documentElement.getAttribute("data-admin-standalone") !== "1") {
          return;
        }
        const el = document.getElementById("root");
        if (!el) {
          console.error("[elvish admin] #root missing \u2014 cannot mount");
          return;
        }
        try {
          const root = ReactDOM.createRoot(el);
          root.render(
            /* @__PURE__ */ React.createElement(AdminErrorBoundary, null, /* @__PURE__ */ React.createElement(AdminApp, null))
          );
          devLog("admin React root attached");
        } catch (err) {
          console.error("[elvish admin] createRoot failed", err);
          el.textContent = "";
          const pre = document.createElement("pre");
          pre.style.cssText = "padding:16px;font:12px monospace;color:#b00;white-space:pre-wrap";
          pre.textContent = "Admin failed to start.\n\n" + String(err && err.stack || err);
          el.appendChild(pre);
        }
      })();
    }
  });

  // entries/mail-admin-embed-entry.jsx
  var require_mail_admin_embed_entry = __commonJS({
    "entries/mail-admin-embed-entry.jsx"() {
      init_react_global();
      init_react_dom_client_global();
      init_icons();
      init_primitives();
      init_layout();
      init_tweaks_panel();
      init_shell();
      init_tools_data();
      init_modals();
      init_admin_primitives();
      init_admin_state();
      init_admin_sections_1();
      init_admin_sections_2();
      init_admin_uptime();
      init_admin_telemetry();
      init_admin_auth_captcha();
      init_admin_performance();
      init_admin_email_sections();
      init_app_admin();
      Object.assign(globalThis, { React: react_global_default, ReactDOM: react_dom_client_global_default });
    }
  });
  require_mail_admin_embed_entry();
})();
