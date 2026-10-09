(function (window) {
  "use strict";
  var GNH = (window.GNH = window.GNH || {});
  var TIMEOUT_MS = 120000;

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

  function isParagraphs(value) {
    return Array.isArray(value) && value.every(function (text) {
      return typeof text === "string";
    });
  }

  function isCounts(value) {
    return !!value && typeof value === "object" &&
      typeof value.done === "number" && typeof value.stale === "number";
  }

  // The SDK keeps one callback slot for callCommand, so commands run one at
  // a time. `queue` settles when the SDK callback of the last command sent
  // has fired; a timeout rejects the caller but does not release the queue.
  var queue = Promise.resolve();

  function run(items, command, isValid) {
    return new Promise(function (resolve, reject) {
      var expired = false;
      var timer = window.setTimeout(function () {
        expired = true;
        reject(new Error("timeout"));
      }, TIMEOUT_MS);
      queue = queue.then(function () {
        // A command that timed out while it waited is never sent.
        if (expired) return undefined;
        return new Promise(function (release) {
          try {
            window.Asc.scope.items = items;
            window.Asc.plugin.callCommand(command, false, true, function (result) {
              window.clearTimeout(timer);
              release();
              var value;
              try {
                value = JSON.parse(result);
              } catch (e) {
                value = undefined;
              }
              // After a timeout the caller is already rejected and this
              // late result is discarded.
              if (isValid(value)) resolve(value);
              else reject(new Error("bad result"));
            });
          } catch (e) {
            window.clearTimeout(timer);
            release();
            reject(e);
          }
        });
      });
    });
  }

  GNH.document = {
    readParagraphs: function () {
      return run([], cmdRead, isParagraphs);
    },
    select: function (target) {
      return run([Object.assign({}, target, { replacement: null })], cmdApply, isCounts);
    },
    replaceMany: function (targets) {
      return run(targets, cmdApply, isCounts);
    }
  };
})(window);
