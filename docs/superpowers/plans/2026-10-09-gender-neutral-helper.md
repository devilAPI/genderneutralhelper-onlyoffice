# Gender-Neutral Wording Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an OnlyOffice text-document plugin that lists German generic-masculine person nouns in a right-hand panel and replaces them in a chosen gender-inclusive style.

**Architecture:** Plain JavaScript with no build step; the repository folder is the plugin. Language logic (`engine.js`, `dictionary.js`, `settings.js`, `strings.js`) is pure and unit-tested under Node. `document.js` is the only file that calls the OnlyOffice API; `panel.js` and `settings-view.js` render the UI.

**Tech Stack:** ES2018 JavaScript, HTML, CSS, OnlyOffice plugin API (`window.Asc.plugin`), Node 26 built-in test runner (`node --test`), `rsvg-convert` for icons.

**Spec:** `docs/superpowers/specs/2026-10-09-gender-neutral-helper-design.md`

## Global Constraints

- Minimum OnlyOffice version 8.1 (`panelRight`). Development machine has Desktop Editors 9.4.0.
- No network requests at runtime. `index.html` loads the plugin SDK from `./../v1/plugins.js` and `./../v1/plugins.css`, which exist locally next to every installed plugin.
- No build step, no npm dependencies.
- Every script attaches to the global `GNH` object. Pure modules also set `module.exports`.
- Style ids, exactly: `neutral`, `colon`, `asterisk`, `underscore`, `binnenI`, `slash`, `pair`.
- Hint keys, exactly: `checkArticle`, `checkCase`, `noNeutralForm`.
- Settings storage key: `gnh.settings.v1`.
- Plugin GUID: `asc.{6F1C2A9E-3B7D-4E58-9A41-C2D07B5E8F13}`.
- German is the source language of all UI strings; `translations/en-US.json` maps each German string to English.
- Never put document text or user input into `innerHTML`. Build DOM with `createElement` and `textContent`.
- Functions passed to `callCommand` run inside the editor: they cannot use closures, receive data only through `Asc.scope`, and return a JSON string.
- End every commit message with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run all commands from the repository root, `/home/devlapi/Dokumente/GitHub/genderneutralhelper-onlyoffice`.

## Review Focus

1. Truncated compounds such as "Mitarbeiter- und Kundenbefragung": the word before the hyphen must not be flagged. Test in Task 3.
2. Pairs written with articles, "die Mitarbeiterinnen und die Mitarbeiter": must not be flagged. Test in Task 3.
3. "Replace all" when a replacement text contains another finding's form in the same paragraph ("Mitarbeiterinnen und Mitarbeitern" contains "Mitarbeiter"): later positions must be replaced first so earlier ordinals stay valid. Test in Task 4 (`orderForReplace`).
4. Missing, throwing or corrupt `localStorage`, and import files with wrong types: the plugin must run with defaults and never throw. Tests in Task 6.
5. Paragraph text with quotation marks, parentheses, trailing line breaks, empty paragraphs and all-caps words: findings inside punctuation are found, empty text gives no findings, "MITARBEITER" is not flagged. Tests in Task 3.

## File Structure

```
config.json                  manifest (Task 1)
index.html                   panel markup (Task 1 debug version, final in Task 7)
package.json                 test and install scripts (Task 1)
tools/install-desktop.sh     copies the plugin into Desktop Editors (Task 1)
resources/img/icon.svg       icon source (Task 1)
resources/img/{light,dark}/icon.png, icon@2x.png   generated (Task 1)
resources/css/panel.css      panel styling (Task 7)
translations/langs.json      ["en-US"] (Task 1)
translations/en-US.json      German -> English (Task 1 empty, Task 7 and 8 fill)
scripts/document.js          OnlyOffice API access (Task 1)
scripts/debug.js             temporary harness, deleted in Task 7 (Task 1)
scripts/engine.js            validate, index, scan, suggest (Tasks 2-4)
scripts/dictionary.js        bundled entries (Task 5)
scripts/settings.js          settings load/save/parse, user entry derivation (Task 6)
scripts/strings.js           all UI strings in German (Task 7, extended in Task 8)
scripts/panel.js             findings UI (Task 7)
scripts/settings-view.js     settings section UI (Task 8)
test/*.test.js               unit tests
README.md                    install and manual checklist (Task 8)
```

---

### Task 1: Scaffold and editor bridge

Proves the one risky assumption first: that a word can be selected and replaced in a running editor with its formatting kept.

**Files:**
- Create: `package.json`, `config.json`, `index.html`, `tools/install-desktop.sh`, `resources/img/icon.svg`, `translations/langs.json`, `translations/en-US.json`, `scripts/document.js`, `scripts/debug.js`
- Generate: `resources/img/light/icon.png`, `resources/img/light/icon@2x.png`, `resources/img/dark/icon.png`, `resources/img/dark/icon@2x.png`

**Interfaces:**
- Produces: `GNH.document.readParagraphs()` returns `Promise<string[]>`.
- Produces: `GNH.document.select(target)` and `GNH.document.replaceMany(targets)` return `Promise<{done: number, stale: number}>`.
- A target is `{ p: number, start: number, form: string, ordinal: number, expected: string, replacement: string|null }`. `p` is the paragraph index, `expected` the paragraph text at scan time, `ordinal` the zero-based index of this occurrence among all case-sensitive substring occurrences of `form` in the paragraph. `replacement: null` means select only.
- `replaceMany` applies targets in the order given. Callers pass them sorted by `engine.orderForReplace` (Task 4).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "genderneutralhelper-onlyoffice",
  "version": "0.1.0",
  "private": true,
  "description": "OnlyOffice plugin: gender-neutral wording helper for German",
  "scripts": {
    "test": "node --test",
    "install:desktop": "sh tools/install-desktop.sh"
  }
}
```

- [ ] **Step 2: Create `config.json`**

```json
{
  "name": "Gender-Neutral Wording",
  "nameLocale": { "de": "Gendergerechte Sprache" },
  "guid": "asc.{6F1C2A9E-3B7D-4E58-9A41-C2D07B5E8F13}",
  "version": "0.1.0",
  "minVersion": "8.1.0",
  "variations": [
    {
      "description": "Finds generic-masculine German person nouns and offers gender-inclusive replacements.",
      "descriptionLocale": {
        "de": "Findet generisch maskuline Personenbezeichnungen und schlägt gendergerechte Formen vor."
      },
      "url": "index.html",
      "icons": [
        {
          "style": "light",
          "100%": { "normal": "resources/img/light/icon.png" },
          "200%": { "normal": "resources/img/light/icon@2x.png" }
        },
        {
          "style": "dark",
          "100%": { "normal": "resources/img/dark/icon.png" },
          "200%": { "normal": "resources/img/dark/icon@2x.png" }
        }
      ],
      "isViewer": false,
      "EditorsSupport": ["word"],
      "type": "panelRight",
      "isVisual": true,
      "isModal": false,
      "isInsideMode": false,
      "initDataType": "none",
      "initData": "",
      "buttons": [],
      "events": []
    }
  ]
}
```

- [ ] **Step 3: Create the icon and generate PNGs**

`resources/img/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="#444444">
  <circle cx="12" cy="13" r="5"/>
  <path d="M4 31c0-6 3.5-9 8-9s8 3 8 9z"/>
  <circle cx="28" cy="13" r="5"/>
  <path d="M20 31c0-6 3.5-9 8-9s8 3 8 9z"/>
