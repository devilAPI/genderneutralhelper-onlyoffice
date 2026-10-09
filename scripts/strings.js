(function (root) {
  "use strict";
  var GNH = (root.GNH = root.GNH || {});

  GNH.strings = {
    style: "Schreibweise",
    scan: "Dokument prüfen",
    retry: "Erneut versuchen",
    replaceAll: "Alle ersetzen",
    settings: "Einstellungen",
    idle: "Noch nicht geprüft.",
    scanning: "Dokument wird geprüft …",
    none: "Keine Fundstellen.",
    count: "Fundstellen: %1",
    error: "Der Zugriff auf das Dokument ist fehlgeschlagen.",
    stale: "Das Dokument wurde geändert. Bitte erneut prüfen.",
    skipped: "Übersprungen, weil sich das Dokument geändert hat: %1",
    noStorage: "Einstellungen können nicht gespeichert werden.",
    jump: "Im Dokument anzeigen",
    replace: "Ersetzen",
    ignore: "Ignorieren",
    never: "Nie markieren",
    hint_checkArticle: "Artikel und Adjektive bitte von Hand anpassen.",
    hint_checkCase: "Bitte den Fall der Ersetzung prüfen.",
    hint_noNeutralForm: "Keine neutrale Form vorhanden.",
    style_neutral: "Neutrale Form (Mitarbeitende)",
    style_colon: "Doppelpunkt (Mitarbeiter:innen)",
    style_asterisk: "Sternchen (Mitarbeiter*innen)",
    style_underscore: "Unterstrich (Mitarbeiter_innen)",
    style_binnenI: "Binnen-I (MitarbeiterInnen)",
    style_slash: "Schrägstrich (Mitarbeiter/-innen)",
    style_pair: "Paarform (Mitarbeiterinnen und Mitarbeiter)",
    fallback: "Ersatz, wenn es keine neutrale Form gibt",
    ownEntries: "Eigene Einträge",
    mascSg: "Maskulin Singular",
    mascPl: "Maskulin Plural",
    femSg: "Feminin Singular",
    femPl: "Feminin Plural",
    neutralSg: "Neutral Singular (optional)",
    neutralPl: "Neutral Plural (optional)",
    save: "Speichern",
    edit: "Bearbeiten",
    remove: "Löschen",
    invalidEntry: "Bitte alle Pflichtfelder mit je einem Wort ausfüllen. Die feminine Singularform muss auf „in“ enden.",
    skippedEntries: "Ungültige Einträge werden nicht verwendet: %1",
    bundled: "Mitgelieferte Wörter",
    search: "Wort suchen",
    more: "Weitere Treffer: %1",
    exportFile: "Exportieren",
    importFile: "Importieren",
    importConfirm: "Aktuelle Einstellungen durch die Datei ersetzen?",
    importInvalid: "Die Datei enthält keine gültigen Einstellungen.",
    yes: "Ja",
    cancel: "Abbrechen"
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GNH.strings;
  }
})(typeof window !== "undefined" ? window : globalThis);
