/**
 * Node smoke test for client filter scripts (run: node static/mail/mail-filter-engine.node.test.mjs).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ledgerSrc = fs.readFileSync(path.join(__dirname, 'mail-filter-ledger.js'), 'utf8');
const engineSrc = fs.readFileSync(path.join(__dirname, 'mail-filter-engine.js'), 'utf8');

const sandbox = {
  window: { ElvishMailManifest: {} },
  console,
};
vm.createContext(sandbox);
vm.runInContext(ledgerSrc, sandbox);
vm.runInContext(engineSrc, sandbox);
const Eng = sandbox.window.ElvishMailFilterEngine;

assert.ok(Eng, 'ElvishMailFilterEngine attached');

const ctx = Eng.buildContext(
  { subject: 'Hello', from_addr: 'a@b.com', to_addrs: ['c@d.com'], has_attachments: false },
  { bodyText: null }
);
assert.strictEqual(Eng.conditionMatches({ type: 'subject', operator: 'contains', value: 'ell' }, ctx), true);
assert.strictEqual(Eng.conditionMatches({ type: 'body', operator: 'contains', value: 'x' }, ctx), false);

const rules = Eng.normalizeRules([
  { id: '1', name: 'r', enabled: true, priority: 50, conditions: [{ type: 'subject', operator: 'contains', value: 'z' }], actions: [{ type: 'mark_read' }] },
  { id: '2', name: 'h', enabled: true, priority: 100, conditions: [{ type: 'subject', operator: 'contains', value: 'z' }], actions: [{ type: 'mark_read' }] },
]);
const hit = Eng.pickFirstMatchingRule(rules, Eng.buildContext({ subject: 'az', from_addr: '', to_addrs: [] }, {}));
assert.strictEqual(hit && hit.id, '2');

console.log('mail-filter-engine.node.test: ok');
