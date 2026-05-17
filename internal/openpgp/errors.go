package openpgp

import "errors"

// ErrInvalidArmoredKey means the armored public key block could not be parsed.
var ErrInvalidArmoredKey = errors.New("openpgp: invalid armored public key")
