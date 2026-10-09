(function (window) {
  "use strict";
  var GNH = (window.GNH = window.GNH || {});
  var doc = window.document;
  var FIELDS = ["mascSg", "mascPl", "femSg", "femPl", "neutralSg", "neutralPl"];
  var MAX_ROWS = 50;

  var root = null;
  var api = null;
  var editingIndex = -1;
  var filter = "";
  var pendingImport = null;
  var message = "";

  function settings() {
    return api.getSettings();
  }

  function update(changes) {
    message = "";
    api.commit(Object.assign({}, settings(), changes));
  }

  function fallbackSection() {
    var el = api.el;
    var select = el("select", {
      id: "fallback",
      onchange: function () { update({ fallbackStyle: select.value }); }
    }, GNH.engine.STYLES.filter(function (id) {
      return id !== "neutral";
    }).map(function (id) {
      return el("option", { value: id, text: api.t("style_" + id) });
    }));
    select.value = settings().fallbackStyle;
    return [el("label", { htmlFor: "fallback", text: api.t("fallback") }), select];
  }

  function entryLabel(entry) {
    var hasForms = entry && entry.masc && Array.isArray(entry.masc.sg) && Array.isArray(entry.masc.pl);
    return hasForms ? entry.masc.sg[0] + " / " + entry.masc.pl[0] : String((entry && entry.id) || "?");
  }

  function customList() {
    var el = api.el;
    var entries = settings().customEntries;
    return el("ul", { className: "plain-list" }, entries.map(function (entry, index) {
      var buttons = [];
      if (GNH.engine.validateEntry(entry)) {
        buttons.push(el("button", {
          type: "button",
          text: api.t("edit"),
          onclick: function () { editingIndex = index; message = ""; refresh(); }
        }));
      }
      buttons.push(el("button", {
        type: "button",
        text: api.t("remove"),
        onclick: function () {
          editingIndex = -1;
          update({ customEntries: entries.filter(function (other, i) { return i !== index; }) });
        }
      }));
      return el("li", {}, [el("span", { text: entryLabel(entry) })].concat(buttons));
    }));
  }

  function formValues(entry) {
    if (!entry) return {};
    var neutral = entry.neutral || {};
    return {
      mascSg: entry.masc.sg[0],
      mascPl: entry.masc.pl[0],
      femSg: entry.fem.sg,
      femPl: entry.fem.pl,
      neutralSg: neutral.sg || "",
      neutralPl: neutral.pl || ""
    };
  }

  function entryForm() {
    var el = api.el;
    var entries = settings().customEntries;
    var values = formValues(editingIndex >= 0 ? entries[editingIndex] : null);
    var inputs = {};
    var nodes = [];
    FIELDS.forEach(function (field) {
      inputs[field] = el("input", { type: "text", id: "entry-" + field, value: values[field] || "" });
      nodes.push(el("label", { htmlFor: "entry-" + field, text: api.t(field) }));
      nodes.push(inputs[field]);
    });
    nodes.push(el("button", {
      type: "button",
      text: api.t("save"),
      onclick: function () {
        var input = {};
        FIELDS.forEach(function (field) { input[field] = inputs[field].value; });
        var entry = GNH.settings.deriveEntry(input);
        if (!entry) {
          message = api.t("invalidEntry");
          doc.getElementById("settingsMessage").textContent = message;
          return;
        }
        var kept = entries.filter(function (other, i) {
          return i !== editingIndex && (!other || other.id !== entry.id);
        });
        editingIndex = -1;
        update({ customEntries: kept.concat(entry) });
      }
    }));
    return nodes;
  }

  function bundledRows(list) {
    var el = api.el;
    var disabled = settings().disabledIds;
    var needle = filter.trim().toLowerCase();
    var matches = GNH.dictionary.filter(function (entry) {
      return entry.id.indexOf(needle) >= 0;
    });
    list.textContent = "";
    matches.slice(0, MAX_ROWS).forEach(function (entry) {
      var box = el("input", {
        type: "checkbox",
        id: "word-" + entry.id,
        checked: disabled.indexOf(entry.id) < 0,
        onchange: function () {
          var others = disabled.filter(function (id) { return id !== entry.id; });
          update({ disabledIds: box.checked ? others : others.concat(entry.id) });
        }
      });
      list.appendChild(el("li", {}, [box, el("label", { htmlFor: "word-" + entry.id, text: entry.masc.sg[0] })]));
    });
    if (matches.length > MAX_ROWS) {
      list.appendChild(el("li", {}, [el("span", { text: api.t("more", matches.length - MAX_ROWS) })]));
    }
  }

  function bundledSection() {
    var el = api.el;
    var list = el("ul", { className: "plain-list" });
    var search = el("input", {
      type: "search",
      id: "wordSearch",
      value: filter,
      oninput: function () { filter = search.value; bundledRows(list); }
    });
    bundledRows(list);
    return [el("label", { htmlFor: "wordSearch", text: api.t("search") }), search, list];
  }

  function exportSettings() {
    var blob = new Blob([GNH.settings.serialize(settings())], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = api.el("a", { href: url, download: "gender-helper-settings.json" });
    doc.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function readImport(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      pendingImport = GNH.settings.parse(String(reader.result));
      message = pendingImport ? "" : api.t("importInvalid");
      refresh();
    };
    reader.onerror = function () {
      pendingImport = null;
      message = api.t("importInvalid");
      refresh();
    };
    reader.readAsText(file);
  }

  function transferSection() {
    var el = api.el;
    var file = el("input", {
      type: "file",
      id: "importFile",
      accept: ".json,application/json",
      onchange: function () { readImport(file.files[0]); }
    });
    var nodes = [
      el("div", { className: "actions" }, [
        el("button", { type: "button", text: api.t("exportFile"), onclick: exportSettings })
      ]),
      el("label", { htmlFor: "importFile", text: api.t("importFile") }),
      file
    ];
    if (pendingImport) {
      nodes.push(el("p", { className: "notice", text: api.t("importConfirm") }));
      nodes.push(el("div", { className: "actions" }, [
        el("button", {
          type: "button",
          text: api.t("yes"),
          onclick: function () {
            var next = pendingImport;
            pendingImport = null;
            editingIndex = -1;
            message = "";
            api.commit(next);
          }
        }),
        el("button", {
          type: "button",
          text: api.t("cancel"),
          onclick: function () { pendingImport = null; refresh(); }
        })
      ]));
    }
    return nodes;
  }

  function refresh() {
    if (!root) return;
    var el = api.el;
    var skipped = api.getSkipped();
    var nodes = [].concat(
      fallbackSection(),
      [el("h3", { text: api.t("ownEntries") }), customList()],
      entryForm(),
      skipped.length ? [el("p", { className: "notice", text: api.t("skippedEntries", skipped.join(", ")) })] : [],
      [el("h3", { text: api.t("bundled") })],
      bundledSection(),
      transferSection(),
      [el("p", { className: "hint", id: "settingsMessage", text: message })]
    );
    root.textContent = "";
    nodes.forEach(function (node) {
      root.appendChild(node);
    });
  }

  GNH.settingsView = {
    mount: function (node, panelApi) {
      root = node;
      api = panelApi;
      refresh();
    },
    refresh: refresh
  };
})(window);
