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
