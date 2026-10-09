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

  GNH.engine = {
    STYLES: STYLES,
    validateEntry: validateEntry,
    mergeEntries: mergeEntries,
    buildIndex: buildIndex
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = GNH.engine;
  }
})(typeof window !== "undefined" ? window : globalThis);
