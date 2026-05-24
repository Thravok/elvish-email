package main

import (
	"os"
	"strings"
)

// deploymentComponents selects which subsystems elvishserver starts in this process.
// Controlled by ELVISH_COMPONENT (comma-separated: api, mta, all).
type deploymentComponents struct {
	HTTP           bool
	SMTP           bool
	MailWorker     bool
	BackgroundJobs bool
}

func parseDeploymentComponents() deploymentComponents {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv("ELVISH_COMPONENT")))
	if raw == "" {
		raw = "all"
	}
	parts := splitComponentList(raw)
	hasAll := componentSetHas(parts, "all")
	hasAPI := hasAll || componentSetHas(parts, "api")
	hasMTA := hasAll || componentSetHas(parts, "mta")

	httpEnabled := envTruthyMain("ELVISH_HTTP_ENABLED")
	if v := strings.TrimSpace(os.Getenv("ELVISH_HTTP_ENABLED")); v == "" {
		if hasMTA && !hasAPI && !hasAll {
			httpEnabled = false
		} else {
			httpEnabled = true
		}
	}

	bgJobs := envTruthyMain("ELVISH_BACKGROUND_JOBS")
	if v := strings.TrimSpace(os.Getenv("ELVISH_BACKGROUND_JOBS")); v == "" {
		switch {
		case hasMTA && !hasAPI && !hasAll:
			bgJobs = false
		default:
			bgJobs = true
		}
	}

	c := deploymentComponents{
		HTTP:           httpEnabled && (hasAPI || hasMTA || hasAll),
		SMTP:           hasMTA || hasAll,
		MailWorker:     hasAPI || hasMTA || hasAll,
		BackgroundJobs: bgJobs && (hasAPI || hasAll),
	}
	if hasAPI && !hasMTA && !hasAll {
		c.SMTP = false
	}
	return c
}

func splitComponentList(raw string) []string {
	var out []string
	for _, p := range strings.Split(raw, ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func componentSetHas(parts []string, name string) bool {
	name = strings.TrimSpace(strings.ToLower(name))
	for _, p := range parts {
		if p == name {
			return true
		}
	}
	return false
}
