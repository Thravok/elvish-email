package blog

import "errors"

// ErrRequireSignedNeedsVerifyPubPath is returned when SigningLoadOpts.RequireSigned is true
// but VerifyPubPath is empty.
var ErrRequireSignedNeedsVerifyPubPath = errors.New("blog: RequireSigned needs VerifyPubPath")
