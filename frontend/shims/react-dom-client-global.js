/** Re-export react-dom/client from globals set by the mail bundle. */
const M = globalThis.ReactDOM;
if (!M) {
  throw new Error("[elvish] mail-admin-embed: globalThis.ReactDOM missing — load /dist/mail-bundle.js first");
}
export default M;
