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
  assert.equal(engine.scanParagraph("die\u00a0Mitarbeiter", INDEX)[0].prev, "die");
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
