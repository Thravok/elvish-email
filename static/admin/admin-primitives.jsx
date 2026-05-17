// ELVISH admin — shared primitives + state
// This file now re-exports from the shared component library for backward compatibility.
// New code should import directly from /static/shared/primitives.jsx

import {
  mdRender,
  Button,
  Alert,
  Badge,
  EmptyState,
  Modal,
  ConfirmModal,
  SectionHeader,
  FormRow,
} from "../shared/primitives.jsx";

import { Icon, Icons } from "../shared/icons.jsx";

const { useState: useS_a, useEffect: useE_a, useRef: useR_a, useMemo: useM_a, useCallback: useC_a } = React;

// ---- form row (legacy layout wrapper) ----
function FRow({ label, hint, req, children }) {
  return (
    <div className="f-row">
      <div className="f-label">
        <div className="f-label-line">{label}{req && <span className="req">*</span>}</div>
        {hint && <div className="f-hint">{hint}</div>}
      </div>
      <div className="f-ctrl">{children}</div>
    </div>
  );
}

// ---- legacy wrappers that map to shared components ----
function Input({ value, onChange, placeholder, type = "text", validate }) {
  const v = validate ? validate(value) : null;
  return (
    <div className={v ? "elvish-input-with-validate" : "inp-with-validate"}>
      <input className="inp elvish-input" type={type} value={value || ""} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
      {v && <span className="elvish-validate-badge" style={{ color: v.ok ? "var(--ok)" : "var(--accent)" }}>{v.ok ? "✓ OK" : "✕ " + v.msg}</span>}
    </div>
  );
}

function Textarea({ value, onChange, placeholder, tall }) {
  return <textarea className={"txa elvish-textarea" + (tall ? " tall" : "")} value={value || ""} placeholder={placeholder}
                   onChange={(e) => onChange(e.target.value)} />;
}

function Select({ value, onChange, options }) {
  return (
    <select className="sel elvish-select" value={value || ""} onChange={(e) => onChange(e.target.value)}>
      {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="tgl elvish-toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="tgl-track elvish-toggle-track"></span>
      {label && <span>{label}</span>}
    </label>
  );
}

function Seg({ value, onChange, options }) {
  return (
    <div className="seg elvish-seg">
      {options.map(o => (
        <button key={o.value} type="button" className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chips({ values, onChange, suggestions }) {
  const [draft, setDraft] = useS_a("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="chips elvish-chips">
      {values.map((v, i) => (
        <span key={i} className="chip elvish-chip">{v}<span className="x" onClick={() => onChange(values.filter((_, j) => j !== i))}>×</span></span>
      ))}
      <input className="inp elvish-input" style={{ width: 140 }} value={draft} placeholder="add…"
             onChange={(e) => setDraft(e.target.value)}
             onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      {suggestions && suggestions.filter(s => !values.includes(s)).map(s => (
        <span key={s} className="chip-add elvish-chip-add" onClick={() => onChange([...values, s])}>+ {s}</span>
      ))}
    </div>
  );
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
  return (
    <div className="rep elvish-repeater">
      {items.map((it, i) => (
        <div key={i} className="rep-row elvish-repeater-row">
          <div className="rep-handle elvish-repeater-handle" title="reorder">⋮⋮</div>
          <div className="rep-body elvish-repeater-body">{render(it, i, (next) => update(i, next))}</div>
          <div className="rep-actions elvish-repeater-actions">
            <button type="button" className="btn-sm elvish-btn elvish-btn-sm elvish-btn-ghost" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" className="btn-sm elvish-btn elvish-btn-sm elvish-btn-ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
            <button type="button" className="btn-sm danger elvish-btn elvish-btn-sm elvish-btn-danger" onClick={() => remove(i)}>×</button>
          </div>
        </div>
      ))}
      <div className="rep-add elvish-repeater-add" onClick={() => onChange([...items, newItem()])}>+ {addLabel || "add"}</div>
    </div>
  );
}

// ---- card (maps to elvish-card) ----
function Card({ title, right, children }) {
  return (
    <div className="adm-card elvish-card">
      <div className="adm-card-h elvish-card-header">
        <div className="l elvish-card-header-text"><h3 className="elvish-card-title">{title}</h3></div>
        <div className="r elvish-card-actions">{right}</div>
      </div>
      <div className="adm-card-b elvish-card-body">{children}</div>
    </div>
  );
}

// ---- section header (uses shared SectionHeader; legacy A.H API) ----
function H({ num, title, sub }) {
  const t = title && String(title).trim();
  const heading = [num, t].filter(Boolean).join(" · ");
  const desc = sub && String(sub).trim();
  return <SectionHeader title={heading} description={desc || undefined} />;
}

// Legacy export via window.adm for backward compatibility
window.adm = {
  mdRender, FRow, Input, Textarea, Select, Toggle, Seg, Chips, Repeater, Card, H,
  Button, Alert, Badge, EmptyState, Modal, ConfirmModal, SectionHeader, FormRow,
  Icon, Icons,
};

// Also export shared components for direct import
export {
  mdRender, FRow, Input, Textarea, Select, Toggle, Seg, Chips, Repeater, Card, H,
  Button, Alert, Badge, EmptyState, Modal, ConfirmModal, SectionHeader, FormRow,
  Icon, Icons,
};
