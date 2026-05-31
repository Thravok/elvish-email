/**
 * Bundled mail search worker (OpenPGP.js 6 + worker logic). Loaded as type: 'module'.
 */
import * as openpgp from "openpgp";
globalThis.openpgp = openpgp;

import "../../static/mail/search/worker.js";
