# Gender-Neutral Wording Helper for OnlyOffice — Design

Date: 2026-10-09
Status: approved

## Purpose

An OnlyOffice plugin for German text documents. It finds generic-masculine
person nouns such as "Mitarbeiter" and offers replacements such as
"Mitarbeitende" or "Mitarbeiter:innen" in a writing style the user chooses.
The document changes only when the user clicks a replace button.

## Scope

In scope:

- Text documents (the `word` editor) in OnlyOffice Desktop Editors and
  OnlyOffice Docs.
- Detection from a bundled dictionary plus user-defined entries.
- Seven output styles (see "Styles").
- Panel UI in German with an English translation.
- Fully local operation: no network requests.

Out of scope:

- Spreadsheets and presentations.
- Rewriting articles, pronouns, adjectives or verbs around a finding.
- Heuristic detection of words that are not in the dictionary.
- Highlighting findings inside the document.
- Text outside what `ApiDocument.GetAllParagraphs()` returns. Headers,
  footers, footnotes and text boxes are not guaranteed to be scanned.
- Syncing settings between machines (export and import cover this manually).

## Approach

Plain JavaScript, HTML and CSS with no build step: the repository folder is
the installable plugin. All language logic lives in modules that do not touch
the OnlyOffice API, so they run under Node's built-in test runner. One module
is the only place that talks to the editor.

## File layout

```
config.json                 plugin manifest
index.html                  panel markup
resources/css/panel.css     panel styling (uses OnlyOffice theme variables)
resources/img/              icons (light and dark, 1x and 2x)
translations/langs.json     list of available UI translations
translations/en-US.json     English translation of the German UI strings
scripts/dictionary.js       bundled entries
scripts/engine.js           pure logic: tokenise, match, suggest
scripts/settings.js         load, save, parse of user settings
scripts/strings.js          all UI strings in German (the source language)
scripts/document.js         OnlyOffice API access
scripts/panel.js            findings UI
scripts/settings-view.js    settings section UI
tools/install-desktop.sh    copies the plugin into Desktop Editors
test/engine.test.js         unit tests
test/dictionary.test.js     dictionary consistency tests
test/settings.test.js       settings validation tests
test/translations.test.js   every UI string has a translation
README.md                   install instructions and manual test checklist
```

Scripts are loaded with plain `<script>` tags and attach to one global
namespace object, `GNH`. Each pure module also exports through
`module.exports` when that exists, so the tests can `require` it.

## Manifest

`config.json` declares one variation:

- `type`: `panelRight`
- `EditorsSupport`: `["word"]`
- `isVisual`: `true`, `isModal`: `false`, `initDataType`: `none`
- `url`: `index.html`
- name and description with `de` and `en` localisations

`panelRight` needs OnlyOffice 8.1 or newer. That is the minimum supported
version and the README states it.

## Dictionary

`scripts/dictionary.js` exports an array of at least 200 entries covering
common occupational, role and group nouns.

Entry shape:

```js
{
  id: "mitarbeiter",          // unique, stable, lower-case
  masc: {                     // masculine forms that get flagged
    sg: ["Mitarbeiter", "Mitarbeiters"],
    pl: ["Mitarbeiter", "Mitarbeitern"]
  },
  fem: { sg: "Mitarbeiterin", pl: "Mitarbeiterinnen" },
  stem: "Mitarbeiter",        // base for colon, asterisk, underscore, Binnen-I
  neutral: {                  // optional
    kind: "participle",       // "participle" or "noun"
    sg: "Mitarbeitende",      // participle: the form ending in -e
    pl: "Mitarbeitende"
  }
}
```

Rules:

- `masc.sg` and `masc.pl` list every inflected form. A form may appear in
  both lists ("Mitarbeiter"); that marks it as ambiguous in number.
- `stem` is the string that precedes `in` / `innen` in the feminine form
  ("Kund" for Kunde, "Ärzt" for Arzt). It is stored explicitly so that weak
  nouns and umlaut plurals need no special cases in the engine.
- `neutral.kind: "noun"` is an ordinary noun with fixed forms
  ("Lehrkraft" / "Lehrkräfte"); `sg` and `pl` may each be a string or omitted.
- `neutral.kind: "participle"` is an adjectival noun whose ending depends on
  the preceding word (see "Neutral style").
- Entries without `neutral` have no neutral form.

User-defined entries use the same shape. The settings editor collects
masculine singular, masculine plural, feminine singular, feminine plural and
optional neutral singular and plural. From these it derives:

- `stem`: the feminine singular without its final `in`.
- extra masculine forms: singular plus `s` (genitive), and plural plus `n`
  (dative) when the plural ends in `e`, `er` or `el`.
