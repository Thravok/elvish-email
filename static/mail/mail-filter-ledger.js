/**
 * Client-side idempotence for mail filter actions (mark_read, etc.).
 * Stored in localStorage; invalidated when the rules set changes.
 */
(function () {
  var STORAGE_KEY = 'elvish_mail_filter_ledger_v1';

  function safeParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function readStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var o = raw ? safeParse(raw) : null;
      if (!o || typeof o !== 'object') return { rulesHash: '', entries: {} };
      if (typeof o.rulesHash !== 'string') o.rulesHash = '';
      if (!o.entries || typeof o.entries !== 'object') o.entries = {};
      return o;
    } catch (_) {
      return { rulesHash: '', entries: {} };
    }
  }

  function writeStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (_) {
      /* quota / private mode */
    }
  }

  function ensureRulesHash(store, rulesHash) {
    if (store.rulesHash !== rulesHash) {
      store.rulesHash = rulesHash;
      store.entries = {};
      writeStore(store);
    }
  }

  window.ElvishMailFilterLedger = {
    /** Stable hash string for the current normalized rule list (caller-provided). */
    syncRulesHash: function (rulesHash) {
      var store = readStore();
      ensureRulesHash(store, rulesHash || '');
    },

    /** True if this message+rule+action set was already applied for this rules generation. */
    alreadyApplied: function (messageId, ruleId, actionFingerprint, rulesHash) {
      if (!messageId || !ruleId || !rulesHash) return false;
      var store = readStore();
      if (store.rulesHash !== rulesHash) return false;
      var e = store.entries[messageId];
      if (!e) return false;
      return e.ruleId === ruleId && e.actionFingerprint === actionFingerprint && e.rulesHash === rulesHash;
    },

    record: function (messageId, ruleId, actionFingerprint, rulesHash) {
      if (!messageId || !ruleId || !rulesHash) return;
      var store = readStore();
      ensureRulesHash(store, rulesHash);
      store.entries[messageId] = {
        ruleId: ruleId,
        actionFingerprint: actionFingerprint,
        rulesHash: rulesHash,
      };
      writeStore(store);
    },

    /** Drop ledger entries for messages no longer in the inbox list. */
    pruneMissing: function (messageIdsSet) {
      var store = readStore();
      var next = {};
      for (var k in store.entries) {
        if (!Object.prototype.hasOwnProperty.call(store.entries, k)) continue;
        if (messageIdsSet[k]) next[k] = store.entries[k];
      }
      store.entries = next;
      writeStore(store);
    },
  };
})();
