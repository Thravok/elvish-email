// ELVISH — Shared UI Primitives
// Form controls, cards, modals, and utility components for settings/admin panels

import React from "react";
import { Icon, Icons } from "./icons.jsx";

const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ============ Markdown Renderer ============
export function mdRender(src) {
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
    const items = block.split(/\n/).map(l => l.replace(/^- /, "")).map(t => `<li>${t}</li>`).join("");
    return pre + `<ul>${items}</ul>`;
  });
  s = s.split(/\n\n+/).map(p => {
    if (/^<(h\d|ul|ol|pre|blockquote)/.test(p.trim())) return p;
    return `<p>${p.replace(/\n/g, "<br/>")}</p>`;
  }).join("\n");
  return s;
}

// ============ Form Primitives ============

export function FormGroup({ label, hint, required, error, helperText, children, className }) {
  return (
    <div className={`elvish-form-group ${className || ""}`}>
      {label && (
        <label className="elvish-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      {hint && <span className="elvish-hint">{hint}</span>}
      {children}
      {(helperText || error) && (
        <span className={`elvish-helper ${error ? "elvish-helper-error" : ""}`}>
          {error || helperText}
        </span>
      )}
    </div>
  );
}

export function Input({ 
  value, 
  onChange, 
  placeholder, 
  type = "text", 
  validate,
  label,
  hint,
  required,
  error,
  helperText,
  disabled,
  className,
  ...props 
}) {
  const v = validate ? validate(value) : null;
  
  const input = (
    <div className={v ? "elvish-input-with-validate" : undefined}>
      <input
        className={`elvish-input ${error ? "elvish-input-error" : ""} ${className || ""}`}
        type={type}
        value={value || ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
      {v && (
        <span className={`elvish-validate-badge ${v.ok ? "ok" : "error"}`}>
          {v.ok ? "✓ OK" : `✕ ${v.msg}`}
        </span>
      )}
    </div>
  );
  
  if (label || hint || error || helperText) {
    return (
      <FormGroup label={label} hint={hint} required={required} error={error} helperText={helperText}>
        {input}
      </FormGroup>
    );
  }
  
  return input;
}

export function Textarea({ 
  value, 
  onChange, 
  placeholder, 
  tall,
  label,
  hint,
  required,
  error,
  helperText,
  disabled,
  className,
  ...props 
}) {
  const textarea = (
    <textarea
      className={`elvish-textarea ${tall ? "tall" : ""} ${error ? "elvish-input-error" : ""} ${className || ""}`}
      value={value || ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  );
  
  if (label || hint || error || helperText) {
    return (
      <FormGroup label={label} hint={hint} required={required} error={error} helperText={helperText}>
        {textarea}
      </FormGroup>
    );
  }
  
  return textarea;
}

export function Select({ 
  value, 
  onChange, 
  options,
  label,
  hint,
  required,
  error,
  helperText,
  disabled,
  className,
  ...props 
}) {
  const select = (
    <select
      className={`elvish-select ${className || ""}`}
      value={value || ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    >
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  );
  
  if (label || hint || error || helperText) {
    return (
      <FormGroup label={label} hint={hint} required={required} error={error} helperText={helperText}>
        {select}
      </FormGroup>
    );
  }
  
  return select;
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`elvish-toggle ${disabled ? "disabled" : ""}`}>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="elvish-toggle-track" />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Seg({ value, onChange, options, disabled }) {
  return (
    <div className="elvish-seg">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? "on" : ""}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips({ values, onChange, suggestions, placeholder = "add…" }) {
  const [draft, setDraft] = useState("");
  
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  
  return (
    <div className="elvish-chips">
      {values.map((v, i) => (
        <span key={i} className="elvish-chip">
          {v}
          <span className="x" onClick={() => onChange(values.filter((_, j) => j !== i))}>×</span>
        </span>
      ))}
      <input
        className="elvish-input"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
      />
      {suggestions && suggestions.filter(s => !values.includes(s)).map(s => (
        <span key={s} className="elvish-chip-add" onClick={() => onChange([...values, s])}>
          + {s}
        </span>
      ))}
    </div>
  );
}

export function Repeater({ items, onChange, render, addLabel = "add", newItem }) {
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const copy = items.slice();
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const update = (i, next) => onChange(items.map((it, j) => j === i ? next : it));
  
  return (
    <div className="elvish-repeater">
      {items.map((it, i) => (
        <div key={i} className="elvish-repeater-row">
          <div className="elvish-repeater-handle" title="reorder">⋮⋮</div>
          <div className="elvish-repeater-body">{render(it, i, (next) => update(i, next))}</div>
          <div className="elvish-repeater-actions">
            <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
            <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</Button>
            <Button size="sm" variant="danger" onClick={() => remove(i)}>×</Button>
          </div>
        </div>
      ))}
      <div className="elvish-repeater-add" onClick={() => onChange([...items, newItem()])}>
        + {addLabel}
      </div>
    </div>
  );
}

// ============ Card Component ============

export function Card({ title, description, actions, children, className, variant }) {
  return (
    <div className={`elvish-card settings-card ${variant || ""} ${className || ""}`.trim()}>
      {(title || description || actions) && (
        <div className="elvish-card-header settings-card-header">
          <div className="elvish-card-header-text settings-card-header-text">
            {title && <h3 className="elvish-card-title settings-card-title">{title}</h3>}
            {description && <p className="elvish-card-desc settings-card-desc">{description}</p>}
          </div>
          {actions && <div className="elvish-card-actions settings-card-actions">{actions}</div>}
        </div>
      )}
      <div className="elvish-card-body settings-card-body">{children}</div>
    </div>
  );
}

// ============ Button Component ============

export function Button({ 
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
  return (
    <button
      type={type}
      className={`elvish-btn elvish-btn-${variant} elvish-btn-${size} settings-btn settings-btn-${variant} settings-btn-${size} ${className || ""}`}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      {...props}
    >
      {loading && <span className="elvish-btn-spinner settings-btn-spinner" />}
      {children}
    </button>
  );
}

// ============ Alert Component ============

export function Alert({ type = "info", title, children }) {
  const iconName = type === "error" ? "warning" : type === "success" ? "check" : "info";
  return (
    <div className={`elvish-alert elvish-alert-${type} settings-alert settings-alert-${type}`}>
      {title && (
        <div className="elvish-alert-title settings-alert-title">
          <Icon name={iconName} />
          {title}
        </div>
      )}
      <div className="elvish-alert-body settings-alert-body">{children}</div>
    </div>
  );
}

// ============ Badge Component ============

export function Badge({ variant = "default", children }) {
  return <span className={`elvish-badge elvish-badge-${variant} settings-badge settings-badge-${variant}`}>{children}</span>;
}

// ============ Empty State Component ============

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="elvish-empty settings-empty">
      {icon && (
        <div className="elvish-empty-icon settings-empty-icon">
          {typeof icon === "string" ? <Icon name={icon} size={24} /> : icon}
        </div>
      )}
      {title && <div className="elvish-empty-title settings-empty-title">{title}</div>}
      {description && <div className="elvish-empty-desc settings-empty-desc">{description}</div>}
      {action && <div className="elvish-empty-action settings-empty-action">{action}</div>}
    </div>
  );
}

// ============ Modal Components ============

export function Modal({ open, onClose, title, size = "md", children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="elvish-modal-overlay settings-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`elvish-modal elvish-modal-${size} settings-modal settings-modal-${size}`}>
        <div className="elvish-modal-header settings-modal-header">
          <h3>{title}</h3>
          <button className="elvish-modal-close settings-modal-close" onClick={onClose} type="button">
            <Icon name="x" />
          </button>
        </div>
        <div className="elvish-modal-body settings-modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({ 
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

  return (
    <div
      className="elvish-modal-overlay settings-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="elvish-modal elvish-modal-sm settings-modal settings-modal-sm">
        <div className="elvish-modal-header settings-modal-header">
          <h3>{title}</h3>
          <button
            className="elvish-modal-close settings-modal-close"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="elvish-modal-body settings-modal-body">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{message}</p>
          <div className="elvish-modal-actions settings-modal-actions">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ List Component ============

export function List({ children, className }) {
  return <div className={`elvish-list ${className || ""}`}>{children}</div>;
}

export function ListItem({ 
  title, 
  subtitle, 
  actions, 
  onClick, 
  active,
  children,
  className 
}) {
  return (
    <div 
      className={`elvish-list-item ${active ? "active" : ""} ${onClick ? "clickable" : ""} ${className || ""}`}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className="elvish-list-item-content">
        {title && <div className="elvish-list-item-title">{title}</div>}
        {subtitle && <div className="elvish-list-item-subtitle">{subtitle}</div>}
        {children}
      </div>
      {actions && <div className="elvish-list-item-actions">{actions}</div>}
    </div>
  );
}

// ============ Grid/Row Utilities ============

export function Grid({ children, className }) {
  return <div className={`elvish-grid ${className || ""}`}>{children}</div>;
}

export function GridRow({ label, children }) {
  return (
    <div className="elvish-grid-row">
      <div className="elvish-grid-label">{label}</div>
      <div className="elvish-grid-value">{children}</div>
    </div>
  );
}

export function FormRow({ children, className }) {
  return <div className={`elvish-form-row ${className || ""}`}>{children}</div>;
}

// ============ Section Header ============

export function SectionHeader({ title, description, icon, variant, actions, children }) {
  return (
    <div className={`elvish-section-header ${variant || ""}`}>
      <h2>
        {icon && <Icon name={icon} />}
        {title}
      </h2>
      {description && <p>{description}</p>}
      {actions && <div className="elvish-section-actions">{actions}</div>}
      {children}
    </div>
  );
}

// ============ Export all ============

export const Primitives = {
  mdRender,
  FormGroup,
  Input,
  Textarea,
  Select,
  Toggle,
  Seg,
  Chips,
  Repeater,
  Card,
  Button,
  Alert,
  Badge,
  EmptyState,
  Modal,
  ConfirmModal,
  List,
  ListItem,
  Grid,
  GridRow,
  FormRow,
  SectionHeader,
};

export default Primitives;
