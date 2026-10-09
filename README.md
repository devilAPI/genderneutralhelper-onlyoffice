# Gendergerechte Sprache — OnlyOffice plugin

Finds generic-masculine German person nouns in a text document and offers
replacements in the style you choose: neutral form (Mitarbeitende), colon,
asterisk, underscore, Binnen-I, slash or pair form. Nothing in the document
changes until you click a replace button. The plugin works offline.

Requires OnlyOffice 8.1 or newer. Text documents only.

## Install (Desktop Editors, Linux)

```sh
npm run install:desktop
```

Then restart OnlyOffice Desktop Editors, open a text document and start
"Gendergerechte Sprache" from the Plugins tab.

On other systems, copy `config.json`, `index.html`, `resources`, `scripts`
and `translations` into a folder named
`{6F1C2A9E-3B7D-4E58-9A41-C2D07B5E8F13}` inside the editor's `sdkjs-plugins`
directory.

## Use

1. Choose a writing style and click "Dokument prüfen".
2. Click a finding to see it in the document. Pick a suggestion from the
   list, then "Ersetzen", or use "Alle ersetzen".
3. "Ignorieren" hides a finding until the next scan. "Nie markieren" turns
   the word off permanently; turn it back on under "Einstellungen".

Add your own words under "Einstellungen". Settings are stored on this
computer; use export and import to move them.

## Limitations

- Articles, pronouns and adjectives are not rewritten. Singular suggestions
  carry a hint to check them.
- Only words in the dictionary or your own entries are found.
- Words like "Mitarbeiter" are identical in singular and plural; both
  suggestions are offered, plural first.
- The ending of neutral participle forms (Mitarbeitende / Mitarbeitenden) is
  chosen from the preceding word and can be wrong; the other ending is always
  the second suggestion.
- Headers, footers, footnotes and text boxes may not be scanned.
- An ignored finding can reappear after replacing a word within about 20
  characters of it.

## Development

```sh
npm test
```

The language logic in `scripts/engine.js`, `scripts/dictionary.js` and
`scripts/settings.js` is unit-tested. `scripts/document.js`,
`scripts/panel.js` and `scripts/settings-view.js` are covered by the manual
checklist below.

## Manual test checklist

Run `npm run install:desktop`, restart the editor, and use a document with:

- `Die Mitarbeiterin und der Mitarbeiter kommen.` (second "Mitarbeiter" bold)
- `Die Lehrer danken den Kunden und allen Mitarbeitern.`
- a table cell containing `Mitarbeiter`

Check:

- [ ] Scan lists the findings; "Mitarbeiterin" is not listed.
- [ ] Clicking a finding selects the word.
- [ ] "Ersetzen" replaces one word and keeps bold formatting.
- [ ] The word in the table cell can be replaced.
- [ ] Ctrl+Z undoes a replacement.
- [ ] Changing the style updates suggestions without a new scan.
- [ ] "Ignorieren" hides a finding until the next scan.
- [ ] "Nie markieren" removes the word; re-enabling it under
      "Mitgelieferte Wörter" brings it back.
- [ ] Editing the document after a scan, then replacing, shows the
      "document has changed" message and changes nothing.
- [ ] "Alle ersetzen" replaces all listed findings.
- [ ] Adding an own entry (Tutor / Tutoren / Tutorin / Tutorinnen) makes
      "Tutoren" a finding; editing and deleting it works.
- [ ] An incomplete own entry shows the validation message.
- [ ] Export saves a JSON file; importing it asks for confirmation and
      restores the settings; importing a non-settings file is rejected.
- [ ] Settings survive an editor restart.
- [ ] The panel is readable in a light and a dark editor theme.
- [ ] With the editor in English, the panel is in English.
