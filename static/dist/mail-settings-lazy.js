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
  function Toggle({ checked, onChange, label, disabled }) {
    return /* @__PURE__ */ react_global_default.createElement("label", { className: `elvish-toggle ${disabled ? "disabled" : ""}` }, /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        type: "checkbox",
        checked: !!checked,
        disabled,
        onChange: (e) => onChange(e.target.checked)
      }
    ), /* @__PURE__ */ react_global_default.createElement("span", { className: "elvish-toggle-track" }), label && /* @__PURE__ */ react_global_default.createElement("span", null, label));
  }
  function Card({ title, description, actions, children, className, variant }) {
    return /* @__PURE__ */ react_global_default.createElement("div", { className: `elvish-card settings-card ${variant || ""} ${className || ""}`.trim() }, (title || description || actions) && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-card-header settings-card-header" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-card-header-text settings-card-header-text" }, title && /* @__PURE__ */ react_global_default.createElement("h3", { className: "elvish-card-title settings-card-title" }, title), description && /* @__PURE__ */ react_global_default.createElement("p", { className: "elvish-card-desc settings-card-desc" }, description)), actions && /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-card-actions settings-card-actions" }, actions)), /* @__PURE__ */ react_global_default.createElement("div", { className: "elvish-card-body settings-card-body" }, children));
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
  function UserSettingsLayout({
    title = "Settings",
    sections,
    activeSection,
    onSectionChange,
    children,
    wideLayout = true,
    shellClassName,
    mainClassName,
    mainContentRef,
    meta,
    footer,
    footerState,
    footerActions,
    showDescriptions = false,
    searchable = true,
    searchPlaceholder = "Search...",
    searchInputAriaLabel,
    navAriaLabel,
    emptySearchTitle = "No results",
    emptySearchDescription = "Try a different search term"
  }) {
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
        footerActions,
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

  // ../static/shared/index.jsx
  var init_shared = __esm({
    "../static/shared/index.jsx"() {
      init_icons();
      init_primitives();
      init_layout();
      init_icons();
      init_primitives();
      init_layout();
    }
  });

  // ../static/mail/mail-settings.jsx
  function Input2({ label, type, value, onChange, placeholder, disabled, helperText, error, className }) {
    return /* @__PURE__ */ react_global_default.createElement("div", { className: `settings-input-group elvish-form-group ${className || ""}` }, label && /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-label elvish-label" }, label), /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        type: type || "text",
        className: `settings-input elvish-input ${error ? "settings-input-error elvish-input-error" : ""}`,
        value,
        onChange,
        placeholder,
        disabled
      }
    ), (helperText || error) && /* @__PURE__ */ react_global_default.createElement("div", { className: `settings-helper elvish-helper ${error ? "settings-helper-error elvish-helper-error" : ""}` }, error || helperText));
  }
  function identityAvatarInitial(label) {
    const raw = String(label || "").trim();
    if (!raw) return "?";
    const local = raw.includes("@") ? raw.split("@")[0] : raw;
    const cleaned = local.replace(/[^a-z0-9]/gi, "");
    return (cleaned[0] || local[0] || "?").toUpperCase();
  }
  function IdentityAvatar({ label, avatarDataUrl, avatarColor, showStatusBadge, size = "md" }) {
    const palette = IDENTITY_AVATAR_COLOR_MAP[avatarColor] || IDENTITY_AVATAR_COLOR_MAP.blue;
    return /* @__PURE__ */ react_global_default.createElement(
      "div",
      {
        className: `identity-avatar identity-avatar-${size}`,
        style: {
          "--identity-avatar-bg": palette.bg,
          "--identity-avatar-fg": palette.fg
        },
        "aria-hidden": "true"
      },
      avatarDataUrl ? /* @__PURE__ */ react_global_default.createElement("img", { src: avatarDataUrl, alt: "", className: "identity-avatar-img" }) : /* @__PURE__ */ react_global_default.createElement("span", { className: "identity-avatar-initial" }, identityAvatarInitial(label)),
      showStatusBadge && /* @__PURE__ */ react_global_default.createElement("span", { className: "identity-avatar-status" })
    );
  }
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read image"));
      reader.readAsDataURL(file);
    });
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = src;
    });
  }
  async function fileToAvatarDataURL(file) {
    if (!file) throw new Error("Choose an image first");
    if (!String(file.type || "").startsWith("image/")) throw new Error("Avatar must be an image file");
    if (file.size > 3 * 1024 * 1024) throw new Error("Avatar must be smaller than 3 MB");
    const src = await readFileAsDataURL(file);
    const img = await loadImage(src);
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");
    const scale = Math.max(size / img.width, size / img.height);
    const width = img.width * scale;
    const height = img.height * scale;
    const x = (size - width) / 2;
    const y = (size - height) / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, x, y, width, height);
    return canvas.toDataURL("image/png");
  }
  function AccountSection({ user }) {
    const [paid, setPaid] = useState3(false);
    useEffect2(() => {
      let cancelled = false;
      window.ElvishMailManifest.getBillingStatus().then((b) => {
        if (!cancelled) setPaid(!!b.paid);
      }).catch(() => {
      });
      return () => {
        cancelled = true;
      };
    }, []);
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-header" }, /* @__PURE__ */ react_global_default.createElement("h2", null, "Account Information"), /* @__PURE__ */ react_global_default.createElement("p", null, "View your account details and status")), /* @__PURE__ */ react_global_default.createElement(Card, null, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-grid" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-item" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-icon" }, SettingsIcons.account), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-content" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-label" }, "Username"), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-value" }, user?.name || user?.email || "\u2014"))), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-item" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-icon" }, SettingsIcons.identities), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-content" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-label" }, "Primary Email"), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-value mono" }, user?.email || "\u2014"))), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-item" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-icon" }, SettingsIcons.security), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-content" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-label" }, "Account Role"), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-account-value" }, /* @__PURE__ */ react_global_default.createElement(Badge, { variant: user?.is_admin ? "accent" : "default" }, user?.is_admin ? "Admin" : "User")))))), /* @__PURE__ */ react_global_default.createElement(Card, { title: "Subscription", description: "Your current plan and billing status" }, /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info", title: paid ? "Paid API tier" : "Free tier" }, paid ? "Paid API features are enabled for this deployment (or your account is admin)." : "You're on the free tier. Operator can set ELVISH_PAID_FEATURES for SMTP submission and custom domains."), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-subscription-features" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-feature" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-feature-icon" }, SettingsIcons.check), /* @__PURE__ */ react_global_default.createElement("span", null, "End-to-end encryption")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-feature" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-feature-icon" }, SettingsIcons.check), /* @__PURE__ */ react_global_default.createElement("span", null, "Multiple identities")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-feature" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-feature-icon" }, SettingsIcons.check), /* @__PURE__ */ react_global_default.createElement("span", null, "GPG key management")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-feature" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-feature-icon" }, SettingsIcons.check), /* @__PURE__ */ react_global_default.createElement("span", null, "Folder organization")))));
  }
  async function getTwoFactorInfo() {
    const result = await window.ElvishMailManifest.getTwoFactorStatus();
    return result && result.mfa ? result.mfa : { enabled: false, methods: [], totp_factors: [], webauthn_factors: [], recovery_remaining: 0 };
  }
  async function ensureFreshTwoFactor(status) {
    const current = status || await getTwoFactorInfo();
    if (!current || !current.enabled) return current;
    const methods = Array.isArray(current.methods) ? current.methods : [];
    if (methods.includes("webauthn") && window.ElvishWebAuthn && window.confirm("Use a security key for this action?\nPress Cancel to enter an authenticator or recovery code instead.")) {
      const begin = await window.ElvishMailManifest.beginWebAuthnVerification();
      const credential = await window.ElvishWebAuthn.getAssertion(begin.options);
      await window.ElvishMailManifest.finishWebAuthnVerification(begin.challenge_id, credential);
      return await getTwoFactorInfo();
    }
    const code = window.prompt(methods.includes("recovery") ? "Enter your 6-digit authenticator code, or paste a recovery code." : "Enter your 6-digit authenticator code.");
    if (!code || !code.trim()) throw new Error("Two-factor verification was cancelled");
    const normalized = code.trim();
    if (/^\d{6}$/.test(normalized.replace(/\s+/g, ""))) {
      await window.ElvishMailManifest.verifyTwoFactorTOTP(normalized);
    } else {
      await window.ElvishMailManifest.verifyTwoFactorRecovery(normalized);
    }
    return await getTwoFactorInfo();
  }
  async function runWithFreshTwoFactor(action, status) {
    try {
      return await action();
    } catch (e) {
      const message = String(e && e.message || e || "");
      if (!message.includes("recent 2fa verification required")) throw e;
      await ensureFreshTwoFactor(status);
      return await action();
    }
  }
  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    }
  }
  function SecuritySection() {
    const [showChangePassword, setShowChangePassword] = useState3(false);
    const [mfa, setMfa] = useState3(null);
    const [loadingMfa, setLoadingMfa] = useState3(true);
    const [mfaError, setMfaError] = useState3("");
    const [showTotpModal, setShowTotpModal] = useState3(false);
    const [totpSetup, setTotpSetup] = useState3(null);
    const [totpCode, setTotpCode] = useState3("");
    const [busyAction, setBusyAction] = useState3(false);
    const [recoveryCodes, setRecoveryCodes] = useState3(null);
    const loadMFA = useCallback2(async () => {
      setLoadingMfa(true);
      try {
        const info = await getTwoFactorInfo();
        setMfa(info);
        setMfaError("");
      } catch (e) {
        setMfaError(e.message || "Failed to load 2FA status");
      } finally {
        setLoadingMfa(false);
      }
    }, []);
    useEffect2(() => {
      loadMFA();
    }, [loadMFA]);
    const handleBeginTOTP = async () => {
      setBusyAction(true);
      setMfaError("");
      try {
        const setup = await window.ElvishMailManifest.beginTOTPSetup("Authenticator app");
        setTotpSetup(setup);
        setTotpCode("");
        setShowTotpModal(true);
      } catch (e) {
        setMfaError(e.message || "Could not start authenticator setup");
      } finally {
        setBusyAction(false);
      }
    };
    const handleConfirmTOTP = async (e) => {
      e.preventDefault();
      if (!totpSetup) return;
      setBusyAction(true);
      try {
        const result = await window.ElvishMailManifest.confirmTOTPSetup(totpSetup.setup_id, totpCode);
        setRecoveryCodes(Array.isArray(result.recovery_codes) ? result.recovery_codes : null);
        setShowTotpModal(false);
        setTotpSetup(null);
        setTotpCode("");
        await loadMFA();
      } catch (e2) {
        setMfaError(e2.message || "Could not confirm authenticator app");
      } finally {
        setBusyAction(false);
      }
    };
    const handleRegisterSecurityKey = async () => {
      if (!window.ElvishWebAuthn) {
        setMfaError("This browser does not support security keys.");
        return;
      }
      setBusyAction(true);
      setMfaError("");
      try {
        const begin = await window.ElvishMailManifest.beginWebAuthnRegistration();
        const credential = await window.ElvishWebAuthn.createCredential(begin.options);
        const result = await window.ElvishMailManifest.finishWebAuthnRegistration(begin.challenge_id, credential, "Security key");
        setRecoveryCodes(Array.isArray(result.recovery_codes) ? result.recovery_codes : null);
        await loadMFA();
      } catch (e) {
        setMfaError(e.message || "Could not register security key");
      } finally {
        setBusyAction(false);
      }
    };
    const handleRegenerateRecovery = async () => {
      setBusyAction(true);
      setMfaError("");
      try {
        const result = await runWithFreshTwoFactor(() => window.ElvishMailManifest.regenerateRecoveryCodes(), mfa);
        setRecoveryCodes(Array.isArray(result.recovery_codes) ? result.recovery_codes : null);
        await loadMFA();
      } catch (e) {
        setMfaError(e.message || "Could not regenerate recovery codes");
      } finally {
        setBusyAction(false);
      }
    };
    const handleDeleteTOTP = async (id) => {
      if (!window.confirm("Remove this authenticator app from your account?")) return;
      setBusyAction(true);
      try {
        await runWithFreshTwoFactor(() => window.ElvishMailManifest.deleteTOTPFactor(id), mfa);
        await loadMFA();
      } catch (e) {
        setMfaError(e.message || "Could not remove authenticator app");
      } finally {
        setBusyAction(false);
      }
    };
    const handleDeleteSecurityKey = async (id) => {
      if (!window.confirm("Remove this security key from your account?")) return;
      setBusyAction(true);
      try {
        await runWithFreshTwoFactor(() => window.ElvishMailManifest.deleteWebAuthnCredential(id), mfa);
        await loadMFA();
      } catch (e) {
        setMfaError(e.message || "Could not remove security key");
      } finally {
        setBusyAction(false);
      }
    };
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-header" }, /* @__PURE__ */ react_global_default.createElement("h2", null, "Security"), /* @__PURE__ */ react_global_default.createElement("p", null, "Manage your account security settings")), mfaError && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, mfaError), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Change Password",
        description: "Update your password. Your GPG keys will be re-encrypted with the new password."
      },
      /* @__PURE__ */ react_global_default.createElement(Alert, { type: "warning" }, "Changing your password will re-encrypt your GPG keys. Locked keys (from previous password resets) will be skipped and can be unlocked separately."),
      /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", onClick: () => setShowChangePassword(true) }, SettingsIcons.lock, " Change Password")
    ), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Two-Factor Authentication",
        description: "Protect your account with an authenticator app and security keys."
      },
      loadingMfa && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "Loading your current 2FA status\u2026"),
      !loadingMfa && mfa && !mfa.enabled && /* @__PURE__ */ react_global_default.createElement(react_global_default.Fragment, null, /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info", title: "2FA is off" }, "Add an authenticator app, a security key, or both. Recovery codes are generated the first time you enable 2FA."), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", onClick: handleBeginTOTP, loading: busyAction }, SettingsIcons.security, " Set up authenticator app"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", onClick: handleRegisterSecurityKey, loading: busyAction }, SettingsIcons.keys, " Add security key"))),
      !loadingMfa && mfa && mfa.enabled && /* @__PURE__ */ react_global_default.createElement(react_global_default.Fragment, null, /* @__PURE__ */ react_global_default.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 12 } }, /* @__PURE__ */ react_global_default.createElement(Badge, { variant: "accent" }, "2FA enabled"), /* @__PURE__ */ react_global_default.createElement(Badge, { variant: "default" }, (mfa.methods || []).join(" + ") || "configured")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-encryption-status", style: { marginBottom: 16 } }, (mfa.totp_factors || []).map((factor) => /* @__PURE__ */ react_global_default.createElement("div", { key: factor.id, className: "settings-encryption-item ok", style: { justifyContent: "space-between", width: "100%" } }, /* @__PURE__ */ react_global_default.createElement("span", null, SettingsIcons.check, " Authenticator app: ", factor.label || "Authenticator app"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", onClick: () => handleDeleteTOTP(factor.id), disabled: busyAction }, "Remove"))), (mfa.webauthn_factors || []).map((factor) => /* @__PURE__ */ react_global_default.createElement("div", { key: factor.id, className: "settings-encryption-item ok", style: { justifyContent: "space-between", width: "100%" } }, /* @__PURE__ */ react_global_default.createElement("span", null, SettingsIcons.check, " Security key: ", factor.label || "Security key"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", onClick: () => handleDeleteSecurityKey(factor.id), disabled: busyAction }, "Remove")))), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", onClick: handleBeginTOTP, loading: busyAction }, "Add authenticator app"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", onClick: handleRegisterSecurityKey, loading: busyAction }, "Add security key")))
    ), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Recovery Codes",
        description: "Use one-time recovery codes if you lose access to your authenticator or security key."
      },
      !loadingMfa && mfa && /* @__PURE__ */ react_global_default.createElement(react_global_default.Fragment, null, /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info", title: `${mfa.recovery_remaining || 0} codes remaining` }, "Regenerate recovery codes after downloading them. Old recovery codes stop working immediately."), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", onClick: handleRegenerateRecovery, loading: busyAction, disabled: !mfa.enabled }, SettingsIcons.refresh, " Regenerate Codes")))
    ), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Encryption Verification",
        description: "Verify the encryption status of your account and keys."
      },
      /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-encryption-status" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-encryption-item ok" }, SettingsIcons.check, /* @__PURE__ */ react_global_default.createElement("span", null, "Account key encrypted client-side")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-encryption-item ok" }, SettingsIcons.check, /* @__PURE__ */ react_global_default.createElement("span", null, "Identity keys encrypted to account key")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-encryption-item ok" }, SettingsIcons.check, /* @__PURE__ */ react_global_default.createElement("span", null, "Message bodies stored as PGP ciphertext")))
    ), /* @__PURE__ */ react_global_default.createElement(Modal, { open: showChangePassword, onClose: () => setShowChangePassword(false), title: "Change Password" }, /* @__PURE__ */ react_global_default.createElement(ChangePasswordForm, { onClose: () => setShowChangePassword(false) })), /* @__PURE__ */ react_global_default.createElement(Modal, { open: showTotpModal, onClose: () => !busyAction && setShowTotpModal(false), title: "Set Up Authenticator App" }, totpSetup && /* @__PURE__ */ react_global_default.createElement("form", { onSubmit: handleConfirmTOTP }, /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "Scan the QR code with your authenticator app, or copy the manual secret below."), totpSetup.qr_png_url && /* @__PURE__ */ react_global_default.createElement("img", { src: totpSetup.qr_png_url, alt: "Authenticator QR code", style: { width: 192, height: 192, display: "block", margin: "0 auto 16px" } }), /* @__PURE__ */ react_global_default.createElement(Input2, { label: "Manual secret", value: totpSetup.secret || "", onChange: () => {
    }, helperText: "Works in Google Authenticator, Authy, 1Password, and similar apps." }), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: () => copyText(totpSetup.secret || "") }, "Copy Secret")), /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Authenticator code",
        value: totpCode,
        onChange: (e) => setTotpCode(e.target.value),
        placeholder: "123456",
        helperText: "Enter the 6-digit code shown in your authenticator app."
      }
    ), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: () => setShowTotpModal(false), disabled: busyAction }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", type: "submit", loading: busyAction, disabled: !totpCode.trim() }, "Enable 2FA")))), /* @__PURE__ */ react_global_default.createElement(Modal, { open: Array.isArray(recoveryCodes) && recoveryCodes.length > 0, onClose: () => setRecoveryCodes(null), title: "Recovery Codes" }, /* @__PURE__ */ react_global_default.createElement(Alert, { type: "warning", title: "Store these now" }, "Each code can only be used once. Regenerating recovery codes invalidates every old code immediately."), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-encryption-status", style: { marginTop: 16 } }, (recoveryCodes || []).map((code) => /* @__PURE__ */ react_global_default.createElement("div", { key: code, className: "settings-encryption-item ok" }, SettingsIcons.check, /* @__PURE__ */ react_global_default.createElement("span", { className: "mono" }, code)))), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: () => copyText((recoveryCodes || []).join("\n")) }, SettingsIcons.copy, " Copy Codes"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", type: "button", onClick: () => setRecoveryCodes(null) }, "Done"))));
  }
  function ChangePasswordForm({ onClose }) {
    const [currentPassword, setCurrentPassword] = useState3("");
    const [newPassword, setNewPassword] = useState3("");
    const [confirmPassword, setConfirmPassword] = useState3("");
    const [loading, setLoading] = useState3(false);
    const [error, setError] = useState3("");
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (newPassword.length < 10) {
        setError("Password must be at least 10 characters");
        return;
      }
      setLoading(true);
      setError("");
      try {
        await runWithFreshTwoFactor(() => window.ElvishMailManifest.changePassword(currentPassword, newPassword));
        onClose();
      } catch (e2) {
        setError(e2.message || "Failed to change password");
      } finally {
        setLoading(false);
      }
    };
    return /* @__PURE__ */ react_global_default.createElement("form", { onSubmit: handleSubmit }, error && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, error), /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Current Password",
        type: "password",
        value: currentPassword,
        onChange: (e) => setCurrentPassword(e.target.value),
        placeholder: "Enter current password"
      }
    ), /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "New Password",
        type: "password",
        value: newPassword,
        onChange: (e) => setNewPassword(e.target.value),
        placeholder: "Enter new password",
        helperText: "Minimum 10 characters (matches registration)"
      }
    ), /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Confirm New Password",
        type: "password",
        value: confirmPassword,
        onChange: (e) => setConfirmPassword(e.target.value),
        placeholder: "Confirm new password"
      }
    ), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: onClose }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", type: "submit", loading }, "Change Password")));
  }
  function looksLikeDisposableIdentity(email, type) {
    if (type === "disposable") return true;
    const local = (email || "").split("@")[0].toLowerCase();
    if (local.length < 10 || !local.startsWith("d_")) return false;
    return /^d_[a-z0-9]+$/.test(local);
  }
  function IdentitiesSection({ user }) {
    const [identities, setIdentities] = useState3([]);
    const [loading, setLoading] = useState3(true);
    const [error, setError] = useState3("");
    const [showCreateModal, setShowCreateModal] = useState3(false);
    const [createType, setCreateType] = useState3("alias");
    const [confirmDelete, setConfirmDelete] = useState3(null);
    const [deleteLoading, setDeleteLoading] = useState3(false);
    const [savingFingerprint, setSavingFingerprint] = useState3("");
    const loadIdentities = useCallback2(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await window.ElvishMailManifest.listIdentities();
        setIdentities(result.identities || []);
      } catch (e) {
        setError(e.message || "Failed to load identities");
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect2(() => {
      loadIdentities();
    }, [loadIdentities]);
    const handleSetDefault = async (fp) => {
      try {
        await window.ElvishMailManifest.setDefaultIdentity(fp);
        await loadIdentities();
      } catch (e) {
        setError(e.message || "Failed to set default");
      }
    };
    const executeDelete = async (fp) => {
      setDeleteLoading(true);
      try {
        await window.ElvishMailManifest.deleteIdentity(fp);
        await loadIdentities();
        setConfirmDelete(null);
      } catch (e) {
        setError(e.message || "Failed to delete identity");
      } finally {
        setDeleteLoading(false);
      }
    };
    const handleDelete = (fp) => {
      setConfirmDelete(fp);
    };
    const handleUpdateProfile = async (fp, payload) => {
      setSavingFingerprint(fp);
      setError("");
      try {
        await window.ElvishMailManifest.updateIdentityProfile(fp, payload);
        await loadIdentities();
      } catch (e) {
        setError(e.message || "Failed to update identity profile");
      } finally {
        setSavingFingerprint("");
      }
    };
    const defaultIdentities = identities.filter((i) => {
      if (looksLikeDisposableIdentity(i.email, i.type)) return false;
      return i.is_default || i.type === "primary";
    });
    const aliasIdentities = identities.filter((i) => {
      if (looksLikeDisposableIdentity(i.email, i.type)) return false;
      return !i.is_default && i.type !== "primary" && i.type !== "plus" && i.type !== "disposable";
    });
    const plusIdentities = identities.filter((i) => i.type === "plus");
    const disposableIdentities = identities.filter((i) => looksLikeDisposableIdentity(i.email, i.type));
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-header" }, /* @__PURE__ */ react_global_default.createElement("h2", null, "Identities"), /* @__PURE__ */ react_global_default.createElement("p", null, "Manage your email addresses. Each identity has its own PGP keypair for encryption.")), error && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, error), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Email Identities",
        description: "Your main email addresses. Each has its own GPG key encrypted to your account key.",
        actions: /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", size: "sm", onClick: () => {
          setCreateType("alias");
          setShowCreateModal(true);
        } }, SettingsIcons.plus, " Create Identity")
      },
      loading ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-loading" }, "Loading identities...") : defaultIdentities.length === 0 && aliasIdentities.length === 0 ? /* @__PURE__ */ react_global_default.createElement(
        EmptyState,
        {
          icon: "identities",
          title: "No identities yet",
          description: "Create your first email identity to start receiving encrypted mail.",
          action: /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", onClick: () => setShowCreateModal(true) }, "Create Identity")
        }
      ) : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-identities-list" }, [...defaultIdentities, ...aliasIdentities].map((id) => /* @__PURE__ */ react_global_default.createElement(
        IdentityItem,
        {
          key: id.fingerprint,
          identity: id,
          onSetDefault: handleSetDefault,
          onDelete: handleDelete,
          onUpdateProfile: handleUpdateProfile,
          saving: savingFingerprint === id.fingerprint
        }
      )))
    ), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Plus Addresses",
        description: "Automatically created addresses like user+tag@domain.com for organization.",
        actions: /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", onClick: () => {
          setCreateType("plus");
          setShowCreateModal(true);
        } }, SettingsIcons.plus, " Configure Plus Address")
      },
      /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "Plus addresses are automatically created when emails arrive. Configure one to set up custom folder routing (e.g., user+shopping@domain.com \u2192 shopping folder)."),
      plusIdentities.length === 0 ? /* @__PURE__ */ react_global_default.createElement(
        EmptyState,
        {
          icon: "identities",
          title: "No plus addresses configured",
          description: "Plus addresses are created automatically when emails arrive at them."
        }
      ) : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-identities-list" }, plusIdentities.map((id) => /* @__PURE__ */ react_global_default.createElement(
        IdentityItem,
        {
          key: id.fingerprint,
          identity: id,
          onDelete: handleDelete,
          onUpdateProfile: handleUpdateProfile,
          saving: savingFingerprint === id.fingerprint
        }
      )))
    ), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Disposable Addresses",
        description: "Temporary email addresses that expire automatically.",
        actions: /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", onClick: () => {
          setCreateType("disposable");
          setShowCreateModal(true);
        } }, SettingsIcons.plus, " Create Disposable")
      },
      /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "Disposable addresses expire after 30 days by default. Perfect for one-time sign-ups or temporary communications."),
      disposableIdentities.length === 0 ? /* @__PURE__ */ react_global_default.createElement(
        EmptyState,
        {
          icon: "identities",
          title: "No disposable addresses",
          description: "Create a temporary address for one-time use."
        }
      ) : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-identities-list" }, disposableIdentities.map((id) => /* @__PURE__ */ react_global_default.createElement(
        IdentityItem,
        {
          key: id.fingerprint,
          identity: id,
          onDelete: handleDelete,
          onUpdateProfile: handleUpdateProfile,
          saving: savingFingerprint === id.fingerprint,
          showExpiry: true
        }
      )))
    ), /* @__PURE__ */ react_global_default.createElement(
      Modal,
      {
        open: showCreateModal,
        onClose: () => setShowCreateModal(false),
        title: createType === "alias" ? "Create Identity" : createType === "plus" ? "Configure Plus Address" : "Create Disposable Address"
      },
      /* @__PURE__ */ react_global_default.createElement(CreateIdentityForm, { type: createType, user, onClose: () => setShowCreateModal(false), onSuccess: loadIdentities })
    ), /* @__PURE__ */ react_global_default.createElement(
      ConfirmModal,
      {
        open: !!confirmDelete,
        onClose: () => !deleteLoading && setConfirmDelete(null),
        onConfirm: () => executeDelete(confirmDelete),
        title: "Delete Identity",
        message: "Are you sure you want to delete this identity? Past messages encrypted to this key will become unreadable. This action cannot be undone.",
        confirmLabel: "Delete Identity",
        confirmVariant: "danger",
        loading: deleteLoading
      }
    ));
  }
  function IdentityItem({ identity, onSetDefault, onDelete, onUpdateProfile, showExpiry, saving }) {
    const isExpired = identity.expires_at && new Date(identity.expires_at) < /* @__PURE__ */ new Date();
    const fileInputRef = useRef2(null);
    const triggerAvatarPicker = () => {
      if (fileInputRef.current && !saving) fileInputRef.current.click();
    };
    const handleAvatarPicked = async (event) => {
      const file = event.target && event.target.files && event.target.files[0];
      if (!file || !onUpdateProfile) return;
      try {
        const avatarDataUrl = await fileToAvatarDataURL(file);
        await onUpdateProfile(identity.fingerprint, { avatar_data_url: avatarDataUrl });
      } catch (e) {
        alert(e.message || "Failed to prepare avatar");
      } finally {
        event.target.value = "";
      }
    };
    return /* @__PURE__ */ react_global_default.createElement("div", { className: `settings-identity-item ${identity.is_default ? "is-default" : ""} ${isExpired ? "is-expired" : ""}` }, /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        ref: fileInputRef,
        type: "file",
        accept: "image/png,image/jpeg,image/webp,image/gif",
        style: { display: "none" },
        onChange: handleAvatarPicked
      }
    ), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-identity-main" }, /* @__PURE__ */ react_global_default.createElement(
      IdentityAvatar,
      {
        label: identity.primary_uid || identity.email,
        avatarDataUrl: identity.avatar_data_url,
        avatarColor: identity.avatar_color,
        showStatusBadge: !!identity.status_badge_enabled
      }
    ), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-identity-content" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-identity-email" }, /* @__PURE__ */ react_global_default.createElement("strong", null, identity.email), identity.is_default && /* @__PURE__ */ react_global_default.createElement(Badge, { variant: "accent" }, "Default"), !identity.is_active && /* @__PURE__ */ react_global_default.createElement(Badge, { variant: "muted" }, "Inactive"), isExpired && /* @__PURE__ */ react_global_default.createElement(Badge, { variant: "error" }, "Expired"), identity.status_badge_enabled && /* @__PURE__ */ react_global_default.createElement(Badge, { variant: "success" }, "Status badge on")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-identity-meta" }, /* @__PURE__ */ react_global_default.createElement("code", null, identity.fingerprint), /* @__PURE__ */ react_global_default.createElement("span", { className: "dim" }, identity.algorithm, " \xB7 ", identity.bits, " bits \xB7 created ", new Date(identity.created_at).toLocaleDateString()), showExpiry && identity.expires_at && /* @__PURE__ */ react_global_default.createElement("span", { className: isExpired ? "error" : "" }, isExpired ? "Expired" : "Expires", ": ", new Date(identity.expires_at).toLocaleDateString())), onUpdateProfile && /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-identity-profile" }, /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-identity-profile-field" }, /* @__PURE__ */ react_global_default.createElement("span", null, "Fallback color"), /* @__PURE__ */ react_global_default.createElement(
      "select",
      {
        className: "settings-select",
        value: identity.avatar_color || "blue",
        disabled: saving,
        onChange: (e) => onUpdateProfile(identity.fingerprint, { avatar_color: e.target.value })
      },
      IDENTITY_AVATAR_COLORS.map((color) => /* @__PURE__ */ react_global_default.createElement("option", { key: color.id, value: color.id }, color.label))
    )), /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-identity-toggle" }, /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        type: "checkbox",
        checked: !!identity.status_badge_enabled,
        disabled: saving,
        onChange: (e) => onUpdateProfile(identity.fingerprint, { status_badge_enabled: e.target.checked })
      }
    ), /* @__PURE__ */ react_global_default.createElement("span", null, "Enable status badge after mutual reply")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-identity-avatar-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", onClick: triggerAvatarPicker, disabled: saving }, saving ? "Saving\u2026" : identity.avatar_data_url ? "Replace Avatar" : "Upload Avatar"), identity.avatar_data_url && /* @__PURE__ */ react_global_default.createElement(
      Button,
      {
        variant: "secondary",
        size: "sm",
        onClick: () => onUpdateProfile(identity.fingerprint, { avatar_data_url: "" }),
        disabled: saving
      },
      "Remove"
    ))))), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-identity-actions" }, onSetDefault && !identity.is_default && identity.is_active && /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", onClick: () => onSetDefault(identity.fingerprint), title: "Set as default" }, SettingsIcons.star), onDelete && !identity.is_default && /* @__PURE__ */ react_global_default.createElement(Button, { variant: "danger", size: "sm", onClick: () => onDelete(identity.fingerprint), title: "Delete" }, SettingsIcons.trash)));
  }
  function MailFromStyleSelect({
    value,
    options,
    onChange,
    loading,
    placeholder,
    emptyMessage,
    menuLabel
  }) {
    const [open, setOpen] = useState3(false);
    const containerRef = useRef2(null);
    useEffect2(() => {
      if (!open) return;
      const handleClickOutside = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setOpen(false);
        }
      };
      const handleEscape = (e) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [open]);
    const getInitial = (v) => {
      if (!v) return "?";
      const at = v.indexOf("@");
      const key = at > 0 ? v.slice(0, at) : v;
      return (key[0] || "?").toUpperCase();
    };
    const getAvatarStyle = (key) => {
      if (!key) return {};
      let hash = 0;
      for (let i = 0; i < key.length; i += 1) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      return {
        "--from-avatar-bg": `linear-gradient(135deg, hsl(${hue}, 55%, 45%), hsl(${(hue + 40) % 360}, 50%, 35%))`
      };
    };
    const selected = (options || []).find((o) => o.value === value);
    const ready = !loading;
    const noOptions = ready && (!options || options.length === 0);
    const triggerDisabled = loading || noOptions;
    const displayLine = loading ? "Loading\u2026" : selected ? selected.label : noOptions ? emptyMessage : placeholder;
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "from-selector", ref: containerRef }, /* @__PURE__ */ react_global_default.createElement(
      "button",
      {
        type: "button",
        className: `from-selector-trigger${open ? " open" : ""}`,
        onClick: () => {
          if (triggerDisabled) return;
          setOpen(!open);
        },
        "aria-haspopup": "listbox",
        "aria-expanded": open,
        disabled: triggerDisabled
      },
      /* @__PURE__ */ react_global_default.createElement("span", { className: "from-selector-avatar", style: getAvatarStyle(value || displayLine) }, loading ? "\u2026" : getInitial(value)),
      /* @__PURE__ */ react_global_default.createElement("span", { className: "from-selector-value" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "from-selector-email" }, displayLine)),
      /* @__PURE__ */ react_global_default.createElement("span", { className: "from-selector-chevron" }, open ? "\u25B4" : "\u25BE")
    ), open && ready && options.length > 0 && /* @__PURE__ */ react_global_default.createElement("div", { className: "from-selector-menu", role: "listbox" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "from-selector-menu-header" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "from-selector-menu-label" }, menuLabel)), options.map((o) => {
      const isSelected = o.value === value;
      return /* @__PURE__ */ react_global_default.createElement(
        "button",
        {
          key: o.value,
          type: "button",
          className: `from-selector-option${isSelected ? " selected" : ""}`,
          onClick: () => {
            onChange(o.value);
            setOpen(false);
          },
          role: "option",
          "aria-selected": isSelected
        },
        /* @__PURE__ */ react_global_default.createElement("span", { className: "from-selector-avatar", style: getAvatarStyle(o.value) }, getInitial(o.value)),
        /* @__PURE__ */ react_global_default.createElement("span", { className: "from-selector-option-content" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "from-selector-option-email" }, o.label)),
        isSelected && /* @__PURE__ */ react_global_default.createElement("span", { className: "from-selector-check" }, "\u2713")
      );
    })));
  }
  function CreateIdentityForm({ type, user, onClose, onSuccess }) {
    const accountLocalDefault = useMemo3(() => {
      const e = String(user?.email || "");
      const i = e.indexOf("@");
      return i > 0 ? e.slice(0, i).toLowerCase() : "";
    }, [user?.email]);
    const [platformDomain, setPlatformDomain] = useState3("");
    const [usableDomains, setUsableDomains] = useState3([]);
    const [domainsLoaded, setDomainsLoaded] = useState3(false);
    const [selectedDomain, setSelectedDomain] = useState3("");
    const [localPart, setLocalPart] = useState3("");
    const [name, setName] = useState3("");
    const [loading, setLoading] = useState3(false);
    const [error, setError] = useState3("");
    const domainOptions = useMemo3(() => {
      const opts = [];
      if (platformDomain) opts.push({ value: platformDomain, label: `${platformDomain} (host)` });
      (usableDomains || []).forEach((d) => {
        if (d.domain) {
          const suf = d.source === "shared" ? " (shared)" : "";
          opts.push({ value: d.domain, label: `${d.domain}${suf}` });
        }
      });
      return opts;
    }, [platformDomain, usableDomains]);
    useEffect2(() => {
      let cancelled = false;
      (async () => {
        setDomainsLoaded(false);
        try {
          const resp = await fetch(elvishApiUrl("/api/auth/signup-config"), { credentials: "include" });
          const j = await resp.json().catch(() => ({}));
          const dom = typeof j.mail_domain === "string" ? j.mail_domain.trim().toLowerCase() : "";
          if (!cancelled) {
            setPlatformDomain(dom);
            setSelectedDomain((prev) => prev || dom);
          }
        } catch (_) {
          if (!cancelled) {
            const e = String(user?.email || "");
            const i = e.indexOf("@");
            const fb = i > 0 ? e.slice(i + 1).toLowerCase() : "";
            setPlatformDomain(fb);
            setSelectedDomain((prev) => prev || fb);
          }
        }
        try {
          const d = await window.ElvishMailManifest.listUsableDomains();
          if (!cancelled) {
            setUsableDomains(Array.isArray(d.domains) ? d.domains : []);
          }
        } catch (_) {
          if (!cancelled) setUsableDomains([]);
        } finally {
          if (!cancelled) setDomainsLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.email]);
    useEffect2(() => {
      if (!domainsLoaded) return;
      setSelectedDomain((prev) => {
        if (prev && domainOptions.some((o) => o.value === prev)) return prev;
        if (platformDomain) return platformDomain;
        const first = domainOptions[0];
        return first ? first.value : "";
      });
    }, [domainsLoaded, platformDomain, domainOptions]);
    useEffect2(() => {
      if (type === "plus") {
        setLocalPart((prev) => prev && prev.trim() ? prev : accountLocalDefault);
      } else if (type === "alias") {
        setLocalPart("");
      }
    }, [type, accountLocalDefault]);
    const previewEmail = useMemo3(() => {
      const dom = selectedDomain || platformDomain || "\u2026";
      if (type === "disposable") return `(random)@${dom}`;
      if (type === "plus") {
        const base = (localPart || "local").trim().toLowerCase();
        const tag = (name || "tag").trim().toLowerCase() || "tag";
        return `${base}+${tag}@${dom}`;
      }
      const loc = (localPart || "local").trim().toLowerCase() || "local";
      return `${loc}@${dom}`;
    }, [type, localPart, name, selectedDomain, platformDomain]);
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!user?.email) {
        setError("Session email unavailable");
        return;
      }
      if (!selectedDomain) {
        setError("Select a domain");
        return;
      }
      setLoading(true);
      setError("");
      try {
        await window.ElvishMailManifest.createGeneratedIdentity({
          accountEmail: user.email,
          type,
          name,
          domain: selectedDomain,
          localPart: type === "disposable" ? "" : localPart
        });
        onSuccess();
        onClose();
      } catch (err) {
        setError(err.message || "Failed to create identity");
      } finally {
        setLoading(false);
      }
    };
    return /* @__PURE__ */ react_global_default.createElement("form", { onSubmit: handleSubmit }, error && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, error), (type === "alias" || type === "plus" || type === "disposable") && /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-identity-profile-field", style: { marginBottom: "12px" } }, /* @__PURE__ */ react_global_default.createElement("span", null, "Domain"), /* @__PURE__ */ react_global_default.createElement(
      MailFromStyleSelect,
      {
        value: selectedDomain,
        options: domainOptions,
        onChange: setSelectedDomain,
        loading: !domainsLoaded,
        placeholder: "Select a domain",
        emptyMessage: "No domains available",
        menuLabel: "\u25B8 SELECT DOMAIN"
      }
    ), domainsLoaded && usableDomains.length === 0 && platformDomain && /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-helper" }, "Verified custom domains also appear here after you add them under Custom Domains. Operator-shared domains appear when enabled by your admin.")), type === "alias" && /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Local part (before @)",
        value: localPart,
        onChange: (ev) => setLocalPart(ev.target.value),
        placeholder: "e.g. work, contact, sales",
        helperText: "3-64 characters: letters, digits, dots, hyphens, underscores (no +). This is the full mailbox name, not a suffix on your login."
      }
    ), type === "plus" && /* @__PURE__ */ react_global_default.createElement(react_global_default.Fragment, null, /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Local part (before +)",
        value: localPart,
        onChange: (ev) => setLocalPart(ev.target.value),
        placeholder: accountLocalDefault || "mailbox",
        helperText: "Usually your main mailbox name on this domain"
      }
    ), /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Plus tag",
        value: name,
        onChange: (ev) => setName(ev.target.value),
        placeholder: "e.g. shopping, newsletters",
        helperText: "Mail goes to local+tag@domain"
      }
    ), /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Route to Folder (optional)",
        placeholder: "e.g. shopping",
        helperText: "Leave empty to deliver to inbox"
      }
    )), type === "disposable" && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "A random disposable local part will be generated on the domain you select. It expires in 30 days."), (type === "alias" || type === "plus" || type === "disposable") && /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-helper", style: { marginBottom: "12px" } }, "Preview: ", /* @__PURE__ */ react_global_default.createElement("strong", null, previewEmail)), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: onClose }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(
      Button,
      {
        variant: "primary",
        type: "submit",
        loading,
        disabled: !domainsLoaded || !selectedDomain || type === "alias" && !localPart.trim() || type === "plus" && (!String(localPart || "").trim() || !String(name || "").trim())
      },
      type === "disposable" ? "Generate Address" : "Create"
    )));
  }
  function FoldersSection() {
    const [folders, setFolders] = useState3([]);
    const [loading, setLoading] = useState3(true);
    const [error, setError] = useState3("");
    const [showCreateModal, setShowCreateModal] = useState3(false);
    const [confirmDelete, setConfirmDelete] = useState3(null);
    const [deleteLoading, setDeleteLoading] = useState3(false);
    const loadFolders = useCallback2(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await window.ElvishMailManifest.listMailboxFolders();
        const list = result.folders || [];
        setFolders(list.map((f) => ({
          name: f.name,
          total: f.total != null ? f.total : 0,
          unread: f.unread != null ? f.unread : 0,
          isStandard: !!f.is_standard
        })));
      } catch (e) {
        setError(e.message || "Failed to load folders");
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect2(() => {
      loadFolders();
    }, [loadFolders]);
    const standardFolders = folders.filter((f) => f.isStandard);
    const customFolders = folders.filter((f) => !f.isStandard);
    const getFolderIcon = (name) => {
      const icons = { inbox: "identities", sent: "smtp", drafts: "edit", trash: "trash" };
      return icons[name.toLowerCase()] || "folders";
    };
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-header" }, /* @__PURE__ */ react_global_default.createElement("h2", null, "Folder Management"), /* @__PURE__ */ react_global_default.createElement("p", null, "Organize your emails with custom folders")), error && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, error), /* @__PURE__ */ react_global_default.createElement(Card, { title: "Standard Folders", description: "Built-in folders that cannot be deleted or renamed." }, loading ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-loading" }, "Loading folders...") : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-folders-grid" }, standardFolders.map((f) => /* @__PURE__ */ react_global_default.createElement("div", { key: f.name, className: "settings-folder-item" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-folder-icon" }, SettingsIcons[getFolderIcon(f.name)]), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-folder-name" }, f.name.charAt(0).toUpperCase() + f.name.slice(1)), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-folder-count dim" }, f.total, " emails"))))), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Custom Folders",
        description: "Create folders to organize your emails.",
        actions: /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", size: "sm", onClick: () => setShowCreateModal(true) }, SettingsIcons.plus, " Create Folder")
      },
      customFolders.length === 0 ? /* @__PURE__ */ react_global_default.createElement(
        EmptyState,
        {
          icon: "folders",
          title: "No custom folders",
          description: "Create folders to organize your emails.",
          action: /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", onClick: () => setShowCreateModal(true) }, "Create Your First Folder")
        }
      ) : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-folders-grid" }, customFolders.map((f) => /* @__PURE__ */ react_global_default.createElement("div", { key: f.name, className: "settings-folder-item custom" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-folder-icon" }, SettingsIcons.folders), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-folder-name" }, f.name), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-folder-count dim" }, f.total, " emails"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "danger", size: "sm", title: "Delete folder", onClick: () => setConfirmDelete(f.name) }, SettingsIcons.trash))))
    ), /* @__PURE__ */ react_global_default.createElement(Modal, { open: showCreateModal, onClose: () => setShowCreateModal(false), title: "Create Folder" }, /* @__PURE__ */ react_global_default.createElement(CreateFolderForm, { onClose: () => setShowCreateModal(false), onSuccess: loadFolders })), /* @__PURE__ */ react_global_default.createElement(
      ConfirmModal,
      {
        open: !!confirmDelete,
        onClose: () => !deleteLoading && setConfirmDelete(null),
        onConfirm: async () => {
          setDeleteLoading(true);
          try {
            await window.ElvishMailManifest.deleteMailboxFolder(confirmDelete);
            await loadFolders();
            setConfirmDelete(null);
          } catch (e) {
            setError(e.message || "Failed to delete folder");
          } finally {
            setDeleteLoading(false);
          }
        },
        title: "Delete Folder",
        message: `Delete folder "${confirmDelete}"? Messages in this folder may remain in storage until moved.`,
        confirmLabel: "Delete Folder",
        confirmVariant: "danger",
        loading: deleteLoading
      }
    ));
  }
  function CreateFolderForm({ onClose, onSuccess }) {
    const [name, setName] = useState3("");
    const [loading, setLoading] = useState3(false);
    const [error, setError] = useState3("");
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!name.trim()) {
        setError("Folder name is required");
        return;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        setError("Only letters, numbers, dashes, and underscores allowed");
        return;
      }
      setLoading(true);
      setError("");
      try {
        await window.ElvishMailManifest.createMailboxFolder(name.trim());
        onSuccess();
        onClose();
      } catch (e2) {
        setError(e2.message || "Failed to create folder");
      } finally {
        setLoading(false);
      }
    };
    return /* @__PURE__ */ react_global_default.createElement("form", { onSubmit: handleSubmit }, error && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, error), /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Folder Name",
        value: name,
        onChange: (e) => setName(e.target.value),
        placeholder: "e.g., shopping, newsletters, work",
        helperText: "Letters, numbers, dashes, and underscores only. Max 50 characters."
      }
    ), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: onClose }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", type: "submit", loading }, "Create Folder")));
  }
  function emptyCondition() {
    return { type: "subject", operator: "contains", value: "" };
  }
  function emptyAction() {
    return { type: "move", value: "archive" };
  }
  function opsForConditionType(type) {
    if (type === "size") return FILTER_OPS_SIZE;
    if (type === "attachment") return [{ id: "equals", label: "Equals" }];
    return FILTER_OPS_STRING;
  }
  function defaultOperatorForType(type) {
    if (type === "size") return "greater_than";
    if (type === "attachment") return "equals";
    return "contains";
  }
  function FiltersSection() {
    const [filters, setFilters] = useState3([]);
    const [loading, setLoading] = useState3(true);
    const [error, setError] = useState3("");
    const [showCreateModal, setShowCreateModal] = useState3(false);
    const [newName, setNewName] = useState3("");
    const [confirmDelete, setConfirmDelete] = useState3(null);
    const [deleteLoading, setDeleteLoading] = useState3(false);
    const [editDraft, setEditDraft] = useState3(null);
    const [saveLoading, setSaveLoading] = useState3(false);
    const [toggleLoading, setToggleLoading] = useState3(null);
    const loadFilters = useCallback2(async () => {
      setLoading(true);
      setError("");
      try {
        const r = await window.ElvishMailManifest.listFilters();
        const raw = r.filters || [];
        setFilters(raw.map((x) => ({
          ...x,
          conditions: Array.isArray(x.conditions) ? x.conditions : [],
          actions: Array.isArray(x.actions) ? x.actions : []
        })));
      } catch (e) {
        setError(e.message || "Failed to load filters");
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect2(() => {
      loadFilters();
    }, [loadFilters]);
    const handleCreate = async (e) => {
      e.preventDefault();
      if (!newName.trim()) return;
      try {
        await window.ElvishMailManifest.createFilter({
          name: newName.trim(),
          enabled: true,
          priority: 100,
          conditions: [emptyCondition()],
          actions: [emptyAction()]
        });
        setNewName("");
        setShowCreateModal(false);
        await loadFilters();
      } catch (err) {
        setError(err.message || "Failed to create filter");
      }
    };
    const handleDelete = (id) => {
      setConfirmDelete(id);
    };
    const executeDeleteFilter = async () => {
      setDeleteLoading(true);
      try {
        await window.ElvishMailManifest.deleteFilter(confirmDelete);
        await loadFilters();
        setConfirmDelete(null);
      } catch (err) {
        setError(err.message || "Failed to delete filter");
      } finally {
        setDeleteLoading(false);
      }
    };
    const openEdit = (f) => {
      setEditDraft({
        id: f.id,
        name: f.name || "",
        enabled: f.enabled !== false,
        priority: Number(f.priority) || 100,
        conditions: f.conditions && f.conditions.length ? f.conditions.map((c) => ({
          type: c.type || "subject",
          operator: c.operator || "contains",
          value: c.value == null ? "" : String(c.value)
        })) : [emptyCondition()],
        actions: f.actions && f.actions.length ? f.actions.map((a) => ({
          type: a.type || "move",
          value: a.value == null ? "" : String(a.value)
        })) : [emptyAction()]
      });
    };
    const saveEdit = async (e) => {
      e.preventDefault();
      if (!editDraft || !editDraft.name.trim()) {
        setError("Rule name is required");
        return;
      }
      const conds = editDraft.conditions || [];
      if (!conds.length) {
        setError("Add at least one condition");
        return;
      }
      for (let i = 0; i < conds.length; i += 1) {
        const c = conds[i];
        if (c.type === "attachment") {
          const v = String(c.value || "").trim().toLowerCase();
          if (v !== "yes" && v !== "no" && v !== "1" && v !== "0" && v !== "true" && v !== "false") {
            setError("Attachment condition value: use yes or no");
            return;
          }
        } else if (c.type !== "size" && !String(c.value || "").trim()) {
          setError("Each condition needs a value (except size, which needs a number)");
          return;
        }
        if (c.type === "size" && !/^-?\d+$/.test(String(c.value || "").trim())) {
          setError("Size condition needs a numeric value");
          return;
        }
      }
      const acts = (editDraft.actions || []).filter((a) => {
        const t = FILTER_ACTION_TYPES.find((x) => x.id === a.type);
        return t && t.supported;
      });
      if (!acts.length) {
        setError("Add at least one supported action (move, mark read, or delete)");
        return;
      }
      for (let j = 0; j < acts.length; j += 1) {
        if (acts[j].type === "move") {
          const folder = String(acts[j].value || "").trim().toLowerCase();
          if (!folder) {
            setError("Move action needs a folder name");
            return;
          }
          if (!/^[a-z0-9_-]+$/.test(folder)) {
            setError("Folder name: letters, numbers, dashes, underscores only");
            return;
          }
        }
      }
      setSaveLoading(true);
      setError("");
      try {
        await window.ElvishMailManifest.updateFilter(editDraft.id, {
          name: editDraft.name.trim(),
          enabled: !!editDraft.enabled,
          priority: Number(editDraft.priority) || 100,
          conditions: conds.map((c) => ({
            type: c.type,
            operator: c.operator,
            value: c.type === "size" ? String(parseInt(c.value, 10)) : String(c.value || "")
          })),
          actions: acts
        });
        setEditDraft(null);
        await loadFilters();
      } catch (err) {
        setError(err.message || "Failed to save filter");
      } finally {
        setSaveLoading(false);
      }
    };
    const toggleEnabled = async (f) => {
      setToggleLoading(f.id);
      setError("");
      try {
        await window.ElvishMailManifest.updateFilter(f.id, {
          name: f.name,
          enabled: !f.enabled,
          priority: Number(f.priority) || 100,
          conditions: f.conditions || [],
          actions: f.actions || []
        });
        await loadFilters();
      } catch (err) {
        setError(err.message || "Failed to update filter");
      } finally {
        setToggleLoading(null);
      }
    };
    const updateConditionRow = (idx, patch) => {
      setEditDraft((d) => {
        if (!d) return d;
        const next = d.conditions.slice();
        const cur = { ...next[idx], ...patch };
        if (patch.type) {
          cur.operator = defaultOperatorForType(patch.type);
        }
        next[idx] = cur;
        return { ...d, conditions: next };
      });
    };
    const updateActionRow = (idx, patch) => {
      setEditDraft((d) => {
        if (!d) return d;
        const next = d.actions.slice();
        next[idx] = { ...next[idx], ...patch };
        return { ...d, actions: next };
      });
    };
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-header" }, /* @__PURE__ */ react_global_default.createElement("h2", null, "Email Filters"), /* @__PURE__ */ react_global_default.createElement("p", null, "Rules sync to your account for all clients. Matching uses decrypted metadata in the app for body-based rules. For external mail, the server applies the same JSON rules at delivery using only envelope and header fields plus message size \u2014 never body text, never third-party spam scores \u2014 so sender blocks can discard mail before it is stored.")), /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "Filter definitions are stored as JSON on the server so clients stay in sync. In the web app, auto-apply still runs in the Inbox on decrypted previews. At SMTP delivery, Elvish evaluates enabled rules once using envelope/headers/size only: delete actions block without persisting; move actions file straight to the folder. Body conditions are ignored on the server and still match only in the client. Star/label actions are not wired to the API yet."), error && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, error), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Filter rules",
        description: "When a message matches all conditions (AND), supported actions run in order. Higher priority numbers run first.",
        actions: /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", size: "sm", onClick: () => setShowCreateModal(true) }, SettingsIcons.plus, " Create filter")
      },
      loading ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-loading" }, "Loading filters...") : filters.length === 0 ? /* @__PURE__ */ react_global_default.createElement(
        EmptyState,
        {
          icon: "filters",
          title: "No filters yet",
          description: "Create a rule with conditions and actions.",
          action: /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", onClick: () => setShowCreateModal(true) }, "Create your first filter")
        }
      ) : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-filters-list" }, filters.map((f) => /* @__PURE__ */ react_global_default.createElement("div", { key: f.id, className: "settings-filter-item" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-filter-info" }, /* @__PURE__ */ react_global_default.createElement("strong", null, f.name), /* @__PURE__ */ react_global_default.createElement("span", { className: "dim" }, (f.conditions || []).length, " condition(s) \xB7 ", (f.actions || []).length, " action(s) \xB7 priority ", f.priority != null ? f.priority : 100)), /* @__PURE__ */ react_global_default.createElement(Badge, { variant: f.enabled ? "success" : "muted" }, f.enabled ? "Enabled" : "Disabled"), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-filter-actions" }, /* @__PURE__ */ react_global_default.createElement(
        Button,
        {
          variant: "secondary",
          size: "sm",
          loading: toggleLoading === f.id,
          onClick: () => toggleEnabled(f),
          title: f.enabled ? "Disable" : "Enable"
        },
        f.enabled ? "Disable" : "Enable"
      ), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", onClick: () => openEdit(f), title: "Edit" }, SettingsIcons.edit), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "danger", size: "sm", onClick: () => handleDelete(f.id) }, SettingsIcons.trash)))))
    ), /* @__PURE__ */ react_global_default.createElement(Modal, { open: showCreateModal, onClose: () => setShowCreateModal(false), title: "Create filter", size: "lg" }, /* @__PURE__ */ react_global_default.createElement("form", { onSubmit: handleCreate }, /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Rule name",
        value: newName,
        onChange: (e) => setNewName(e.target.value),
        placeholder: "e.g. Newsletters to archive"
      }
    ), /* @__PURE__ */ react_global_default.createElement("p", { className: "settings-helper", style: { marginTop: 8 } }, "You can add conditions and actions after creation."), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: () => setShowCreateModal(false) }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", type: "submit" }, "Create")))), /* @__PURE__ */ react_global_default.createElement(Modal, { open: !!editDraft, onClose: () => !saveLoading && setEditDraft(null), title: "Edit filter", size: "lg" }, editDraft && /* @__PURE__ */ react_global_default.createElement("form", { onSubmit: saveEdit }, /* @__PURE__ */ react_global_default.createElement(Input2, { label: "Rule name", value: editDraft.name, onChange: (e) => setEditDraft({ ...editDraft, name: e.target.value }) }), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-filter-editor-grid", style: { marginTop: 12 } }, /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-label" }, "Enabled"), /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-checkbox-inline" }, /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        type: "checkbox",
        checked: editDraft.enabled,
        onChange: (e) => setEditDraft({ ...editDraft, enabled: e.target.checked })
      }
    ), /* @__PURE__ */ react_global_default.createElement("span", null, "Run this rule when viewing Inbox")), /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Priority (higher runs first)",
        type: "number",
        value: String(editDraft.priority),
        onChange: (e) => setEditDraft({ ...editDraft, priority: parseInt(e.target.value, 10) || 0 })
      }
    )), /* @__PURE__ */ react_global_default.createElement("h4", { className: "settings-filter-editor-subtitle" }, "Conditions (all must match)"), (editDraft.conditions || []).map((c, idx) => /* @__PURE__ */ react_global_default.createElement("div", { key: `c-${idx}`, className: "settings-filter-rule-row" }, /* @__PURE__ */ react_global_default.createElement(
      "select",
      {
        className: "settings-select",
        value: c.type,
        onChange: (e) => updateConditionRow(idx, { type: e.target.value })
      },
      FILTER_CONDITION_TYPES.map((t) => /* @__PURE__ */ react_global_default.createElement("option", { key: t.id, value: t.id }, t.label))
    ), /* @__PURE__ */ react_global_default.createElement(
      "select",
      {
        className: "settings-select",
        value: c.operator,
        onChange: (e) => updateConditionRow(idx, { operator: e.target.value })
      },
      opsForConditionType(c.type).map((o) => /* @__PURE__ */ react_global_default.createElement("option", { key: o.id, value: o.id }, o.label))
    ), /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        className: "settings-input",
        placeholder: c.type === "attachment" ? "yes or no" : "Value",
        value: c.value,
        onChange: (e) => updateConditionRow(idx, { value: e.target.value })
      }
    ), /* @__PURE__ */ react_global_default.createElement(Button, { type: "button", variant: "secondary", size: "sm", onClick: () => {
      setEditDraft((d) => {
        if (!d) return d;
        const next = d.conditions.filter((_, i) => i !== idx);
        return { ...d, conditions: next.length ? next : [emptyCondition()] };
      });
    } }, SettingsIcons.trash))), /* @__PURE__ */ react_global_default.createElement(Button, { type: "button", variant: "secondary", size: "sm", onClick: () => {
      setEditDraft((d) => d ? { ...d, conditions: [...d.conditions, emptyCondition()] } : d);
    } }, SettingsIcons.plus, " Add condition"), /* @__PURE__ */ react_global_default.createElement("h4", { className: "settings-filter-editor-subtitle" }, "Actions"), (editDraft.actions || []).map((a, idx) => /* @__PURE__ */ react_global_default.createElement("div", { key: `a-${idx}`, className: "settings-filter-rule-row" }, /* @__PURE__ */ react_global_default.createElement(
      "select",
      {
        className: "settings-select",
        value: a.type,
        onChange: (e) => updateActionRow(idx, { type: e.target.value, value: e.target.value === "move" ? a.value || "archive" : "" })
      },
      FILTER_ACTION_TYPES.map((t) => /* @__PURE__ */ react_global_default.createElement("option", { key: t.id, value: t.id, disabled: !t.supported }, t.label))
    ), /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        className: "settings-input",
        style: { flex: 1 },
        placeholder: a.type === "move" ? "Folder (e.g. archive, trash, work)" : "Value if required",
        value: a.value || "",
        onChange: (e) => updateActionRow(idx, { value: e.target.value }),
        disabled: a.type === "mark_read" || a.type === "delete"
      }
    ), /* @__PURE__ */ react_global_default.createElement(Button, { type: "button", variant: "secondary", size: "sm", onClick: () => {
      setEditDraft((d) => {
        if (!d) return d;
        const next = d.actions.filter((_, i) => i !== idx);
        return { ...d, actions: next.length ? next : [emptyAction()] };
      });
    } }, SettingsIcons.trash))), /* @__PURE__ */ react_global_default.createElement(Button, { type: "button", variant: "secondary", size: "sm", onClick: () => {
      setEditDraft((d) => d ? { ...d, actions: [...d.actions, emptyAction()] } : d);
    } }, SettingsIcons.plus, " Add action"), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions", style: { marginTop: 20 } }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: () => setEditDraft(null), disabled: saveLoading }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", type: "submit", loading: saveLoading }, "Save")))), /* @__PURE__ */ react_global_default.createElement(
      ConfirmModal,
      {
        open: !!confirmDelete,
        onClose: () => !deleteLoading && setConfirmDelete(null),
        onConfirm: executeDeleteFilter,
        title: "Delete filter",
        message: "Are you sure you want to delete this filter rule? This action cannot be undone.",
        confirmLabel: "Delete filter",
        confirmVariant: "danger",
        loading: deleteLoading
      }
    ));
  }
  function normalizeCustomDomainRecord(raw) {
    const status = String(raw?.status || "pending").trim().toLowerCase() || "pending";
    return {
      domain: String(raw?.domain || "").trim().toLowerCase(),
      status,
      mxVerified: !!(raw?.mx_verified ?? raw?.mxVerified),
      spfVerified: !!(raw?.spf_verified ?? raw?.spfVerified),
      dkimVerified: !!(raw?.dkim_verified ?? raw?.dkimVerified),
      dmarcVerified: !!(raw?.dmarc_verified ?? raw?.dmarcVerified),
      verificationTxtHost: String(raw?.verification_txt_host ?? raw?.verificationTxtHost ?? "").trim(),
      verificationTxtValue: String(raw?.verification_txt_value ?? raw?.verificationTxtValue ?? "").trim(),
      dnsConfig: normalizeCustomDomainDNSConfig(raw),
      catchallIdentityFP: String(raw?.catchall_identity_fp ?? raw?.catchallIdentityFp ?? "").trim().toUpperCase(),
      createdAt: raw?.created_at || raw?.createdAt || ""
    };
  }
  function normalizeCustomDomainDNSConfig(raw) {
    const source = raw?.dns_config || raw?.dnsConfig || {};
    return {
      verificationTxt: normalizeCustomDomainDNSConfigEntry(source.verification_txt || source.verificationTxt, "TXT"),
      mx: normalizeCustomDomainDNSConfigEntry(source.mx, "MX"),
      spf: normalizeCustomDomainDNSConfigEntry(source.spf, "TXT"),
      dkim: normalizeCustomDomainDNSConfigEntry(source.dkim, "TXT"),
      dmarc: normalizeCustomDomainDNSConfigEntry(source.dmarc, "TXT")
    };
  }
  function normalizeCustomDomainDNSConfigEntry(raw, fallbackType) {
    return {
      type: String(raw?.type || fallbackType || "TXT").trim().toUpperCase() || "TXT",
      host: String(raw?.host || "").trim(),
      value: String(raw?.value || "").trim(),
      ttl: String(raw?.ttl || "Auto").trim() || "Auto",
      extra: String(raw?.extra || "").trim(),
      hint: String(raw?.hint || "").trim()
    };
  }
  function customDomainStatusVariant(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "active" || normalized === "verified") return "success";
    if (normalized === "pending") return "warning";
    return "error";
  }
  function customDomainStatusLabel(status) {
    const normalized = String(status || "").trim().toLowerCase();
    return normalized === "active" ? "ready" : normalized || "pending";
  }
  function customDomainIsReady(domain) {
    const status = String(domain?.status || "").trim().toLowerCase();
    return status === "active" || status === "verified";
  }
  function relativeDNSName(name, domain) {
    const fqdn = String(name || "").trim().toLowerCase().replace(/\.$/, "");
    const base = String(domain || "").trim().toLowerCase().replace(/\.$/, "");
    if (!fqdn || !base) return fqdn || "";
    if (fqdn === base) return "@";
    const suffix = "." + base;
    return fqdn.endsWith(suffix) ? fqdn.slice(0, -suffix.length) || "@" : fqdn;
  }
  function uniqueDNSValues(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean)));
  }
  function buildCustomDomainDNSRecords(domain, verifyResult) {
    if (!domain?.domain) return [];
    const dnsConfig = domain.dnsConfig || {};
    const domainName = domain.domain;
    const records = [];
    const checkFor = (key) => verifyResult?.checks?.[key] || null;
    const pushRecord = (id, label, recordConfig, check, ok) => {
      const fqdn = String(recordConfig?.host || "").trim();
      const statusText = String(
        check?.note || check?.error || (check?.ok ? "Verified." : "") || recordConfig?.hint || ""
      ).trim();
      records.push({
        id,
        label,
        ok: !!ok,
        type: String(recordConfig?.type || (id === "mx" ? "MX" : "TXT")).trim().toUpperCase(),
        hostLabel: relativeDNSName(fqdn, domainName) || "@",
        fqdn,
        value: String(recordConfig?.value || "").trim(),
        ttl: String(recordConfig?.ttl || "Auto").trim() || "Auto",
        extra: String(recordConfig?.extra || "").trim(),
        statusText,
        setupNote: String(recordConfig?.hint || "").trim(),
        detectedValues: uniqueDNSValues(check?.values)
      });
    };
    pushRecord(
      "ownership",
      "Ownership TXT",
      {
        type: "TXT",
        host: domain.verificationTxtHost || dnsConfig?.verificationTxt?.host || "",
        value: domain.verificationTxtValue || dnsConfig?.verificationTxt?.value || "",
        ttl: dnsConfig?.verificationTxt?.ttl || "Auto",
        hint: "Publish this exact TXT record so Elvish can verify you control the domain."
      },
      checkFor("ownership"),
      verifyResult?.ownership_verified
    );
    pushRecord("mx", "MX", dnsConfig?.mx || { host: domainName }, checkFor("mx"), domain.mxVerified || checkFor("mx")?.ok);
    pushRecord("spf", "SPF", dnsConfig?.spf || { host: domainName }, checkFor("spf"), domain.spfVerified || checkFor("spf")?.ok);
    pushRecord("dkim", "DKIM", dnsConfig?.dkim || { host: "" }, checkFor("dkim"), domain.dkimVerified || checkFor("dkim")?.ok);
    pushRecord("dmarc", "DMARC", dnsConfig?.dmarc || { host: `_dmarc.${domainName}` }, checkFor("dmarc"), domain.dmarcVerified || checkFor("dmarc")?.ok);
    return records;
  }
  function validateCustomDomainInput(raw) {
    const domain = String(raw || "").trim().toLowerCase().replace(/\.+$/, "");
    if (!domain) return "Domain is required";
    if (domain.length > 253 || !domain.includes(".")) return "Enter a valid DNS domain";
    const parts = domain.split(".");
    for (const part of parts) {
      if (!part || part.length > 63) return "Enter a valid DNS domain";
      if (part.startsWith("-") || part.endsWith("-")) return "Enter a valid DNS domain";
      if (!/^[a-z0-9-]+$/.test(part)) return "Enter a valid DNS domain";
    }
    return "";
  }
  function domainCheckState(domain, verifyResult, key, label) {
    const checks = verifyResult?.checks || {};
    if (checks[key]) {
      const entry = checks[key];
      const values = Array.isArray(entry.values) && entry.values.length ? entry.values.join(", ") : "";
      return {
        key,
        label,
        ok: !!entry.ok,
        note: entry.note || entry.error || values || entry.expected || ""
      };
    }
    if (key === "ownership") {
      const setup = domain?.verificationTxtHost && domain?.verificationTxtValue ? `${domain.verificationTxtHost} -> ${domain.verificationTxtValue}` : "Add the verification TXT record, then run Verify DNS.";
      return {
        key,
        label,
        ok: !!verifyResult?.ownership_verified,
        note: verifyResult?.ownership_verified ? "Ownership verified." : setup
      };
    }
    const flagName = `${key}Verified`;
    return {
      key,
      label,
      ok: !!domain?.[flagName],
      note: domain?.[flagName] ? "Verified." : "Run Verify DNS to test this record."
    };
  }
  function SettingsToast({ toast, onClose }) {
    useEffect2(() => {
      if (!toast?.message) return void 0;
      const t = setTimeout(onClose, 3e3);
      return () => clearTimeout(t);
    }, [toast, onClose]);
    if (!toast?.message) return null;
    return /* @__PURE__ */ react_global_default.createElement("div", { className: `mail-toast ${toast.type || ""}` }, toast.message);
  }
  function DomainSetupProgress({ checks }) {
    const steps = [
      { key: "ownership", label: "Ownership" },
      { key: "mx", label: "MX" },
      { key: "spf", label: "SPF" },
      { key: "dkim", label: "DKIM" },
      { key: "dmarc", label: "DMARC" }
    ];
    const completedCount = checks.filter((c) => c.ok).length;
    const allComplete = completedCount === steps.length;
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-progress" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-progress-header" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "domain-setup-progress-title" }, "Setup Progress"), /* @__PURE__ */ react_global_default.createElement("span", { className: `domain-setup-progress-count ${allComplete ? "complete" : ""}` }, completedCount, " of ", steps.length, " complete")), /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-progress-bar" }, /* @__PURE__ */ react_global_default.createElement(
      "div",
      {
        className: "domain-setup-progress-fill",
        style: { width: `${completedCount / steps.length * 100}%` }
      }
    )), /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-progress-steps" }, steps.map((step) => {
      const check = checks.find((c) => c.key === step.key);
      const isComplete = check?.ok;
      return /* @__PURE__ */ react_global_default.createElement(
        "div",
        {
          key: step.key,
          className: `domain-setup-step ${isComplete ? "complete" : "pending"}`
        },
        /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-step-icon" }, isComplete ? SettingsIcons.check : /* @__PURE__ */ react_global_default.createElement("span", { className: "domain-setup-step-circle" })),
        /* @__PURE__ */ react_global_default.createElement("span", { className: "domain-setup-step-label" }, step.label)
      );
    })));
  }
  function DomainDNSRecord({ record, onCopy }) {
    const copyAllFields = () => {
      const parts = [];
      if (record.hostLabel) parts.push(`Host: ${record.hostLabel}`);
      if (record.type) parts.push(`Type: ${record.type}`);
      if (record.value) parts.push(`Value: ${record.value}`);
      if (record.extra) parts.push(record.extra);
      if (record.ttl && record.ttl !== "Auto") parts.push(`TTL: ${record.ttl}`);
      onCopy(parts.join("\n"));
    };
    return /* @__PURE__ */ react_global_default.createElement("div", { className: `domain-dns-record ${record.ok ? "verified" : "pending"}` }, /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-header" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-title" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "domain-dns-record-icon" }, record.ok ? SettingsIcons.check : SettingsIcons.x), /* @__PURE__ */ react_global_default.createElement("strong", null, record.label)), /* @__PURE__ */ react_global_default.createElement(Badge, { variant: record.ok ? "success" : "warning" }, record.ok ? "Verified" : "Pending")), /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-fields" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-row" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-field" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "domain-dns-record-field-label" }, "Type"), /* @__PURE__ */ react_global_default.createElement("code", null, record.type)), /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-field" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "domain-dns-record-field-label" }, "Host"), /* @__PURE__ */ react_global_default.createElement("code", null, record.hostLabel || "@")), record.extra && /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-field" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "domain-dns-record-field-label" }, "Priority"), /* @__PURE__ */ react_global_default.createElement("code", null, record.extra.replace(/^Priority\s*/i, "")))), /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-value-row" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-field wide" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "domain-dns-record-field-label" }, "Value"), /* @__PURE__ */ react_global_default.createElement("code", { className: "domain-dns-record-value" }, record.value || "Awaiting server guidance")), /* @__PURE__ */ react_global_default.createElement(
      Button,
      {
        variant: "secondary",
        size: "sm",
        onClick: copyAllFields,
        disabled: !record.value,
        title: "Copy record details"
      },
      SettingsIcons.copy,
      " Copy"
    ))), record.statusText && !record.ok && /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-note" }, record.statusText), record.detectedValues?.length > 0 && /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-detected" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "domain-dns-record-field-label" }, "Detected"), /* @__PURE__ */ react_global_default.createElement("code", null, record.detectedValues.join(", "))));
  }
  function CustomDomainsSection() {
    const [domains, setDomains] = useState3([]);
    const [identities, setIdentities] = useState3([]);
    const [loading, setLoading] = useState3(true);
    const [error, setError] = useState3("");
    const [toast, setToast] = useState3(null);
    const [showAddModal, setShowAddModal] = useState3(false);
    const [paid, setPaid] = useState3(false);
    const [newDomain, setNewDomain] = useState3("");
    const [domainFormError, setDomainFormError] = useState3("");
    const [busyAdd, setBusyAdd] = useState3(false);
    const [detailDomainName, setDetailDomainName] = useState3("");
    const [detailError, setDetailError] = useState3("");
    const [verifyLoading, setVerifyLoading] = useState3(false);
    const [verifyResult, setVerifyResult] = useState3(null);
    const [catchallDraft, setCatchallDraft] = useState3("");
    const [catchallLoading, setCatchallLoading] = useState3(false);
    const [confirmDelete, setConfirmDelete] = useState3(null);
    const [deleteLoading, setDeleteLoading] = useState3(false);
    const showToast = useCallback2((message, type) => {
      setToast({ message, type });
    }, []);
    const load = useCallback2(async () => {
      setLoading(true);
      setError("");
      try {
        const billing = await window.ElvishMailManifest.getBillingStatus();
        setPaid(!!billing.paid);
        if (!billing.paid) {
          setDomains([]);
          setIdentities([]);
          return [];
        }
        const [domainsResult, identitiesResult] = await Promise.allSettled([
          window.ElvishMailManifest.listCustomDomains(),
          window.ElvishMailManifest.listIdentities()
        ]);
        if (domainsResult.status !== "fulfilled") throw domainsResult.reason;
        const nextDomains = (domainsResult.value.domains || []).map(normalizeCustomDomainRecord);
        setDomains(nextDomains);
        if (identitiesResult.status === "fulfilled") {
          const nextIdentities = (identitiesResult.value.identities || []).filter((identity) => !!identity.is_active).map((identity) => ({
            email: identity.email,
            fingerprint: String(identity.fingerprint || "").trim().toUpperCase(),
            isDefault: !!identity.is_default
          }));
          setIdentities(nextIdentities);
        } else {
          setIdentities([]);
        }
        return nextDomains;
      } catch (e) {
        setError(e.message || "Failed to load domains");
        return [];
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect2(() => {
      load();
    }, [load]);
    useEffect2(() => {
      if (!detailDomainName) return;
      const exists = domains.some((domain) => domain.domain === detailDomainName);
      if (!exists) {
        setDetailDomainName("");
        setVerifyResult(null);
        setDetailError("");
        setCatchallDraft("");
      }
    }, [detailDomainName, domains]);
    const selectedDomain = useMemo3(
      () => domains.find((domain) => domain.domain === detailDomainName) || null,
      [detailDomainName, domains]
    );
    const availableCatchallTargets = useMemo3(
      () => identities.slice().sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.email.localeCompare(b.email)),
      [identities]
    );
    const openDomainDetails = useCallback2((domain, nextVerifyResult = null) => {
      const current = typeof domain === "string" ? domains.find((entry) => entry.domain === domain) || null : domain;
      if (!current?.domain) return;
      setDetailDomainName(current.domain);
      setVerifyResult(nextVerifyResult);
      setDetailError("");
      setCatchallDraft(current.catchallIdentityFP || "");
    }, [domains]);
    const closeDomainDetails = () => {
      if (verifyLoading || catchallLoading) return;
      setDetailDomainName("");
      setVerifyResult(null);
      setDetailError("");
      setCatchallDraft("");
    };
    const handleAdd = async (e) => {
      e.preventDefault();
      const d = String(newDomain || "").trim().toLowerCase().replace(/\.+$/, "");
      const validation = validateCustomDomainInput(d);
      setDomainFormError(validation);
      if (validation) return;
      setBusyAdd(true);
      setError("");
      try {
        const result = await window.ElvishMailManifest.addCustomDomain(d);
        const refreshed = await load();
        const fallbackDomain = normalizeCustomDomainRecord({
          domain: result.domain || d,
          status: "pending",
          dns_config: result?.dns_config,
          verification_txt_host: result?.dns_config?.verification_txt?.host,
          verification_txt_value: result?.dns_config?.verification_txt?.value
        });
        setNewDomain("");
        setShowAddModal(false);
        openDomainDetails(refreshed.find((domain) => domain.domain === fallbackDomain.domain) || fallbackDomain);
        showToast(`Added ${fallbackDomain.domain}. Publish the DNS records, then verify DNS.`, "ok");
      } catch (err) {
        setError(err.message || "Failed to add domain");
      } finally {
        setBusyAdd(false);
      }
    };
    const verifySelectedDomain = async () => {
      if (!selectedDomain?.domain) return;
      setVerifyLoading(true);
      setDetailError("");
      setError("");
      try {
        const result = await window.ElvishMailManifest.verifyCustomDomain(selectedDomain.domain);
        setVerifyResult(result);
        const refreshed = await load();
        openDomainDetails(selectedDomain.domain, result);
        const latest = refreshed.find((domain) => domain.domain === selectedDomain.domain);
        if (result.ready || customDomainIsReady(latest || selectedDomain)) {
          showToast(`${selectedDomain.domain} is ready to receive mail.`, "ok");
        } else {
          showToast(`DNS check finished for ${selectedDomain.domain}. Review the missing records.`, "err");
        }
      } catch (err) {
        const message = err.message || "Verify failed";
        setDetailError(message);
        setError(message);
        showToast(message, "err");
      } finally {
        setVerifyLoading(false);
      }
    };
    const saveCatchall = async () => {
      if (!selectedDomain?.domain) return;
      setCatchallLoading(true);
      setDetailError("");
      setError("");
      try {
        await window.ElvishMailManifest.setDomainCatchall(selectedDomain.domain, catchallDraft || null);
        await load();
        showToast(
          catchallDraft ? `Catch-all saved for ${selectedDomain.domain}.` : `Catch-all cleared for ${selectedDomain.domain}.`,
          "ok"
        );
      } catch (err) {
        const message = err.message || "Could not save catch-all";
        setDetailError(message);
        setError(message);
        showToast(message, "err");
      } finally {
        setCatchallLoading(false);
      }
    };
    const removeOne = (domain) => {
      setConfirmDelete(domain);
    };
    const executeRemoveDomain = async () => {
      setDeleteLoading(true);
      setError("");
      try {
        await window.ElvishMailManifest.deleteCustomDomain(confirmDelete);
        await load();
        if (detailDomainName === confirmDelete) closeDomainDetails();
        showToast(`Removed ${confirmDelete}.`, "ok");
        setConfirmDelete(null);
      } catch (err) {
        const message = err.message || "Delete failed";
        setError(message);
        showToast(message, "err");
      } finally {
        setDeleteLoading(false);
      }
    };
    const domainChecks = selectedDomain ? [
      domainCheckState(selectedDomain, verifyResult, "ownership", "Ownership TXT"),
      domainCheckState(selectedDomain, verifyResult, "mx", "MX"),
      domainCheckState(selectedDomain, verifyResult, "spf", "SPF"),
      domainCheckState(selectedDomain, verifyResult, "dkim", "DKIM"),
      domainCheckState(selectedDomain, verifyResult, "dmarc", "DMARC")
    ] : [];
    const dnsRecords = selectedDomain ? buildCustomDomainDNSRecords(selectedDomain, verifyResult) : [];
    const catchallDirty = selectedDomain && (selectedDomain.catchallIdentityFP || "") !== (catchallDraft || "");
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-header" }, /* @__PURE__ */ react_global_default.createElement("h2", null, "Custom Domains"), /* @__PURE__ */ react_global_default.createElement("p", null, "Use your own domain for email addresses")), !paid ? /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info", title: "Paid Feature" }, "Enable paid API features (operator sets ", /* @__PURE__ */ react_global_default.createElement("code", { className: "mono" }, "ELVISH_PAID_FEATURES=true"), ") or grant admin for testing.") : /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info", title: "DNS Workflow" }, "Add a domain, publish the ownership TXT and mail records shown in the setup modal, then run ", /* @__PURE__ */ react_global_default.createElement("strong", null, "Verify DNS"), " until the domain is ready."), error && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, error), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Your Domains",
        description: "Add and manage custom email domains.",
        actions: /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", size: "sm", onClick: () => setShowAddModal(true), disabled: !paid }, SettingsIcons.plus, " Add Domain")
      },
      loading ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-loading" }, "Loading domains...") : domains.length === 0 ? /* @__PURE__ */ react_global_default.createElement(
        EmptyState,
        {
          icon: "domains",
          title: "No custom domains",
          description: paid ? "Add a domain to start guided verification." : "Paid tier required."
        }
      ) : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-domains-list" }, domains.map((domain) => /* @__PURE__ */ react_global_default.createElement("div", { key: domain.domain, className: "settings-domain-item" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-domain-info" }, /* @__PURE__ */ react_global_default.createElement("div", null, /* @__PURE__ */ react_global_default.createElement("strong", null, domain.domain), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-domain-subtitle" }, customDomainIsReady(domain) ? "Ready to receive mail." : "DNS records still need attention.")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-domain-status" }, /* @__PURE__ */ react_global_default.createElement(Badge, { variant: customDomainStatusVariant(domain.status) }, customDomainStatusLabel(domain.status)))), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-domain-checks" }, /* @__PURE__ */ react_global_default.createElement("span", { className: domain.mxVerified ? "ok" : "pending" }, domain.mxVerified ? SettingsIcons.check : SettingsIcons.x, " MX"), /* @__PURE__ */ react_global_default.createElement("span", { className: domain.spfVerified ? "ok" : "pending" }, domain.spfVerified ? SettingsIcons.check : SettingsIcons.x, " SPF"), /* @__PURE__ */ react_global_default.createElement("span", { className: domain.dkimVerified ? "ok" : "pending" }, domain.dkimVerified ? SettingsIcons.check : SettingsIcons.x, " DKIM"), /* @__PURE__ */ react_global_default.createElement("span", { className: domain.dmarcVerified ? "ok" : "pending" }, domain.dmarcVerified ? SettingsIcons.check : SettingsIcons.x, " DMARC")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-filter-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", onClick: () => openDomainDetails(domain) }, customDomainIsReady(domain) ? "Manage" : "Setup & Verify"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "danger", size: "sm", onClick: () => removeOne(domain.domain) }, SettingsIcons.trash)))))
    ), /* @__PURE__ */ react_global_default.createElement(Modal, { open: showAddModal, onClose: () => !busyAdd && setShowAddModal(false), title: "Add Custom Domain" }, !paid ? /* @__PURE__ */ react_global_default.createElement(Alert, { type: "warning" }, "Paid subscription required.") : /* @__PURE__ */ react_global_default.createElement("form", { onSubmit: handleAdd }, domainFormError && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, domainFormError), /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Domain",
        value: newDomain,
        onChange: (e) => {
          setNewDomain(e.target.value);
          if (domainFormError) setDomainFormError("");
        },
        placeholder: "example.com",
        error: domainFormError,
        helperText: "Use the apex domain you control. Subdomains are not supported here."
      }
    ), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: () => setShowAddModal(false), disabled: busyAdd }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", type: "submit", loading: busyAdd }, "Add")))), /* @__PURE__ */ react_global_default.createElement(
      Modal,
      {
        open: !!selectedDomain,
        onClose: closeDomainDetails,
        title: selectedDomain ? `Domain Setup \xB7 ${selectedDomain.domain}` : "Domain Setup",
        size: "lg"
      },
      selectedDomain ? /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-modal" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-header" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-header-info" }, /* @__PURE__ */ react_global_default.createElement(Badge, { variant: customDomainStatusVariant(selectedDomain.status) }, customDomainStatusLabel(selectedDomain.status)), /* @__PURE__ */ react_global_default.createElement("p", { className: "domain-setup-header-desc" }, customDomainIsReady(selectedDomain) ? "This domain is ready to receive mail. Re-run verification anytime or adjust catch-all routing below." : "Publish the DNS records below at your provider, then click Verify DNS to check each one.")), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", onClick: verifySelectedDomain, loading: verifyLoading }, SettingsIcons.refresh, " Verify DNS")), /* @__PURE__ */ react_global_default.createElement(DomainSetupProgress, { checks: domainChecks }), detailError && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, detailError), verifyResult?.issues?.length > 0 && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "warning", title: "Issues found" }, /* @__PURE__ */ react_global_default.createElement("ul", { className: "domain-setup-issues" }, verifyResult.issues.map((issue) => /* @__PURE__ */ react_global_default.createElement("li", { key: issue }, issue)))), /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-records" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-records-header" }, /* @__PURE__ */ react_global_default.createElement("h4", null, "DNS Records"), /* @__PURE__ */ react_global_default.createElement("p", null, "Add these records at your DNS provider. Most providers need the Host and Value fields.")), /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-dns-record-list" }, dnsRecords.map((record) => /* @__PURE__ */ react_global_default.createElement(
        DomainDNSRecord,
        {
          key: record.id,
          record,
          onCopy: copyText
        }
      )))), customDomainIsReady(selectedDomain) && /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-catchall" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-catchall-header" }, /* @__PURE__ */ react_global_default.createElement("h4", null, "Catch-All Routing"), /* @__PURE__ */ react_global_default.createElement("p", null, "Route unmatched addresses to one of your identities.")), /* @__PURE__ */ react_global_default.createElement("div", { className: "domain-setup-catchall-controls" }, /* @__PURE__ */ react_global_default.createElement(
        "select",
        {
          className: "settings-select",
          value: catchallDraft,
          onChange: (e) => setCatchallDraft(e.target.value),
          disabled: catchallLoading
        },
        /* @__PURE__ */ react_global_default.createElement("option", { value: "" }, "Disabled"),
        availableCatchallTargets.map((identity) => /* @__PURE__ */ react_global_default.createElement("option", { key: identity.fingerprint, value: identity.fingerprint }, identity.email, identity.isDefault ? " (default)" : ""))
      ), /* @__PURE__ */ react_global_default.createElement(
        Button,
        {
          variant: "secondary",
          onClick: saveCatchall,
          loading: catchallLoading,
          disabled: !catchallDirty
        },
        "Save"
      ))), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: closeDomainDetails, disabled: verifyLoading || catchallLoading }, "Done"))) : null
    ), /* @__PURE__ */ react_global_default.createElement(
      ConfirmModal,
      {
        open: !!confirmDelete,
        onClose: () => !deleteLoading && setConfirmDelete(null),
        onConfirm: executeRemoveDomain,
        title: "Remove Domain",
        message: `Are you sure you want to remove the domain "${confirmDelete}"? This will stop receiving emails for this domain.`,
        confirmLabel: "Remove Domain",
        confirmVariant: "danger",
        loading: deleteLoading
      }
    ), /* @__PURE__ */ react_global_default.createElement(SettingsToast, { toast, onClose: () => setToast(null) }));
  }
  function GpgIdentityKeyRow({ k, showDefaultBadge, vaultUnlocked }) {
    const [exportPrivateOpen, setExportPrivateOpen] = useState3(false);
    const [exportPassphrase, setExportPassphrase] = useState3(false);
    const [pass1, setPass1] = useState3("");
    const [pass2, setPass2] = useState3("");
    const [exportBusy, setExportBusy] = useState3(false);
    const [exportErr, setExportErr] = useState3("");
    const exportPublic = () => {
      const txt = k.armoredPublic || "";
      if (!txt) return;
      const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `public-${(k.email || "key").replace(/@/g, "_at_")}.asc`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    const closePrivateModal = () => {
      setExportPrivateOpen(false);
      setExportErr("");
      setExportPassphrase(false);
      setPass1("");
      setPass2("");
    };
    const downloadPrivateKey = async () => {
      setExportErr("");
      if (!window.ElvishKeyVault || typeof window.ElvishKeyVault.exportIdentityPrivateKeyArmored !== "function") {
        setExportErr("Key vault is not available.");
        return;
      }
      if (!window.ElvishKeyVault.isUnlocked()) {
        setExportErr("Unlock your keys from the mail unlock dialog first.");
        return;
      }
      if (exportPassphrase) {
        if (pass1 !== pass2) {
          setExportErr("Passphrases do not match.");
          return;
        }
        if (pass1.trim().length < 8) {
          setExportErr("Passphrase must be at least 8 characters.");
          return;
        }
      }
      setExportBusy(true);
      try {
        const passphrase = exportPassphrase ? pass1 : "";
        const armored = await window.ElvishKeyVault.exportIdentityPrivateKeyArmored(k.keyId, { passphrase });
        const slug = (k.email || "key").replace(/@/g, "_at_");
        const suffix = exportPassphrase ? "-private-encrypted.asc" : "-private.asc";
        const blob = new Blob([armored], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${slug}${suffix}`;
        a.click();
        URL.revokeObjectURL(a.href);
        closePrivateModal();
      } catch (e) {
        setExportErr(e && e.message || "Export failed");
      } finally {
        setExportBusy(false);
      }
    };
    const vaultLocked = !vaultUnlocked;
    return /* @__PURE__ */ react_global_default.createElement("div", { className: `settings-key-item ${vaultLocked ? "is-locked" : ""}` }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-key-icon" }, SettingsIcons.identities), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-key-info" }, /* @__PURE__ */ react_global_default.createElement("strong", null, k.email), /* @__PURE__ */ react_global_default.createElement("code", null, k.keyId), /* @__PURE__ */ react_global_default.createElement("span", { className: "dim" }, k.algorithm, " \xB7 ", k.bits, " bits \xB7 ", new Date(k.createdAt).toLocaleDateString())), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-key-badges" }, /* @__PURE__ */ react_global_default.createElement(Badge, { variant: k.isActive ? "success" : "muted" }, k.isActive ? "Active" : "Inactive"), showDefaultBadge && k.isDefault && /* @__PURE__ */ react_global_default.createElement(Badge, { variant: "accent" }, "Default"), vaultLocked && /* @__PURE__ */ react_global_default.createElement(Badge, { variant: "warning" }, "Vault locked")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-key-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", title: "Download armored public key", onClick: exportPublic }, SettingsIcons.download, " Public"), /* @__PURE__ */ react_global_default.createElement(
      Button,
      {
        variant: "secondary",
        size: "sm",
        title: vaultLocked ? "Unlock the vault to export" : "Export private key (.asc)",
        onClick: () => vaultLocked ? null : setExportPrivateOpen(true),
        disabled: vaultLocked
      },
      SettingsIcons.download,
      " Private"
    )), /* @__PURE__ */ react_global_default.createElement(Modal, { open: exportPrivateOpen, onClose: () => !exportBusy && closePrivateModal(), title: "Export identity private key" }, /* @__PURE__ */ react_global_default.createElement(Alert, { type: "warning", title: "Sensitive material" }, "Anyone with this file can read mail encrypted to this address. Prefer a passphrase-protected file if you copy it off this device."), /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "The account master key is not exportable. This file is only for this identity (", k.email, ")."), /* @__PURE__ */ react_global_default.createElement(
      Toggle,
      {
        checked: exportPassphrase,
        onChange: (v) => {
          setExportPassphrase(v);
          setExportErr("");
        },
        label: "Protect with passphrase (OpenPGP / GnuPG\u2013compatible)"
      }
    ), exportPassphrase && /* @__PURE__ */ react_global_default.createElement(react_global_default.Fragment, null, /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Passphrase",
        type: "password",
        value: pass1,
        onChange: (e) => setPass1(e.target.value),
        placeholder: "At least 8 characters"
      }
    ), /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Confirm passphrase",
        type: "password",
        value: pass2,
        onChange: (e) => setPass2(e.target.value),
        placeholder: "Repeat passphrase"
      }
    )), exportErr && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, exportErr), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: closePrivateModal, disabled: exportBusy }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", type: "button", onClick: downloadPrivateKey, loading: exportBusy }, SettingsIcons.download, " Download"))));
  }
  function GPGKeysSection() {
    const [keys, setKeys] = useState3([]);
    const [accountKey, setAccountKey] = useState3(null);
    const [vaultUnlocked, setVaultUnlocked] = useState3(
      () => !!(typeof window !== "undefined" && window.ElvishKeyVault && window.ElvishKeyVault.isUnlocked && window.ElvishKeyVault.isUnlocked())
    );
    const [loading, setLoading] = useState3(true);
    const [error, setError] = useState3("");
    const [showInfo, setShowInfo] = useState3(false);
    const [showImportModal, setShowImportModal] = useState3(false);
    useEffect2(() => {
      const tick = () => {
        try {
          setVaultUnlocked(!!(window.ElvishKeyVault && window.ElvishKeyVault.isUnlocked && window.ElvishKeyVault.isUnlocked()));
        } catch (_) {
          setVaultUnlocked(false);
        }
      };
      tick();
      const id = setInterval(tick, 1500);
      return () => clearInterval(id);
    }, []);
    const longLivedKeys = useMemo3(
      () => keys.filter((k) => !looksLikeDisposableIdentity(k.email, k.type)),
      [keys]
    );
    const disposableKeys = useMemo3(
      () => keys.filter((k) => looksLikeDisposableIdentity(k.email, k.type)),
      [keys]
    );
    const loadKeys = useCallback2(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await window.ElvishMailManifest.listIdentities();
        const ids = result.identities || [];
        setKeys(ids.map((i) => ({
          keyId: i.fingerprint,
          email: i.email,
          type: i.type,
          algorithm: i.algorithm,
          bits: i.bits,
          isActive: i.is_active,
          isDefault: i.is_default,
          createdAt: i.created_at,
          armoredPublic: i.armored_public || ""
        })));
        setAccountKey({
          keyId: "ACCOUNT-KEY"
        });
      } catch (e) {
        setError(e.message || "Failed to load keys");
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect2(() => {
      loadKeys();
    }, [loadKeys]);
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-header" }, /* @__PURE__ */ react_global_default.createElement("h2", null, "GPG Keys"), /* @__PURE__ */ react_global_default.createElement("p", null, "Manage your encryption keys for secure email")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", onClick: () => setShowInfo(!showInfo) }, SettingsIcons.info, " ", showInfo ? "Hide" : "Show", " Info"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", onClick: () => setShowImportModal(true) }, SettingsIcons.upload, " Import Key")), showInfo && /* @__PURE__ */ react_global_default.createElement(Card, null, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-keys-info" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-keys-info-item" }, /* @__PURE__ */ react_global_default.createElement("strong", null, SettingsIcons.keys, " Account Key"), /* @__PURE__ */ react_global_default.createElement("p", null, "Master key encrypted with your password. Used to encrypt/decrypt all identity keys. Its private half is not exportable.")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-keys-info-item" }, /* @__PURE__ */ react_global_default.createElement("strong", null, SettingsIcons.identities, " Identity Keys"), /* @__PURE__ */ react_global_default.createElement("p", null, "Individual GPG keys for each long-lived email identity, encrypted to your account key.")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-keys-info-item" }, /* @__PURE__ */ react_global_default.createElement("strong", null, SettingsIcons.identities, " Disposable Addresses"), /* @__PURE__ */ react_global_default.createElement("p", null, "Temporary addresses get their own keys; they expire and can be removed like other identities.")), /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "Keys are generated and encrypted client-side in your browser. You can download identity private keys here for GnuPG or other tools; optional passphrase protection uses standard OpenPGP key encryption."))), error && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, error), accountKey && /* @__PURE__ */ react_global_default.createElement(Card, { className: !vaultUnlocked ? "settings-card-warning" : "" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-key-item account-key" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-key-icon" }, SettingsIcons.keys), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-key-info" }, /* @__PURE__ */ react_global_default.createElement("strong", null, "Account Key"), /* @__PURE__ */ react_global_default.createElement(Badge, { variant: !vaultUnlocked ? "warning" : "success" }, !vaultUnlocked ? "Locked" : "Unlocked")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-key-warning dim", style: { marginTop: 8 } }, "The account private key cannot be exported. Identity keys below can be exported when the vault is unlocked."), !vaultUnlocked && /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-key-warning" }, "Unlock your vault to use encryption features."))), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Identity Keys",
        description: "GPG keys for your primary addresses and aliases (not disposable addresses)."
      },
      loading ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-loading" }, "Loading keys...") : longLivedKeys.length === 0 ? /* @__PURE__ */ react_global_default.createElement(
        EmptyState,
        {
          icon: "keys",
          title: "No identity keys",
          description: "Keys are created automatically when you create an identity."
        }
      ) : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-keys-list" }, longLivedKeys.map((k) => /* @__PURE__ */ react_global_default.createElement(GpgIdentityKeyRow, { key: k.keyId, k, showDefaultBadge: true, vaultUnlocked })))
    ), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Disposable Addresses",
        description: "GPG keys for temporary disposable addresses (they expire automatically)."
      },
      loading ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-loading" }, "Loading keys...") : disposableKeys.length === 0 ? /* @__PURE__ */ react_global_default.createElement(
        EmptyState,
        {
          icon: "keys",
          title: "No disposable keys",
          description: "Create a disposable address under Identities to get a key for it."
        }
      ) : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-keys-list" }, disposableKeys.map((k) => /* @__PURE__ */ react_global_default.createElement(GpgIdentityKeyRow, { key: k.keyId, k, showDefaultBadge: false, vaultUnlocked })))
    ), /* @__PURE__ */ react_global_default.createElement(Modal, { open: showImportModal, onClose: () => setShowImportModal(false), title: "Import GPG Key" }, /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "Paste your GPG key (private or public) below. The key will be encrypted with your password before being stored."), /* @__PURE__ */ react_global_default.createElement(Alert, { type: "warning" }, "Key import is an advanced feature. Imported keys must be compatible with OpenPGP.js."), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", onClick: () => setShowImportModal(false) }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", disabled: true }, "Import Key"))));
  }
  function SMTPSubmissionSection({ onGoToIdentities }) {
    const [credentials, setCredentials] = useState3([]);
    const [identities, setIdentities] = useState3([]);
    const [loading, setLoading] = useState3(true);
    const [error, setError] = useState3("");
    const [showCreateModal, setShowCreateModal] = useState3(false);
    const [paid, setPaid] = useState3(false);
    const [credName, setCredName] = useState3("");
    const [credFp, setCredFp] = useState3("");
    const [busy, setBusy] = useState3(false);
    const [confirmAction, setConfirmAction] = useState3(null);
    const [actionLoading, setActionLoading] = useState3(false);
    const [showCredentials, setShowCredentials] = useState3(null);
    const smtpHost = typeof window !== "undefined" ? window.location.hostname : "";
    const sendingIdentities = useMemo3(() => {
      const raw = identities || [];
      const rows = raw.filter((i) => i.is_active !== false).map((i) => ({
        email: String(i.email || "").trim(),
        fingerprint: String(i.fingerprint || "").trim().toUpperCase(),
        isDefault: !!i.is_default,
        type: i.type
      })).filter((i) => i.fingerprint && i.email);
      rows.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.email.localeCompare(b.email));
      return rows;
    }, [identities]);
    const identityEmailByFp = useMemo3(() => {
      const m = /* @__PURE__ */ new Map();
      for (const i of sendingIdentities) {
        m.set(i.fingerprint, i.email);
      }
      return m;
    }, [sendingIdentities]);
    const load = useCallback2(async () => {
      setLoading(true);
      setError("");
      try {
        const b = await window.ElvishMailManifest.getBillingStatus();
        setPaid(!!b.paid);
        if (!b.paid) {
          setCredentials([]);
          setIdentities([]);
          return;
        }
        const [credRes, idRes] = await Promise.allSettled([
          window.ElvishMailManifest.listSMTPCredentials(),
          window.ElvishMailManifest.listIdentities()
        ]);
        if (credRes.status !== "fulfilled") throw credRes.reason;
        const raw = credRes.value.credentials || [];
        setCredentials(raw.map((c) => ({
          id: c.id,
          name: c.name,
          username: c.username,
          identityFingerprint: String(c.identity_fingerprint ?? c.identityFingerprint ?? "").trim().toUpperCase(),
          identityEmail: String(c.identity_email ?? c.email ?? "").trim()
        })));
        if (idRes.status === "fulfilled") {
          setIdentities(idRes.value.identities || []);
        } else {
          setIdentities([]);
        }
      } catch (e) {
        setError(e.message || "Failed to load SMTP credentials");
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect2(() => {
      load();
    }, [load]);
    const openCreateModal = useCallback2(() => {
      setError("");
      const list = sendingIdentities;
      const def = list.find((i) => i.isDefault) || list[0];
      setCredFp(def ? def.fingerprint : "");
      setCredName("");
      setShowCreateModal(true);
    }, [sendingIdentities]);
    const createCred = async (e) => {
      e.preventDefault();
      if (!credName.trim() || !credFp.trim()) return;
      setBusy(true);
      setError("");
      try {
        const r = await window.ElvishMailManifest.createSMTPCredential({
          name: credName.trim(),
          identity_fingerprint: credFp.trim()
        });
        const pw = r.credential && r.credential.password;
        const user = r.credential && r.credential.username;
        setShowCredentials({ username: user, password: pw, isNew: true });
        setCredName("");
        setCredFp("");
        setShowCreateModal(false);
        await load();
      } catch (err) {
        setError(err.message || "Create failed");
      } finally {
        setBusy(false);
      }
    };
    const regenerate = (id) => {
      setConfirmAction({ type: "regenerate", id });
    };
    const executeRegenerate = async () => {
      setActionLoading(true);
      try {
        const r = await window.ElvishMailManifest.regenerateSMTPCredential(confirmAction.id);
        setShowCredentials({ username: r.username, password: r.password, isNew: false });
        setConfirmAction(null);
        await load();
      } catch (err) {
        setError(err.message || "Regenerate failed");
      } finally {
        setActionLoading(false);
      }
    };
    const remove = (id) => {
      setConfirmAction({ type: "delete", id });
    };
    const executeRemove = async () => {
      setActionLoading(true);
      try {
        await window.ElvishMailManifest.deleteSMTPCredential(confirmAction.id);
        setConfirmAction(null);
        await load();
      } catch (err) {
        setError(err.message || "Delete failed");
      } finally {
        setActionLoading(false);
      }
    };
    const resolveCredentialSendAs = (c) => {
      if (c.identityEmail) return c.identityEmail;
      return identityEmailByFp.get(c.identityFingerprint) || "";
    };
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-header" }, /* @__PURE__ */ react_global_default.createElement("h2", null, "SMTP submission"), /* @__PURE__ */ react_global_default.createElement("p", null, "Connect Apple Mail, Thunderbird, Outlook, or any client that supports authenticated SMTP.")), !paid ? /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info", title: "Paid feature" }, "SMTP submission requires paid API access (operator env ", /* @__PURE__ */ react_global_default.createElement("code", { className: "mono" }, "ELVISH_PAID_FEATURES"), ").") : null, error && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, error), /* @__PURE__ */ react_global_default.createElement(
      Card,
      {
        title: "Mail client setup",
        description: "Each credential is a generated login. Submission is always bound to one sending identity so outbound mail uses the correct From address and key material.",
        actions: /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", size: "sm", onClick: openCreateModal, disabled: !paid }, SettingsIcons.plus, " Create credential")
      },
      /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-smtp-conn" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-smtp-conn-block" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-smtp-conn-label" }, "Submission host"), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-domain-copy-value" }, /* @__PURE__ */ react_global_default.createElement("code", null, smtpHost || "your-mail-host"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", type: "button", title: "Copy hostname", onClick: () => copyText(smtpHost) }, SettingsIcons.copy, " Copy"))), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-smtp-conn-block" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-smtp-conn-label" }, "Ports & encryption"), /* @__PURE__ */ react_global_default.createElement("ul", { className: "settings-smtp-port-list" }, /* @__PURE__ */ react_global_default.createElement("li", null, /* @__PURE__ */ react_global_default.createElement("code", null, "587"), " \u2014 STARTTLS (recommended for most clients)"), /* @__PURE__ */ react_global_default.createElement("li", null, /* @__PURE__ */ react_global_default.createElement("code", null, "465"), " \u2014 implicit TLS (SSL/TLS)"))), /* @__PURE__ */ react_global_default.createElement("p", { className: "settings-smtp-hint" }, "Use normal password (PLAIN/LOGIN) after STARTTLS on 587, or SSL on 465. Your client encrypts the tunnel; message bodies follow your identity's OpenPGP settings for storage and delivery.")),
      loading ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-loading" }, "Loading credentials\u2026") : credentials.length === 0 ? /* @__PURE__ */ react_global_default.createElement(
        EmptyState,
        {
          icon: "smtp",
          title: "No SMTP credentials yet",
          description: paid ? "Create a credential, then paste the generated username and password into your mail app." : "Paid tier required."
        }
      ) : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-credentials-list" }, credentials.map((c) => {
        const sendAs = resolveCredentialSendAs(c);
        return /* @__PURE__ */ react_global_default.createElement("div", { key: c.id, className: "settings-credential-item" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-credential-info" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-credential-title" }, c.name), sendAs ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-credential-sendas" }, "Sends as ", /* @__PURE__ */ react_global_default.createElement("strong", null, sendAs)) : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-credential-sendas dim" }, "Identity ", /* @__PURE__ */ react_global_default.createElement("span", { className: "mono", title: c.identityFingerprint }, c.identityFingerprint), " (add or restore this address under Identities)"), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-domain-copy-value settings-credential-user-row" }, /* @__PURE__ */ react_global_default.createElement("code", null, c.username), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", type: "button", title: "Copy username", onClick: () => copyText(c.username) }, SettingsIcons.copy))), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-credential-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", onClick: () => regenerate(c.id) }, SettingsIcons.refresh, " Regenerate"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "danger", size: "sm", onClick: () => remove(c.id), title: "Delete credential" }, SettingsIcons.trash)));
      }))
    ), /* @__PURE__ */ react_global_default.createElement(Modal, { open: showCreateModal, onClose: () => !busy && setShowCreateModal(false), title: "Create SMTP credential" }, !paid ? /* @__PURE__ */ react_global_default.createElement(Alert, { type: "warning" }, "Paid subscription required.") : /* @__PURE__ */ react_global_default.createElement("form", { onSubmit: createCred }, /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "Pick which address this app will send as. You can create separate credentials per device; each can use a different identity if you need that."), /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        label: "Label",
        value: credName,
        onChange: (e) => setCredName(e.target.value),
        placeholder: "e.g. MacBook Thunderbird",
        helperText: "Shown only in settings \u2014 your mail app never sees this."
      }
    ), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-input-group" }, /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-label", htmlFor: "smtp-create-identity" }, "Sending identity"), /* @__PURE__ */ react_global_default.createElement(
      "select",
      {
        id: "smtp-create-identity",
        className: "settings-select",
        value: credFp,
        onChange: (e) => setCredFp(e.target.value),
        required: true
      },
      sendingIdentities.length === 0 ? /* @__PURE__ */ react_global_default.createElement("option", { value: "" }, "No active identities") : sendingIdentities.map((i) => /* @__PURE__ */ react_global_default.createElement("option", { key: i.fingerprint, value: i.fingerprint }, i.email, i.isDefault ? " \u2014 default" : ""))
    ), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-helper" }, sendingIdentities.length === 0 && onGoToIdentities ? /* @__PURE__ */ react_global_default.createElement("span", null, "Create an address under", " ", /* @__PURE__ */ react_global_default.createElement("button", { type: "button", className: "settings-inline-link", onClick: () => {
      setShowCreateModal(false);
      onGoToIdentities();
    } }, "Identities"), ", then return here.") : "Outbound mail uses this identity\u2019s From address and signing key.")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: () => setShowCreateModal(false), disabled: busy }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(
      Button,
      {
        variant: "primary",
        type: "submit",
        loading: busy,
        disabled: !credName.trim() || !credFp.trim() || sendingIdentities.length === 0
      },
      "Create"
    )))), /* @__PURE__ */ react_global_default.createElement(
      ConfirmModal,
      {
        open: confirmAction?.type === "regenerate",
        onClose: () => !actionLoading && setConfirmAction(null),
        onConfirm: executeRegenerate,
        title: "Regenerate password",
        message: "The current SMTP password stops working immediately. Update every device that uses this credential.",
        confirmLabel: "Regenerate",
        confirmVariant: "primary",
        loading: actionLoading
      }
    ), /* @__PURE__ */ react_global_default.createElement(
      ConfirmModal,
      {
        open: confirmAction?.type === "delete",
        onClose: () => !actionLoading && setConfirmAction(null),
        onConfirm: executeRemove,
        title: "Delete SMTP credential",
        message: "Mail apps using this username/password will stop sending. This cannot be undone.",
        confirmLabel: "Delete",
        confirmVariant: "danger",
        loading: actionLoading
      }
    ), /* @__PURE__ */ react_global_default.createElement(Modal, { open: !!showCredentials, onClose: () => setShowCredentials(null), title: showCredentials?.isNew ? "Credential created" : "New password" }, /* @__PURE__ */ react_global_default.createElement(Alert, { type: "warning", title: "Save these values now" }, "The password is shown only once. Store it in a password manager or your client's saved passwords."), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-smtp-reveal-fields" }, /* @__PURE__ */ react_global_default.createElement(Input2, { label: "Username", value: showCredentials?.username || "", disabled: true }), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-domain-copy-value" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", type: "button", onClick: () => copyText(showCredentials?.username || "") }, SettingsIcons.copy, " Copy username")), /* @__PURE__ */ react_global_default.createElement(Input2, { label: "Password", value: showCredentials?.password || "", disabled: true }), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-domain-copy-value" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", size: "sm", type: "button", onClick: () => copyText(showCredentials?.password || "") }, SettingsIcons.copy, " Copy password"))), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", onClick: () => setShowCredentials(null) }, "Done"))));
  }
  function PrivacyConsentSection() {
    const [mailOpt, setMailOpt] = useState3({
      auto_encrypt_inbound: true,
      wkd_publish: true,
      attach_public_key_default: false,
      keyvault_idle_min: 15,
      retention_setup_completed: false
    });
    const [retentionDays, setRetentionDays] = useState3({ ...DEFAULT_RETENTION_DAYS });
    const [loading, setLoading] = useState3(true);
    const [error, setError] = useState3("");
    const loadConsent = useCallback2(async () => {
      setLoading(true);
      setError("");
      try {
        const s = await window.ElvishMailManifest.getMailSettings();
        const st = s.settings || {};
        const retention = s.retention_days || {};
        setMailOpt({
          auto_encrypt_inbound: st.auto_encrypt_inbound !== false,
          wkd_publish: st.wkd_publish !== false,
          attach_public_key_default: !!st.attach_public_key_default,
          keyvault_idle_min: typeof st.keyvault_idle_min === "number" && st.keyvault_idle_min > 0 ? st.keyvault_idle_min : 15,
          retention_setup_completed: !!st.retention_setup_completed
        });
        setRetentionDays({
          inbox: typeof retention.inbox === "number" && retention.inbox > 0 ? retention.inbox : null,
          sent: typeof retention.sent === "number" && retention.sent > 0 ? retention.sent : null,
          trash: typeof retention.trash === "number" && retention.trash > 0 ? retention.trash : null,
          archive: typeof retention.archive === "number" && retention.archive > 0 ? retention.archive : null
        });
      } catch (e) {
        setError(e.message || "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect2(() => {
      loadConsent();
    }, [loadConsent]);
    const saveMailBehaviour = async (patch) => {
      const next = { ...mailOpt, ...patch };
      setMailOpt(next);
      try {
        await window.ElvishMailManifest.setMailSettings({
          auto_encrypt_inbound: next.auto_encrypt_inbound,
          wkd_publish: next.wkd_publish,
          attach_public_key_default: !!next.attach_public_key_default,
          keyvault_idle_min: next.keyvault_idle_min,
          retention_setup_completed: !!next.retention_setup_completed
        });
      } catch (e) {
        setError(e.message || "Failed to save mail settings");
        await loadConsent();
      }
    };
    const saveRetention = async (nextRetention) => {
      setRetentionDays(nextRetention);
      try {
        await window.ElvishMailManifest.setMailSettings({
          retention_days: nextRetention,
          retention_setup_completed: true
        });
        setMailOpt((prev) => ({ ...prev, retention_setup_completed: true }));
      } catch (e) {
        setError(e.message || "Failed to save retention policy");
        await loadConsent();
      }
    };
    const setFolderRetention = (folder, enabled, fallbackDays) => {
      const next = { ...retentionDays };
      next[folder] = enabled ? next[folder] || fallbackDays || 30 : null;
      saveRetention(next);
    };
    const updateFolderRetentionDays = (folder, value) => {
      const n = parseInt(value, 10);
      if (!Number.isFinite(n) || n < 1) return;
      saveRetention({ ...retentionDays, [folder]: n });
    };
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-header" }, /* @__PURE__ */ react_global_default.createElement("h2", null, "Mail & privacy"), /* @__PURE__ */ react_global_default.createElement("p", null, "Mail behaviour, retention, keys, and account-related preferences")), error && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, error), /* @__PURE__ */ react_global_default.createElement(Card, { title: "Mail behaviour", description: "Inbound encryption, key directory, and compose defaults." }, loading ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-loading" }, "Loading...") : /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-consent-grid" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-consent-row" }, /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-consent-toggle" }, /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        type: "checkbox",
        checked: true,
        disabled: true,
        readOnly: true
      }
    ), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-label" }, "Inbound SMTP encryption")), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-help" }, "Plaintext inbound SMTP is gateway-encrypted to your keys automatically before it is stored.")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-consent-row" }, /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-consent-toggle" }, /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        type: "checkbox",
        checked: !!mailOpt.wkd_publish,
        onChange: (e) => saveMailBehaviour({ wkd_publish: e.target.checked })
      }
    ), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-label" }, "WKD publish")), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-help" }, "Publish public keys for Web Key Directory discovery.")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-consent-row" }, /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-consent-toggle" }, /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        type: "checkbox",
        checked: !!mailOpt.attach_public_key_default,
        onChange: (e) => saveMailBehaviour({ attach_public_key_default: e.target.checked })
      }
    ), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-label" }, "Attach my public key (OpenPGP sends)")), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-help" }, "When enabled, new compose sessions default to attaching your identity public key as ", /* @__PURE__ */ react_global_default.createElement("code", null, "public-\u2026asc"), " on OpenPGP-direct sends. You can still turn it off per message.")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-consent-row" }, /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-consent-label" }, "Key vault idle timeout (minutes)"), /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        type: "number",
        min: 1,
        max: 1440,
        className: "settings-input",
        style: { maxWidth: 120 },
        value: mailOpt.keyvault_idle_min,
        onChange: (e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isFinite(n) || n < 1) return;
          saveMailBehaviour({ keyvault_idle_min: n });
        }
      }
    )))), /* @__PURE__ */ react_global_default.createElement(Card, { title: "Message retention", description: "Automatically delete mail after a chosen number of days for each folder." }, loading ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-loading" }, "Loading...") : /* @__PURE__ */ react_global_default.createElement(react_global_default.Fragment, null, /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "Secure defaults: Inbox off, Archive off, Sent 30 days, Trash 30 days. Changes here update future retention sweeps for this account."), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-consent-grid" }, [
      { id: "inbox", label: "Inbox", help: "Disabled by default. Enable if you want inbox mail to expire automatically.", fallbackDays: 30 },
      { id: "sent", label: "Sent", help: "Defaults to 30 days so app-authored mail is not retained forever.", fallbackDays: 30 },
      { id: "trash", label: "Trash", help: "Defaults to 30 days before permanent deletion.", fallbackDays: 30 },
      { id: "archive", label: "Archive", help: "Disabled by default so archived mail is retained until you choose otherwise.", fallbackDays: 30 }
    ].map((item) => {
      const enabled = typeof retentionDays[item.id] === "number" && retentionDays[item.id] > 0;
      return /* @__PURE__ */ react_global_default.createElement("div", { key: item.id, className: "settings-consent-row" }, /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-consent-toggle" }, /* @__PURE__ */ react_global_default.createElement(
        "input",
        {
          type: "checkbox",
          checked: enabled,
          onChange: (e) => setFolderRetention(item.id, e.target.checked, item.fallbackDays)
        }
      ), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-label" }, item.label)), /* @__PURE__ */ react_global_default.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } }, /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-help" }, item.help), /* @__PURE__ */ react_global_default.createElement(
        "input",
        {
          type: "number",
          min: 1,
          max: 3650,
          className: "settings-input",
          style: { maxWidth: 120 },
          value: enabled ? retentionDays[item.id] : "",
          disabled: !enabled,
          placeholder: "days",
          onChange: (e) => updateFolderRetentionDays(item.id, e.target.value)
        }
      )));
    })))), /* @__PURE__ */ react_global_default.createElement(Card, { title: "Trusted contacts", description: "Per-user OpenPGP keys used for trusted signature badges and compose. WKD/HKPS hits are not trusted until you save a key here or tap Trust on a message." }, /* @__PURE__ */ react_global_default.createElement(ContactsManager, null)), /* @__PURE__ */ react_global_default.createElement(Card, { title: "Recipient Key Lookup", description: "Test the keyserver chain for an email address." }, /* @__PURE__ */ react_global_default.createElement(RecipientLookup, null)));
  }
  function ContactsManager() {
    const [rows, setRows] = useState3([]);
    const [loading, setLoading] = useState3(true);
    const [err, setErr] = useState3("");
    const [addEmail, setAddEmail] = useState3("");
    const [addArmored, setAddArmored] = useState3("");
    const [addBusy, setAddBusy] = useState3(false);
    const load = useCallback2(async () => {
      if (!window.ElvishMailManifest || typeof window.ElvishMailManifest.listContactKeys !== "function") {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErr("");
      try {
        const r = await window.ElvishMailManifest.listContactKeys();
        setRows(Array.isArray(r.contacts) ? r.contacts : []);
      } catch (e) {
        setErr(e && e.message || String(e));
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect2(() => {
      void load();
    }, [load]);
    const onDelete = async (email, fingerprint) => {
      if (!window.ElvishMailManifest || typeof window.ElvishMailManifest.deleteContactKey !== "function") return;
      try {
        await window.ElvishMailManifest.deleteContactKey(email, fingerprint);
        await load();
      } catch (e) {
        setErr(e && e.message || String(e));
      }
    };
    const onAdd = async () => {
      const em = addEmail.trim().toLowerCase();
      const arm = addArmored.trim();
      if (!em || !arm) return;
      setAddBusy(true);
      setErr("");
      try {
        await window.ElvishMailManifest.putContactKey({
          email: em,
          armoredPublic: arm,
          source: "settings",
          trusted: true
        });
        setAddEmail("");
        setAddArmored("");
        await load();
      } catch (e) {
        setErr(e && e.message || String(e));
      } finally {
        setAddBusy(false);
      }
    };
    return /* @__PURE__ */ react_global_default.createElement("div", null, /* @__PURE__ */ react_global_default.createElement(Alert, { type: "info" }, "Only keys stored here (or via ", /* @__PURE__ */ react_global_default.createElement("strong", null, "Trust sender key"), " on a message) count as trusted for the green signer badge."), err ? /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, err) : null, loading ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-loading" }, "Loading...") : /* @__PURE__ */ react_global_default.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ react_global_default.createElement("table", { className: "settings-table", style: { width: "100%", fontSize: 13 } }, /* @__PURE__ */ react_global_default.createElement("thead", null, /* @__PURE__ */ react_global_default.createElement("tr", null, /* @__PURE__ */ react_global_default.createElement("th", null, "Email"), /* @__PURE__ */ react_global_default.createElement("th", null, "Fingerprint (suffix)"), /* @__PURE__ */ react_global_default.createElement("th", null, "Trusted"), /* @__PURE__ */ react_global_default.createElement("th", null, "Source"), /* @__PURE__ */ react_global_default.createElement("th", { style: { width: 100 } }))), /* @__PURE__ */ react_global_default.createElement("tbody", null, rows.length === 0 ? /* @__PURE__ */ react_global_default.createElement("tr", null, /* @__PURE__ */ react_global_default.createElement("td", { colSpan: 5, className: "dim" }, "No saved contacts.")) : rows.map((c) => /* @__PURE__ */ react_global_default.createElement("tr", { key: `${c.email}-${c.fingerprint}` }, /* @__PURE__ */ react_global_default.createElement("td", null, /* @__PURE__ */ react_global_default.createElement("code", null, c.email)), /* @__PURE__ */ react_global_default.createElement("td", { className: "mono dim", title: c.fingerprint }, (c.fingerprint || "").slice(-16).toUpperCase()), /* @__PURE__ */ react_global_default.createElement("td", null, c.trusted ? /* @__PURE__ */ react_global_default.createElement(Badge, { variant: "success" }, "yes") : /* @__PURE__ */ react_global_default.createElement(Badge, { variant: "muted" }, "no")), /* @__PURE__ */ react_global_default.createElement("td", { className: "dim", style: { maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }, title: c.source || "" }, c.source || "\u2014"), /* @__PURE__ */ react_global_default.createElement("td", null, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "danger", size: "sm", onClick: () => onDelete(c.email, c.fingerprint) }, "Remove"))))))), /* @__PURE__ */ react_global_default.createElement("div", { style: { marginTop: 20, display: "flex", flexDirection: "column", gap: 12 } }, /* @__PURE__ */ react_global_default.createElement("p", { className: "dim", style: { margin: 0, fontSize: 13 } }, "Add a contact by pasting their armored public key. It is stored as trusted immediately."), /* @__PURE__ */ react_global_default.createElement(Input2, { label: "Email", type: "email", value: addEmail, onChange: (e) => setAddEmail(e.target.value), placeholder: "peer@example.com" }), /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-field" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-field-label" }, "Armored public key"), /* @__PURE__ */ react_global_default.createElement(
      "textarea",
      {
        className: "settings-input",
        rows: 6,
        value: addArmored,
        onChange: (e) => setAddArmored(e.target.value),
        placeholder: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n...\n-----END PGP PUBLIC KEY BLOCK-----",
        style: { width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }
      }
    )), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "primary", onClick: onAdd, disabled: addBusy || !addEmail.trim() || !addArmored.trim(), loading: addBusy }, "Save as trusted")));
  }
  function RecipientLookup() {
    const [email, setEmail] = useState3("");
    const [hit, setHit] = useState3(null);
    const [err, setErr] = useState3("");
    const [busy, setBusy] = useState3(false);
    const onLookup = async () => {
      if (!email) return;
      setBusy(true);
      setErr("");
      setHit(null);
      try {
        const r = await window.ElvishMailManifest.lookupKey(email.trim().toLowerCase());
        if (!r) setErr("Not found in any source");
        else setHit(r);
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setBusy(false);
      }
    };
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-lookup" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-lookup-form" }, /* @__PURE__ */ react_global_default.createElement(
      Input2,
      {
        type: "email",
        placeholder: "alice@example.com",
        value: email,
        onChange: (e) => setEmail(e.target.value)
      }
    ), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", onClick: onLookup, disabled: busy || !email, loading: busy }, "Lookup")), err && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, err), hit && /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-lookup-result" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-lookup-row" }, /* @__PURE__ */ react_global_default.createElement("strong", null, "Source:"), /* @__PURE__ */ react_global_default.createElement(Badge, { variant: hit.source === "local" ? "success" : "default" }, hit.source)), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-lookup-row" }, /* @__PURE__ */ react_global_default.createElement("strong", null, "Fingerprint:"), /* @__PURE__ */ react_global_default.createElement("code", null, hit.fingerprint)), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-lookup-row" }, /* @__PURE__ */ react_global_default.createElement("strong", null, "UID Match:"), /* @__PURE__ */ react_global_default.createElement("span", null, hit.verified_uid_match ? "Yes" : "No")), /* @__PURE__ */ react_global_default.createElement("details", { className: "settings-lookup-details" }, /* @__PURE__ */ react_global_default.createElement("summary", null, "Armored public key"), /* @__PURE__ */ react_global_default.createElement("pre", null, hit.armored))));
  }
  function SupportSection() {
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-header" }, /* @__PURE__ */ react_global_default.createElement("h2", null, "Support"), /* @__PURE__ */ react_global_default.createElement("p", null, "Get help with your account")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-support-grid" }, /* @__PURE__ */ react_global_default.createElement(Card, { title: "Contact Support", className: "settings-support-card" }, /* @__PURE__ */ react_global_default.createElement("p", null, "Need help? Reach out to our support team."), /* @__PURE__ */ react_global_default.createElement("a", { href: "mailto:support@elvish.email", className: "settings-support-link" }, SettingsIcons.identities, " support@elvish.email")), /* @__PURE__ */ react_global_default.createElement(Card, { title: "Documentation", className: "settings-support-card" }, /* @__PURE__ */ react_global_default.createElement("p", null, "Browse our documentation and guides."), /* @__PURE__ */ react_global_default.createElement("a", { href: "/docs", className: "settings-support-link" }, SettingsIcons.info, " Documentation"))));
  }
  function DangerZoneSection() {
    const [policy, setPolicy] = useState3({ enabled: false, value: 30, unit: "days" });
    const [status, setStatus] = useState3({ last_activity_day: "", scheduled_delete_at: "", scheduled_delete_reason: "" });
    const [loadingStatus, setLoadingStatus] = useState3(true);
    const [statusError, setStatusError] = useState3("");
    const [showDeleteModal, setShowDeleteModal] = useState3(false);
    const [deleteMode, setDeleteMode] = useState3("now");
    const [delPwd, setDelPwd] = useState3("");
    const [delConfirm, setDelConfirm] = useState3("");
    const [actionBusy, setActionBusy] = useState3(false);
    const [policyBusy, setPolicyBusy] = useState3(false);
    const [cancelBusy, setCancelBusy] = useState3(false);
    const [delErr, setDelErr] = useState3("");
    const applyDeletePolicy = useCallback2((payload) => {
      const nextPolicy = payload && payload.policy ? payload.policy : {};
      setPolicy({
        enabled: !!nextPolicy.enabled,
        value: nextPolicy.value > 0 ? nextPolicy.value : 30,
        unit: nextPolicy.unit || "days"
      });
      setStatus({
        last_activity_day: payload && payload.last_activity_day ? payload.last_activity_day : "",
        scheduled_delete_at: payload && payload.scheduled_delete_at ? payload.scheduled_delete_at : "",
        scheduled_delete_reason: payload && payload.scheduled_delete_reason ? payload.scheduled_delete_reason : ""
      });
    }, []);
    const loadDeletePolicy = useCallback2(async () => {
      setLoadingStatus(true);
      setStatusError("");
      try {
        const result = await window.ElvishMailManifest.getDeletePolicy();
        applyDeletePolicy(result);
      } catch (err) {
        setStatusError(err.message || "Could not load account deletion settings");
      } finally {
        setLoadingStatus(false);
      }
    }, [applyDeletePolicy]);
    useEffect2(() => {
      loadDeletePolicy();
    }, [loadDeletePolicy]);
    const formatDateTime = (value) => {
      if (!value) return "Not available";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString();
    };
    const formatDay = (value) => {
      if (!value) return "Not available";
      const date = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString();
    };
    const openDeleteModal = (mode) => {
      setDeleteMode(mode);
      setDelPwd("");
      setDelConfirm("");
      setDelErr("");
      setShowDeleteModal(true);
    };
    const submitDelete = async (e) => {
      e.preventDefault();
      setDelErr("");
      if (delConfirm !== "DELETE") {
        setDelErr("Confirmation must be exactly DELETE");
        return;
      }
      setActionBusy(true);
      try {
        const action = deleteMode === "schedule" ? () => window.ElvishMailManifest.scheduleAccountDeletion(delPwd, delConfirm) : () => window.ElvishMailManifest.deleteAccount(delPwd, delConfirm);
        await runWithFreshTwoFactor(action);
        if (deleteMode === "now") {
          window.location.href = "/";
          return;
        }
        setShowDeleteModal(false);
        await loadDeletePolicy();
      } catch (err) {
        setDelErr(err.message || "Could not update account deletion");
      } finally {
        setActionBusy(false);
      }
    };
    const savePolicy = async () => {
      setStatusError("");
      if (policy.enabled && (!Number.isFinite(policy.value) || policy.value <= 0)) {
        setStatusError("Choose a valid inactivity value greater than zero");
        return;
      }
      setPolicyBusy(true);
      try {
        const result = await window.ElvishMailManifest.setDeletePolicy({
          enabled: !!policy.enabled,
          value: policy.enabled ? Number(policy.value) : 0,
          unit: policy.enabled ? policy.unit : ""
        });
        applyDeletePolicy(result);
      } catch (err) {
        setStatusError(err.message || "Could not save inactivity delete policy");
      } finally {
        setPolicyBusy(false);
      }
    };
    const cancelScheduledDeletion = async () => {
      setStatusError("");
      setCancelBusy(true);
      try {
        await window.ElvishMailManifest.cancelAccountDeletion();
        await loadDeletePolicy();
      } catch (err) {
        setStatusError(err.message || "Could not cancel scheduled deletion");
      } finally {
        setCancelBusy(false);
      }
    };
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-section-header danger" }, /* @__PURE__ */ react_global_default.createElement("h2", null, SettingsIcons.danger, " Danger Zone"), /* @__PURE__ */ react_global_default.createElement("p", null, "Irreversible actions that affect your account")), statusError && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, statusError), loadingStatus ? /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-loading" }, "Loading...") : null, status.scheduled_delete_at ? /* @__PURE__ */ react_global_default.createElement(Alert, { type: "warning", title: "Account deletion is scheduled" }, "Your account is set to be deleted on ", /* @__PURE__ */ react_global_default.createElement("strong", null, formatDateTime(status.scheduled_delete_at)), ". You can cancel it before that deadline.") : null, /* @__PURE__ */ react_global_default.createElement(Card, { className: "settings-card-danger" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-danger-item" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-danger-info" }, /* @__PURE__ */ react_global_default.createElement("strong", null, "Delete Account"), /* @__PURE__ */ react_global_default.createElement("p", null, "Delete all data tied to this account. Deleted addresses stay unavailable for 2 years so nobody can immediately reclaim them after account removal.")), /* @__PURE__ */ react_global_default.createElement("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "danger", onClick: () => openDeleteModal("now") }, SettingsIcons.trash, " Delete Now"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", onClick: () => openDeleteModal("schedule") }, "Schedule 7-Day Delete"), status.scheduled_delete_at ? /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", onClick: cancelScheduledDeletion, loading: cancelBusy }, "Cancel Scheduled Delete") : null))), /* @__PURE__ */ react_global_default.createElement(Card, { title: "Auto-Delete After Inactivity", className: "settings-card-danger" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-consent-grid" }, /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-consent-row" }, /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-consent-toggle" }, /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        type: "checkbox",
        checked: !!policy.enabled,
        onChange: (e) => setPolicy((prev) => ({ ...prev, enabled: e.target.checked }))
      }
    ), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-label" }, "Delete this account after inactivity")), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-help" }, "Any authenticated use of the app resets the inactivity timer. We only keep the last online day for this policy.")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-consent-row", style: { alignItems: "center", gap: 12, flexWrap: "wrap" } }, /* @__PURE__ */ react_global_default.createElement("label", { className: "settings-consent-label" }, "Delete after"), /* @__PURE__ */ react_global_default.createElement(
      "input",
      {
        type: "number",
        min: 1,
        className: "settings-input",
        style: { maxWidth: 120 },
        disabled: !policy.enabled,
        value: policy.value,
        onChange: (e) => setPolicy((prev) => ({ ...prev, value: parseInt(e.target.value || "0", 10) || 0 }))
      }
    ), /* @__PURE__ */ react_global_default.createElement(
      "select",
      {
        className: "settings-input",
        style: { maxWidth: 160 },
        disabled: !policy.enabled,
        value: policy.unit,
        onChange: (e) => setPolicy((prev) => ({ ...prev, unit: e.target.value }))
      },
      /* @__PURE__ */ react_global_default.createElement("option", { value: "days" }, "days"),
      /* @__PURE__ */ react_global_default.createElement("option", { value: "weeks" }, "weeks"),
      /* @__PURE__ */ react_global_default.createElement("option", { value: "months" }, "months")
    ), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", onClick: savePolicy, loading: policyBusy }, "Save Auto-Delete Policy")), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-consent-row" }, /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-label" }, "Most recent activity day"), /* @__PURE__ */ react_global_default.createElement("span", { className: "settings-consent-help" }, formatDay(status.last_activity_day))))), /* @__PURE__ */ react_global_default.createElement(
      Modal,
      {
        open: showDeleteModal,
        onClose: () => !actionBusy && setShowDeleteModal(false),
        title: deleteMode === "schedule" ? "Schedule Account Deletion" : "Delete Account"
      },
      /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error", title: "Warning: This action is irreversible" }, deleteMode === "schedule" ? "When the 7-day window expires, Elvish will permanently erase:" : "Deleting your account will permanently erase:", /* @__PURE__ */ react_global_default.createElement("ul", null, /* @__PURE__ */ react_global_default.createElement("li", null, "All your emails and attachments"), /* @__PURE__ */ react_global_default.createElement("li", null, "All your GPG keys (messages become unreadable)"), /* @__PURE__ */ react_global_default.createElement("li", null, "All your identities and custom domains"), /* @__PURE__ */ react_global_default.createElement("li", null, "Your filters and folder configurations"), /* @__PURE__ */ react_global_default.createElement("li", null, "Your login and account metadata, while keeping non-reversible address reservations for 2 years"))),
      /* @__PURE__ */ react_global_default.createElement("form", { onSubmit: submitDelete }, delErr && /* @__PURE__ */ react_global_default.createElement(Alert, { type: "error" }, delErr), /* @__PURE__ */ react_global_default.createElement(Input2, { type: "password", label: "Account password", value: delPwd, onChange: (e) => setDelPwd(e.target.value), placeholder: "Current password" }), /* @__PURE__ */ react_global_default.createElement(Input2, { label: "Type DELETE to confirm", value: delConfirm, onChange: (e) => setDelConfirm(e.target.value), placeholder: "DELETE" }), /* @__PURE__ */ react_global_default.createElement("div", { className: "settings-modal-actions" }, /* @__PURE__ */ react_global_default.createElement(Button, { variant: "secondary", type: "button", onClick: () => setShowDeleteModal(false), disabled: actionBusy }, "Cancel"), /* @__PURE__ */ react_global_default.createElement(Button, { variant: "danger", type: "submit", loading: actionBusy, disabled: delConfirm !== "DELETE" || !delPwd }, deleteMode === "schedule" ? "Schedule delete in 7 days" : "Delete forever")))
    ));
  }
  function MailSettingsPanel({ user }) {
    const [activeSection, setActiveSection] = useState3("account");
    const navSections = useMemo3(
      () => SETTINGS_SECTIONS.map((s) => ({
        ...s,
        testId: `mail-settings-nav-${s.id}`
      })),
      []
    );
    const renderSection = () => {
      switch (activeSection) {
        case "account":
          return /* @__PURE__ */ react_global_default.createElement(AccountSection, { user });
        case "security":
          return /* @__PURE__ */ react_global_default.createElement(SecuritySection, null);
        case "identities":
          return /* @__PURE__ */ react_global_default.createElement(IdentitiesSection, { user });
        case "folders":
          return /* @__PURE__ */ react_global_default.createElement(FoldersSection, null);
        case "filters":
          return /* @__PURE__ */ react_global_default.createElement(FiltersSection, null);
        case "domains":
          return /* @__PURE__ */ react_global_default.createElement(CustomDomainsSection, null);
        case "keys":
          return /* @__PURE__ */ react_global_default.createElement(GPGKeysSection, null);
        case "smtp":
          return /* @__PURE__ */ react_global_default.createElement(SMTPSubmissionSection, { onGoToIdentities: () => setActiveSection("identities") });
        case "consent":
          return /* @__PURE__ */ react_global_default.createElement(PrivacyConsentSection, null);
        case "support":
          return /* @__PURE__ */ react_global_default.createElement(SupportSection, null);
        case "danger":
          return /* @__PURE__ */ react_global_default.createElement(DangerZoneSection, null);
        default:
          return /* @__PURE__ */ react_global_default.createElement(AccountSection, { user });
      }
    };
    return /* @__PURE__ */ react_global_default.createElement("div", { className: "mail-settings-panel" }, /* @__PURE__ */ react_global_default.createElement(
      UserSettingsLayout,
      {
        title: "Settings",
        sections: navSections,
        activeSection,
        onSectionChange: setActiveSection,
        wideLayout: true,
        searchPlaceholder: "Search settings\u2026",
        searchInputAriaLabel: "Search mail settings sections",
        navAriaLabel: "Mail settings sections",
        emptySearchTitle: "No matching settings",
        emptySearchDescription: "Try a different keyword or clear the search to see all sections."
      },
      renderSection()
    ));
  }
  var useState3, useEffect2, useCallback2, useMemo3, useRef2, SettingsIcons, SETTINGS_SECTIONS, DEFAULT_RETENTION_DAYS, IDENTITY_AVATAR_COLORS, IDENTITY_AVATAR_COLOR_MAP, FILTER_CONDITION_TYPES, FILTER_OPS_STRING, FILTER_OPS_SIZE, FILTER_ACTION_TYPES;
  var init_mail_settings = __esm({
    "../static/mail/mail-settings.jsx"() {
      init_react_global();
      init_shared();
      ({ useState: useState3, useEffect: useEffect2, useCallback: useCallback2, useMemo: useMemo3, useRef: useRef2 } = react_global_default);
      SettingsIcons = {
        account: Icons.account,
        security: Icons.security,
        identities: Icons.mail,
        folders: Icons.folder,
        filters: Icons.filter,
        domains: Icons.globe,
        keys: Icons.key,
        smtp: Icons.send,
        consent: Icons.file,
        support: Icons.help,
        danger: Icons.danger,
        back: Icons.back,
        check: Icons.check,
        x: Icons.x,
        plus: Icons.plus,
        trash: Icons.trash,
        edit: Icons.edit,
        copy: Icons.copy,
        download: Icons.download,
        upload: Icons.upload,
        refresh: Icons.refresh,
        lock: Icons.lock,
        unlock: Icons.unlock,
        star: Icons.star,
        info: Icons.info,
        warning: Icons.warning
      };
      SETTINGS_SECTIONS = [
        { id: "account", label: "Account", icon: "account" },
        { id: "security", label: "Security", icon: "security" },
        { id: "identities", label: "Identities", icon: "mail" },
        { id: "folders", label: "Folders", icon: "folder" },
        { id: "filters", label: "Filters", icon: "filter" },
        { id: "domains", label: "Custom Domains", icon: "globe" },
        { id: "keys", label: "GPG Keys", icon: "key" },
        { id: "smtp", label: "SMTP Submission", icon: "send" },
        { id: "consent", label: "Mail & privacy", icon: "file" },
        { id: "support", label: "Support", icon: "help" },
        { id: "danger", label: "Danger Zone", icon: "danger", variant: "danger" }
      ];
      DEFAULT_RETENTION_DAYS = Object.freeze({
        inbox: null,
        sent: 30,
        trash: 30,
        archive: null
      });
      IDENTITY_AVATAR_COLORS = [
        { id: "pink", label: "Pink", bg: "linear-gradient(135deg, #ff80b5, #c14d85)", fg: "#fff7fb" },
        { id: "yellow", label: "Yellow", bg: "linear-gradient(135deg, #ffd36a, #b38316)", fg: "#fffaf0" },
        { id: "red", label: "Red", bg: "linear-gradient(135deg, #ff7b7b, #bb4040)", fg: "#fff5f5" },
        { id: "orange", label: "Orange", bg: "linear-gradient(135deg, #ffad66, #c76321)", fg: "#fff7f0" },
        { id: "green", label: "Green", bg: "linear-gradient(135deg, #74dca8, #25865d)", fg: "#f4fff8" },
        { id: "blue", label: "Blue", bg: "linear-gradient(135deg, #7aa8ff, #3f5bd1)", fg: "#f5f8ff" },
        { id: "dark-blue", label: "Dark Blue", bg: "linear-gradient(135deg, #7f8fb6, #35425e)", fg: "#f4f7fd" }
      ];
      IDENTITY_AVATAR_COLOR_MAP = IDENTITY_AVATAR_COLORS.reduce((acc, color) => {
        acc[color.id] = color;
        return acc;
      }, {});
      FILTER_CONDITION_TYPES = [
        { id: "sender", label: "Sender (From)" },
        { id: "subject", label: "Subject" },
        { id: "recipient", label: "Recipient (To)" },
        { id: "body", label: "Body (preview / recovered text only)" },
        { id: "attachment", label: "Attachments" },
        { id: "size", label: "Size (bytes)" }
      ];
      FILTER_OPS_STRING = [
        { id: "contains", label: "Contains" },
        { id: "equals", label: "Equals" },
        { id: "starts_with", label: "Starts with" },
        { id: "ends_with", label: "Ends with" },
        { id: "matches", label: "Matches (substring)" }
      ];
      FILTER_OPS_SIZE = [
        { id: "greater_than", label: "Greater than" },
        { id: "less_than", label: "Less than" },
        { id: "equals", label: "Equals" }
      ];
      FILTER_ACTION_TYPES = [
        { id: "move", label: "Move to folder", supported: true },
        { id: "mark_read", label: "Mark as read", supported: true },
        { id: "delete", label: "Move to trash", supported: true },
        { id: "mark_important", label: "Star / important (API pending)", supported: false },
        { id: "label", label: "Label (API pending)", supported: false },
        { id: "forward", label: "Forward (not available)", supported: false }
      ];
      window.ElvishMailSettings = MailSettingsPanel;
    }
  });

  // entries/mail-settings-lazy-entry.jsx
  var require_mail_settings_lazy_entry = __commonJS({
    "entries/mail-settings-lazy-entry.jsx"() {
      init_react_global();
      init_react_dom_client_global();
      init_mail_settings();
      Object.assign(globalThis, { React: react_global_default, ReactDOM: react_dom_client_global_default });
    }
  });
  require_mail_settings_lazy_entry();
})();
