package main

import (
	"testing"
)

func TestParseDeploymentComponents(t *testing.T) {
	t.Setenv("ELVISH_HTTP_ENABLED", "")
	t.Setenv("ELVISH_BACKGROUND_JOBS", "")

	tests := []struct {
		component  string
		wantHTTP   bool
		wantSMTP   bool
		wantWorker bool
		wantBG     bool
	}{
		{component: "", wantHTTP: true, wantSMTP: true, wantWorker: true, wantBG: true},
		{component: "all", wantHTTP: true, wantSMTP: true, wantWorker: true, wantBG: true},
		{component: "api", wantHTTP: true, wantSMTP: false, wantWorker: true, wantBG: true},
		{component: "mta", wantHTTP: false, wantSMTP: true, wantWorker: true, wantBG: false},
		{component: "api,mta", wantHTTP: true, wantSMTP: true, wantWorker: true, wantBG: true},
	}
	for _, tc := range tests {
		t.Run(tc.component, func(t *testing.T) {
			if tc.component == "" {
				t.Setenv("ELVISH_COMPONENT", "")
			} else {
				t.Setenv("ELVISH_COMPONENT", tc.component)
			}
			got := parseDeploymentComponents()
			if got.HTTP != tc.wantHTTP {
				t.Errorf("HTTP: got %v want %v", got.HTTP, tc.wantHTTP)
			}
			if got.SMTP != tc.wantSMTP {
				t.Errorf("SMTP: got %v want %v", got.SMTP, tc.wantSMTP)
			}
			if got.MailWorker != tc.wantWorker {
				t.Errorf("MailWorker: got %v want %v", got.MailWorker, tc.wantWorker)
			}
			if got.BackgroundJobs != tc.wantBG {
				t.Errorf("BackgroundJobs: got %v want %v", got.BackgroundJobs, tc.wantBG)
			}
		})
	}
}

func TestParseDeploymentComponentsExplicitFlags(t *testing.T) {
	t.Setenv("ELVISH_COMPONENT", "api")
	t.Setenv("ELVISH_BACKGROUND_JOBS", "0")
	got := parseDeploymentComponents()
	if got.BackgroundJobs {
		t.Fatal("expected background jobs off")
	}

	t.Setenv("ELVISH_COMPONENT", "mta")
	t.Setenv("ELVISH_HTTP_ENABLED", "1")
	t.Setenv("ELVISH_BACKGROUND_JOBS", "")
	got = parseDeploymentComponents()
	if !got.HTTP {
		t.Fatal("expected HTTP on for mta with ELVISH_HTTP_ENABLED=1")
	}
}
