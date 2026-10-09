(function (root) {
  "use strict";
  var GNH = (root.GNH = root.GNH || {});
  if (!GNH.engine && typeof require === "function") require("./engine.js");
  var engine = GNH.engine;

  var KEY = "gnh.settings.v1";
  var SINGLE_WORD = /^\p{L}+(?:-\p{L}+)*$/u;
  var FIELDS = ["mascSg", "mascPl", "femSg", "femPl", "neutralSg", "neutralPl"];

  function defaults() {
    return { primaryStyle: "neutral", fallbackStyle: "colon", disabledIds: [], customEntries: [] };
  }

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function validate(raw) {
    if (!isObject(raw)) return null;
    if (engine.STYLES.indexOf(raw.primaryStyle) < 0) return null;
    if (engine.STYLES.indexOf(raw.fallbackStyle) < 0 || raw.fallbackStyle === "neutral") return null;
    if (!Array.isArray(raw.disabledIds)) return null;
    if (!raw.disabledIds.every(function (id) { return typeof id === "string"; })) return null;
    if (!Array.isArray(raw.customEntries) || !raw.customEntries.every(isObject)) return null;
    return {
      primaryStyle: raw.primaryStyle,
      fallbackStyle: raw.fallbackStyle,
      disabledIds: raw.disabledIds.slice(),
      customEntries: raw.customEntries.slice()
    };
  }

  function parse(text) {
    try {
      return validate(JSON.parse(text));
    } catch (e) {
      return null;
    }
  }

  function serialize(settings) {
    return JSON.stringify(settings, null, 2);
  }

  function load(storage) {
    try {
      var text = storage.getItem(KEY);
      if (text === null) return { settings: defaults(), persistent: true };
      var parsed = parse(text);
      return parsed
        ? { settings: parsed, persistent: true }
        : { settings: defaults(), persistent: false };
    } catch (e) {
      return { settings: defaults(), persistent: false };
    }
  }

  function save(storage, settings) {
    try {
      storage.setItem(KEY, serialize(settings));
      return true;
    } catch (e) {
      return false;
    }
  }

  function deriveEntry(input) {
    if (!isObject(input)) return null;
    var v = {};
    FIELDS.forEach(function (field) {
      v[field] = typeof input[field] === "string" ? input[field].trim() : "";
    });
    if (!SINGLE_WORD.test(v.mascSg) || !SINGLE_WORD.test(v.mascPl)) return null;
    if (!v.femPl || v.femSg.length < 3 || !v.femSg.endsWith("in")) return null;
    var sg = /[sßxz]$/.test(v.mascSg) ? [v.mascSg] : [v.mascSg, v.mascSg + "s"];
    var pl = /(?:e|er|el)$/.test(v.mascPl) ? [v.mascPl, v.mascPl + "n"] : [v.mascPl];
    var entry = {
      id: v.mascSg.toLowerCase(),
      masc: { sg: sg, pl: pl },
      fem: { sg: v.femSg, pl: v.femPl },
      stem: v.femSg.slice(0, -2)
    };
    if (v.neutralSg || v.neutralPl) {
      entry.neutral = { kind: "noun" };
      if (v.neutralSg) entry.neutral.sg = v.neutralSg;
      if (v.neutralPl) entry.neutral.pl = v.neutralPl;
    }
    return entry;
  }

  function without(list, ids) {
    return list.filter(function (id) {
      return ids.indexOf(id) < 0;
    });
  }

  // disabledIds after a user entry was saved: the saved word is enabled, and
  // so is the id the entry had before the edit.
  function disabledAfterSave(disabledIds, id, previousId) {
    return without(disabledIds, [id, previousId]);
  }

  // disabledIds after a user entry was deleted. If a bundled word has the
  // same id, that word comes back and keeps its disabled state.
  function disabledAfterDelete(disabledIds, id, bundledIds) {
    return without(disabledIds, bundledIds.indexOf(id) < 0 ? [id] : []);
  }

  GNH.settings = {
    KEY: KEY,
    defaults: defaults,
    parse: parse,
    serialize: serialize,
    load: load,
    save: save,
    deriveEntry: deriveEntry,
    disabledAfterSave: disabledAfterSave,
    disabledAfterDelete: disabledAfterDelete
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = GNH.settings;
  }
})(typeof window !== "undefined" ? window : globalThis);
