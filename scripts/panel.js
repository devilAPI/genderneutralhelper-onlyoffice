(function (window) {
  "use strict";
  var GNH = window.GNH;
  var engine = GNH.engine;
  var store = GNH.settings;
  var editor = GNH.document;
  var plugin = window.Asc.plugin;
  var doc = window.document;

  var state = {
    ready: false,
    settings: store.defaults(),
    persistent: true,
    index: null,
    paragraphs: null,
    items: [],
    ignored: new Set(),
    status: "idle",
    message: ""
  };

  function t(key, arg) {
    var text = plugin.tr(GNH.strings[key]);
    return arg === undefined ? text : text.replace("%1", String(arg));
  }

  function el(tag, attrs, children) {
    var node = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "text") node.textContent = attrs[key];
      else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2), attrs[key]);
      else if (key in node) node[key] = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  function storage() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  }

  function rebuildIndex() {
    var entries = engine.mergeEntries(GNH.dictionary, state.settings.customEntries);
    state.index = engine.buildIndex(entries, state.settings.disabledIds);
  }

  // Recomputes findings from the cached paragraph texts. No editor access.
  function rebuildItems() {
    if (!state.paragraphs) return;
    var s = state.settings;
    state.items = engine.scanDocument(state.paragraphs, state.index)
      .filter(function (finding) {
        return !state.ignored.has(engine.findingKey(finding));
      })
      .map(function (finding) {
        var entry = state.index.byId.get(finding.entryId);
        return {
          finding: finding,
          suggestions: engine.suggestAll(finding, entry, s.primaryStyle, s.fallbackStyle),
          chosen: 0
        };
      });
    state.status = state.items.length ? "findings" : "none";
  }

  function commit(next) {
    state.settings = next;
    state.persistent = store.save(storage(), next);
    rebuildIndex();
    rebuildItems();
    render();
    if (GNH.settingsView) GNH.settingsView.refresh();
  }

  function fail() {
    state.paragraphs = null;
    state.items = [];
    state.status = "error";
    render();
  }

  function scan(keepIgnored, message) {
    if (!keepIgnored) state.ignored = new Set();
    state.status = "scanning";
    state.message = message || "";
    render();
    return editor.readParagraphs().then(function (paragraphs) {
      state.paragraphs = paragraphs;
      rebuildItems();
      render();
    }).catch(fail);
  }

  function target(item, replacement) {
    var f = item.finding;
    return {
      p: f.p,
      start: f.start,
      form: f.form,
      ordinal: f.ordinal,
      expected: state.paragraphs[f.p],
      replacement: replacement
    };
  }

  function showStale() {
    state.message = t("stale");
    render();
  }

  function selectItem(item) {
    editor.select(target(item, null)).then(function (result) {
      if (result.done !== 1) showStale();
    }).catch(fail);
  }

  function replaceItems(items) {
    var targets = engine.orderForReplace(items.map(function (item) {
      return target(item, item.suggestions[item.chosen].text);
    }));
    editor.replaceMany(targets).then(function (result) {
      if (result.done === 0) return showStale();
      return scan(true, result.stale > 0 ? t("skipped", result.stale) : "");
    }).catch(fail);
  }

  function ignoreItem(item) {
    state.ignored.add(engine.findingKey(item.finding));
    rebuildItems();
    render();
  }

  function neverFlag(item) {
    commit(Object.assign({}, state.settings, {
      disabledIds: state.settings.disabledIds.concat(item.finding.entryId)
    }));
  }

  function hintText(item) {
    var hint = item.suggestions[item.chosen].hint;
    return hint ? t("hint_" + hint) : "";
  }

  function renderItem(item) {
    var f = item.finding;
    var hint = el("p", { className: "hint", text: hintText(item) });
    var select = el("select", {
      onchange: function () {
        item.chosen = select.selectedIndex;
        hint.textContent = hintText(item);
      }
    }, item.suggestions.map(function (suggestion) {
      return el("option", { text: suggestion.text });
    }));
    select.selectedIndex = item.chosen;
    return el("li", { className: "finding" }, [
      el("button", { type: "button", className: "ctx", title: t("jump"), onclick: function () { selectItem(item); } }, [
        doc.createTextNode(f.context.before),
        el("mark", { text: f.form }),
        doc.createTextNode(f.context.after)
      ]),
      select,
      hint,
      el("div", { className: "actions" }, [
        el("button", { type: "button", text: t("replace"), onclick: function () { replaceItems([item]); } }),
        el("button", { type: "button", text: t("ignore"), onclick: function () { ignoreItem(item); } }),
        el("button", { type: "button", text: t("never"), onclick: function () { neverFlag(item); } })
      ])
    ]);
  }

  function render() {
    var notes = [];
    if (!state.persistent) notes.push(t("noStorage"));
    if (state.message) notes.push(state.message);
    var notice = doc.getElementById("notice");
    notice.textContent = notes.join(" ");
    notice.hidden = notes.length === 0;

    var summary = {
      idle: t("idle"),
      scanning: t("scanning"),
      none: t("none"),
      error: t("error"),
      findings: t("count", state.items.length)
    };
    doc.getElementById("summary").textContent = summary[state.status];
    doc.getElementById("scan").disabled = state.status === "scanning";
    doc.getElementById("retry").hidden = state.status !== "error";
    doc.getElementById("replaceAll").hidden = state.status !== "findings";
    doc.getElementById("style").value = state.settings.primaryStyle;

    var list = doc.getElementById("findings");
    list.textContent = "";
    if (state.status === "findings") {
      state.items.forEach(function (item) {
        list.appendChild(renderItem(item));
      });
    }
  }

  function applyStaticText() {
    Array.prototype.forEach.call(doc.querySelectorAll("[data-i18n]"), function (node) {
      node.textContent = t(node.getAttribute("data-i18n"));
    });
    var style = doc.getElementById("style");
    style.textContent = "";
    engine.STYLES.forEach(function (id) {
      style.appendChild(el("option", { value: id, text: t("style_" + id) }));
    });
  }

  var api = {
    t: t,
    el: el,
    getSettings: function () { return state.settings; },
    getSkipped: function () { return state.index.skipped; },
    commit: commit
  };

  plugin.init = function () {
    if (state.ready) return;
    state.ready = true;
    var loaded = store.load(storage());
    state.settings = loaded.settings;
    state.persistent = loaded.persistent;
    rebuildIndex();
    doc.getElementById("style").addEventListener("change", function (event) {
      commit(Object.assign({}, state.settings, { primaryStyle: event.target.value }));
    });
    doc.getElementById("scan").addEventListener("click", function () { scan(false); });
    doc.getElementById("retry").addEventListener("click", function () { scan(true); });
    doc.getElementById("replaceAll").addEventListener("click", function () { replaceItems(state.items); });
    applyStaticText();
    render();
    if (GNH.settingsView) GNH.settingsView.mount(doc.getElementById("settingsBody"), api);
  };

  plugin.onTranslate = function () {
    applyStaticText();
    render();
    if (GNH.settingsView) GNH.settingsView.refresh();
  };

  plugin.onThemeChanged = function (theme) {
    plugin.onThemeChangedBase(theme);
    var style = doc.documentElement.style;
    var map = {
      "--gnh-bg": "background-normal",
      "--gnh-text": "text-normal",
      "--gnh-muted": "text-secondary",
      "--gnh-border": "border-regular-control",
      "--gnh-control": "background-toolbar"
    };
    Object.keys(map).forEach(function (name) {
      if (theme && theme[map[name]]) style.setProperty(name, theme[map[name]]);
      else style.removeProperty(name);
    });
  };

  plugin.button = function () {
    this.executeCommand("close", "");
  };
})(window);
