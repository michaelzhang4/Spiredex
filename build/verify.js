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

console.log("EMBEDDED DATA CHECK (from final HTML)");
console.log(" enemies: " + all.length + " (m " + monsters.length + " / e " + elites.length + " / b " + bosses.length + ")");
console.log(" events: " + events.length + " | ancients: " + ancients.length + " | mechanics sections: " + mech.length);
console.log(" act encounter refs resolved: " + resolved + "/" + total);
console.log(" curly-quote intact in events: " + /“Strike”/.test(grab("csv-events")));
// render smoke test (full pipeline used by browser)
var len = all.map(function (e) { return STS.statCardHtml(e, { appears: false }); }).join("").length
  + acts.map(function (a) { return STS.actHtml(a, idx); }).join("").length
  + events.map(STS.eventCardHtml).join("").length
  + ancients.map(STS.ancientCardHtml).join("").length
  + STS.mechanicsHtml(mech).length;
console.log(" rendered HTML chars (no throw): " + len);
console.log(all.length === 104 && resolved >= 120 ? "PASS" : "CHECK");
