/* Slay the Spire 2 Reference - DOM bootstrap & views (browser only) */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var LS = "sts2:";

  var FILES = [
    { key: "monsters", id: "csv-monsters", match: /monsters/i, label: "Monsters" },
    { key: "elites", id: "csv-elites", match: /elites/i, label: "Elites" },
    { key: "bosses", id: "csv-bosses", match: /bosses/i, label: "Bosses" },
    { key: "ancients", id: "csv-ancients", match: /ancients/i, label: "Ancients" },
    { key: "events", id: "csv-events", match: /events/i, label: "Events" },
    { key: "mechanics", id: "csv-mechanics", match: /mechanics/i, label: "Mechanics" },
    { key: "act-overgrowth", id: "csv-act-overgrowth", match: /overgrowth/i, label: "Act 1: Overgrowth" },
    { key: "act-underdocks", id: "csv-act-underdocks", match: /underdocks/i, label: "Act 1: Underdocks" },
    { key: "act-hive", id: "csv-act-hive", match: /hive/i, label: "Act 2: Hive" },
    { key: "act-glory", id: "csv-act-glory", match: /glory/i, label: "Act 3: Glory" }
  ];
  var ACT_KEYS = [
    { key: "act-overgrowth", short: "1 · Overgrowth" },
    { key: "act-underdocks", short: "1 · Underdocks" },
    { key: "act-hive", short: "2 · Hive" },
    { key: "act-glory", short: "3 · Glory" }
  ];

  var SOURCE = {};              // key -> "loaded" | "builtin"
  var D = {};                   // parsed datasets
  var state = { view: "acts", act: "act-overgrowth", q: "", betype: "all" };

  // CSV text for a dataset: a copy you loaded into this browser, else the built-in snapshot.
  function getRaw(f) {
    try { var v = localStorage.getItem(LS + f.key); if (v && v.trim()) { SOURCE[f.key] = "loaded"; return v; } } catch (e) {}
    SOURCE[f.key] = "builtin";
    var el = document.getElementById(f.id);
    return el ? (el.textContent || "").trim() : "";
  }
  function updateSourceLabel() {
    var el = $("#src");
    if (FILES.some(function (f) { return SOURCE[f.key] === "loaded"; })) { el.textContent = "● using CSVs you loaded"; el.className = "src ok"; }
    else { el.textContent = "● built-in data"; el.className = "src"; }
    el.title = "Built-in data is baked into this file. Load CSVs (button or drag-drop) to view newer data; it is remembered in this browser until you Reset.";
  }

  function rebuild() {
    var RAW = {};
    FILES.forEach(function (f) { RAW[f.key] = getRaw(f); });
    D.monsters = STS.parseStatBlocks(STS.parseCSV(RAW["monsters"] || ""), "monster");
    D.elites = STS.parseStatBlocks(STS.parseCSV(RAW["elites"] || ""), "elite");
    D.bosses = STS.parseStatBlocks(STS.parseCSV(RAW["bosses"] || ""), "boss");
    D.all = D.monsters.concat(D.elites, D.bosses);
    D.idx = STS.buildIndex(D.all);
    D.acts = {};
    ACT_KEYS.forEach(function (a) { D.acts[a.key] = STS.parseAct(STS.parseCSV(RAW[a.key] || "")); });
    D.events = STS.parseEvents(STS.parseCSV(RAW["events"] || ""));
    D.ancients = STS.parseAncients(STS.parseCSV(RAW["ancients"] || ""));
    D.mechanics = STS.parseMechanics(STS.parseCSV(RAW["mechanics"] || ""));
    D.events.forEach(function (e) {
      e._s = (e.name + " " + e.cond + " " + e.options.map(function (o) { return o.name + " " + o.effect + " " + o.notes; }).join(" ")).toLowerCase();
    });
    D.ancients.forEach(function (a) {
      a._s = (a.name + " " + a.groups.map(function (g) {
        return g.items.map(function (i) { return i.name + " " + i.desc; }).join(" ");
      }).join(" ")).toLowerCase();
    });
    D.all.forEach(function (e) { e.appearsIn = []; e._ap = {}; });
    Object.keys(D.acts).forEach(function (ak) {
      var act = D.acts[ak], shortName = (ACT_KEYS.filter(function (x) { return x.key === ak; })[0] || {}).short || act.title;
      act.sections.forEach(function (sec) {
        if (sec.kind === "events") return;
        sec.encounters.forEach(function (enc) {
          enc.monsters.forEach(function (raw) {
            var e = STS.resolveRef(raw, D.idx); if (!e) return;
            var k = ak + "|" + enc.name; if (e._ap[k]) return; e._ap[k] = 1;
            e.appearsIn.push({ actKey: ak, label: shortName + " · " + enc.name });
          });
        });
      });
    });
  }

  /* ----------------------------- views ----------------------------- */
  function matchQ(s) { return !state.q || s.indexOf(state.q) >= 0; }

  function viewActs() {
    var bar = '<div class="actbar">' + ACT_KEYS.map(function (a) {
      return '<button class="actbtn' + (state.act === a.key ? " on" : "") + '" data-act="' + a.key + '">' + STS.esc(a.short) + "</button>";
    }).join("") + "</div>";
    var act = D.acts[state.act];
    if (!act) return bar + '<div class="empty">No data.</div>';
    if (state.q) act = filterAct(act, state.q);
    return bar + STS.actHtml(act, D.idx);
  }
  function filterAct(act, q) {
    var copy = { title: act.title, ancients: act.ancients, events: act.events.filter(function (n) { return n.toLowerCase().indexOf(q) >= 0; }), sections: [] };
    act.sections.forEach(function (sec) {
      if (sec.kind === "events") return;
      var encs = sec.encounters.filter(function (enc) {
        var hay = (enc.name + " " + enc.tags.join(" ") + " " + enc.monsters.join(" ") + " " + enc.notes.join(" ")).toLowerCase();
        if (hay.indexOf(q) >= 0) return true;
        return enc.monsters.some(function (raw) { var e = STS.resolveRef(raw, D.idx); return e && e.search.indexOf(q) >= 0; });
      });
      if (encs.length) copy.sections.push({ kind: sec.kind, label: sec.label, encounters: encs });
    });
    return copy;
  }

  function viewBestiary() {
    var types = [["all", "All"], ["monster", "Monsters"], ["elite", "Elites"], ["boss", "Bosses"]];
    var bar = '<div class="typebar">' + types.map(function (t) {
      var n = t[0] === "all" ? D.all.length : D.all.filter(function (e) { return e.type === t[0]; }).length;
      return '<button class="actbtn' + (state.betype === t[0] ? " on" : "") + '" data-betype="' + t[0] + '">' + t[1] + " <b>" + n + "</b></button>";
    }).join("") + "</div>";
    var list = D.all.filter(function (e) { return (state.betype === "all" || e.type === state.betype) && matchQ(e.search); });
    if (!list.length) return bar + '<div class="empty">No enemies match your search.</div>';
    return bar + '<div class="grid">' + list.map(function (e) { return STS.statCardHtml(e, { appears: true }); }).join("") + "</div>";
  }

  function viewEvents() {
    var acts = [], byAct = {};
    D.events.forEach(function (e) { if (!byAct[e.act]) { byAct[e.act] = []; acts.push(e.act); } byAct[e.act].push(e); });
    var h = "", any = false;
    acts.forEach(function (a) {
      var evs = byAct[a].filter(function (e) { return matchQ(e._s); });
      if (!evs.length) return; any = true;
      h += '<h2 class="group-h">' + STS.esc(a) + "</h2><div class=\"grid\">" + evs.map(STS.eventCardHtml).join("") + "</div>";
    });
    return any ? h : '<div class="empty">No events match your search.</div>';
  }

  function viewAncients() {
    var list = D.ancients.filter(function (a) { return matchQ(a._s); });
    if (!list.length) return '<div class="empty">No ancients match your search.</div>';
    return '<div class="note-bar">Ancients are run modifiers chosen at the start of each act. Each offers a pool of relic/card options.</div>' +
      '<div class="grid">' + list.map(STS.ancientCardHtml).join("") + "</div>";
  }

  function viewMechanics() {
    var secs = D.mechanics;
    if (state.q) {
      secs = D.mechanics.map(function (s) {
        var items = s.items.filter(function (it) { return (it.label + " " + it.lines.join(" ")).toLowerCase().indexOf(state.q) >= 0; });
        return (s.title.toLowerCase().indexOf(state.q) >= 0) ? s : { title: s.title, items: items };
      }).filter(function (s) { return s.items.length; });
    }
    if (!secs.length) return '<div class="empty">No mechanics match your search.</div>';
    return '<div class="grid">' + STS.mechanicsHtml(secs) + "</div>";
  }

  function render() {
    var c = $("#content"), html = "";
    if (state.view === "acts") html = viewActs();
    else if (state.view === "bestiary") html = viewBestiary();
    else if (state.view === "events") html = viewEvents();
    else if (state.view === "ancients") html = viewAncients();
    else if (state.view === "mechanics") html = viewMechanics();
    c.innerHTML = html;
    window.scrollTo(0, 0);
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("on", t.getAttribute("data-view") === state.view); });
  }
  function refresh() { rebuild(); render(); updateSourceLabel(); }

  /* --------------------------- interactions ------------------------ */
  function setView(v) { state.view = v; render(); }
  function flash(msg) { var el = $("#status"); el.textContent = msg; el.classList.add("show"); setTimeout(function () { el.classList.remove("show"); }, 4000); }

  function loadFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList || []).filter(function (file) { return /\.csv$/i.test(file.name); });
    if (!arr.length) { flash("No .csv files found there"); return; }
    var done = 0, matched = [], skipped = [];
    arr.forEach(function (file) {
      var f = FILES.filter(function (x) { return x.match.test(file.name); })[0];
      var rd = new FileReader();
      rd.onload = function () {
        if (f) { try { localStorage.setItem(LS + f.key, rd.result); } catch (e) {} matched.push(f.label); }
        else skipped.push(file.name);
        if (++done === arr.length) { refresh(); flash(matched.length ? ("Loaded: " + matched.join(", ")) : "No recognised CSV filenames"); }
      };
      rd.readAsText(file);
    });
  }

  function jumpTo(id, view) {
    setView(view);
    var el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.add("flash"); setTimeout(function () { el.classList.remove("flash"); }, 1600); if (el.tagName === "DETAILS") el.open = true; }
  }

  function wire() {
    document.querySelectorAll(".tab").forEach(function (t) { t.addEventListener("click", function () { setView(t.getAttribute("data-view")); }); });
    var search = $("#search");
    search.addEventListener("input", function () { state.q = this.value.trim().toLowerCase(); render(); });
    $("#asc").addEventListener("change", function () { document.body.classList.toggle("asc-on", this.checked); });
    $("#loadBtn").addEventListener("click", function () { $("#file").click(); });
    $("#file").addEventListener("change", function () { loadFiles(this.files); this.value = ""; });
    $("#folderBtn").addEventListener("click", function () { $("#folder").click(); });
    $("#folder").addEventListener("change", function () { loadFiles(this.files); this.value = ""; });
    $("#resetBtn").addEventListener("click", function () {
      if (!confirm("Forget the CSVs you loaded into this browser and go back to the built-in data?")) return;
      FILES.forEach(function (f) { try { localStorage.removeItem(LS + f.key); } catch (e) {} });
      refresh(); flash("Reset to built-in data");
    });

    $("#content").addEventListener("click", function (ev) {
      var a = ev.target.closest("[data-act]"); if (a) { state.act = a.getAttribute("data-act"); state.q = ""; search.value = ""; render(); return; }
      var bt = ev.target.closest("[data-betype]"); if (bt) { state.betype = bt.getAttribute("data-betype"); render(); return; }
      var ja = ev.target.closest("[data-jump-act]"); if (ja) { state.act = ja.getAttribute("data-jump-act"); state.q = ""; search.value = ""; setView("acts"); return; }
      var je = ev.target.closest("[data-jump-event]"); if (je) { jumpTo("evt-" + STS.slug(je.getAttribute("data-jump-event")), "events"); return; }
      var jn = ev.target.closest("[data-jump-ancient]"); if (jn) { jumpTo("anc-" + STS.slug(jn.getAttribute("data-jump-ancient")), "ancients"); return; }
      var ex = ev.target.closest('[data-action="expand-act"]'); if (ex) { ev.target.closest(".act").querySelectorAll("details").forEach(function (d) { d.open = true; }); return; }
      var co = ev.target.closest('[data-action="collapse-act"]'); if (co) { ev.target.closest(".act").querySelectorAll("details").forEach(function (d) { d.open = false; }); return; }
    });

    var drop = $("#drop"), dc = 0;
    window.addEventListener("dragenter", function (e) { e.preventDefault(); dc++; drop.classList.add("show"); });
    window.addEventListener("dragover", function (e) { e.preventDefault(); });
    window.addEventListener("dragleave", function (e) { e.preventDefault(); dc--; if (dc <= 0) drop.classList.remove("show"); });
    window.addEventListener("drop", function (e) { e.preventDefault(); dc = 0; drop.classList.remove("show"); loadFiles(e.dataTransfer.files); });
  }

  wire();
  refresh();
})();