- `neutral.kind`: always `"noun"` for user entries.

A user entry with the same `id` as a bundled entry replaces it.

## Engine

`scripts/engine.js` is pure. Its three main functions are described here; it
also exports small helpers built on them (`scanDocument`, `suggestAll`,
`orderForReplace`, `findingKey`, `validateEntry`, `mergeEntries`).

### `buildIndex(entries, disabledIds)`

Returns a map from each masculine form to the entries and numbers
(`sg`, `pl`) it can stand for. Disabled entries are left out.

### `scanParagraph(text, index)`

Returns the findings in one paragraph's text. Each finding has:

- `form`: the matched word as written
- `start`: character offset in the paragraph text
- `ordinal`: zero-based position of this match among all case-sensitive
  substring occurrences of `form` in the paragraph text. `document.js` uses it
  to pick the matching result of the editor's search.
- `entryId`
- `numbers`: `["sg"]`, `["pl"]` or `["sg", "pl"]`
- `prev`: the preceding word, lower-cased, or `null`
- `context`: up to 40 characters of text on each side, for the panel

Matching rules:

- A word is a maximal run of letters (including ä, ö, ü, ß) and hyphens.
  Matching compares whole words case-sensitively against the index, so
  "Mitarbeitergespräch", "Mitarbeiter-Gespräch" and "Mitarbeiterin" are not
  flagged.
- A match is skipped when it is already gendered: when it is directly followed
  by `:`, `*`, `_`, `/` or `/-` and then `in` or `innen`.
- A match is skipped when it is part of a pair: when the entry's feminine
  form stands directly before or after it, joined by "und", "oder", "bzw." or
  "/".

### `suggest(finding, entry, style, fallbackStyle)`

Returns an ordered list of suggestions. Each has `text`, `style`, `number`
and an optional `hint` key. The first item is the default replacement.

For a finding that is ambiguous in number, the list holds the plural
suggestion first, then the singular one. Plural comes first because generic
masculines in running text are more often plural.

Any singular suggestion in a gendered style carries the hint `checkArticle`,
because the surrounding article and adjectives will usually need manual
editing.

## Styles

Example for "Mitarbeiter" (stem "Mitarbeiter") and "Kunde" (stem "Kund"):

| Style id | Plural | Singular |
|---|---|---|
| `neutral` | Mitarbeitende | Mitarbeitende |
| `colon` | Mitarbeiter:innen, Kund:innen | Mitarbeiter:in, Kund:in |
| `asterisk` | Mitarbeiter*innen | Mitarbeiter*in |
| `underscore` | Mitarbeiter_innen | Mitarbeiter_in |
| `binnenI` | MitarbeiterInnen | MitarbeiterIn |
| `slash` | Mitarbeiter/-innen, Kundinnen/Kunden | Mitarbeiter/-in, Kundin/Kunde |
| `pair` | Mitarbeiterinnen und Mitarbeiter | Mitarbeiterin oder Mitarbeiter |

Details:

- Colon, asterisk, underscore and Binnen-I are `stem` + separator + `in` or
  `innen`. They do not inflect further.
- Slash uses the short form `<masc>/-in(nen)` only when the matched masculine
  form equals `stem`. Otherwise it writes both words in full, feminine first,
  keeping the matched masculine form.
- Pair writes the feminine form, then "und" (plural) or "oder" (singular),
  then the matched masculine form unchanged, so the case is preserved
  ("Mitarbeiterinnen und Mitarbeitern").

### Neutral style

- If the entry has no neutral form for the finding's number, the engine uses
  `fallbackStyle` instead and marks the suggestion with the hint
  `noNeutralForm`.
- `kind: "noun"`: the stored form is used as is, with the hint `checkCase`
  when the matched masculine form is a genitive or dative form (it differs
  from the first form in its list).
- `kind: "participle"`: the ending is chosen from `prev`.
  - After a word in the weak-ending list (der, die, den, dem, des, diese,
    diesen, dieser, alle, allen, aller, unsere, unseren, unserer, ihre, ihren,
    ihrer, keine, keinen, keiner, beide, beiden, and the contracted
    prepositions zum, zur, im, am, vom, beim), the form ends in `-en`
    ("die Mitarbeitenden").
  - When the matched masculine form is a dative plural (ends in `n` and
    differs from the first plural form), the form ends in `-en`.
  - Otherwise the form ends in `-e`.
  - The other ending is always offered as the second suggestion, because this
    rule is an approximation.

## Settings

