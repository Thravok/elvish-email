package httpserver

import "testing"

func TestSafeRedirectPath_InputScenarios_ReturnsCleanPath(t *testing.T) {
	t.Parallel()
	tests := []struct {
		in, want string
	}{
		{"", "/"},
		{"/foo", "/foo"},
		{"//evil.com", "/"},
		{"https://evil.com", "/"},
		{"  /ok  ", "/ok"},
	}
	for _, tc := range tests {
		if got := safeRedirectPath(tc.in); got != tc.want {
			t.Errorf("safeRedirectPath(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestSafeOAuthAuthorizeNext(t *testing.T) {
	t.Parallel()
	if got := safeOAuthAuthorizeNext("/oauth/authorize?client_id=x"); got == "" {
		t.Fatal("expected non-empty")
	}
	if got := safeOAuthAuthorizeNext("//oauth/authorize"); got != "" {
		t.Fatalf("got %q", got)
	}
	if got := safeOAuthAuthorizeNext("/login?x=1"); got != "" {
		t.Fatalf("got %q", got)
	}
}
