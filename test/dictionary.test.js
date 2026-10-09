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
