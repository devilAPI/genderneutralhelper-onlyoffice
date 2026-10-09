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
