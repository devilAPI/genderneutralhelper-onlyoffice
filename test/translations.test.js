"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = require("../scripts/engine.js");
const german = require("../scripts/strings.js");
const { en: english, pickStrings } = require("../scripts/strings-en.js");

const rootDir = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

test("both tables have the same keys", () => {
  assert.deepEqual(Object.keys(english).sort(), Object.keys(german).sort());
});

test("every string is non-empty in both languages", () => {
  [german, english].forEach((table) => {
    Object.keys(table).forEach((key) => {
      assert.ok(typeof table[key] === "string" && table[key].length > 0, key);
    });
  });
});

test("placeholders survive translation", () => {
  Object.keys(german).forEach((key) => {
    assert.equal(german[key].includes("%1"), String(english[key]).includes("%1"), key);
  });
});

test("every style and hint has a string", () => {
  [german, english].forEach((table) => {
    engine.STYLES.forEach((id) => assert.ok(table["style_" + id], id));
    ["checkArticle", "checkCase", "noNeutralForm"].forEach((hint) => assert.ok(table["hint_" + hint], hint));
  });
});

test("keys used in markup and scripts exist", () => {
  const keys = [];
  read("index.html").replace(/data-i18n="([^"]+)"/g, (m, key) => keys.push(key));
  fs.readdirSync(path.join(rootDir, "scripts")).forEach((file) => {
    read("scripts/" + file).replace(/\bt\("([A-Za-z_]+)"[,)]/g, (m, key) => keys.push(key));
  });
  assert.ok(keys.length > 10);
  keys.forEach((key) => {
    assert.ok(german[key], key);
    assert.ok(english[key], key);
  });
});

test("the progress and suggestion-label strings exist", () => {
  assert.ok(german.replacing.includes("%1"));
  assert.equal(german.chooseSuggestion, "Vorschlag wählen");
  assert.equal(english.chooseSuggestion, "Choose suggestion");
});

test("pickStrings gives English for English editor languages", () => {
  ["en", "en-US", "EN-gb"].forEach((lang) => assert.equal(pickStrings(lang), english, lang));
});

test("pickStrings gives German for everything else", () => {
  ["de-DE", "fr-FR", undefined, null, "", 5, "de-en"].forEach((lang) => {
    assert.equal(pickStrings(lang), german, String(lang));
  });
});