</svg>
```

Run:

```bash
mkdir -p resources/img/light resources/img/dark
rsvg-convert -w 40 -h 40 -o resources/img/light/icon.png resources/img/icon.svg
rsvg-convert -w 80 -h 80 -o resources/img/light/icon@2x.png resources/img/icon.svg
sed 's/#444444/#e8e8e8/' resources/img/icon.svg | rsvg-convert -w 40 -h 40 -o resources/img/dark/icon.png
sed 's/#444444/#e8e8e8/' resources/img/icon.svg | rsvg-convert -w 80 -h 80 -o resources/img/dark/icon@2x.png
file resources/img/*/icon*.png
```

Expected: four lines, each reporting a PNG of 40 x 40 or 80 x 80.

- [ ] **Step 4: Create the translation stubs**

`translations/langs.json`:

```json
["en-US"]
```

`translations/en-US.json`:

```json
{}
```

- [ ] **Step 5: Create `scripts/document.js`**

```js
(function (window) {
  "use strict";
  var GNH = (window.GNH = window.GNH || {});
  var TIMEOUT_MS = 30000;

  // Runs inside the editor. No closures; input comes from Asc.scope.
  function cmdRead() {
    var paragraphs = Api.GetDocument().GetAllParagraphs();
    var out = [];
    for (var i = 0; i < paragraphs.length; i++) {
      out.push(paragraphs[i].GetText({ Numbering: false }));
    }
    return JSON.stringify(out);
  }

  // Runs inside the editor. Selects each target and, if it has a
  // replacement, replaces it. A paragraph is compared with its scan-time
  // text once, before the first change to it.
  function cmdApply() {
    var paragraphs = Api.GetDocument().GetAllParagraphs();
    var items = Asc.scope.items;
    var checked = {};
    var done = 0;
    var stale = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var par = paragraphs[it.p];
      if (checked[it.p] === undefined) {
        checked[it.p] = !!par && par.GetText({ Numbering: false }) === it.expected;
      }
      var ranges = checked[it.p] ? par.Search(it.form, true) : null;
      var range = ranges ? ranges[it.ordinal] : null;
      if (!range) {
        stale++;
        continue;
      }
      range.Select();
      if (it.replacement !== null) {
        Api.ReplaceTextSmart([it.replacement]);
      }
      done++;
    }
    return JSON.stringify({ done: done, stale: stale });
  }

  function run(scope, command) {
    return new Promise(function (resolve, reject) {
      var timer = window.setTimeout(function () {
        reject(new Error("timeout"));
      }, TIMEOUT_MS);
      try {
        Object.keys(scope).forEach(function (key) {
          window.Asc.scope[key] = scope[key];
        });
        window.Asc.plugin.callCommand(command, false, true, function (result) {
          window.clearTimeout(timer);
          try {
            resolve(JSON.parse(result));
          } catch (e) {
            reject(new Error("bad result"));
          }
        });
      } catch (e) {
        window.clearTimeout(timer);
        reject(e);
      }
    });
  }

  GNH.document = {
    readParagraphs: function () {
      return run({}, cmdRead);
    },
    select: function (target) {
      return run({ items: [Object.assign({}, target, { replacement: null })] }, cmdApply);
    },
    replaceMany: function (targets) {
      return run({ items: targets }, cmdApply);
    }
  };
})(window);
```

- [ ] **Step 6: Create the temporary harness**

`index.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Gendergerechte Sprache</title>
  <script src="./../v1/plugins.js"></script>
  <link rel="stylesheet" href="./../v1/plugins.css">
</head>
<body>
  <button id="dbgRead">Read</button>
  <button id="dbgSelect">Select 2nd</button>
  <button id="dbgReplace">Replace 2nd</button>
  <button id="dbgAll">Replace all</button>
  <pre id="dbgOut" style="white-space: pre-wrap"></pre>
  <script src="scripts/document.js"></script>
  <script src="scripts/debug.js"></script>
</body>
</html>
```

`scripts/debug.js`:

```js
(function (window) {
  "use strict";
  var editor = window.GNH.document;
  var doc = window.document;
  var FORM = "Mitarbeiter";

  function show(value) {
    doc.getElementById("dbgOut").textContent = JSON.stringify(value, null, 2);
  }

  // Every substring occurrence of FORM, in document order.
  function targets(paragraphs, replacement) {
    var out = [];
    paragraphs.forEach(function (text, p) {
      var ordinal = 0;
      var at = text.indexOf(FORM);
      while (at !== -1) {
        out.push({ p: p, start: at, form: FORM, ordinal: ordinal, expected: text, replacement: replacement });
        ordinal++;
        at = text.indexOf(FORM, at + FORM.length);
      }
    });
    return out;
  }

  function withTargets(replacement, pick) {
    return editor.readParagraphs().then(function (paragraphs) {
      return pick(targets(paragraphs, replacement));
    });
  }

  window.Asc.plugin.init = function () {
    doc.getElementById("dbgRead").onclick = function () {
      editor.readParagraphs().then(show, function (e) { show(String(e)); });
    };
    doc.getElementById("dbgSelect").onclick = function () {
      withTargets(null, function (list) { return editor.select(list[1]); }).then(show, function (e) { show(String(e)); });
    };
    doc.getElementById("dbgReplace").onclick = function () {
      withTargets("Mitarbeiter:innen", function (list) { return editor.replaceMany([list[1]]); }).then(show, function (e) { show(String(e)); });
    };
    doc.getElementById("dbgAll").onclick = function () {
      withTargets("Mitarbeitende", function (list) { return editor.replaceMany(list.reverse()); }).then(show, function (e) { show(String(e)); });
    };
  };
  window.Asc.plugin.button = function () {
    this.executeCommand("close", "");
  };
})(window);
```

- [ ] **Step 7: Create `tools/install-desktop.sh`**

```sh
#!/bin/sh
# Copies the plugin into OnlyOffice Desktop Editors for the current user.
set -eu
DEST="$HOME/.local/share/onlyoffice/desktopeditors/sdkjs-plugins/{6F1C2A9E-3B7D-4E58-9A41-C2D07B5E8F13}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$DEST"
mkdir -p "$DEST"
for item in config.json index.html resources scripts translations; do
  if [ -e "$SRC/$item" ]; then
    cp -r "$SRC/$item" "$DEST/"
  fi
done
echo "Installed to $DEST. Restart OnlyOffice Desktop Editors."
```

- [ ] **Step 8: Install and check the files landed**

Run: `npm run install:desktop && ls "$HOME/.local/share/onlyoffice/desktopeditors/sdkjs-plugins/{6F1C2A9E-3B7D-4E58-9A41-C2D07B5E8F13}"`

Expected: `config.json index.html resources scripts translations`

- [ ] **Step 9: Human checkpoint in the editor**

This step needs the human partner; an agent cannot drive the editor. Ask them to do the following and report each result.

1. Restart OnlyOffice Desktop Editors and open a new text document.
2. Type three paragraphs:
   - `Die Mitarbeiterin und der Mitarbeiter kommen.` with the second "Mitarbeiter" in **bold**
   - `Alle Mitarbeiter und Mitarbeiter sind da.`
   - a one-row table with `Mitarbeiter` in a cell
3. Open the Plugins tab and start "Gendergerechte Sprache". A panel opens on the right.
4. Click **Read**. Expected: a JSON array containing the three texts.
5. Click **Select 2nd**. Expected: the bold "Mitarbeiter" in paragraph 1 is selected (the first substring occurrence is inside "Mitarbeiterin"), output `{"done":1,"stale":0}`.
6. Click **Replace 2nd**. Expected: it becomes "Mitarbeiter:innen" and is still bold.
7. Press Ctrl+Z. Expected: the replacement is undone.
8. Click **Replace all**. Expected: every "Mitarbeiter" substring becomes "Mitarbeitende", including the one in the table and the one inside "Mitarbeiterin" (the harness matches substrings); `stale` is 0.

The stale-position check is exercised in Task 7's checkpoint.

If step 6 or 8 fails (text not replaced or formatting lost), replace the `Api.ReplaceTextSmart` call path with the following in `scripts/document.js` and repeat the checkpoint. It selects in the editor, then pastes from the plugin side, one target at a time:

```js
    replaceMany: function (targets) {
      var total = { done: 0, stale: 0 };
      return targets.reduce(function (chain, target) {
        return chain.then(function () {
          return run({ items: [Object.assign({}, target, { replacement: null })] }, cmdApply);
        }).then(function (r) {
          total.stale += r.stale;
          if (r.done !== 1) return null;
          return new Promise(function (resolve) {
            window.Asc.plugin.executeMethod("PasteText", [target.replacement], function () {
              total.done++;
              resolve();
            });
          });
        });
      }, Promise.resolve()).then(function () {
        return total;
      });
    }
```

With this fallback the stale check runs per target against the scan-time text, so only the first replacement in a paragraph succeeds per scan; note that in the README's limitations if the fallback is adopted. If neither path works, stop and report to the human partner.

- [ ] **Step 10: Commit**

```bash
chmod +x tools/install-desktop.sh
git add package.json config.json index.html tools resources translations scripts
git commit -m "Add plugin scaffold and editor bridge" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Engine — entry validation and index

**Files:**
- Create: `scripts/engine.js`
- Test: `test/engine.test.js`

**Interfaces:**
- Produces: `engine.STYLES` — array of the seven style ids in the order of Global Constraints.
- Produces: `engine.validateEntry(entry)` returns `boolean`.
- Produces: `engine.mergeEntries(bundled, custom)` returns `Entry[]`: custom entries first, then bundled entries whose `id` no custom entry uses.
- Produces: `engine.buildIndex(entries, disabledIds)` returns `{ forms: Map<string, {entryId: string, numbers: string[]}>, byId: Map<string, Entry>, skipped: string[] }`. `numbers` is `["sg"]`, `["pl"]` or `["sg", "pl"]`.
- Entry shape (from the spec): `{ id, masc: { sg: string[], pl: string[] }, fem: { sg, pl }, stem, neutral?: { kind: "participle"|"noun", sg?, pl? } }`. `masc.sg[0]` and `masc.pl[0]` are the nominative forms.

- [ ] **Step 1: Write the failing tests**

`test/engine.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../scripts/engine.js");

const MIT = {
  id: "mitarbeiter",
  masc: { sg: ["Mitarbeiter", "Mitarbeiters"], pl: ["Mitarbeiter", "Mitarbeitern"] },
  fem: { sg: "Mitarbeiterin", pl: "Mitarbeiterinnen" },
  stem: "Mitarbeiter",
  neutral: { kind: "participle", sg: "Mitarbeitende", pl: "Mitarbeitende" }
};
const KUNDE = {
  id: "kunde",
  masc: { sg: ["Kunde", "Kunden"], pl: ["Kunden"] },
  fem: { sg: "Kundin", pl: "Kundinnen" },
  stem: "Kund"
};
const ARZT = {
  id: "arzt",
  masc: { sg: ["Arzt", "Arztes"], pl: ["Ärzte", "Ärzten"] },
  fem: { sg: "Ärztin", pl: "Ärztinnen" },
  stem: "Ärzt"
};
const LEHRER = {
  id: "lehrer",
  masc: { sg: ["Lehrer", "Lehrers"], pl: ["Lehrer", "Lehrern"] },
  fem: { sg: "Lehrerin", pl: "Lehrerinnen" },
  stem: "Lehrer",
  neutral: { kind: "noun", sg: "Lehrkraft", pl: "Lehrkräfte" }
};
const ALL = [MIT, KUNDE, ARZT, LEHRER];

test("STYLES lists the seven style ids", () => {
  assert.deepEqual(engine.STYLES, ["neutral", "colon", "asterisk", "underscore", "binnenI", "slash", "pair"]);
});

test("validateEntry accepts well-formed entries", () => {
  ALL.forEach((e) => assert.equal(engine.validateEntry(e), true, e.id));
});

test("validateEntry rejects malformed entries", () => {
  const without = (key) => { const c = Object.assign({}, MIT); delete c[key]; return c; };
  assert.equal(engine.validateEntry(null), false);
  assert.equal(engine.validateEntry("Mitarbeiter"), false);
  assert.equal(engine.validateEntry(without("stem")), false);
  assert.equal(engine.validateEntry(without("fem")), false);
  assert.equal(engine.validateEntry(Object.assign({}, MIT, { masc: { sg: ["Mitarbeiter"], pl: [] } })), false);
  assert.equal(engine.validateEntry(Object.assign({}, MIT, { masc: { sg: ["Mitarbeiter", ""], pl: ["Mitarbeiter"] } })), false);
  assert.equal(engine.validateEntry(Object.assign({}, MIT, { neutral: { kind: "other", sg: "X", pl: "X" } })), false);
  assert.equal(engine.validateEntry(Object.assign({}, MIT, { neutral: { kind: "participle", sg: "Mitarbeitenden", pl: "Mitarbeitende" } })), false);
  assert.equal(engine.validateEntry(Object.assign({}, MIT, { neutral: { kind: "participle", sg: "Mitarbeitende" } })), false);
  assert.equal(engine.validateEntry(Object.assign({}, MIT, { neutral: null })), false);
});

test("validateEntry accepts a noun neutral with only one number", () => {
  assert.equal(engine.validateEntry(Object.assign({}, LEHRER, { neutral: { kind: "noun", sg: "Lehrkraft" } })), true);
});

test("buildIndex maps forms to entry and numbers", () => {
  const index = engine.buildIndex(ALL, []);
  assert.deepEqual(index.forms.get("Mitarbeiter"), { entryId: "mitarbeiter", numbers: ["sg", "pl"] });
  assert.deepEqual(index.forms.get("Mitarbeiters"), { entryId: "mitarbeiter", numbers: ["sg"] });
  assert.deepEqual(index.forms.get("Mitarbeitern"), { entryId: "mitarbeiter", numbers: ["pl"] });
  assert.deepEqual(index.forms.get("Kunden"), { entryId: "kunde", numbers: ["sg", "pl"] });
  assert.equal(index.forms.has("Mitarbeiterin"), false);
  assert.equal(index.byId.get("arzt"), ARZT);
  assert.deepEqual(index.skipped, []);
});

test("buildIndex leaves out disabled entries", () => {
  const index = engine.buildIndex(ALL, ["kunde"]);
  assert.equal(index.forms.has("Kunde"), false);
  assert.equal(index.byId.has("kunde"), false);
  assert.equal(index.forms.has("Arzt"), true);
});

test("buildIndex skips invalid entries and reports them", () => {
  const index = engine.buildIndex([{ id: "kaputt" }, null, MIT], undefined);
  assert.deepEqual(index.skipped, ["kaputt", "?"]);
  assert.equal(index.forms.has("Mitarbeiter"), true);
});

test("buildIndex keeps the first entry when two claim a form", () => {
  const other = Object.assign({}, KUNDE, { id: "anderer", masc: { sg: ["Mitarbeiter"], pl: ["Kunden"] } });
  const index = engine.buildIndex([MIT, other], []);
  assert.equal(index.forms.get("Mitarbeiter").entryId, "mitarbeiter");
  assert.deepEqual(index.forms.get("Mitarbeiter").numbers, ["sg", "pl"]);
  assert.equal(index.forms.get("Kunden").entryId, "anderer");
});

test("mergeEntries puts custom entries first and lets them replace bundled ones", () => {
  const custom = Object.assign({}, KUNDE, { stem: "Kundx" });
  const merged = engine.mergeEntries([MIT, KUNDE], [custom]);
  assert.deepEqual(merged.map((e) => e.id), ["kunde", "mitarbeiter"]);
  assert.equal(merged[0], custom);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/engine.test.js`
Expected: FAIL with `Cannot find module '../scripts/engine.js'`

- [ ] **Step 3: Write `scripts/engine.js`**

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/engine.test.js`
Expected: PASS, 9 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add scripts/engine.js test/engine.test.js
git commit -m "Add entry validation and form index" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Engine — scanning

**Files:**
- Modify: `scripts/engine.js`
- Test: `test/engine.test.js` (append)

**Interfaces:**
- Consumes: `buildIndex` result from Task 2.
- Produces: `engine.scanParagraph(text, index)` returns `Finding[]`, where a Finding is `{ form, start, ordinal, entryId, numbers: string[], prev: string|null, context: { before: string, after: string } }`.
- Produces: `engine.scanDocument(paragraphs, index)` returns the findings of all paragraphs in order, each with an added `p` (paragraph index).
- Produces: `engine.findingKey(finding)` returns a string that identifies a finding from `scanDocument` across rescans.

- [ ] **Step 1: Append the failing tests to `test/engine.test.js`**

```js
const INDEX = engine.buildIndex(ALL, []);
const forms = (text) => engine.scanParagraph(text, INDEX).map((f) => f.form);

test("scanParagraph finds whole-word matches with their details", () => {
  const found = engine.scanParagraph("Alle Mitarbeiter und Kunden sind eingeladen.", INDEX);
  assert.equal(found.length, 2);
  assert.deepEqual(found[0], {
    form: "Mitarbeiter",
    start: 5,
    ordinal: 0,
    entryId: "mitarbeiter",
    numbers: ["sg", "pl"],
    prev: "alle",
    context: { before: "Alle ", after: " und Kunden sind eingeladen." }
  });
  assert.equal(found[1].form, "Kunden");
  assert.equal(found[1].prev, "und");
});

test("scanParagraph ignores compounds, feminine forms and hyphenated words", () => {
  assert.deepEqual(forms("Das Mitarbeitergespräch mit der Mitarbeiterin im Mitarbeiter-Büro."), []);
});

test("scanParagraph ignores truncated compounds", () => {
  assert.deepEqual(forms("Die Mitarbeiter- und Kundenbefragung läuft."), []);
  assert.deepEqual(forms("Betriebs-Mitarbeiter"), []);
});

test("scanParagraph ignores forms that are already gendered", () => {
  assert.deepEqual(forms("Mitarbeiter:innen, Mitarbeiter*innen, Mitarbeiter_in, Mitarbeiter/-innen, Mitarbeiter/innen, Mitarbeiter:in."), []);
  assert.deepEqual(forms("MitarbeiterInnen"), []);
});

test("scanParagraph still flags a form followed by an unrelated slash word", () => {
  assert.deepEqual(forms("Mitarbeiter/intern"), ["Mitarbeiter"]);
});

test("scanParagraph ignores pairs in either order", () => {
  assert.deepEqual(forms("Mitarbeiterinnen und Mitarbeiter"), []);
  assert.deepEqual(forms("Mitarbeiter und Mitarbeiterinnen"), []);
  assert.deepEqual(forms("Mitarbeiterin oder Mitarbeiter"), []);
  assert.deepEqual(forms("Kundinnen/Kunden"), []);
  assert.deepEqual(forms("den Kundinnen bzw. Kunden"), []);
});

test("scanParagraph ignores pairs written with articles", () => {
  assert.deepEqual(forms("die Mitarbeiterinnen und die Mitarbeiter"), []);
  assert.deepEqual(forms("der Arzt oder die Ärztin"), []);
});

test("scanParagraph flags a form joined to another word's feminine form", () => {
  assert.deepEqual(forms("Kundinnen und Mitarbeiter"), ["Mitarbeiter"]);
});

test("scanParagraph counts the ordinal over all substring occurrences", () => {
  const found = engine.scanParagraph("Die Mitarbeiterin und das Mitarbeitergespräch: der Mitarbeiter fehlt.", INDEX);
  assert.equal(found.length, 1);
  assert.equal(found[0].ordinal, 2);
  assert.equal(found[0].prev, "der");
});

test("scanParagraph sets prev to null unless only whitespace separates the words", () => {
  assert.equal(engine.scanParagraph("Mitarbeiter kommen.", INDEX)[0].prev, null);
  assert.equal(engine.scanParagraph("Heute, Mitarbeiter kommen.", INDEX)[0].prev, null);
  assert.equal(engine.scanParagraph("die Mitarbeiter", INDEX)[0].prev, "die");
});

test("scanParagraph limits context to 40 characters per side", () => {
  const found = engine.scanParagraph("x".repeat(60) + " Mitarbeiter " + "y".repeat(60), INDEX);
  assert.equal(found[0].context.before.length, 40);
  assert.equal(found[0].context.after.length, 40);
});

test("scanParagraph copes with punctuation, line breaks, empty text and capitals", () => {
  assert.deepEqual(forms("Die „Mitarbeiter“ (Kunden) kommen.\r\n"), ["Mitarbeiter", "Kunden"]);
  assert.deepEqual(forms(""), []);
  assert.deepEqual(forms("\r\n"), []);
  assert.deepEqual(forms("MITARBEITER und mitarbeiter"), []);
  assert.deepEqual(forms("😀 Ärzte 😀"), ["Ärzte"]);
});

test("scanParagraph gives independent results on repeated calls", () => {
  assert.deepEqual(forms("Kunde"), ["Kunde"]);
  assert.deepEqual(forms("Kunde"), ["Kunde"]);
});

test("scanDocument adds the paragraph index", () => {
  const found = engine.scanDocument(["Der Kunde wartet.", "", "Alle Mitarbeiter."], INDEX);
  assert.deepEqual(found.map((f) => [f.p, f.form]), [[0, "Kunde"], [2, "Mitarbeiter"]]);
});

test("findingKey separates findings and is stable for equal findings", () => {
  const a = engine.scanDocument(["Der Kunde und der Kunde."], INDEX);
  const b = engine.scanDocument(["Der Kunde und der Kunde."], INDEX);
  assert.notEqual(engine.findingKey(a[0]), engine.findingKey(a[1]));
  assert.equal(engine.findingKey(a[0]), engine.findingKey(b[0]));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/engine.test.js`
Expected: FAIL with `engine.scanParagraph is not a function`

- [ ] **Step 3: Add scanning to `scripts/engine.js`**

Insert directly above the line `GNH.engine = {`:

```js
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
```

Extend the export object so it reads:

```js
  GNH.engine = {
    STYLES: STYLES,
    validateEntry: validateEntry,
    mergeEntries: mergeEntries,
    buildIndex: buildIndex,
    scanParagraph: scanParagraph,
    scanDocument: scanDocument,
    findingKey: findingKey
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/engine.test.js`
Expected: PASS, 24 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add scripts/engine.js test/engine.test.js
git commit -m "Add paragraph scanning" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Engine — suggestions and replace order

**Files:**
- Modify: `scripts/engine.js`
- Test: `test/engine.test.js` (append)

**Interfaces:**
- Consumes: Finding and Entry shapes from Tasks 2 and 3.
- Produces: `engine.suggest(finding, entry, style, fallbackStyle)` returns `Suggestion[]`, a Suggestion being `{ text, style, number: "sg"|"pl", hint?: "checkArticle"|"checkCase"|"noNeutralForm" }`. Plural suggestions come before singular ones; texts are unique.
- Produces: `engine.suggestAll(finding, entry, primaryStyle, fallbackStyle)` returns the suggestions of `primaryStyle` followed by those of every other style in `STYLES` order, texts unique. Never empty for a valid entry.
- Produces: `engine.orderForReplace(targets)` returns a new array sorted by `p` descending, then `start` descending.

- [ ] **Step 1: Append the failing tests to `test/engine.test.js`**

```js
const finding = (form, numbers, prev) => ({ form, numbers, prev: prev === undefined ? null : prev });
const texts = (list) => list.map((s) => s.text);

test("suggest builds separator styles for both numbers, plural first", () => {
  const f = finding("Mitarbeiter", ["sg", "pl"]);
  assert.deepEqual(engine.suggest(f, MIT, "colon", "colon"), [
    { text: "Mitarbeiter:innen", style: "colon", number: "pl" },
    { text: "Mitarbeiter:in", style: "colon", number: "sg", hint: "checkArticle" }
  ]);
  assert.deepEqual(texts(engine.suggest(f, MIT, "asterisk", "colon")), ["Mitarbeiter*innen", "Mitarbeiter*in"]);
  assert.deepEqual(texts(engine.suggest(f, MIT, "underscore", "colon")), ["Mitarbeiter_innen", "Mitarbeiter_in"]);
  assert.deepEqual(texts(engine.suggest(f, MIT, "binnenI", "colon")), ["MitarbeiterInnen", "MitarbeiterIn"]);
});

test("suggest uses the stem for weak and umlaut nouns", () => {
  assert.deepEqual(texts(engine.suggest(finding("Kunden", ["sg", "pl"]), KUNDE, "colon", "colon")), ["Kund:innen", "Kund:in"]);
  assert.deepEqual(texts(engine.suggest(finding("Ärzten", ["pl"]), ARZT, "colon", "colon")), ["Ärzt:innen"]);
  assert.deepEqual(texts(engine.suggest(finding("Arzt", ["sg"]), ARZT, "asterisk", "colon")), ["Ärzt*in"]);
  assert.deepEqual(texts(engine.suggest(finding("Ärzte", ["pl"]), ARZT, "binnenI", "colon")), ["ÄrztInnen"]);
});

test("suggest writes the short slash form only when the form equals the stem", () => {
  assert.deepEqual(texts(engine.suggest(finding("Mitarbeiter", ["sg", "pl"]), MIT, "slash", "colon")), ["Mitarbeiter/-innen", "Mitarbeiter/-in"]);
  assert.deepEqual(texts(engine.suggest(finding("Mitarbeitern", ["pl"]), MIT, "slash", "colon")), ["Mitarbeiterinnen/Mitarbeitern"]);
  assert.deepEqual(texts(engine.suggest(finding("Kunden", ["sg", "pl"]), KUNDE, "slash", "colon")), ["Kundinnen/Kunden", "Kundin/Kunden"]);
});

test("suggest keeps the matched case in pair style", () => {
  assert.deepEqual(texts(engine.suggest(finding("Mitarbeitern", ["pl"]), MIT, "pair", "colon")), ["Mitarbeiterinnen und Mitarbeitern"]);
  assert.deepEqual(texts(engine.suggest(finding("Mitarbeiter", ["sg", "pl"]), MIT, "pair", "colon")), ["Mitarbeiterinnen und Mitarbeiter", "Mitarbeiterin oder Mitarbeiter"]);
  assert.equal(engine.suggest(finding("Arzt", ["sg"]), ARZT, "pair", "colon")[0].hint, "checkArticle");
});

test("suggest picks the participle ending from the preceding word", () => {
  const strong = engine.suggest(finding("Mitarbeiter", ["sg", "pl"]), MIT, "neutral", "colon");
  assert.deepEqual(strong, [
    { text: "Mitarbeitende", style: "neutral", number: "pl" },
    { text: "Mitarbeitenden", style: "neutral", number: "pl" }
  ]);
  assert.deepEqual(texts(engine.suggest(finding("Mitarbeiter", ["sg", "pl"], "die"), MIT, "neutral", "colon")), ["Mitarbeitenden", "Mitarbeitende"]);
  assert.deepEqual(texts(engine.suggest(finding("Mitarbeiter", ["sg", "pl"], "zum"), MIT, "neutral", "colon")), ["Mitarbeitenden", "Mitarbeitende"]);
  assert.deepEqual(texts(engine.suggest(finding("Mitarbeiter", ["sg", "pl"], "viele"), MIT, "neutral", "colon")), ["Mitarbeitende", "Mitarbeitenden"]);
});

test("suggest uses the weak participle ending for a dative plural", () => {
  assert.deepEqual(texts(engine.suggest(finding("Mitarbeitern", ["pl"], "mit"), MIT, "neutral", "colon")), ["Mitarbeitenden", "Mitarbeitende"]);
});

test("suggest uses noun neutrals as stored and flags oblique cases", () => {
  assert.deepEqual(engine.suggest(finding("Lehrer", ["sg", "pl"]), LEHRER, "neutral", "colon"), [
    { text: "Lehrkräfte", style: "neutral", number: "pl" },
    { text: "Lehrkraft", style: "neutral", number: "sg" }
  ]);
  assert.deepEqual(engine.suggest(finding("Lehrern", ["pl"]), LEHRER, "neutral", "colon"), [
    { text: "Lehrkräfte", style: "neutral", number: "pl", hint: "checkCase" }
  ]);
  assert.equal(engine.suggest(finding("Lehrers", ["sg"]), LEHRER, "neutral", "colon")[0].hint, "checkCase");
});

test("suggest falls back when there is no neutral form", () => {
  assert.deepEqual(engine.suggest(finding("Kunden", ["sg", "pl"]), KUNDE, "neutral", "asterisk"), [
    { text: "Kund*innen", style: "asterisk", number: "pl", hint: "noNeutralForm" },
    { text: "Kund*in", style: "asterisk", number: "sg", hint: "noNeutralForm" }
  ]);
  const sgOnly = Object.assign({}, LEHRER, { neutral: { kind: "noun", sg: "Lehrkraft" } });
  assert.deepEqual(texts(engine.suggest(finding("Lehrer", ["sg", "pl"]), sgOnly, "neutral", "colon")), ["Lehrer:innen", "Lehrkraft"]);
});

test("suggestAll starts with the primary style and has unique texts", () => {
  const all = engine.suggestAll(finding("Mitarbeiter", ["sg", "pl"]), MIT, "colon", "asterisk");
  assert.equal(all[0].text, "Mitarbeiter:innen");
  assert.equal(all[1].text, "Mitarbeiter:in");
  assert.equal(new Set(texts(all)).size, all.length);
  assert.ok(texts(all).includes("Mitarbeitende"));
  assert.ok(texts(all).includes("Mitarbeiterinnen und Mitarbeiter"));
});

test("suggestAll does not repeat fallback suggestions", () => {
  const all = engine.suggestAll(finding("Kunde", ["sg"]), KUNDE, "neutral", "colon");
  assert.deepEqual(all[0], { text: "Kund:in", style: "colon", number: "sg", hint: "noNeutralForm" });
  assert.equal(texts(all).filter((t) => t === "Kund:in").length, 1);
});

test("orderForReplace sorts last paragraph and last position first without mutating", () => {
  const input = [{ p: 0, start: 5 }, { p: 2, start: 1 }, { p: 0, start: 30 }, { p: 2, start: 9 }];
  const copy = input.slice();
  assert.deepEqual(engine.orderForReplace(input), [{ p: 2, start: 9 }, { p: 2, start: 1 }, { p: 0, start: 30 }, { p: 0, start: 5 }]);
  assert.deepEqual(input, copy);
});

test("ordinals of earlier findings survive replacing later ones first", () => {
  const text = "Mitarbeiter danken den Mitarbeitern.";
  const found = engine.scanDocument([text], INDEX);
  const ordered = engine.orderForReplace(found);
  assert.equal(ordered[0].form, "Mitarbeitern");
  const after = text.slice(0, ordered[0].start) + "Mitarbeiterinnen und Mitarbeitern" + text.slice(ordered[0].start + ordered[0].form.length);
  let at = -1;
  for (let i = 0; i <= ordered[1].ordinal; i++) at = after.indexOf(ordered[1].form, at + 1);
  assert.equal(at, ordered[1].start);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/engine.test.js`
Expected: FAIL with `engine.suggest is not a function`

- [ ] **Step 3: Add suggestions to `scripts/engine.js`**

Insert directly above the line `GNH.engine = {`:

```js
  var SEPARATORS = { colon: ":", asterisk: "*", underscore: "_" };
  var WEAK_PREV = new Set([
    "der", "die", "den", "dem", "des",
    "diese", "diesen", "dieser",
    "alle", "allen", "aller",
    "unsere", "unseren", "unserer",
    "ihre", "ihren", "ihrer",
    "keine", "keinen", "keiner",
    "beide", "beiden",
    "zum", "zur", "im", "am", "vom", "beim"
  ]);

  function genderedText(entry, style, number, form) {
    var plural = number === "pl";
    if (SEPARATORS[style]) return entry.stem + SEPARATORS[style] + (plural ? "innen" : "in");
    if (style === "binnenI") return entry.stem + (plural ? "Innen" : "In");
    if (style === "slash") {
      return form === entry.stem
        ? form + (plural ? "/-innen" : "/-in")
        : entry.fem[number] + "/" + form;
    }
    return entry.fem[number] + (plural ? " und " : " oder ") + form;
  }

  function gendered(entry, style, number, form, forcedHint) {
    var suggestion = { text: genderedText(entry, style, number, form), style: style, number: number };
    var hint = forcedHint || (number === "sg" ? "checkArticle" : null);
    if (hint) suggestion.hint = hint;
    return [suggestion];
  }

  function neutral(finding, entry, number, fallbackStyle) {
    var n = entry.neutral;
    var form = finding.form;
    if (!n || !n[number]) return gendered(entry, fallbackStyle, number, form, "noNeutralForm");
    if (n.kind === "noun") {
      var suggestion = { text: n[number], style: "neutral", number: number };
      if (form !== entry.masc[number][0]) suggestion.hint = "checkCase";
      return [suggestion];
    }
    var dativePlural = number === "pl" && form !== entry.masc.pl[0] && form.endsWith("n");
    var weak = WEAK_PREV.has(finding.prev) || dativePlural;
    return (weak ? ["n", ""] : ["", "n"]).map(function (ending) {
      return { text: n[number] + ending, style: "neutral", number: number };
    });
  }

  function pushUnique(list, suggestions) {
    suggestions.forEach(function (suggestion) {
      var known = list.some(function (other) {
        return other.text === suggestion.text;
      });
      if (!known) list.push(suggestion);
    });
  }

  function suggest(finding, entry, style, fallbackStyle) {
    var out = [];
    ["pl", "sg"].forEach(function (number) {
      if (finding.numbers.indexOf(number) < 0) return;
      pushUnique(out, style === "neutral"
        ? neutral(finding, entry, number, fallbackStyle)
        : gendered(entry, style, number, finding.form));
    });
    return out;
  }

  function suggestAll(finding, entry, primaryStyle, fallbackStyle) {
    var out = [];
    var order = [primaryStyle].concat(STYLES.filter(function (style) {
      return style !== primaryStyle;
    }));
    order.forEach(function (style) {
      pushUnique(out, suggest(finding, entry, style, fallbackStyle));
    });
    return out;
  }

  function orderForReplace(targets) {
    return targets.slice().sort(function (a, b) {
      return b.p - a.p || b.start - a.start;
    });
  }
```

Extend the export object so it reads:

```js
  GNH.engine = {
    STYLES: STYLES,
    validateEntry: validateEntry,
    mergeEntries: mergeEntries,
    buildIndex: buildIndex,
    scanParagraph: scanParagraph,
    scanDocument: scanDocument,
    findingKey: findingKey,
    suggest: suggest,
    suggestAll: suggestAll,
    orderForReplace: orderForReplace
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/engine.test.js`
Expected: PASS, 36 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add scripts/engine.js test/engine.test.js
git commit -m "Add suggestions and replace ordering" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dictionary

**Files:**
- Create: `scripts/dictionary.js`
- Test: `test/dictionary.test.js`

**Interfaces:**
- Consumes: `engine.validateEntry`, `engine.buildIndex`, `engine.suggestAll`, `engine.STYLES`.
- Produces: `GNH.dictionary` — `Entry[]` with at least 200 entries; each `id` equals `masc.sg[0].toLowerCase()`.

- [ ] **Step 1: Write the failing tests**

`test/dictionary.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../scripts/engine.js");
const dictionary = require("../scripts/dictionary.js");

test("dictionary has at least 200 entries", () => {
  assert.ok(dictionary.length >= 200, "has " + dictionary.length);
});

test("every entry is valid and consistently formed", () => {
  dictionary.forEach((e) => {
    assert.equal(engine.validateEntry(e), true, e.id);
    assert.equal(e.id, e.masc.sg[0].toLowerCase(), e.id);
    assert.equal(e.fem.sg, e.stem + "in", e.id);
    assert.equal(e.fem.pl, e.stem + "innen", e.id);
  });
});

test("ids are unique", () => {
  const ids = dictionary.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("no masculine form is claimed by two entries", () => {
  const owner = new Map();
  dictionary.forEach((e) => {
    e.masc.sg.concat(e.masc.pl).forEach((form) => {
      assert.ok(!owner.has(form) || owner.get(form) === e.id, form + " in " + e.id + " and " + owner.get(form));
      owner.set(form, e.id);
    });
  });
});

test("the index skips nothing", () => {
  assert.deepEqual(engine.buildIndex(dictionary, []).skipped, []);
});

test("every form of every entry gets a suggestion in every style", () => {
  const index = engine.buildIndex(dictionary, []);
  index.forms.forEach((hit, form) => {
    const finding = { form: form, numbers: hit.numbers, prev: null };
    engine.STYLES.forEach((style) => {
      const list = engine.suggestAll(finding, index.byId.get(hit.entryId), style, "colon");
      assert.ok(list.length > 0 && list.every((s) => s.text.length > 0), form + " / " + style);
    });
  });
});

test("known entries have the expected forms", () => {
  const byId = new Map(dictionary.map((e) => [e.id, e]));
  assert.deepEqual(byId.get("mitarbeiter").masc, { sg: ["Mitarbeiter", "Mitarbeiters"], pl: ["Mitarbeiter", "Mitarbeitern"] });
  assert.equal(byId.get("mitarbeiter").neutral.sg, "Mitarbeitende");
  assert.deepEqual(byId.get("kunde").masc, { sg: ["Kunde", "Kunden"], pl: ["Kunden"] });
  assert.equal(byId.get("kunde").stem, "Kund");
  assert.deepEqual(byId.get("student").masc, { sg: ["Student", "Studenten"], pl: ["Studenten"] });
  assert.deepEqual(byId.get("arzt").masc, { sg: ["Arzt", "Arztes"], pl: ["Ärzte", "Ärzten"] });
  assert.equal(byId.get("arzt").fem.sg, "Ärztin");
  assert.deepEqual(byId.get("autor").masc, { sg: ["Autor", "Autors"], pl: ["Autoren"] });
  assert.deepEqual(byId.get("lehrer").neutral, { kind: "noun", sg: "Lehrkraft", pl: "Lehrkräfte" });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/dictionary.test.js`
Expected: FAIL with `Cannot find module '../scripts/dictionary.js'`

- [ ] **Step 3: Write `scripts/dictionary.js`**

```js
(function (root) {
  "use strict";
  var GNH = (root.GNH = root.GNH || {});

  function make(sg, pl, stem, neutral) {
    var entry = {
      id: sg[0].toLowerCase(),
      masc: { sg: sg, pl: pl },
      fem: { sg: stem + "in", pl: stem + "innen" },
      stem: stem
    };
    if (neutral) entry.neutral = neutral;
    return entry;
  }

  // Lehrer: des Lehrers, die Lehrer, den Lehrern
  function er(base, neutral) {
    return make([base, base + "s"], [base, base + "n"], base, neutral);
  }

  // Kunde: des Kunden, die Kunden; Kundin
  function weakE(base, neutral) {
    return make([base, base + "n"], [base + "n"], base.slice(0, -1), neutral);
  }

  // Student: des Studenten, die Studenten
  function weak(base, neutral) {
    return make([base, base + "en"], [base + "en"], base, neutral);
  }

  // Explicit forms. A plural ending in -e gets a dative form in -en.
  function strong(sg, genitive, pl, stem, neutral) {
    var plurals = /e$/.test(pl) ? [pl, pl + "n"] : [pl];
    return make([sg, genitive], plurals, stem, neutral);
  }

  function P(word) {
    return { kind: "participle", sg: word, pl: word };
  }

  function N(sg, pl) {
    return { kind: "noun", sg: sg, pl: pl };
  }

  var ER_PLAIN = [
    "Arbeiter", "Arbeitgeber", "Anwohner", "Bewohner", "Einwohner", "Bewerber", "Bürger", "Mitbürger",
    "Staatsbürger", "Bürgermeister", "Minister", "Kanzler", "Politiker", "Sprecher", "Berater", "Erzieher",
    "Altenpfleger", "Künstler", "Musiker", "Sänger", "Tänzer", "Schauspieler", "Maler", "Schriftsteller",
    "Dichter", "Übersetzer", "Dolmetscher", "Wissenschaftler", "Techniker", "Mechaniker", "Elektriker",
    "Informatiker", "Programmierer", "Entwickler", "Mathematiker", "Physiker", "Chemiker", "Historiker",
    "Handwerker", "Bäcker", "Metzger", "Gärtner", "Tischler", "Maurer", "Dachdecker", "Klempner",
    "Verkäufer", "Käufer", "Händler", "Hersteller", "Anbieter", "Dienstleister", "Unternehmer", "Gründer",
    "Eigentümer", "Besitzer", "Inhaber", "Vermieter", "Mieter", "Pächter", "Verbraucher", "Spieler",
    "Sportler", "Trainer", "Schiedsrichter", "Richter", "Verteidiger", "Kläger", "Gutachter", "Ermittler",
    "Fahrer", "Busfahrer", "Empfänger", "Absender", "Gegner", "Anhänger", "Befürworter", "Kritiker",
    "Verfasser", "Herausgeber", "Gesetzgeber", "Veranstalter", "Betreiber", "Vorgänger", "Nachfolger",
    "Partner", "Geschäftspartner", "Mitspieler", "Gewinner", "Verlierer", "Sieger", "Ausländer",
    "Europäer", "Amerikaner", "Österreicher", "Rentner", "Schuldner", "Gläubiger", "Steuerzahler",
    "Aussteller", "Kellner", "Apotheker", "Sanitäter", "Reporter", "Manager", "Designer", "Blogger"
  ];

  var ER_NEUTRAL = [
    er("Mitarbeiter", P("Mitarbeitende")),
    er("Lehrer", N("Lehrkraft", "Lehrkräfte")),
    er("Schüler", P("Lernende")),
    er("Teilnehmer", P("Teilnehmende")),
    er("Zuschauer", P("Zuschauende")),
    er("Zuhörer", P("Zuhörende")),
    er("Leser", P("Lesende")),
    er("Forscher", P("Forschende")),
    er("Helfer", P("Helfende")),
    er("Radfahrer", P("Radfahrende")),
    er("Autofahrer", P("Autofahrende")),
    er("Fußgänger", P("Zufußgehende")),
    er("Arbeitnehmer", P("Beschäftigte")),
    er("Nutzer", P("Nutzende")),
    er("Benutzer", P("Benutzende")),
    er("Anwender", P("Anwendende")),
    er("Betreuer", N("Betreuungsperson", "Betreuungspersonen")),
    er("Vertreter", N("Vertretung", "Vertretungen")),
    er("Stellvertreter", N("Stellvertretung", "Stellvertretungen")),
    er("Wähler", P("Wählende")),
    er("Antragsteller", P("Antragstellende")),
    er("Pfleger", N("Pflegekraft", "Pflegekräfte")),
    er("Krankenpfleger", N("Pflegefachkraft", "Pflegefachkräfte")),
    er("Abteilungsleiter", N("Abteilungsleitung", "Abteilungsleitungen")),
    er("Projektleiter", N("Projektleitung", "Projektleitungen")),
    er("Teamleiter", N("Teamleitung", "Teamleitungen")),
    er("Gruppenleiter", N("Gruppenleitung", "Gruppenleitungen")),
    er("Schulleiter", N("Schulleitung", "Schulleitungen")),
    er("Geschäftsführer", N("Geschäftsführung", "Geschäftsführungen")),
    er("Ansprechpartner", N("Ansprechperson", "Ansprechpersonen")),
    er("Besucher", P("Besuchende")),
    er("Spender", P("Spendende")),
    er("Unterstützer", P("Unterstützende")),
    er("Prüfer", P("Prüfende"))
  ];

  var WEAK_E_PLAIN = [
    "Kunde", "Kollege", "Experte", "Zeuge", "Bote", "Psychologe", "Biologe", "Soziologe", "Pädagoge",
    "Geologe", "Theologe", "Ökologe", "Brite", "Russe", "Türke", "Schwede", "Däne", "Grieche",
    "Chinese", "Genosse", "Insasse", "Schütze", "Lotse"
  ];

  var WEAK_PLAIN = [
    "Präsident", "Absolvent", "Patient", "Klient", "Konsument", "Produzent", "Referent", "Interessent",
    "Abonnent", "Korrespondent", "Agent", "Journalist", "Jurist", "Spezialist", "Tourist", "Aktivist",
    "Pianist", "Komponist", "Terrorist", "Praktikant", "Lieferant", "Migrant", "Passant", "Mandant",
    "Kandidat", "Soldat", "Diplomat", "Demokrat", "Athlet", "Architekt", "Fotograf", "Philosoph",
    "Pilot", "Kamerad", "Chirurg", "Ökonom", "Astronom", "Therapeut"
  ];

  // Plural in -en: Autor, Autors, Autoren
  var OR_PLURAL = [
    "Autor", "Direktor", "Professor", "Moderator", "Investor", "Senator", "Rektor", "Inspektor",
    "Lektor", "Organisator", "Administrator", "Koordinator", "Initiator", "Kurator", "Mentor",
    "Sponsor", "Pastor"
  ];

  // Plural in -e: Redakteur, Redakteurs, Redakteure
  var E_PLURAL = [
    "Redakteur", "Ingenieur", "Friseur", "Akteur", "Regisseur", "Sekretär", "Aktionär", "Funktionär",
    "Bibliothekar", "Notar", "Kommissar", "Referendar", "Offizier", "Wirt", "Landwirt", "Kapitän",
    "Dekan"
  ];

  var EXPLICIT = [
    weakE("Kommilitone", P("Mitstudierende")),
    weak("Student", P("Studierende")),
    weak("Dozent", P("Lehrende")),
    weak("Demonstrant", P("Demonstrierende")),
    weak("Assistent", N("Assistenz", "Assistenzen")),
    weak("Polizist", N("Polizeikraft", "Polizeikräfte")),
    strong("Arzt", "Arztes", "Ärzte", "Ärzt"),
    strong("Zahnarzt", "Zahnarztes", "Zahnärzte", "Zahnärzt"),
    strong("Tierarzt", "Tierarztes", "Tierärzte", "Tierärzt"),
    strong("Anwalt", "Anwalts", "Anwälte", "Anwält"),
    strong("Rechtsanwalt", "Rechtsanwalts", "Rechtsanwälte", "Rechtsanwält"),
    strong("Koch", "Kochs", "Köche", "Köch"),
    strong("Freund", "Freundes", "Freunde", "Freund"),
    strong("Chef", "Chefs", "Chefs", "Chef", N("Führungskraft", "Führungskräfte"))
  ];

  GNH.dictionary = [].concat(
    ER_NEUTRAL,
    ER_PLAIN.map(function (base) { return er(base); }),
    WEAK_E_PLAIN.map(function (base) { return weakE(base); }),
    WEAK_PLAIN.map(function (base) { return weak(base); }),
    OR_PLURAL.map(function (base) { return strong(base, base + "s", base + "en", base); }),
    E_PLURAL.map(function (base) { return strong(base, base + "s", base + "e", base); }),
    EXPLICIT
  );

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GNH.dictionary;
  }
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/dictionary.test.js`
Expected: PASS, 7 tests, 0 failures. If "no masculine form is claimed by two entries" or "ids are unique" fails, the message names the duplicate word; delete the second occurrence from its list and rerun.

- [ ] **Step 5: Commit**

```bash
git add scripts/dictionary.js test/dictionary.test.js
git commit -m "Add bundled dictionary" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Settings

**Files:**
- Create: `scripts/settings.js`
- Test: `test/settings.test.js`

**Interfaces:**
- Consumes: `engine.STYLES`.
- Produces: `settings.KEY` — `"gnh.settings.v1"`.
- Produces: `settings.defaults()` returns `{ primaryStyle: "neutral", fallbackStyle: "colon", disabledIds: [], customEntries: [] }`.
- Produces: `settings.parse(text)` returns a Settings object or `null` (strict shape check; entries inside `customEntries` only need to be objects).
- Produces: `settings.serialize(settings)` returns a JSON string.
- Produces: `settings.load(storage)` returns `{ settings, persistent: boolean }`; never throws. `storage` is a `localStorage`-like object or `null`.
- Produces: `settings.save(storage, settings)` returns `boolean`; never throws.
- Produces: `settings.deriveEntry(input)` returns an Entry or `null`. `input` is `{ mascSg, mascPl, femSg, femPl, neutralSg, neutralPl }`, all strings.

- [ ] **Step 1: Write the failing tests**

`test/settings.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../scripts/engine.js");
const settings = require("../scripts/settings.js");

function fakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}
const throwing = {
  getItem: () => { throw new Error("denied"); },
  setItem: () => { throw new Error("denied"); }
};
const DEFAULTS = { primaryStyle: "neutral", fallbackStyle: "colon", disabledIds: [], customEntries: [] };

test("defaults returns a fresh object each time", () => {
  assert.deepEqual(settings.defaults(), DEFAULTS);
  assert.notEqual(settings.defaults(), settings.defaults());
  assert.equal(settings.KEY, "gnh.settings.v1");
});

test("load returns defaults for empty storage", () => {
  assert.deepEqual(settings.load(fakeStorage()), { settings: DEFAULTS, persistent: true });
});

test("save and load round-trip", () => {
  const storage = fakeStorage();
  const value = { primaryStyle: "pair", fallbackStyle: "asterisk", disabledIds: ["kunde"], customEntries: [{ id: "x" }] };
  assert.equal(settings.save(storage, value), true);
  assert.deepEqual(settings.load(storage), { settings: value, persistent: true });
});

test("load falls back to defaults for corrupt or mistyped content", () => {
  const bad = ["{", "null", "[]", "\"text\"", "{\"primaryStyle\":\"x\"}",
    JSON.stringify(Object.assign({}, DEFAULTS, { disabledIds: "kunde" })),
    JSON.stringify(Object.assign({}, DEFAULTS, { disabledIds: [1] })),
    JSON.stringify(Object.assign({}, DEFAULTS, { customEntries: ["Kunde"] })),
    JSON.stringify(Object.assign({}, DEFAULTS, { customEntries: [null] }))];
  bad.forEach((text) => {
    assert.deepEqual(settings.load(fakeStorage({ "gnh.settings.v1": text })), { settings: DEFAULTS, persistent: false }, text);
  });
});

test("load and save never throw without usable storage", () => {
  assert.deepEqual(settings.load(null), { settings: DEFAULTS, persistent: false });
  assert.deepEqual(settings.load(throwing), { settings: DEFAULTS, persistent: false });
  assert.equal(settings.save(null, DEFAULTS), false);
  assert.equal(settings.save(throwing, DEFAULTS), false);
});

test("parse rejects neutral as fallback style and non-JSON text", () => {
  assert.equal(settings.parse(JSON.stringify(Object.assign({}, DEFAULTS, { fallbackStyle: "neutral" }))), null);
  assert.equal(settings.parse("not json"), null);
  assert.equal(settings.parse(""), null);
});

test("parse drops unknown keys", () => {
  const parsed = settings.parse(JSON.stringify(Object.assign({ extra: 1 }, DEFAULTS)));
  assert.deepEqual(parsed, DEFAULTS);
});

test("serialize output parses back", () => {
  assert.deepEqual(settings.parse(settings.serialize(DEFAULTS)), DEFAULTS);
});

test("deriveEntry builds a valid entry and trims input", () => {
  const entry = settings.deriveEntry({ mascSg: " Tutor ", mascPl: "Tutoren", femSg: "Tutorin", femPl: "Tutorinnen", neutralSg: "", neutralPl: "" });
  assert.deepEqual(entry, {
    id: "tutor",
    masc: { sg: ["Tutor", "Tutors"], pl: ["Tutoren"] },
    fem: { sg: "Tutorin", pl: "Tutorinnen" },
    stem: "Tutor"
  });
  assert.equal(engine.validateEntry(entry), true);
});

test("deriveEntry adds a dative plural and noun neutrals", () => {
  const entry = settings.deriveEntry({ mascSg: "Coach", mascPl: "Coache", femSg: "Coachin", femPl: "Coachinnen", neutralSg: "Begleitperson", neutralPl: "" });
  assert.deepEqual(entry.masc.pl, ["Coache", "Coachen"]);
  assert.deepEqual(entry.neutral, { kind: "noun", sg: "Begleitperson" });
  assert.equal(engine.validateEntry(entry), true);
  const erNoun = settings.deriveEntry({ mascSg: "Tester", mascPl: "Tester", femSg: "Testerin", femPl: "Testerinnen" });
  assert.deepEqual(erNoun.masc, { sg: ["Tester", "Testers"], pl: ["Tester", "Testern"] });
});

test("deriveEntry adds no genitive s after a sibilant", () => {
  const entry = settings.deriveEntry({ mascSg: "Boss", mascPl: "Bosse", femSg: "Bossin", femPl: "Bossinnen" });
  assert.deepEqual(entry.masc.sg, ["Boss"]);
});

test("deriveEntry rejects incomplete or unusable input", () => {
  const ok = { mascSg: "Tutor", mascPl: "Tutoren", femSg: "Tutorin", femPl: "Tutorinnen" };
  assert.equal(settings.deriveEntry(Object.assign({}, ok, { femPl: " " })), null);
  assert.equal(settings.deriveEntry(Object.assign({}, ok, { femSg: "Tutor" })), null);
  assert.equal(settings.deriveEntry(Object.assign({}, ok, { femSg: "in" })), null);
  assert.equal(settings.deriveEntry(Object.assign({}, ok, { mascSg: "zwei Wörter" })), null);
  assert.equal(settings.deriveEntry(Object.assign({}, ok, { mascPl: "Tutor3n" })), null);
  assert.equal(settings.deriveEntry(Object.assign({}, ok, { mascSg: undefined })), null);
  assert.equal(settings.deriveEntry(null), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/settings.test.js`
Expected: FAIL with `Cannot find module '../scripts/settings.js'`

- [ ] **Step 3: Write `scripts/settings.js`**

```js
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

  GNH.settings = {
    KEY: KEY,
    defaults: defaults,
    parse: parse,
    serialize: serialize,
    load: load,
    save: save,
    deriveEntry: deriveEntry
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = GNH.settings;
  }
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/settings.test.js`
Expected: PASS, 12 tests, 0 failures

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, 55 tests, 0 failures

- [ ] **Step 6: Commit**

```bash
git add scripts/settings.js test/settings.test.js
git commit -m "Add settings storage and user entry derivation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Findings panel

**Files:**
- Create: `scripts/strings.js`, `scripts/panel.js`, `resources/css/panel.css`, `test/translations.test.js`
- Modify: `index.html` (replace entirely), `translations/en-US.json` (replace entirely)
- Delete: `scripts/debug.js`

**Interfaces:**
- Consumes: `GNH.engine` (Tasks 2-4), `GNH.dictionary` (Task 5), `GNH.settings` (Task 6), `GNH.document` (Task 1).
- Produces: `GNH.strings` — object mapping string keys to German text. `%1` marks one placeholder.
- Produces: an element `<div id="settingsBody">` inside `<details id="settings">` for Task 8.
- Produces: `panel.js` calls `GNH.settingsView.mount(node, api)` once at init and `GNH.settingsView.refresh()` after every settings change and translation load, if `GNH.settingsView` exists. `api` is `{ t(key, arg), el(tag, attrs, children), getSettings(), getSkipped(), commit(nextSettings) }`.
  - `t` returns the translated string for a `GNH.strings` key, with `%1` replaced by `arg`.
  - `el` creates an element; `attrs.text` sets `textContent`, keys starting with `on` add listeners, other keys set a DOM property if it exists, otherwise an attribute.
  - `commit` stores the settings, rebuilds the index, recomputes findings from the cached paragraphs and re-renders.

- [ ] **Step 1: Write the failing translation test**

`test/translations.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = require("../scripts/engine.js");
const strings = require("../scripts/strings.js");

const rootDir = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");
const english = JSON.parse(read("translations/en-US.json"));

test("every German string has a non-empty English translation", () => {
  Object.keys(strings).forEach((key) => {
    const text = english[strings[key]];
    assert.ok(typeof text === "string" && text.length > 0, key);
  });
});

test("the translation file has no unused entries", () => {
  const used = new Set(Object.values(strings));
  Object.keys(english).forEach((german) => assert.ok(used.has(german), german));
});

test("placeholders survive translation", () => {
  Object.values(strings).forEach((german) => {
    assert.equal(german.includes("%1"), english[german].includes("%1"), german);
  });
});

test("every style and hint has a string", () => {
  engine.STYLES.forEach((id) => assert.ok(strings["style_" + id], id));
  ["checkArticle", "checkCase", "noNeutralForm"].forEach((hint) => assert.ok(strings["hint_" + hint], hint));
});

test("keys used in markup and scripts exist", () => {
  const keys = [];
  read("index.html").replace(/data-i18n="([^"]+)"/g, (m, key) => keys.push(key));
  fs.readdirSync(path.join(rootDir, "scripts")).forEach((file) => {
    read("scripts/" + file).replace(/\bt\("([A-Za-z_]+)"[,)]/g, (m, key) => keys.push(key));
  });
  assert.ok(keys.length > 10);
  keys.forEach((key) => assert.ok(strings[key], key));
});

test("langs.json lists en-US", () => {
  assert.deepEqual(JSON.parse(read("translations/langs.json")), ["en-US"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/translations.test.js`
Expected: FAIL with `Cannot find module '../scripts/strings.js'`

- [ ] **Step 3: Create `scripts/strings.js`**

```js
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
    style_pair: "Paarform (Mitarbeiterinnen und Mitarbeiter)"
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GNH.strings;
  }
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 4: Replace `translations/en-US.json`**

```json
{
  "Schreibweise": "Writing style",
  "Dokument prüfen": "Scan document",
  "Erneut versuchen": "Try again",
  "Alle ersetzen": "Replace all",
  "Einstellungen": "Settings",
  "Noch nicht geprüft.": "Not scanned yet.",
  "Dokument wird geprüft …": "Scanning document …",
  "Keine Fundstellen.": "No findings.",
  "Fundstellen: %1": "Findings: %1",
  "Der Zugriff auf das Dokument ist fehlgeschlagen.": "Could not access the document.",
  "Das Dokument wurde geändert. Bitte erneut prüfen.": "The document has changed. Please scan again.",
  "Übersprungen, weil sich das Dokument geändert hat: %1": "Skipped because the document changed: %1",
  "Einstellungen können nicht gespeichert werden.": "Settings cannot be saved.",
  "Im Dokument anzeigen": "Show in document",
  "Ersetzen": "Replace",
  "Ignorieren": "Ignore",
  "Nie markieren": "Never flag",
  "Artikel und Adjektive bitte von Hand anpassen.": "Please adjust articles and adjectives by hand.",
  "Bitte den Fall der Ersetzung prüfen.": "Please check the grammatical case of the replacement.",
  "Keine neutrale Form vorhanden.": "No neutral form available.",
  "Neutrale Form (Mitarbeitende)": "Neutral form (Mitarbeitende)",
  "Doppelpunkt (Mitarbeiter:innen)": "Colon (Mitarbeiter:innen)",
  "Sternchen (Mitarbeiter*innen)": "Asterisk (Mitarbeiter*innen)",
  "Unterstrich (Mitarbeiter_innen)": "Underscore (Mitarbeiter_innen)",
  "Binnen-I (MitarbeiterInnen)": "Internal I (MitarbeiterInnen)",
  "Schrägstrich (Mitarbeiter/-innen)": "Slash (Mitarbeiter/-innen)",
  "Paarform (Mitarbeiterinnen und Mitarbeiter)": "Pair form (Mitarbeiterinnen und Mitarbeiter)"
}
```

- [ ] **Step 5: Replace `index.html`**

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Gendergerechte Sprache</title>
  <script src="./../v1/plugins.js"></script>
  <link rel="stylesheet" href="./../v1/plugins.css">
  <link rel="stylesheet" href="resources/css/panel.css">
</head>
<body>
  <div id="app">
    <label for="style" data-i18n="style"></label>
    <select id="style"></select>
    <button id="scan" type="button" class="primary" data-i18n="scan"></button>
    <p id="notice" class="notice" hidden></p>
    <p id="summary" class="summary" aria-live="polite"></p>
    <button id="retry" type="button" data-i18n="retry" hidden></button>
    <ul id="findings"></ul>
    <button id="replaceAll" type="button" data-i18n="replaceAll" hidden></button>
    <details id="settings">
      <summary data-i18n="settings"></summary>
      <div id="settingsBody"></div>
    </details>
  </div>
  <script src="scripts/engine.js"></script>
  <script src="scripts/dictionary.js"></script>
  <script src="scripts/settings.js"></script>
  <script src="scripts/strings.js"></script>
  <script src="scripts/document.js"></script>
  <script src="scripts/panel.js"></script>
</body>
</html>
```

- [ ] **Step 6: Create `resources/css/panel.css`**

```css
:root {
  --gnh-bg: #ffffff;
  --gnh-text: #333333;
  --gnh-muted: #6b6b6b;
  --gnh-border: #cbcbcb;
  --gnh-control: #f3f3f3;
  --gnh-accent: #446995;
  --gnh-mark: #ffe58a;
}

html, body {
  margin: 0;
  height: 100%;
  background: var(--gnh-bg);
  color: var(--gnh-text);
  font: 12px/1.45 Arial, Helvetica, sans-serif;
}

#app {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  box-sizing: border-box;
}

select, input[type="text"], input[type="search"] {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 6px;
  border: 1px solid var(--gnh-border);
  border-radius: 2px;
  background: var(--gnh-bg);
  color: var(--gnh-text);
  font: inherit;
}

button {
  padding: 4px 10px;
  border: 1px solid var(--gnh-border);
  border-radius: 2px;
  background: var(--gnh-control);
  color: var(--gnh-text);
  font: inherit;
  cursor: pointer;
}

button.primary {
  border-color: var(--gnh-accent);
  background: var(--gnh-accent);
  color: #ffffff;
}

button:disabled {
  opacity: 0.5;
  cursor: default;
}

:focus-visible {
  outline: 2px solid var(--gnh-accent);
  outline-offset: 1px;
}

.notice {
  margin: 0;
  padding: 6px 8px;
  border: 1px solid var(--gnh-border);
  border-radius: 2px;
}

.summary, .hint {
  margin: 0;
  color: var(--gnh-muted);
}

.hint:empty {
  display: none;
}

#findings, .plain-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.finding {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
  border-top: 1px solid var(--gnh-border);
}

.ctx {
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  overflow-wrap: anywhere;
  white-space: normal;
}

.ctx mark {
  padding: 0 1px;
  background: var(--gnh-mark);
  color: #222222;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

#settingsBody {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
}

#settingsBody h3 {
  margin: 8px 0 0;
  font-size: 12px;
}

.plain-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.plain-list li > span, .plain-list li > label {
  flex: 1;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 7: Create `scripts/panel.js`**

```js
(function (window) {
  "use strict";
  var GNH = window.GNH;
  var engine = GNH.engine;
  var store = GNH.settings;
  var editor = GNH.document;
  var plugin = window.Asc.plugin;
  var doc = window.document;

  var state = {
    ready: false,
    settings: store.defaults(),
    persistent: true,
    index: null,
    paragraphs: null,
    items: [],
    ignored: new Set(),
    status: "idle",
    message: ""
  };

  function t(key, arg) {
    var text = plugin.tr(GNH.strings[key]);
    return arg === undefined ? text : text.replace("%1", String(arg));
  }

  function el(tag, attrs, children) {
    var node = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "text") node.textContent = attrs[key];
      else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2), attrs[key]);
      else if (key in node) node[key] = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  function storage() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  }

  function rebuildIndex() {
    var entries = engine.mergeEntries(GNH.dictionary, state.settings.customEntries);
    state.index = engine.buildIndex(entries, state.settings.disabledIds);
  }

  // Recomputes findings from the cached paragraph texts. No editor access.
  function rebuildItems() {
    if (!state.paragraphs) return;
    var s = state.settings;
    state.items = engine.scanDocument(state.paragraphs, state.index)
      .filter(function (finding) {
        return !state.ignored.has(engine.findingKey(finding));
      })
      .map(function (finding) {
        var entry = state.index.byId.get(finding.entryId);
        return {
          finding: finding,
          suggestions: engine.suggestAll(finding, entry, s.primaryStyle, s.fallbackStyle),
          chosen: 0
        };
      });
    state.status = state.items.length ? "findings" : "none";
  }

  function commit(next) {
    state.settings = next;
    state.persistent = store.save(storage(), next);
    rebuildIndex();
    rebuildItems();
    render();
    if (GNH.settingsView) GNH.settingsView.refresh();
  }

  function fail() {
    state.paragraphs = null;
    state.items = [];
    state.status = "error";
    render();
  }

  function scan(keepIgnored, message) {
    if (!keepIgnored) state.ignored = new Set();
    state.status = "scanning";
    state.message = message || "";
    render();
    return editor.readParagraphs().then(function (paragraphs) {
      state.paragraphs = paragraphs;
      rebuildItems();
      render();
    }).catch(fail);
  }

  function target(item, replacement) {
    var f = item.finding;
    return {
      p: f.p,
      start: f.start,
      form: f.form,
      ordinal: f.ordinal,
      expected: state.paragraphs[f.p],
      replacement: replacement
    };
  }

  function showStale() {
    state.message = t("stale");
    render();
  }

  function selectItem(item) {
    editor.select(target(item, null)).then(function (result) {
      if (result.done !== 1) showStale();
    }).catch(fail);
  }

  function replaceItems(items) {
    var targets = engine.orderForReplace(items.map(function (item) {
      return target(item, item.suggestions[item.chosen].text);
    }));
    editor.replaceMany(targets).then(function (result) {
      if (result.done === 0) return showStale();
      return scan(true, result.stale > 0 ? t("skipped", result.stale) : "");
    }).catch(fail);
  }

  function ignoreItem(item) {
    state.ignored.add(engine.findingKey(item.finding));
    rebuildItems();
    render();
  }

  function neverFlag(item) {
    commit(Object.assign({}, state.settings, {
      disabledIds: state.settings.disabledIds.concat(item.finding.entryId)
    }));
  }

  function hintText(item) {
    var hint = item.suggestions[item.chosen].hint;
    return hint ? t("hint_" + hint) : "";
  }

  function renderItem(item) {
    var f = item.finding;
    var hint = el("p", { className: "hint", text: hintText(item) });
    var select = el("select", {
      onchange: function () {
        item.chosen = select.selectedIndex;
        hint.textContent = hintText(item);
      }
    }, item.suggestions.map(function (suggestion) {
      return el("option", { text: suggestion.text });
    }));
    select.selectedIndex = item.chosen;
    return el("li", { className: "finding" }, [
      el("button", { type: "button", className: "ctx", title: t("jump"), onclick: function () { selectItem(item); } }, [
        doc.createTextNode(f.context.before),
        el("mark", { text: f.form }),
        doc.createTextNode(f.context.after)
      ]),
      select,
      hint,
      el("div", { className: "actions" }, [
        el("button", { type: "button", text: t("replace"), onclick: function () { replaceItems([item]); } }),
        el("button", { type: "button", text: t("ignore"), onclick: function () { ignoreItem(item); } }),
        el("button", { type: "button", text: t("never"), onclick: function () { neverFlag(item); } })
      ])
    ]);
  }

  function render() {
    var notes = [];
    if (!state.persistent) notes.push(t("noStorage"));
    if (state.message) notes.push(state.message);
    var notice = doc.getElementById("notice");
    notice.textContent = notes.join(" ");
    notice.hidden = notes.length === 0;

    var summary = {
      idle: t("idle"),
      scanning: t("scanning"),
      none: t("none"),
      error: t("error"),
      findings: t("count", state.items.length)
    };
    doc.getElementById("summary").textContent = summary[state.status];
    doc.getElementById("scan").disabled = state.status === "scanning";
    doc.getElementById("retry").hidden = state.status !== "error";
    doc.getElementById("replaceAll").hidden = state.status !== "findings";
    doc.getElementById("style").value = state.settings.primaryStyle;

    var list = doc.getElementById("findings");
    list.textContent = "";
    if (state.status === "findings") {
      state.items.forEach(function (item) {
        list.appendChild(renderItem(item));
      });
    }
  }

  function applyStaticText() {
    Array.prototype.forEach.call(doc.querySelectorAll("[data-i18n]"), function (node) {
      node.textContent = t(node.getAttribute("data-i18n"));
    });
    var style = doc.getElementById("style");
    style.textContent = "";
    engine.STYLES.forEach(function (id) {
      style.appendChild(el("option", { value: id, text: t("style_" + id) }));
    });
  }

  var api = {
    t: t,
    el: el,
    getSettings: function () { return state.settings; },
    getSkipped: function () { return state.index.skipped; },
    commit: commit
  };

  plugin.init = function () {
    if (state.ready) return;
    state.ready = true;
    var loaded = store.load(storage());
    state.settings = loaded.settings;
    state.persistent = loaded.persistent;
    rebuildIndex();
    doc.getElementById("style").addEventListener("change", function (event) {
      commit(Object.assign({}, state.settings, { primaryStyle: event.target.value }));
    });
    doc.getElementById("scan").addEventListener("click", function () { scan(false); });
    doc.getElementById("retry").addEventListener("click", function () { scan(true); });
    doc.getElementById("replaceAll").addEventListener("click", function () { replaceItems(state.items); });
    applyStaticText();
    render();
    if (GNH.settingsView) GNH.settingsView.mount(doc.getElementById("settingsBody"), api);
  };

  plugin.onTranslate = function () {
    applyStaticText();
    render();
    if (GNH.settingsView) GNH.settingsView.refresh();
  };

  plugin.onThemeChanged = function (theme) {
    plugin.onThemeChangedBase(theme);
    var style = doc.documentElement.style;
    var map = {
      "--gnh-bg": "background-normal",
      "--gnh-text": "text-normal",
      "--gnh-muted": "text-secondary",
      "--gnh-border": "border-regular-control",
      "--gnh-control": "background-toolbar"
    };
    Object.keys(map).forEach(function (name) {
      if (theme && theme[map[name]]) style.setProperty(name, theme[map[name]]);
      else style.removeProperty(name);
    });
  };

  plugin.button = function () {
    this.executeCommand("close", "");
  };
})(window);
```

- [ ] **Step 8: Delete the harness and run all tests**

Run: `git rm -q scripts/debug.js && npm test`
Expected: PASS, 61 tests, 0 failures

- [ ] **Step 9: Check the scripts parse**

Run: `for f in scripts/*.js; do node --check "$f" || echo "FAILED $f"; done`
Expected: no output

- [ ] **Step 10: Human checkpoint in the editor**

Run `npm run install:desktop`, then ask the human partner to restart Desktop Editors and check:

1. With the three-paragraph document from Task 1 plus the sentence `Die Lehrer danken den Kunden und allen Mitarbeitern.`: "Dokument prüfen" lists the findings; "Mitarbeiterin" is not listed.
2. Clicking a context line selects that word in the document.
3. "Ersetzen" on the bold "Mitarbeiter" replaces it, keeps bold, and the list refreshes.
4. Changing "Schreibweise" changes the default suggestions without a new scan.
5. "Ignorieren" removes one finding; it stays gone after replacing another one; it returns after "Dokument prüfen".
6. "Nie markieren" on a "Kunden" finding removes all Kunde findings, also after a new scan.
7. Scan, then type a letter into a paragraph with a finding, then click "Ersetzen" on it: the stale message appears and the document is unchanged.
8. "Alle ersetzen" replaces everything left; one Ctrl+Z undoes at least the last replacement.
9. Switching the editor between a light and a dark theme keeps the panel readable.
10. With the editor UI set to English the panel text is English.

Fix anything that fails before committing.

- [ ] **Step 11: Commit**

```bash
git add -A index.html scripts resources/css translations test/translations.test.js
git commit -m "Add findings panel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Settings section and README

**Files:**
- Create: `scripts/settings-view.js`, `README.md`
- Modify: `scripts/strings.js`, `translations/en-US.json`, `index.html`

**Interfaces:**
- Consumes: the `api` object from Task 7; `GNH.engine.STYLES`, `GNH.engine.validateEntry`; `GNH.settings.deriveEntry`, `GNH.settings.parse`, `GNH.settings.serialize`; `GNH.dictionary`.
- Produces: `GNH.settingsView.mount(node, api)` and `GNH.settingsView.refresh()`.

- [ ] **Step 1: Add the settings strings**

In `scripts/strings.js`, add these properties after `style_pair` (put a comma after the `style_pair` line):

```js
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
```

In `translations/en-US.json`, add these entries before the closing brace (put a comma after the current last entry):

```json
  "Ersatz, wenn es keine neutrale Form gibt": "Fallback when there is no neutral form",
  "Eigene Einträge": "Your entries",
  "Maskulin Singular": "Masculine singular",
  "Maskulin Plural": "Masculine plural",
  "Feminin Singular": "Feminine singular",
  "Feminin Plural": "Feminine plural",
  "Neutral Singular (optional)": "Neutral singular (optional)",
  "Neutral Plural (optional)": "Neutral plural (optional)",
  "Speichern": "Save",
  "Bearbeiten": "Edit",
  "Löschen": "Delete",
  "Bitte alle Pflichtfelder mit je einem Wort ausfüllen. Die feminine Singularform muss auf „in“ enden.": "Please fill in every required field with a single word. The feminine singular must end in “in”.",
  "Ungültige Einträge werden nicht verwendet: %1": "Invalid entries are not used: %1",
  "Mitgelieferte Wörter": "Bundled words",
  "Wort suchen": "Search word",
  "Weitere Treffer: %1": "More matches: %1",
  "Exportieren": "Export",
  "Importieren": "Import",
  "Aktuelle Einstellungen durch die Datei ersetzen?": "Replace the current settings with the file?",
  "Die Datei enthält keine gültigen Einstellungen.": "The file does not contain valid settings.",
  "Ja": "Yes",
  "Abbrechen": "Cancel"
```

- [ ] **Step 2: Run the translation test**

Run: `node --test test/translations.test.js`
Expected: PASS, 6 tests. Strings and translations were added together, so the suite stays green; a failure here names a mistyped key. This task's UI code has no automated test and is checked in Step 7.

- [ ] **Step 3: Create `scripts/settings-view.js`**

```js
(function (window) {
  "use strict";
  var GNH = (window.GNH = window.GNH || {});
  var doc = window.document;
  var FIELDS = ["mascSg", "mascPl", "femSg", "femPl", "neutralSg", "neutralPl"];
  var MAX_ROWS = 50;

  var root = null;
  var api = null;
  var editingIndex = -1;
  var filter = "";
  var pendingImport = null;
  var message = "";

  function settings() {
    return api.getSettings();
  }

  function update(changes) {
    message = "";
    api.commit(Object.assign({}, settings(), changes));
  }

  function fallbackSection() {
    var el = api.el;
    var select = el("select", {
      id: "fallback",
      onchange: function () { update({ fallbackStyle: select.value }); }
    }, GNH.engine.STYLES.filter(function (id) {
      return id !== "neutral";
    }).map(function (id) {
      return el("option", { value: id, text: api.t("style_" + id) });
    }));
    select.value = settings().fallbackStyle;
    return [el("label", { htmlFor: "fallback", text: api.t("fallback") }), select];
  }

  function entryLabel(entry) {
    var hasForms = entry && entry.masc && Array.isArray(entry.masc.sg) && Array.isArray(entry.masc.pl);
    return hasForms ? entry.masc.sg[0] + " / " + entry.masc.pl[0] : String((entry && entry.id) || "?");
  }

  function customList() {
    var el = api.el;
    var entries = settings().customEntries;
    return el("ul", { className: "plain-list" }, entries.map(function (entry, index) {
      var buttons = [];
      if (GNH.engine.validateEntry(entry)) {
        buttons.push(el("button", {
          type: "button",
          text: api.t("edit"),
          onclick: function () { editingIndex = index; message = ""; refresh(); }
        }));
      }
      buttons.push(el("button", {
        type: "button",
        text: api.t("remove"),
        onclick: function () {
          editingIndex = -1;
          update({ customEntries: entries.filter(function (other, i) { return i !== index; }) });
        }
      }));
      return el("li", {}, [el("span", { text: entryLabel(entry) })].concat(buttons));
    }));
  }

  function formValues(entry) {
    if (!entry) return {};
    var neutral = entry.neutral || {};
    return {
      mascSg: entry.masc.sg[0],
      mascPl: entry.masc.pl[0],
      femSg: entry.fem.sg,
      femPl: entry.fem.pl,
      neutralSg: neutral.sg || "",
      neutralPl: neutral.pl || ""
    };
  }

  function entryForm() {
    var el = api.el;
    var entries = settings().customEntries;
    var values = formValues(editingIndex >= 0 ? entries[editingIndex] : null);
    var inputs = {};
    var nodes = [];
    FIELDS.forEach(function (field) {
      inputs[field] = el("input", { type: "text", id: "entry-" + field, value: values[field] || "" });
      nodes.push(el("label", { htmlFor: "entry-" + field, text: api.t(field) }));
      nodes.push(inputs[field]);
    });
    nodes.push(el("button", {
      type: "button",
      text: api.t("save"),
      onclick: function () {
        var input = {};
        FIELDS.forEach(function (field) { input[field] = inputs[field].value; });
        var entry = GNH.settings.deriveEntry(input);
        if (!entry) {
          message = api.t("invalidEntry");
          doc.getElementById("settingsMessage").textContent = message;
          return;
        }
        var kept = entries.filter(function (other, i) {
          return i !== editingIndex && (!other || other.id !== entry.id);
        });
        editingIndex = -1;
        update({ customEntries: kept.concat(entry) });
      }
    }));
    return nodes;
  }

  function bundledRows(list) {
    var el = api.el;
    var disabled = settings().disabledIds;
    var needle = filter.trim().toLowerCase();
    var matches = GNH.dictionary.filter(function (entry) {
      return entry.id.indexOf(needle) >= 0;
    });
    list.textContent = "";
    matches.slice(0, MAX_ROWS).forEach(function (entry) {
      var box = el("input", {
        type: "checkbox",
        id: "word-" + entry.id,
        checked: disabled.indexOf(entry.id) < 0,
        onchange: function () {
          var others = disabled.filter(function (id) { return id !== entry.id; });
          update({ disabledIds: box.checked ? others : others.concat(entry.id) });
        }
      });
      list.appendChild(el("li", {}, [box, el("label", { htmlFor: "word-" + entry.id, text: entry.masc.sg[0] })]));
    });
    if (matches.length > MAX_ROWS) {
      list.appendChild(el("li", {}, [el("span", { text: api.t("more", matches.length - MAX_ROWS) })]));
    }
  }

  function bundledSection() {
    var el = api.el;
    var list = el("ul", { className: "plain-list" });
    var search = el("input", {
      type: "search",
      id: "wordSearch",
      value: filter,
      oninput: function () { filter = search.value; bundledRows(list); }
    });
    bundledRows(list);
    return [el("label", { htmlFor: "wordSearch", text: api.t("search") }), search, list];
  }

  function exportSettings() {
    var blob = new Blob([GNH.settings.serialize(settings())], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = api.el("a", { href: url, download: "gender-helper-settings.json" });
    doc.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function readImport(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      pendingImport = GNH.settings.parse(String(reader.result));
      message = pendingImport ? "" : api.t("importInvalid");
      refresh();
    };
    reader.onerror = function () {
      pendingImport = null;
      message = api.t("importInvalid");
      refresh();
    };
    reader.readAsText(file);
  }

  function transferSection() {
    var el = api.el;
    var file = el("input", {
      type: "file",
      id: "importFile",
      accept: ".json,application/json",
      onchange: function () { readImport(file.files[0]); }
    });
    var nodes = [
      el("div", { className: "actions" }, [
        el("button", { type: "button", text: api.t("exportFile"), onclick: exportSettings })
      ]),
      el("label", { htmlFor: "importFile", text: api.t("importFile") }),
      file
    ];
    if (pendingImport) {
      nodes.push(el("p", { className: "notice", text: api.t("importConfirm") }));
      nodes.push(el("div", { className: "actions" }, [
        el("button", {
          type: "button",
          text: api.t("yes"),
          onclick: function () {
            var next = pendingImport;
            pendingImport = null;
            editingIndex = -1;
            message = "";
            api.commit(next);
          }
        }),
        el("button", {
          type: "button",
          text: api.t("cancel"),
          onclick: function () { pendingImport = null; refresh(); }
        })
      ]));
    }
    return nodes;
  }

  function refresh() {
    if (!root) return;
    var el = api.el;
    var skipped = api.getSkipped();
    var nodes = [].concat(
      fallbackSection(),
      [el("h3", { text: api.t("ownEntries") }), customList()],
      entryForm(),
      skipped.length ? [el("p", { className: "notice", text: api.t("skippedEntries", skipped.join(", ")) })] : [],
      [el("h3", { text: api.t("bundled") })],
      bundledSection(),
      transferSection(),
      [el("p", { className: "hint", id: "settingsMessage", text: message })]
    );
    root.textContent = "";
    nodes.forEach(function (node) {
      root.appendChild(node);
    });
  }

  GNH.settingsView = {
    mount: function (node, panelApi) {
      root = node;
      api = panelApi;
      refresh();
    },
    refresh: refresh
  };
})(window);
```

- [ ] **Step 4: Load the script in `index.html`**

Add this line directly above `<script src="scripts/panel.js"></script>`:

```html
  <script src="scripts/settings-view.js"></script>
```

- [ ] **Step 5: Run all checks**

Run: `npm test && for f in scripts/*.js; do node --check "$f" || echo "FAILED $f"; done`
Expected: PASS, 61 tests, 0 failures, and no `FAILED` line

- [ ] **Step 6: Write `README.md`**

````markdown
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
````

- [ ] **Step 7: Human checkpoint in the editor**

Run `npm run install:desktop` and ask the human partner to work through the README checklist. Fix anything that fails. If export does not produce a file in Desktop Editors, report it to the human partner as a known limitation and add it to the README's limitations list.

- [ ] **Step 8: Commit**

```bash
git add README.md index.html scripts/settings-view.js scripts/strings.js translations/en-US.json
git commit -m "Add settings section and README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
