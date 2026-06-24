/* Slay the Spire 2 Reference - pure logic library (no DOM).
   Used both by the Node test harness and inlined into the final HTML. */
(function (global) {
  "use strict";

  /* ============================ CSV ============================ */
  function parseCSV(text) {
    text = String(text).replace(/\r\n?/g, "\n");
    var rows = [], row = [], field = "", q = false, i = 0, c;
    while (i < text.length) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"') { q = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\n") { row.push(field); field = ""; rows.push(row); row = []; i++; continue; }
      field += c; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function cell(rows, r, k) { var c = rows[r]; return (c && c[k] != null) ? String(c[k]).trim() : ""; }
  function splitFirstLine(s) {
    var parts = String(s).split("\n");
    var name = (parts.shift() || "").trim();
    var rest = parts.join("\n").replace(/\n+/g, " ").trim();
    return { name: name, rest: rest };
  }

  /* ====================== text formatting ===================== */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var KW = [
    [/\bDamage\b/g, "attack"],
    [/\bBlock\b/g, "block"],
    [/\b(?:Summons?|Summoned|Hatch(?:es|ling)?)\b/g, "summon"],
    [/\b(?:Strength|Ritual|Dexterity|Thorns?|Artifact|Plating|Soar|Burrowed|Metallicize|Intangible|Regen|Galvanic|Vigor|Sandpit|Steam Eruption|Rampart)\b/g, "buff"],
    [/\b(?:Weak|Frail|Vulnerable|Constrict|Tender|Shrink|Tangled|Poison|Slow|Imbalanced|Chains of Binding)\b/g, "debuff"],
    [/\b(?:Dazed|Slimed|Toxic|Wounds?|Infection|Void|Burns?|Flutter|Beckon|Withers?)\b/g, "status"]
  ];
  function kwHi(s) { KW.forEach(function (p) { s = s.replace(p[0], function (m) { return '<span class="kw kw-' + p[1] + '">' + m + "</span>"; }); }); return s; }
  var ASC = /([0-9]+(?:\s*[-xX]\s*[0-9]+)*)\s*\(\s*([0-9]+(?:\s*[-xX]\s*[0-9]+)*)\s*\)/g;
  function ascWrap(s) { return s.replace(ASC, function (_, a, b) { return '<span class="base">' + a + '</span> <span class="asc">(' + b + ')</span>'; }); }
  function fmt(text) {
    if (text == null) return "";
    var s = esc(text);
    s = kwHi(s);
    s = ascWrap(s);
    s = s.replace(/\n+/g, "<br>");
    s = s.replace(/\s*-\s*&gt;\s*/g, ' <span class="arrow">&#8594;</span> ');
    return s;
  }
  function fxClass(t) {
    var s = String(t).trim().toLowerCase();
    if (s.indexOf("damage") === 0) return "attack";
    if (s.indexOf("block") === 0) return "block";
    if (s.indexOf("summon") === 0) return "summon";
    if (s.indexOf("add") === 0 || s.indexOf("shuffle") === 0) return "status";
    if (s.indexOf("apply") === 0) return "debuff";
    if (s.indexOf("gain") === 0 || s.indexOf("strength") === 0 || s.indexOf("ritual") === 0 || s.indexOf("dexterity") === 0 || s.indexOf("heal") === 0 || s.indexOf("block") >= 0 && s.indexOf("gain") >= 0) return "buff";
    if (/weak|frail|vulnerable|constrict|tangled|shrink|tender/.test(s)) return "debuff";
    if (/strength|ritual|thorns|dexterity|artifact|plating/.test(s) && /gain/.test(s)) return "buff";
    return "";
  }
  function noteHtml(line) {
    var idx = line.indexOf(":");
    if (idx > 0 && idx <= 30 && /^[A-Z(]/.test(line)) {
      return '<span class="kw-term">' + fmt(line.slice(0, idx)) + ':</span>' + fmt(line.slice(idx + 1));
    }
    return fmt(line);
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  /* ================ stat blocks (Monsters/Elites/Bosses) ============ */
  // Cosmetic grouping for multi-part bosses/elites. The CSV does not encode
  // where a group ends, so these members are listed explicitly. If you rename
  // an entity in the CSV you may lose its "part of" badge (data still shows).
  var BOSS_GROUPS = {
    "Crusher": "Kaiser Crab", "Rocket": "Kaiser Crab",
    "Stage 1": "Test Subject #C14", "Stage 2": "Test Subject #C14", "Stage 3": "Test Subject #C14",
    "Kin Priest": "The Kin", "Kin Follower": "The Kin",
    "Flail Knight": "Knights", "Spectral Knight": "Knights", "Magi Knight": "Knights",
    "Torch Head Amalgam": "Queen"
  };
  function parseStatBlocks(rows, type) {
    var list = [], cur = null, c, r;
    for (r = 1; r < rows.length; r++) {
      var cells = rows[r] || [];
      var get = function (k) { return (cells[k] == null ? "" : String(cells[k])).trim(); };
      var name = get(0), hp = get(1), notes = get(8), patt = get(9), mc = [];
      for (c = 2; c <= 7; c++) mc[c] = get(c);
      var hasMove = mc.some(function (x) { return x; });
      var onlyName = name !== "" && hp === "" && notes === "" && patt === "" && !hasMove;
      if (onlyName) continue;                       // group header (e.g. "Kaiser Crab") -> skip
      var realHp = /^\d/.test(hp);                  // a true HP starts with a digit
      if (name !== "" && realHp) {
        cur = { type: type, name: name, sub: "", group: BOSS_GROUPS[name] || "", hp: hp, moves: {}, order: [], notes: [], patt: [] };
        for (c = 2; c <= 7; c++) if (mc[c]) { cur.moves[c] = { name: mc[c], fx: [] }; cur.order.push(c); }
        list.push(cur);
      } else if (cur) {
        if (name) cur.sub = cur.sub ? cur.sub + " " + name : name;
        if (hp) cur.hp = cur.hp ? cur.hp + " " + hp : hp;   // stray HP-column note
        for (c = 2; c <= 7; c++) if (mc[c]) {
          if (!cur.moves[c]) { cur.moves[c] = { name: "", fx: [] }; cur.order.push(c); }
          cur.moves[c].fx.push(mc[c]);
        }
      }
      if (cur) { if (notes) cur.notes.push(notes); if (patt) cur.patt.push(patt); }
    }
    list.forEach(function (m) {
      m.movesArr = m.order.map(function (k) { return m.moves[k]; });
      var nn = m.hp.match(/\d+/); m.hpNum = nn ? parseInt(nn[0], 10) : 0;
      var bits = [m.name, m.sub, m.group, m.hp];
      m.movesArr.forEach(function (mv) { bits.push(mv.name); mv.fx.forEach(function (f) { bits.push(f); }); });
      m.notes.forEach(function (x) { bits.push(x); }); m.patt.forEach(function (x) { bits.push(x); });
      m.search = bits.join(" ").toLowerCase();
      m.id = slug(m.type + "-" + (m.group ? m.group + "-" : "") + m.name);
    });
    return list;
  }

  /* ============== name resolution (act refs -> entities) ========= */
  // Some act references use a different size word than the stat block name
  // ("Twig Slime (Small)" vs "Twig Slime (S)"). Canonicalize to the long form.
  function expandSize(s) { return s.replace(/\(s\)/g, "(small)").replace(/\(m\)/g, "(medium)").replace(/\(l\)/g, "(large)"); }
  var EXTRA_ALIASES = { "torch head amalgam": ["torch amalgam"] };
  function buildIndex(entities) {
    var idx = {};
    function add(key, e) {
      key = String(key).toLowerCase().trim(); if (!key) return;
      if (!idx[key]) idx[key] = e;
      var ex = expandSize(key); if (ex !== key && !idx[ex]) idx[ex] = e;
    }
    entities.forEach(function (e) {
      add(e.name, e);
      var m = e.name.toLowerCase().match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (m) { var base = m[1].trim(), q = m[2].trim(); add(q + " " + base, e); add(base + " " + q, e); }
      if (e.group) { add(e.group + " " + e.name, e); add(e.group + " (" + e.name + ")", e); }
      (EXTRA_ALIASES[e.name.toLowerCase()] || []).forEach(function (k) { add(k, e); });
    });
    return idx;
  }
  function refLabel(raw) { return String(raw).replace(/\n+/g, " ").trim(); }
  function resolveRef(raw, idx) {
    if (!raw) return null;
    var s = String(raw).toLowerCase().replace(/\n+/g, " ");
    s = s.replace(/^\s*\d+\s*/, "");                  // leading count
    s = s.replace(/^\s*(?:or|either|and)\s+/, "");     // connectives
    s = s.replace(/\brandom\b/g, " ").replace(/\bat most 1 of each\b/g, " ");
    s = s.replace(/\s+/g, " ").trim();
    var sCut = s.replace(/\s*[,:].*$/, "").trim();      // drop trailing ", either:" etc.
    var tries = [s, sCut];
    tries.push(sCut.replace(/s$/, ""));                 // trailing plural
    tries.push(sCut.replace(/^(\S+?)s\b/, "$1"));       // first-word plural ("scrolls of biting")
    var first = sCut.split(" ")[0];
    if (first && first.length > 3) tries.push(first);   // last resort: leading word
    for (var i = 0; i < tries.length; i++) {
      var t = tries[i].trim(); if (!t) continue;
      if (idx[t]) return idx[t];
      var ex = expandSize(t); if (idx[ex]) return idx[ex];
    }
    return null;
  }

  /* ========================== Act files ======================= */
  function classifyHeader(c0) {
    var s = c0.toLowerCase();
    if (/easy\s+pool/.test(s)) return "easy";
    if (/hard\s+pool/.test(s)) return "hard";
    if (/^elites?\b/.test(s)) return "elites";
    if (/^boss(es)?\b/.test(s)) return "bosses";
    if (/^events?\b/.test(s)) return "events";
    if (/^ancients?\b/.test(s)) return "ancients";
    return null;
  }
  function parseAct(rows) {
    var act = { title: cell(rows, 0, 0) || "Act", ancients: [], events: [], sections: [] };
    var mode = null, section = null, enc = null, monStart = 1, tagCol = -1;
    function findCols(r) {
      monStart = -1; tagCol = -1; var c = rows[r] || [];
      for (var k = 0; k < c.length; k++) {
        var v = (c[k] || "").trim().toLowerCase();
        if (v === "monsters:" || v === "monsters") monStart = k;
        else if (v === "tags:" || v === "tags") tagCol = k;
      }
      if (monStart < 0) monStart = 1;
    }
    function collect(r, enc) {
      var c = rows[r] || [], end = (tagCol >= 0 ? tagCol : Math.max(c.length, monStart + 1));
      for (var k = monStart; k < end; k++) {
        var v = (c[k] == null ? "" : String(c[k])).trim();
        if (!v) continue;
        if (/^\(/.test(v) || /:$/.test(v)) enc.notes.push(v); else enc.monsters.push(v);
      }
      if (tagCol >= 0) { var t = (c[tagCol] == null ? "" : String(c[tagCol])).trim(); if (t) enc.tags.push(t); }
    }
    for (var i = 1; i < rows.length; i++) {
      var c0 = cell(rows, i, 0);
      var hk = c0 ? classifyHeader(c0) : null;
      if (hk) {
        mode = hk; enc = null;
        if (hk === "ancients") { section = null; continue; }
        section = { kind: hk, label: c0, encounters: [] }; act.sections.push(section);
        if (hk !== "events") findCols(i);
        continue;
      }
      if (mode === "ancients") { if (c0) act.ancients.push(c0); continue; }
      if (mode === "events") { if (c0) { var sp = splitFirstLine(c0); act.events.push(sp.name); } continue; }
      if (mode === "easy" || mode === "hard" || mode === "elites" || mode === "bosses") {
        if (!section) continue;
        if (c0) { var s2 = splitFirstLine(c0); enc = { name: s2.name, note: s2.rest, monsters: [], notes: [], tags: [] }; section.encounters.push(enc); collect(i, enc); }
        else if (enc) collect(i, enc);
      }
    }
    return act;
  }

  /* ============================ Events ======================== */
  function parseEvents(rows) {
    var list = [], curAct = "", cur = null;
    for (var r = 1; r < rows.length; r++) {
      var c0 = cell(rows, r, 0), c1 = cell(rows, r, 1), c2 = cell(rows, r, 2), c3 = cell(rows, r, 3);
      if (!c0 && !c1 && !c2 && !c3) continue;
      if (c0 && !c1 && !c2 && !c3 && /^(act\s|shared)/i.test(c0)) { curAct = c0; continue; }
      if (c0) {
        var sp = splitFirstLine(c0);
        cur = { act: curAct, name: sp.name, cond: sp.rest, options: [] };
        list.push(cur);
        if (c1 || c2 || c3) cur.options.push({ name: c1, effect: c2, notes: c3 });
      } else if (cur) {
        if (c1 || c2 || c3) cur.options.push({ name: c1, effect: c2, notes: c3 });
      }
    }
    return list;
  }

  /* =========================== Ancients ======================= */
  function parseAncients(rows) {
    var list = [], cur = null;
    for (var r = 0; r < rows.length; r++) {
      var c0 = cell(rows, r, 0), rv = rows[r] || [], restNonEmpty = false;
      for (var k = 1; k < rv.length; k++) { if ((rv[k] || "").trim()) { restNonEmpty = true; break; } }
      if (c0 && !restNonEmpty) { cur = { name: c0, groups: [] }; list.push(cur); continue; }
      if (restNonEmpty && c0) {                 // options header row; next row = descriptions
        var descRow = rows[r + 1] || [], items = [];
        for (var k2 = 1; k2 < rv.length; k2++) {
          var nm = (rv[k2] || "").trim(); if (!nm) continue;
          var ds = (descRow[k2] != null ? String(descRow[k2]).trim() : "");
          items.push({ name: nm, desc: ds });
        }
        if (cur && items.length) cur.groups.push({ label: c0, items: items });
        r++;                                    // consume description row
      }
    }
    return list;
  }

  /* ========================== Mechanics ======================= */
  function parseMechanics(rows) {
    var sections = [], cur = null, sub = null;
    for (var r = 0; r < rows.length; r++) {
      var c0 = cell(rows, r, 0), c1 = cell(rows, r, 1), c2 = cell(rows, r, 2);
      if (!c0 && !c1 && !c2) continue;
      if (c0 && !c1 && !c2) { cur = { title: c0, items: [] }; sections.push(cur); sub = null; continue; }
      if (!cur) { cur = { title: "General", items: [] }; sections.push(cur); }
      if (c0) { sub = { label: c0, lines: [] }; if (c1) sub.lines.push(c1); if (c2) sub.lines.push(c2); cur.items.push(sub); }
      else { if (!sub) { sub = { label: "", lines: [] }; cur.items.push(sub); } if (c1) sub.lines.push(c1); if (c2) sub.lines.push(c2); }
    }
    return sections;
  }

  /* ===================== HTML string builders ================= */
  function statBodyHtml(e) {
    var h = "";
    if (e.movesArr.length) {
      h += '<div class="sec"><div class="sec-label">Moves</div>';
      e.movesArr.forEach(function (mv) {
        h += '<div class="move">';
        if (mv.name) h += '<div class="mname">' + esc(mv.name) + "</div>";
        if (mv.fx.length) {
          h += '<div class="chips">';
          mv.fx.forEach(function (f) { var c = fxClass(f); h += '<span class="chip' + (c ? " " + c : "") + '">' + fmt(f) + "</span>"; });
          h += "</div>";
        }
        h += "</div>";
      });
      h += "</div>";
    }
    if (e.notes.length) {
      h += '<div class="sec"><div class="sec-label">Notes &amp; keywords</div><ul class="notes">';
      e.notes.forEach(function (n) { h += "<li>" + noteHtml(n) + "</li>"; });
      h += "</ul></div>";
    }
    if (e.patt.length) {
      h += '<div class="sec"><div class="sec-label">Attack pattern (turn order)</div><ul class="pattern">';
      e.patt.forEach(function (p) { h += "<li>" + fmt(p) + "</li>"; });
      h += "</ul></div>";
    }
    return h;
  }
  function statCardHtml(e, opts) {
    opts = opts || {};
    var h = '<div class="card stat" id="ent-' + esc(e.id) + '">';
    h += '<div class="card-head"><h3 class="ename">' + esc(e.name) + (e.sub ? ' <span class="sub">' + esc(e.sub) + "</span>" : "") + "</h3>";
    h += '<span class="typebadge t-' + esc(e.type) + '">' + esc(e.type) + "</span></div>";
    if (e.group) h += '<div class="grouprow">part of <b>' + esc(e.group) + "</b></div>";
    h += '<div class="hp">&#10084; ' + fmt(e.hp) + "</div>";
    if (opts.appears && e.appearsIn && e.appearsIn.length) {
      h += '<div class="appears"><span class="sec-label">Appears in</span> ' + e.appearsIn.map(function (a) {
        return '<span class="apchip" data-jump-act="' + esc(a.actKey) + '">' + esc(a.label) + "</span>";
      }).join("") + "</div>";
    }
    h += statBodyHtml(e);
    return h + "</div>";
  }
  /* ---- turn-order parsing: derive an ordered rotation from Attack Pattern text.
     Conservative on purpose: only fires on clear cycle/alternate/always/start-then
     phrasing, and the full pattern text is always shown too, so nothing is lost. ---- */
  function normName(s) { return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function moveIndexByName(movesArr, token) {
    var t = normName(token); if (!t) return -1;
    var names = movesArr.map(function (m) { return normName(m.name); }), i, k, w, pre;
    for (i = 0; i < names.length; i++) if (names[i] && names[i] === t) return i;         // exact
    w = t.split(" ");
    for (k = w.length; k >= 1; k--) { pre = w.slice(0, k).join(" "); for (i = 0; i < names.length; i++) if (names[i] && names[i] === pre) return i; } // "Thrash until..." -> Thrash
    for (i = 0; i < names.length; i++) if (names[i] && names[i].length >= 4 && t.indexOf(names[i]) >= 0) return i;   // move name inside token
    for (i = 0; i < names.length; i++) if (t.length >= 4 && names[i] && names[i].indexOf(t) === 0) return i;         // "Expel" -> "Expel Blast"
    return -1;
  }
  function cleanToken(s) {
    return String(s).replace(/\s*-\s*>\s*/g, " ")
      .replace(/\b(?:until|then|after|before|if|when|once|while|chosen|chooses|picks|randomly|equally|allowed)\b.*$/i, "")
      .replace(/\(.*$/, "").replace(/[\s,.;:]+$/, "").replace(/^[\s,.;:]+/, "").replace(/\s+/g, " ").trim();
  }
  function chainSteps(str, movesArr) {
    var parts = /->/.test(String(str)) ? String(str).split(/\s*-\s*>\s*/) : String(str).split(/\s+and\s+|\s*\/\s*/);
    var steps = [];
    parts.forEach(function (p) {
      var raw = p.trim(); if (!raw) return;
      var mi = moveIndexByName(movesArr, raw);
      var label = mi >= 0 ? movesArr[mi].name : cleanToken(raw);
      if (label) steps.push({ label: label, mi: mi });
    });
    return steps;
  }
  function parseRotation(line, movesArr) {
    if (!line) return null;
    var raw = String(line).replace(/\s+/g, " ").trim(), m, seg = [];
    if (m = raw.match(/^starts?\s+with\s+(.+?)\.\s*then\b,?\s*(?:continue[s]?\s+)?(?:cycl\w*|alternat\w*)\s*(?:through|between)?\s*(.+?)\.?$/i)) {
      seg.push({ kind: "start", steps: chainSteps(m[1], movesArr) });
      seg.push({ kind: "loop", steps: chainSteps(m[2], movesArr) });
    } else if (m = raw.match(/^starts?\s+with\s+(.+?)\.\s*then\b\s*(?:it\s+)?(?:uses\s+)?(.+?)\s+every turn/i)) {
      seg.push({ kind: "start", steps: chainSteps(m[1], movesArr) });
      seg.push({ kind: "loop", steps: chainSteps(m[2], movesArr) });
    } else if (m = raw.match(/(?:cycl\w*|alternat\w*)\s+(?:through|between\s+)?([A-Za-z0-9].*?)(?:\.|$)/i)) {
      seg.push({ kind: "loop", steps: chainSteps(m[1], movesArr) });
    } else if ((m = raw.match(/^always uses\s+([^.]+)/i)) || (m = raw.match(/\buses\s+([^.]+?)\s+every turn/i))) {
      seg.push({ kind: "loop", steps: chainSteps(m[1], movesArr) });
    } else if (/->/.test(raw) && (m = raw.match(/^starts?\s+with\s+(.+?)(?:\.|$)/i))) {
      seg.push({ kind: "seq", steps: chainSteps(m[1], movesArr) });
    } else if (m = raw.match(/([A-Za-z0-9][^.]*?(?:\s*-\s*>\s*[^.]+)+)/)) {
      seg.push({ kind: "loop", steps: chainSteps(m[1], movesArr) });
    }
    seg = seg.filter(function (s) { return s.steps && s.steps.length; });
    var total = seg.reduce(function (n, s) { return n + s.steps.length; }, 0);
    if (!seg.length) return null;
    if (total === 1 && seg[0].kind !== "loop") return null;   // a lone non-looping move isn't a rotation
    return { segments: seg };
  }
  function rotSteps(steps) {
    return steps.map(function (st, i) {
      var cls = "turn" + (st.mi >= 0 ? " m" + (st.mi + 1) : "");
      var num = st.mi >= 0 ? '<i class="tn">' + (st.mi + 1) + "</i>" : "";
      return (i ? '<span class="rar">&#8594;</span>' : "") + '<span class="' + cls + '">' + num + esc(st.label) + "</span>";
    }).join("");
  }
  function rotationHtml(e) {
    var parsed = null, i;
    for (i = 0; i < e.patt.length; i++) { parsed = parseRotation(e.patt[i], e.movesArr); if (parsed) break; }
    if (!parsed && !e.patt.length) return "";
    var h = '<div class="rotation"><span class="rot-label">Turn order</span>';
    if (parsed) {
      h += '<div class="rot-line">' + parsed.segments.map(function (s) {
        if (s.kind === "loop") return '<span class="seg loop">' + rotSteps(s.steps) + '<span class="repeat" title="repeats">&#8635;</span></span>';
        if (s.kind === "start") return '<span class="seg start"><span class="seg-tag">start</span>' + rotSteps(s.steps) + "</span>";
        return '<span class="seg">' + rotSteps(s.steps) + "</span>";
      }).join('<span class="seg-then">then</span>') + "</div>";
    }
    if (e.patt.length) h += '<div class="rot-text">' + e.patt.map(function (p) { return fmt(p); }).join("<br>") + "</div>";
    return h + "</div>";
  }
  // one monster = one full-width row: identity | passives + moves (Move 1..N) + turn order
  function combatMonRowHtml(e, label, count) {
    var h = '<div class="mon-row">';
    h += '<div class="mon-id"><div class="mon-name">' + esc(label || e.name) + (count > 1 ? ' <span class="mon-x">&#215;' + count + "</span>" : "") + "</div>";
    h += '<div class="mon-meta"><span class="typebadge t-' + esc(e.type) + '">' + esc(e.type) + "</span>";
    if (e.group) h += '<span class="mon-group">part of <b>' + esc(e.group) + "</b></span>";
    h += "</div>";
    h += '<div class="hp">&#10084; ' + fmt(e.hp) + "</div>";
    if (e.sub) h += '<div class="mon-sub">' + esc(e.sub) + "</div>";
    h += "</div>";                                  // mon-id
    h += '<div class="mon-main">';
    if (e.notes.length) {
      h += '<div class="passives">';
      e.notes.forEach(function (n) { h += '<span class="passive">' + noteHtml(n) + "</span>"; });
      h += "</div>";
    }
    if (e.movesArr.length) {
      h += '<div class="move-strip">';
      e.movesArr.forEach(function (mv, i) {
        var n = i + 1;
        h += '<div class="mv m' + n + '"><div class="mv-h"><span class="mv-n">' + n + '</span><span class="mv-name">' + esc(mv.name || ("Move " + n)) + "</span></div>";
        if (mv.fx.length) {
          h += '<div class="chips">';
          mv.fx.forEach(function (f) { var c = fxClass(f); h += '<span class="chip' + (c ? " " + c : "") + '">' + fmt(f) + "</span>"; });
          h += "</div>";
        }
        h += "</div>";
      });
      h += "</div>";
    }
    h += rotationHtml(e);
    return h + "</div></div>";                      // mon-main, mon-row
  }
  // a combat = a full-width collapsible panel; open it and every monster shows at once
  function encounterHtml(enc, idx) {
    var seen = {}, order = [], extra = [];
    enc.monsters.forEach(function (raw) {
      var e = resolveRef(raw, idx);
      if (!e) { extra.push(refLabel(raw)); return; }
      if (!seen[e.id]) { seen[e.id] = { e: e, label: refLabel(raw), count: 0 }; order.push(e.id); }
      seen[e.id].count++;                            // collapse duplicates (Inklet, Inklet, Inklet -> x3)
    });
    enc.notes.forEach(function (nt) { extra.push(refLabel(nt)); });
    var rows = order.map(function (id) { return seen[id]; });
    var h = '<details class="combat"><summary class="combat-sum"><span class="cs-chev"></span><span class="cs-name">' + esc(enc.name) + "</span>";
    if (enc.tags && enc.tags.length) h += enc.tags.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
    h += '<span class="cs-mons">' + rows.map(function (r) {
      return '<span class="cs-mon t-' + esc(r.e.type) + '">' + esc(r.label) + (r.count > 1 ? " &#215;" + r.count : "") + "</span>";
    }).join("") + "</span></summary>";
    h += '<div class="combat-body">';
    if (enc.note) h += '<div class="enc-note">' + fmt(enc.note) + "</div>";
    rows.forEach(function (r) { h += combatMonRowHtml(r.e, r.label, r.count); });
    if (extra.length) h += '<div class="enc-extra"><span class="sec-label">Also / variable</span><br>' + extra.map(function (u) { return fmt(u); }).join("<br>") + "</div>";
    return h + "</div></details>";
  }
  var SECTION_TITLES = { easy: "Easy-pool combats", hard: "Hard-pool combats", elites: "Elites", bosses: "Bosses", events: "Events" };
  function actHtml(act, idx) {
    var h = '<div class="act">';
    h += '<div class="act-top"><h2>' + esc(act.title) + "</h2>";
    h += '<button class="btn mini" data-action="expand-act">Expand all</button>';
    h += '<button class="btn mini" data-action="collapse-act">Collapse all</button></div>';
    if (act.ancients && act.ancients.length) {
      h += '<div class="ancient-pool"><span class="sec-label">Ancient pool</span> ' +
        act.ancients.map(function (a) { return '<span class="apchip" data-jump-ancient="' + esc(a) + '">' + esc(a) + "</span>"; }).join("") + "</div>";
    }
    act.sections.forEach(function (sec) {
      if (sec.kind === "events") return; // events listed separately below
      h += '<div class="act-sec"><h3 class="act-sec-title">' + esc(SECTION_TITLES[sec.kind] || sec.label) + "</h3>";
      h += '<div class="combat-list">';
      sec.encounters.forEach(function (enc) { h += encounterHtml(enc, idx); });
      h += "</div></div>";
    });
    if (act.events && act.events.length) {
      h += '<div class="act-sec"><h3 class="act-sec-title">Events</h3><div class="event-links">';
      h += act.events.map(function (ev) { return '<span class="apchip" data-jump-event="' + esc(ev) + '">' + esc(ev) + "</span>"; }).join("");
      h += "</div></div>";
    }
    return h + "</div>";
  }
  function eventCardHtml(ev) {
    var h = '<div class="card event" id="evt-' + esc(slug(ev.name)) + '">';
    h += '<div class="card-head"><h3 class="ename">' + esc(ev.name) + "</h3>";
    h += '<span class="typebadge t-event">' + esc(ev.act.replace(/:.*/, "")) + "</span></div>";
    if (ev.cond) h += '<div class="cond">' + fmt(ev.cond) + "</div>";
    h += '<table class="opts"><tbody>';
    ev.options.forEach(function (o) {
      if (o.name && !o.effect && !o.notes) { h += '<tr class="opt-head"><td colspan="2">' + fmt(o.name) + "</td></tr>"; return; }
      h += "<tr><td class=\"opt-name\">" + fmt(o.name) + "</td><td class=\"opt-effect\">" + fmt(o.effect) +
        (o.notes ? '<div class="opt-notes">' + fmt(o.notes) + "</div>" : "") + "</td></tr>";
    });
    h += "</tbody></table>";
    return h + "</div>";
  }
  function ancientCardHtml(a) {
    var h = '<div class="card ancient" id="anc-' + esc(slug(a.name)) + '"><div class="card-head"><h3 class="ename">' + esc(a.name) + "</h3>";
    h += '<span class="typebadge t-ancient">Ancient</span></div>';
    a.groups.forEach(function (g) {
      h += '<div class="anc-group"><div class="sec-label">' + esc(g.label) + "</div>";
      g.items.forEach(function (it) {
        h += '<div class="anc-item"><div class="anc-name">' + esc(it.name) + "</div><div class=\"anc-desc\">" + fmt(it.desc) + "</div></div>";
      });
      h += "</div>";
    });
    return h + "</div>";
  }
  function mechanicsHtml(sections) {
    var h = "";
    sections.forEach(function (s) {
      h += '<div class="card mech"><h3 class="ename">' + esc(s.title) + "</h3>";
      s.items.forEach(function (it) {
        h += '<div class="mech-item">';
        if (it.label) h += '<div class="mech-label">' + fmt(it.label) + "</div>";
        it.lines.forEach(function (ln) { h += '<div class="mech-line">' + fmt(ln) + "</div>"; });
        h += "</div>";
      });
      h += "</div>";
    });
    return h;
  }

  var api = {
    parseCSV: parseCSV, parseStatBlocks: parseStatBlocks, parseAct: parseAct, parseEvents: parseEvents,
    parseAncients: parseAncients, parseMechanics: parseMechanics,
    buildIndex: buildIndex, resolveRef: resolveRef, refLabel: refLabel,
    fmt: fmt, esc: esc, slug: slug,
    statCardHtml: statCardHtml, encounterHtml: encounterHtml,
    actHtml: actHtml, eventCardHtml: eventCardHtml, ancientCardHtml: ancientCardHtml, mechanicsHtml: mechanicsHtml
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.STS = api;
})(typeof window !== "undefined" ? window : this);
