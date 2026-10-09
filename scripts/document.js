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
