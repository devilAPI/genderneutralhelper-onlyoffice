(function (root) {
  "use strict";
  var GNH = (root.GNH = root.GNH || {});

  var STYLES = ["neutral", "colon", "asterisk", "underscore", "binnenI", "slash", "pair"];

  function isStr(value) {
    return typeof value === "string" && value.length > 0;
  }

  function isFormList(value) {
    return Array.isArray(value) && value.length > 0 && value.every(isStr);
  }

  function validateEntry(entry) {
    if (!entry || typeof entry !== "object") return false;
    if (!isStr(entry.id) || !isStr(entry.stem)) return false;
    if (!entry.masc || !isFormList(entry.masc.sg) || !isFormList(entry.masc.pl)) return false;
    if (!entry.fem || !isStr(entry.fem.sg) || !isStr(entry.fem.pl)) return false;
    if (entry.neutral === undefined) return true;
    var n = entry.neutral;
    if (!n || (n.kind !== "noun" && n.kind !== "participle")) return false;
    if (n.sg !== undefined && !isStr(n.sg)) return false;
    if (n.pl !== undefined && !isStr(n.pl)) return false;
    if (n.kind === "participle") {
      return isStr(n.sg) && isStr(n.pl) && n.sg.endsWith("e") && n.pl.endsWith("e");
    }
    return true;
  }

  function mergeEntries(bundled, custom) {
    var customIds = new Set(custom.map(function (entry) {
      return entry && entry.id;
    }));
    return custom.concat(bundled.filter(function (entry) {
      return !customIds.has(entry.id);
    }));
  }

  function buildIndex(entries, disabledIds) {
    var disabled = new Set(disabledIds || []);
    var forms = new Map();
    var byId = new Map();
    var skipped = [];
    entries.forEach(function (entry) {
      if (!validateEntry(entry)) {
        skipped.push(entry && isStr(entry.id) ? entry.id : "?");
        return;
      }
      if (disabled.has(entry.id) || byId.has(entry.id)) return;
      byId.set(entry.id, entry);
      ["sg", "pl"].forEach(function (number) {
        entry.masc[number].forEach(function (form) {
          var hit = forms.get(form);
          if (!hit) {
            forms.set(form, { entryId: entry.id, numbers: [number] });
          } else if (hit.entryId === entry.id && hit.numbers.indexOf(number) < 0) {
            hit.numbers.push(number);
          }
        });
      });
    });
    return { forms: forms, byId: byId, skipped: skipped };
  }

  var WORD = /\p{L}+(?:-\p{L}+)*/gu;
  var GENDERED_AFTER = /^(?:[:*_]|\/-?)in(?:nen)?(?!\p{L})/u;
  var JOIN = "(?:\\s+(?:und|oder|bzw\\.)\\s+|\\s*\\/\\s*)";
  var ARTICLE = "(?:(?:der|die|den|dem|des)\\s+)?";
  var PAIR_BEFORE = new RegExp("(\\p{L}+)" + JOIN + ARTICLE + "$", "u");
  var PAIR_AFTER = new RegExp("^" + JOIN + ARTICLE + "(\\p{L}+)", "u");

  function countBefore(text, form, start) {
    var count = 0;
    var at = text.indexOf(form);
    while (at !== -1 && at < start) {
      count++;
      at = text.indexOf(form, at + form.length);
    }
    return count;
  }

  function isFeminine(entry, match) {
    return !!match && (match[1] === entry.fem.sg || match[1] === entry.fem.pl);
  }

  function matchToken(text, token, prevToken, index) {
    var hit = index.forms.get(token.word);
    if (!hit) return null;
    var before = text.slice(0, token.start);
    var after = text.slice(token.end);
    if (before.endsWith("-") || after.startsWith("-")) return null;
    if (GENDERED_AFTER.test(after)) return null;
    var entry = index.byId.get(hit.entryId);
    if (isFeminine(entry, PAIR_BEFORE.exec(before))) return null;
    if (isFeminine(entry, PAIR_AFTER.exec(after))) return null;
    var gap = prevToken ? text.slice(prevToken.end, token.start) : "";
    return {
      form: token.word,
      start: token.start,
      ordinal: countBefore(text, token.word, token.start),
      entryId: hit.entryId,
      numbers: hit.numbers.slice(),
      prev: prevToken && /^\s+$/.test(gap) ? prevToken.word.toLowerCase() : null,
      context: { before: before.slice(-40), after: after.slice(0, 40) }
    };
  }

  function scanParagraph(text, index) {
    var findings = [];
    var prevToken = null;
    var match;
    WORD.lastIndex = 0;
    while ((match = WORD.exec(text)) !== null) {
      var token = { word: match[0], start: match.index, end: match.index + match[0].length };
      var finding = matchToken(text, token, prevToken, index);
      if (finding) findings.push(finding);
      prevToken = token;
    }
    return findings;
  }

  function scanDocument(paragraphs, index) {
    var all = [];
    paragraphs.forEach(function (text, p) {
      scanParagraph(String(text), index).forEach(function (finding) {
        finding.p = p;
        all.push(finding);
      });
    });
    return all;
  }

  function findingKey(finding) {
    return [finding.p, finding.form, finding.context.before.slice(-20), finding.context.after.slice(0, 20)].join("|");
  }

  GNH.engine = {
    STYLES: STYLES,
    validateEntry: validateEntry,
    mergeEntries: mergeEntries,
    buildIndex: buildIndex,
    scanParagraph: scanParagraph,
    scanDocument: scanDocument,
    findingKey: findingKey
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = GNH.engine;
  }
})(typeof window !== "undefined" ? window : globalThis);
