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

test("disabledAfterSave re-enables the saved id and the id it replaced", () => {
  assert.deepEqual(settings.disabledAfterSave(["kunde", "tutor", "coach"], "tutor", undefined), ["kunde", "coach"]);
  assert.deepEqual(settings.disabledAfterSave(["kunde", "tutor", "coach"], "tutorin", "tutor"), ["kunde", "coach"]);
  assert.deepEqual(settings.disabledAfterSave(["tutor", "coach", "tutor"], "coach", "tutor"), []);
});

test("disabledAfterSave leaves other ids alone and does not mutate", () => {
  const disabled = ["kunde", "arzt"];
  const next = settings.disabledAfterSave(disabled, "tutor", null);
  assert.deepEqual(next, ["kunde", "arzt"]);
  assert.notEqual(next, disabled);
  assert.deepEqual(disabled, ["kunde", "arzt"]);
});

test("disabledAfterDelete forgets the id of a purely custom entry", () => {
  assert.deepEqual(settings.disabledAfterDelete(["kunde", "tutor"], "tutor", ["kunde", "arzt"]), ["kunde"]);
  assert.deepEqual(settings.disabledAfterDelete(["tutor", "tutor"], "tutor", []), []);
});

test("disabledAfterDelete keeps the state of a bundled word", () => {
  assert.deepEqual(settings.disabledAfterDelete(["kunde", "tutor"], "kunde", ["kunde", "arzt"]), ["kunde", "tutor"]);
  assert.deepEqual(settings.disabledAfterDelete(["tutor"], "kunde", ["kunde"]), ["tutor"]);
});

test("disabledAfterDelete copes with an entry without a usable id", () => {
  const disabled = ["kunde"];
  const next = settings.disabledAfterDelete(disabled, undefined, ["kunde"]);
  assert.deepEqual(next, ["kunde"]);
  assert.notEqual(next, disabled);
});
