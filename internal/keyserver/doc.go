// Package keyserver resolves a recipient email to a verified PGP public key.
//
// Resolution chain (fixed order: WKD, Proton HKPS for proton domains, keys.openpgp.org, keyserver.ubuntu.com):
//   - local                        — our own contact_pgp_keys cache + user_identity_keys
//   - wkd_advanced / wkd_direct    — Web Key Directory (RFC draft-koch-openpgp-webkey-service)
//   - proton                       — dedicated Proton Mail source (HKP + /api/keys + KT stub)
//   - hkps_keys_openpgp_org
//   - hkps_keyserver_ubuntu_com
//
// Proton-domain emails auto-promote the proton source to first position regardless of chain order.
package keyserver
