/**
 * Client-side mail filter evaluation (ELVish). Rules sync via /api/v1/filters;
 * matching uses decrypted metadata on-device for body-based conditions. At SMTP
 * ingest the server also applies the same rules using envelope/headers/size only
 * (see mailpipe.evalIngestPrivacyFilters).
 */
(function () {
  var RULES_CAP = 50;

  var SUPPORTED_CONDITION_TYPES = {
    sender: true,
    subject: true,
    recipient: true,
    body: true,
    attachment: true,
    size: true,
    header: false,
  };

  var SUPPORTED_ACTION_TYPES = {
    move: true,
    mark_read: true,
    delete: true,
    mark_important: false,
    label: false,
    forward: false,
  };

  function norm(s) {
    return String(s == null ? '' : s)
      .trim()
      .toLowerCase();
  }

  function stableRulesHash(rules) {
    try {
      var slim = (rules || []).map(function (r) {
        return {
          id: r.id,
          enabled: !!r.enabled,
          priority: Number(r.priority) || 0,
          conditions: r.conditions || [],
          actions: r.actions || [],
        };
      });
      var json = JSON.stringify(slim);
      var h = 5381;
      for (var i = 0; i < json.length; i++) {
        h = (h * 33) ^ json.charCodeAt(i);
      }
      return 'r' + (h >>> 0).toString(16);
    } catch (_) {
      return 'r0';
    }
  }

  function normalizeRules(rawList) {
    var list = Array.isArray(rawList) ? rawList.slice() : [];
    list = list
      .filter(function (r) {
        return r && r.enabled !== false && String(r.id || '').trim();
      })
      .sort(function (a, b) {
        var pa = Number(a.priority) || 0;
        var pb = Number(b.priority) || 0;
        if (pb !== pa) return pb - pa;
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      });
    if (list.length > RULES_CAP) list = list.slice(0, RULES_CAP);
    return list;
  }

  function buildContext(message, opts) {
    opts = opts || {};
    var to = [];
    if (Array.isArray(message.to_addrs)) to = message.to_addrs.map(function (x) { return String(x || ''); });
    var hasAtt =
      !!message.has_attachments ||
      (Array.isArray(message.attachments) && message.attachments.length > 0);
    var ctx = {
      subject: String(message.subject || ''),
      from: String(message.from_addr || ''),
      to: to,
      bodyText: typeof opts.bodyText === 'string' ? opts.bodyText : null,
      hasAttachments: hasAtt,
      sizeBytes: typeof opts.sizeBytes === 'number' ? opts.sizeBytes : null,
    };
    return ctx;
  }

  function matchString(hay, needle, operator) {
    var h = norm(hay);
    var n = norm(needle);
    if (!n && operator !== 'equals') return false;
    switch (operator) {
      case 'equals':
        return h === n;
      case 'starts_with':
        return h.startsWith(n);
      case 'ends_with':
        return h.endsWith(n);
      case 'matches':
      case 'contains':
        return n !== '' && h.indexOf(n) !== -1;
      default:
        return false;
    }
  }

  function conditionMatches(cond, ctx) {
    if (!cond || typeof cond !== 'object') return true;
    var type = String(cond.type || '').trim().toLowerCase();
    var op = String(cond.operator || 'contains').trim().toLowerCase();
    var val = cond.value == null ? '' : String(cond.value);

    if (!SUPPORTED_CONDITION_TYPES[type]) return false;
    if (type === 'header') return false;

    if (type === 'sender') {
      return matchString(ctx.from, val, op);
    }
    if (type === 'subject') {
      return matchString(ctx.subject, val, op);
    }
    if (type === 'recipient') {
      var addrs = ctx.to || [];
      for (var i = 0; i < addrs.length; i++) {
        if (matchString(addrs[i], val, op)) return true;
      }
      return false;
    }
    if (type === 'body') {
      if (ctx.bodyText == null || ctx.bodyText === '') return false;
      return matchString(ctx.bodyText, val, op);
    }
    if (type === 'attachment') {
      var want = norm(val);
      if (want === '0' || want === 'false' || want === 'no') return !ctx.hasAttachments;
      return !!ctx.hasAttachments;
    }
    if (type === 'size') {
      if (ctx.sizeBytes == null || !isFinite(ctx.sizeBytes)) return false;
      var num = parseInt(val, 10);
      if (!isFinite(num)) return false;
      switch (op) {
        case 'greater_than':
          return ctx.sizeBytes > num;
        case 'less_than':
          return ctx.sizeBytes < num;
        case 'equals':
          return ctx.sizeBytes === num;
        default:
          return false;
      }
    }
    return false;
  }

  function ruleMatches(rule, ctx) {
    var conds = Array.isArray(rule.conditions) ? rule.conditions : [];
    if (conds.length === 0) return false;
    for (var i = 0; i < conds.length; i++) {
      if (!conditionMatches(conds[i], ctx)) return false;
    }
    return true;
  }

  function pickFirstMatchingRule(rules, ctx) {
    for (var i = 0; i < rules.length; i++) {
      if (ruleMatches(rules[i], ctx)) return rules[i];
    }
    return null;
  }

  function actionFingerprint(actions) {
    var acts = Array.isArray(actions) ? actions : [];
    var slim = acts.map(function (a) {
      return { type: String(a.type || ''), value: a.value == null ? '' : String(a.value) };
    });
    try {
      return JSON.stringify(slim);
    } catch (_) {
      return '[]';
    }
  }

  function filterSupportedActions(actions) {
    var out = [];
    var acts = Array.isArray(actions) ? actions : [];
    for (var i = 0; i < acts.length; i++) {
      var t = String(acts[i].type || '').trim().toLowerCase();
      if (SUPPORTED_ACTION_TYPES[t]) out.push(acts[i]);
    }
    return out;
  }

  /**
   * @returns {Promise<{ applied: boolean, skipped?: string[] }>}
   */
  function applyActions(messageId, actions) {
    var manifest = window.ElvishMailManifest;
    if (!manifest || !messageId) return Promise.resolve({ applied: false });
    var acts = filterSupportedActions(actions);
    if (acts.length === 0) return Promise.resolve({ applied: false });
    var skipped = [];

    function run(idx) {
      if (idx >= acts.length) return Promise.resolve();
      var a = acts[idx];
      var t = String(a.type || '').trim().toLowerCase();
      var v = a.value == null ? '' : String(a.value);
      if (t === 'move') {
        var folder = norm(v);
        if (!folder) return run(idx + 1);
        return manifest.moveMessage(messageId, folder).then(function () { return run(idx + 1); });
      }
      if (t === 'mark_read') {
        return manifest.setMessageRead(messageId, true).then(function () { return run(idx + 1); });
      }
      if (t === 'delete') {
        return manifest.deleteMessage(messageId, { permanent: false }).then(function () { return run(idx + 1); });
      }
      skipped.push(t);
      return run(idx + 1);
    }
    return run(0).then(function () {
      return { applied: true, skipped: skipped.length ? skipped : undefined };
    });
  }

  /**
   * @param {object[]} messages
   * @param {object[]} rawRules from API
   * @param {object} options { bodyByMessageId?: Record<string,string>, onReload?: () => void }
   */
  function runInboxFilterPass(messages, rawRules, options) {
    options = options || {};
    var Ledger = window.ElvishMailFilterLedger;
    var rules = normalizeRules(rawRules || []);
    var rh = stableRulesHash(rules);
    if (Ledger && typeof Ledger.syncRulesHash === 'function') Ledger.syncRulesHash(rh);

    var idSet = {};
    for (var m = 0; m < messages.length; m++) {
      if (messages[m] && messages[m].id) idSet[messages[m].id] = true;
    }
    if (Ledger && typeof Ledger.pruneMissing === 'function') Ledger.pruneMissing(idSet);

    var bodyById = options.bodyByMessageId || {};
    var maxConcurrent = 3;
    var queue = messages.slice();
    var inFlight = 0;
    var reloadPending = false;

    function scheduleReload() {
      reloadPending = true;
    }

    return new Promise(function (resolve) {
      function pump() {
        while (inFlight < maxConcurrent && queue.length) {
          var msg = queue.shift();
          if (!msg || !msg.id) continue;
          var bodyText = bodyById[msg.id];
          var ctx = buildContext(msg, { bodyText: bodyText != null ? bodyText : null });
          var hit = pickFirstMatchingRule(rules, ctx);
          if (!hit) continue;
          var acts = filterSupportedActions(hit.actions || []);
          if (!acts.length) continue;
          var fp = actionFingerprint(acts);
          if (Ledger && typeof Ledger.alreadyApplied === 'function' && Ledger.alreadyApplied(msg.id, hit.id, fp, rh)) {
            continue;
          }
          inFlight += 1;
          applyActions(msg.id, hit.actions || [])
            .then(function () {
              if (Ledger && typeof Ledger.record === 'function') Ledger.record(msg.id, hit.id, fp, rh);
              scheduleReload();
            })
            .catch(function () {
              /* ignore individual failures */
            })
            .then(function () {
              inFlight -= 1;
              pump();
            });
        }
        if (inFlight === 0 && queue.length === 0) {
          if (reloadPending && typeof options.onReload === 'function') {
            try {
              options.onReload();
            } catch (_) {
              /* */
            }
          }
          resolve({ ok: true });
        }
      }
      pump();
    });
  }

  window.ElvishMailFilterEngine = {
    RULES_CAP: RULES_CAP,
    SUPPORTED_CONDITION_TYPES: SUPPORTED_CONDITION_TYPES,
    SUPPORTED_ACTION_TYPES: SUPPORTED_ACTION_TYPES,
    stableRulesHash: stableRulesHash,
    normalizeRules: normalizeRules,
    buildContext: buildContext,
    conditionMatches: conditionMatches,
    ruleMatches: ruleMatches,
    pickFirstMatchingRule: pickFirstMatchingRule,
    actionFingerprint: actionFingerprint,
    applyActions: applyActions,
    runInboxFilterPass: runInboxFilterPass,
  };
})();
