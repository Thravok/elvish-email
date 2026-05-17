// ELVISH — Shared Layout Components
// Settings shell, navigation, and main content containers

import React from "react";
import { Icon } from "./icons.jsx";
import { Button } from "./primitives.jsx";

const { useState, useMemo } = React;

// ============ Settings Shell ============

export function SettingsShell({ children, className, wideLayout }) {
  return (
    <div
      className={`elvish-settings-shell ${className || ""}`.trim()}
      data-settings-shell={wideLayout ? "wide" : undefined}
    >
      {children}
    </div>
  );
}

// ============ Navigation Sidebar ============

export function Nav({
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
  emptySearchDescription = "Try a different search term",
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter((s) => {
      const kw = Array.isArray(s.searchKeywords) ? s.searchKeywords : [];
      const kwHit = kw.some((k) => String(k).toLowerCase().includes(q));
      return (
        s.label.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.badge && String(s.badge).toLowerCase().includes(q)) ||
        kwHit
      );
    });
  }, [sections, searchQuery]);

  return (
    <nav className={`elvish-nav ${className || ""}`} aria-label={navAriaLabel || title}>
      <div className="elvish-nav-header">
        <h2>{title}</h2>
        {meta && (
          <div className="elvish-nav-meta">
            {meta.map((item, i) => (
              <span key={i} className="elvish-nav-meta-item">
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {searchable && (
        <div className="elvish-nav-search">
          <span className="elvish-nav-search-icon">
            <Icon name="search" />
          </span>
          <input
            type="search"
            className="elvish-nav-search-input"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={searchInputAriaLabel || searchPlaceholder}
          />
        </div>
      )}

      <div className="elvish-nav-items">
        {filteredSections.map((section) => (
          <button
            key={section.id}
            type="button"
            data-testid={section.testId || undefined}
            className={`elvish-nav-item ${activeSection === section.id ? "active" : ""} ${section.variant || ""}`}
            onClick={() => onSectionChange(section.id)}
          >
            {section.icon && (
              <span className="elvish-nav-icon">
                {typeof section.icon === "string" ? <Icon name={section.icon} /> : section.icon}
              </span>
            )}
            <span className="elvish-nav-label">
              <span className="elvish-nav-label-text">{section.label}</span>
              {showDescriptions && section.description && (
                <span className="elvish-nav-label-desc">{section.description}</span>
              )}
            </span>
            {section.badge && <span className="elvish-nav-badge">{section.badge}</span>}
          </button>
        ))}

        {filteredSections.length === 0 && (
          <div className="elvish-nav-empty" style={{ padding: "24px 20px", color: "var(--dim)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{emptySearchTitle}</div>
            <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5 }}>
              {emptySearchDescription}
            </div>
          </div>
        )}
      </div>

      {(footer || footerState || footerActions) && (
        <div className="elvish-nav-footer">
          {footerState && (
            <div className={`elvish-nav-footer-state ${footerState.variant || ""}`}>
              {footerState.text}
            </div>
          )}
          {footerActions && (
            <div className="elvish-nav-footer-actions">{footerActions}</div>
          )}
          {footer}
        </div>
      )}
    </nav>
  );
}

// ============ Main Content Area ============

export function Main({ children, className, contentRef }) {
  return (
    <main className={`elvish-main ${className || ""}`}>
      <div ref={contentRef} className="elvish-main-content">
        {children}
      </div>
    </main>
  );
}

// ============ Topbar (optional) ============

export function Topbar({
  brand,
  brandSuffix,
  center,
  right,
  className,
}) {
  return (
    <div className={`elvish-topbar ${className || ""}`}>
      <div className="elvish-topbar-left">
        {brand}
        {brandSuffix && (
          <>
            <span className="elvish-topbar-sep">/</span>
            <span className="elvish-topbar-section">{brandSuffix}</span>
          </>
        )}
      </div>
      {center && <div className="elvish-topbar-center">{center}</div>}
      {right && <div className="elvish-topbar-right">{right}</div>}
    </div>
  );
}

// ============ Preset: Admin Panel Layout ============
// Same building blocks as UserSettingsLayout (SettingsShell + Nav + Main); defaults suit operator tools.

export function AdminPanelLayout({
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
  emptySearchDescription = "Try a different search term",
}) {
  const resolvedFooterActions =
    footerActions !== undefined
      ? footerActions
      : onSave
        ? (
            <Button variant="primary" onClick={onSave} disabled={saveDisabled}>
              Save Changes
            </Button>
          )
        : undefined;

  return (
    <SettingsShell className={shellClassName} wideLayout={wideLayout}>
      <Nav
        title={title}
        sections={sections}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        showDescriptions={showDescriptions}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        searchInputAriaLabel={searchInputAriaLabel}
        navAriaLabel={navAriaLabel}
        emptySearchTitle={emptySearchTitle}
        emptySearchDescription={emptySearchDescription}
        meta={meta}
        footerState={footerState}
        footerActions={resolvedFooterActions}
        footer={footer}
      />
      <Main className={mainClassName} contentRef={mainContentRef}>{children}</Main>
    </SettingsShell>
  );
}

// ============ Preset: User Settings Layout ============
// Same stack as AdminPanelLayout; defaults omit section descriptions and heavy footer chrome.

export function UserSettingsLayout({
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
  emptySearchDescription = "Try a different search term",
}) {
  return (
    <SettingsShell className={shellClassName} wideLayout={wideLayout}>
      <Nav
        title={title}
        sections={sections}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        showDescriptions={showDescriptions}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        searchInputAriaLabel={searchInputAriaLabel}
        navAriaLabel={navAriaLabel}
        emptySearchTitle={emptySearchTitle}
        emptySearchDescription={emptySearchDescription}
        meta={meta}
        footerState={footerState}
        footerActions={footerActions}
        footer={footer}
      />
      <Main className={mainClassName} contentRef={mainContentRef}>{children}</Main>
    </SettingsShell>
  );
}

// ============ Export all ============

export const Layout = {
  SettingsShell,
  Nav,
  Main,
  Topbar,
  AdminPanelLayout,
  UserSettingsLayout,
};

export default Layout;
