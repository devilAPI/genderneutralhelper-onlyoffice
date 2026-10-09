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
