// Package paths resolves monorepo layout paths from the repository root.
package paths

import "path/filepath"

// RepoRoot is the absolute or relative repository root passed via -root / ELVISH_ROOT.
type RepoRoot string

func (r RepoRoot) String() string { return string(r) }

// APITemplates returns the SSR template directory (services/api/templates).
func (r RepoRoot) APITemplates() string {
	return filepath.Join(r.String(), "services", "api", "templates")
}

// APIContent returns on-disk blog seed content (services/api/content).
func (r RepoRoot) APIContent() string {
	return filepath.Join(r.String(), "services", "api", "content")
}

// APIStatic returns marketing/site assets served by elvishapi (services/api/static).
func (r RepoRoot) APIStatic() string {
	return filepath.Join(r.String(), "services", "api", "static")
}

// WebApp returns the browser mail/auth/protected tree (apps/web).
func (r RepoRoot) WebApp() string {
	return filepath.Join(r.String(), "apps", "web")
}

// AdminApp returns the operator panel sources (apps/admin/src).
func (r RepoRoot) AdminApp() string {
	return filepath.Join(r.String(), "apps", "admin", "src")
}

// DataDir returns generated secrets (DKIM, MFA, relay) under <root>/data.
func (r RepoRoot) DataDir() string {
	return filepath.Join(r.String(), "data")
}
