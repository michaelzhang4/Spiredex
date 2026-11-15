// Validate the ASSEMBLED html: pull embedded CSV blocks back out and parse them.
var fs = require("fs"), path = require("path");
var STS = require("./lib.js");
var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function grab(id) {
  var re = new RegExp('<script type="text/plain" id="' + id + '">([\\s\\S]*?)</script>');
  var m = html.match(re);
  if (!m) throw new Error("missing embedded block: " + id);
  return m[1].trim();
}
var monsters = STS.parseStatBlocks(STS.parseCSV(grab("csv-monsters")), "monster");
var elites = STS.parseStatBlocks(STS.parseCSV(grab("csv-elites")), "elite");
var bosses = STS.parseStatBlocks(STS.parseCSV(grab("csv-bosses")), "boss");
var all = monsters.concat(elites, bosses);
var idx = STS.buildIndex(all);
var events = STS.parseEvents(STS.parseCSV(grab("csv-events")));
var ancients = STS.parseAncients(STS.parseCSV(grab("csv-ancients")));
var mech = STS.parseMechanics(STS.parseCSV(grab("csv-mechanics")));
var acts = ["csv-act-overgrowth", "csv-act-underdocks", "csv-act-hive", "csv-act-glory"].map(function (id) {
  return STS.parseAct(STS.parseCSV(grab(id)));
});

var resolved = 0, total = 0;
acts.forEach(function (act) {
  act.sections.forEach(function (sec) {
    if (sec.kind === "events") return;
    sec.encounters.forEach(function (enc) {
      enc.monsters.forEach(function (raw) { total++; if (STS.resolveRef(raw, idx)) resolved++; });
    });
  });
});

// Dread: every "Dominion:" line in the Bosses data must end up on a boss.
var domLines = [], domShown = {};
STS.parseCSV(grab("csv-bosses")).forEach(function (row) {
  var m = String(row[0] || "").trim().match(/^dominion\s*:\s*([\s\S]*)$/i);
  if (m) domLines.push(m[1]);
});
all.forEach(function (e) { if (e.dominion) domShown[e.dominion] = 1; });
var domOk = domLines.filter(function (t) { return domShown[t]; }).length;

// Wiki-sourced Dread notes (lib.js WIKI_DREAD_NOTES): each must attach to an enemy, and none
// may repeat something the sheet now says itself.
var wikiKeys = Object.keys(STS.wikiDreadNotes), wikiOn = 0, wikiDup = [];
all.forEach(function (e) {
  if (!e.wikiNotes.length) return;
  wikiOn++;
  var sheet = [e.hp].concat(e.notes, e.patt, e.movesArr.map(function (mv) { return mv.name + " " + mv.fx.join(" "); }))
    .join(" ").toLowerCase().replace(/[\[\]]/g, "");
  e.wikiNotes.forEach(function (w) { if (sheet.indexOf(w.key) >= 0) wikiDup.push(e.name + " " + w.text); });
});

// Act event lists: every chip must point at an event card, and every act's own events must be listed.
var chips = 0, linked = 0, listed = {};
acts.forEach(function (act) {
  STS.linkActEvents(act, events).forEach(function (l) { chips++; if (l.found) { linked++; listed[l.name] = 1; } });
});
var actEvents = events.filter(function (e) { return !/^shared/i.test(e.act); });
var onPages = actEvents.filter(function (e) { return listed[e.name]; }).length;

console.log("EMBEDDED DATA CHECK (from final HTML)");
console.log(" enemies: " + all.length + " (m " + monsters.length + " / e " + elites.length + " / b " + bosses.length + ")");
console.log(" events: " + events.length + " | ancients: " + ancients.length + " | mechanics sections: " + mech.length);
console.log(" act encounter refs resolved: " + resolved + "/" + total);
console.log(" Dread Dominion lines shown on a boss: " + domOk + "/" + domLines.length);
console.log(" wiki-sourced Dread notes attached: " + wikiOn + "/" + wikiKeys.length +
  (wikiDup.length ? " | NOW ALSO IN THE SHEET - delete from WIKI_DREAD_NOTES in lib.js: " + wikiDup.join("; ") : ""));
console.log(" act event chips linked to an event card: " + linked + "/" + chips + " | act events listed on their act page: " + onPages + "/" + actEvents.length);
console.log(" curly-quote intact in events: " + /“Strike”/.test(grab("csv-events")));
// render smoke test (full pipeline used by browser)
var len = all.map(function (e) { return STS.statCardHtml(e, { appears: false }); }).join("").length
  + acts.map(function (a) { return STS.actHtml(a, idx); }).join("").length
  + events.map(STS.eventCardHtml).join("").length
  + ancients.map(STS.ancientCardHtml).join("").length
  + STS.mechanicsHtml(mech).length;
console.log(" rendered HTML chars (no throw): " + len);
console.log(all.length === 104 && resolved >= 120 && domOk === domLines.length && wikiOn === wikiKeys.length && !wikiDup.length &&
  linked === chips && onPages === actEvents.length ? "PASS" : "CHECK");
