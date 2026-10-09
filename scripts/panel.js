(function (window) {
  "use strict";
  var GNH = window.GNH;
  var engine = GNH.engine;
  var store = GNH.settings;
  var editor = GNH.document;
  var plugin = window.Asc.plugin;
  var doc = window.document;

  var BATCH_SIZE = 25;

  var state = {
    ready: false,
    settings: store.defaults(),
    persistent: true,
    index: null,
    paragraphs: null,
    items: [],
    ignored: new Set(),
    status: "idle",
    message: "",
    // True from the start of an editor command until it has settled.
    busy: false,
    // A paragraph read is under way.
    reading: false,
    // "done / total" while replacements are sent, otherwise "".
    progress: "",
    // Settings changed while busy; the items are rebuilt when the command ends.
    rebuildDue: false
  };

  function strings() {
    var info = plugin.info;
    return GNH.pickStrings(info ? info.lang : undefined);
  }

  function t(key, arg) {
    var text = strings()[key];
    if (arg === undefined) return text;
    // A function, so that "$&" and the like in arg are taken literally.
    return text.replace("%1", function () {
      return String(arg);
    });
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

  // The suggestion texts the user picked, by finding key. Items still on
  // their default are left out, so a changed default takes effect.
  function chosenTexts() {
    var texts = new Map();
    state.items.forEach(function (item) {
      if (item.chosen > 0) texts.set(engine.findingKey(item.finding), item.suggestions[item.chosen].text);
    });
    return texts;
  }

  // Recomputes findings from the cached paragraph texts. No editor access.
  function rebuildItems() {
    if (!state.paragraphs) return;
    var s = state.settings;
    var chosen = chosenTexts();
    state.items = engine.scanDocument(state.paragraphs, state.index)
      .filter(function (finding) {
        return !state.ignored.has(engine.findingKey(finding));
      })
      .map(function (finding) {
        var entry = state.index.byId.get(finding.entryId);
        var suggestions = engine.suggestAll(finding, entry, s.primaryStyle, s.fallbackStyle);
        return {
          finding: finding,
          suggestions: suggestions,
          chosen: engine.indexOfText(suggestions, chosen.get(engine.findingKey(finding)))
        };
      });
    state.status = state.items.length ? "findings" : "none";
  }

  function commit(next) {
    if (next.primaryStyle !== state.settings.primaryStyle) {
      // A new primary style forgets every remembered choice.
      state.items.forEach(function (item) {
        item.chosen = 0;
      });
    }
    state.settings = next;
    state.persistent = store.save(storage(), next);
    rebuildIndex();
    if (state.busy) state.rebuildDue = true;
    else rebuildItems();
    render();
    if (GNH.settingsView) GNH.settingsView.refresh();
  }

  function fail() {
    state.paragraphs = null;
    state.items = [];
    state.status = "error";
    state.message = "";
  }

  // Runs one user action that talks to the editor. `work` returns a promise;
  // until it settles the panel is busy and starts nothing else.
  function start(work) {
    if (state.busy) return;
    state.busy = true;
    render();
    new Promise(function (resolve) {
      resolve(work());
    }).catch(fail).then(function () {
      state.busy = false;
      state.reading = false;
      state.progress = "";
      if (state.rebuildDue) {
        state.rebuildDue = false;
        rebuildItems();
      }
      render();
    });
  }

  // Reads the document and rebuilds the findings. With keepList the current
  // list stays on screen (disabled) until the new one is there.
  function scan(keepList, message) {
    state.message = message || "";
    state.reading = true;
    if (!keepList) state.status = "scanning";
    render();
    return editor.readParagraphs().then(function (paragraphs) {
      state.paragraphs = paragraphs;
      rebuildItems();
    });
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

  function selectItem(item) {
    start(function () {
      return editor.select(target(item, null)).then(function (result) {
        if (result.done !== 1) state.message = t("stale");
      });
    });
  }

  // Sends the batches one after another and resolves with the summed counts.
  function sendBatches(batches, total) {
    var sum = { done: 0, stale: 0 };
    function send(i) {
      if (i === batches.length) return Promise.resolve(sum);
      state.progress = (sum.done + sum.stale) + " / " + total;
      render();
      return editor.replaceMany(batches[i]).then(function (result) {
        sum.done += result.done;
        sum.stale += result.stale;
        return send(i + 1);
      });
    }
    return send(0);
  }

  function replaceItems(items) {
    start(function () {
      var targets = engine.orderForReplace(items.map(function (item) {
        return target(item, item.suggestions[item.chosen].text);
      }));
      return sendBatches(engine.batchTargets(targets, BATCH_SIZE), targets.length).then(function (sum) {
        state.progress = "";
        if (sum.done === 0) {
          state.message = t("stale");
          return undefined;
        }
        return scan(true, sum.stale > 0 ? t("skipped", sum.stale) : "");
      }, function () {
        // A batch failed; earlier batches may have changed the document.
        state.progress = "";
        return scan(true, t("error"));
      });
    });
  }

  function ignoreItem(item) {
    if (state.busy) return;
    state.ignored.add(engine.findingKey(item.finding));
    rebuildItems();
    render();
  }

  function neverFlag(item) {
    if (state.busy) return;
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
    var busy = state.busy;
    var hint = el("p", { className: "hint", text: hintText(item) });
    var select = el("select", {
      "aria-label": t("chooseSuggestion"),
      disabled: busy,
      onchange: function () {
        if (state.busy) return;
        item.chosen = select.selectedIndex;
        hint.textContent = hintText(item);
      }
    }, item.suggestions.map(function (suggestion) {
      return el("option", { text: suggestion.text });
    }));
    select.selectedIndex = item.chosen;
    return el("li", { className: "finding" }, [
      el("button", { type: "button", className: "ctx", title: t("jump"), disabled: busy, onclick: function () { selectItem(item); } }, [
        doc.createTextNode(f.context.before),
        el("mark", { text: f.form }),
        doc.createTextNode(f.context.after)
      ]),
      select,
      hint,
      el("div", { className: "actions" }, [
        el("button", { type: "button", text: t("replace"), disabled: busy, onclick: function () { replaceItems([item]); } }),
        el("button", { type: "button", text: t("ignore"), disabled: busy, onclick: function () { ignoreItem(item); } }),
        el("button", { type: "button", text: t("never"), disabled: busy, onclick: function () { neverFlag(item); } })
      ])
    ]);
  }

  function summaryText() {
    if (state.progress) return t("replacing", state.progress);
    if (state.reading) return t("scanning");
    return {
      idle: t("idle"),
      scanning: t("scanning"),
      none: t("none"),
      error: t("error"),
      findings: t("count", state.items.length)
    }[state.status];
  }

  function render() {
    var top = window.scrollY;
    var notes = [];
    if (!state.persistent) notes.push(t("noStorage"));
    if (state.message) notes.push(state.message);
    var notice = doc.getElementById("notice");
    notice.textContent = notes.join(" ");
    notice.hidden = notes.length === 0;

    doc.getElementById("summary").textContent = summaryText();
    doc.getElementById("scan").disabled = state.busy;
    doc.getElementById("retry").hidden = state.status !== "error";
    doc.getElementById("retry").disabled = state.busy;
    doc.getElementById("replaceAll").hidden = state.status !== "findings";
    doc.getElementById("replaceAll").disabled = state.busy;
    doc.getElementById("style").value = state.settings.primaryStyle;

    var list = doc.getElementById("findings");
    list.textContent = "";
    if (state.status === "findings") {
      state.items.forEach(function (item) {
        list.appendChild(renderItem(item));
      });
    }
    // Rebuilding the list must not move the page.
    window.scrollTo(0, top);
  }

  function applyStaticText() {
    doc.documentElement.lang = strings() === GNH.stringsEn ? "en" : "de";
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
    doc.getElementById("scan").addEventListener("click", function () {
      start(function () {
        state.ignored = new Set();
        return scan(false);
      });
    });
    doc.getElementById("retry").addEventListener("click", function () {
      start(function () { return scan(true); });
    });
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
