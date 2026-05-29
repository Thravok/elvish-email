package httpserver

import (
	"testing"

	"elvish/libs/go/models"
	"elvish/libs/go/store"
)

func TestUserAuthMethodLabel(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		u    models.User
		want string
	}{
		{"disabled", models.User{PasswordHash: store.DisabledPasswordHash()}, "disabled"},
		{"srp method", models.User{AuthMethod: "srp", PasswordHash: store.SRPPasswordHash()}, "srp"},
		{"legacy", models.User{PasswordHash: "$2a$10$abc"}, "legacy"},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := userAuthMethodLabel(&tc.u); got != tc.want {
				t.Fatalf("got %q want %q", got, tc.want)
			}
		})
	}
}

func TestUserPasswordDisabled(t *testing.T) {
	t.Parallel()
	if !userPasswordDisabled(store.DisabledPasswordHash()) {
		t.Fatal("expected disabled")
	}
	if userPasswordDisabled(store.SRPPasswordHash()) {
		t.Fatal("srp sentinel is not disabled")
	}
}