`scripts/settings.js` stores one JSON object in `localStorage` under the key
`gnh.settings.v1`:

```js
{
  primaryStyle: "neutral",
  fallbackStyle: "colon",
  disabledIds: [],
  customEntries: []
}
```

- Defaults are as shown.
- `fallbackStyle` cannot be `neutral`.
- All reads and writes are wrapped in try/catch. If storage is unavailable or
  the stored value is invalid, the plugin runs with defaults and the panel
  shows a one-line notice that settings will not be saved.
- Export downloads the object as `gender-helper-settings.json`. Import reads a
  file, validates its shape, and replaces the stored object after the user
  confirms. Invalid files are rejected with a message and change nothing.

## Editor access

`scripts/document.js` exposes three asynchronous functions. Each wraps
`window.Asc.plugin.callCommand`, passes its inputs through `Asc.scope`, and
resolves with the command's return value. A target describes one finding:
paragraph index, form, ordinal, start offset, the paragraph text seen at scan
time, and the replacement.

- `readParagraphs()` returns the array of paragraph texts from
  `Api.GetDocument().GetAllParagraphs()`.
- `select(target)` finds the range with
  `paragraph.Search(form, true)[ordinal]` and selects it.
- `replaceMany(targets)` replaces each target's range with its replacement in
  one command, keeping the formatting of the replaced text. A single
  replacement is a list of one. Targets are processed from the last paragraph
  to the first, and within a paragraph from the last position to the first,
  so earlier ordinals stay valid.

Stale-position check: before the first change to a paragraph, its current
text is compared with the text seen at scan time. If they differ, or the
range does not exist, that target is skipped and nothing is changed for it.
Both functions resolve with `{ done, stale }`: how many targets were applied
and how many were skipped as stale.

Implementation risk: the exact API call that replaces a range's text while
keeping its formatting must be confirmed in a running editor. The
implementation plan tests this first, before the UI is built on top of it.

## Panel

Top to bottom:

1. Style selector (primary style) and a "Scan document" button.
2. A summary line: number of findings, or a state message.
3. The findings list. Each item shows the context snippet with the word
   emphasised, the default suggestion, a dropdown with the other suggestions,
   any hint, and the buttons "Replace" and "Ignore".
4. "Replace all" for every finding still listed.
5. A collapsible settings section: fallback style, the list of user entries
   with add, edit and delete, a searchable list of bundled entries with a
   disable toggle, and export and import.

Behaviour:

- Clicking an item selects the word in the document.
- "Replace" replaces that finding with the chosen suggestion, then rescans the
  document so that positions are current.
- "Replace all" uses each finding's currently chosen suggestion, then rescans.
- "Ignore" hides the finding until the next manual scan. A third button,
  "Never flag", adds the entry to `disabledIds`.
- Changing the primary style recomputes suggestions without rescanning.
- A stale result shows "The document has changed. Please scan again." and
  leaves the list as it is.
- States: not scanned yet, scanning, no findings, findings, error.
- The panel follows the editor's light or dark theme through the
  `onThemeChanged` plugin event.

All visible strings are defined in German in `scripts/strings.js` and
translated through the editor's translation mechanism; `en-US.json` holds the
English versions. Hints are stored as keys (`checkArticle`, `checkCase`,
`noNeutralForm`) and translated in the panel.

## Error handling

- Editor command fails or returns nothing: the panel shows the error state
  with a retry button; the document is not modified.
- Stale positions: handled as described under "Editor access".
- Storage failure and invalid import: handled as described under "Settings".
- A dictionary or user entry that fails validation is skipped by
  `buildIndex`, and the settings section lists skipped user entries.

## Testing

Automated, run with `node --test`:

- Engine: whole-word matching, compounds and hyphenated words not flagged,
  already-gendered and paired forms skipped, `ordinal` correct when the form
  also occurs inside longer words, number ambiguity, every style for an
  `-er` noun, a weak noun and an umlaut noun, slash long form, pair case
  preservation, participle endings after weak-list words, fallback when no
  neutral form exists, hints.
- Dictionary: unique ids, required fields present, `fem.sg` equals
  `stem` + "in", `fem.pl` equals `stem` + "innen", no masculine form claimed
  by two entries.
- Settings: defaults, validation, rejection of invalid imports, user entry
  derivation.

Manual, listed in the README and run in the editor:

- Install in Desktop Editors and scan a sample document.
- Select, replace and replace all, including a word in bold text and a word
  inside a table.
- Undo after replace.
- Edit the document between scan and replace to trigger the stale message.
- Switch the editor theme and UI language.

`document.js` and `panel.js` are covered only by the manual checklist.
