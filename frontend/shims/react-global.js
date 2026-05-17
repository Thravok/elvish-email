/** Re-export React from the mail bundle (must load after mail-bundle.js). */
const R = globalThis.React;
if (!R) {
  throw new Error("[elvish] mail-admin-embed: globalThis.React missing — load /dist/mail-bundle.js first");
}
export default R;
