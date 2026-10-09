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
