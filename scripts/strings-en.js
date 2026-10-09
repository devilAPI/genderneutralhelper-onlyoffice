(function (root) {
  "use strict";
  var GNH = (root.GNH = root.GNH || {});
  if (!GNH.strings && typeof require === "function") require("./strings.js");

  // English UI strings; same keys as GNH.strings.
  GNH.stringsEn = {
    style: "Writing style",
    scan: "Scan document",
    retry: "Try again",
    replaceAll: "Replace all",
    settings: "Settings",
    idle: "Not scanned yet.",
    scanning: "Scanning document …",
    none: "No findings.",
    count: "Findings: %1",
    error: "Could not access the document.",
    stale: "The document has changed. Please scan again.",
    replacing: "Replacing … %1",
    skipped: "Skipped because the document changed: %1",
    noStorage: "Settings cannot be saved.",
    jump: "Show in document",
    chooseSuggestion: "Choose suggestion",
    replace: "Replace",
    ignore: "Ignore",
    never: "Never flag",
    hint_checkArticle: "Please adjust articles and adjectives by hand.",
    hint_checkCase: "Please check the grammatical case of the replacement.",
    hint_noNeutralForm: "No neutral form available.",
    style_neutral: "Neutral form (Mitarbeitende)",
    style_colon: "Colon (Mitarbeiter:innen)",
    style_asterisk: "Asterisk (Mitarbeiter*innen)",
    style_underscore: "Underscore (Mitarbeiter_innen)",
    style_binnenI: "Internal I (MitarbeiterInnen)",
    style_slash: "Slash (Mitarbeiter/-innen)",
    style_pair: "Pair form (Mitarbeiterinnen und Mitarbeiter)",
    fallback: "Fallback when there is no neutral form",
    ownEntries: "Your entries",
    mascSg: "Masculine singular",
    mascPl: "Masculine plural",
    femSg: "Feminine singular",
    femPl: "Feminine plural",
    neutralSg: "Neutral singular (optional)",
    neutralPl: "Neutral plural (optional)",
    save: "Save",
    edit: "Edit",
    remove: "Delete",
    invalidEntry: "Please fill in every required field with a single word. The feminine singular must end in “in”.",
    skippedEntries: "Invalid entries are not used: %1",
    bundled: "Bundled words",
    search: "Search word",
    more: "More matches: %1",
    exportFile: "Export",
    importFile: "Import",
    importConfirm: "Replace the current settings with the file?",
    importInvalid: "The file does not contain valid settings.",
    yes: "Yes",
    cancel: "Cancel"
  };

  // The string table for an editor language such as "en", "en-US" or "de-DE".
  GNH.pickStrings = function (lang) {
    return typeof lang === "string" && /^en/i.test(lang) ? GNH.stringsEn : GNH.strings;
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { en: GNH.stringsEn, pickStrings: GNH.pickStrings };
  }
})(typeof window !== "undefined" ? window : globalThis);
