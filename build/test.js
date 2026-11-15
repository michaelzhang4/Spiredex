var fs = require("fs");
var path = require("path");
var STS = require("./lib.js");

var DIR = path.join(__dirname, "..");
function read(f) { return fs.readFileSync(path.join(DIR, "data", f), "utf8"); }
var P = "Slay the Spire 2 Reference - ";

var monsters = STS.parseStatBlocks(STS.parseCSV(read(P + "Monsters.csv")), "monster");
var elites = STS.parseStatBlocks(STS.parseCSV(read(P + "Elites.csv")), "elite");
var bosses = STS.parseStatBlocks(STS.parseCSV(read(P + "Bosses.csv")), "boss");
var all = monsters.concat(elites, bosses);
var idx = STS.buildIndex(all);

console.log("=== stat blocks ===");
console.log("monsters:", monsters.length, "| elites:", elites.length, "| bosses:", bosses.length, "| total:", all.length);
console.log("empty-named?", all.filter(function (e) { return !e.name; }).length);
console.log("boss names:", bosses.map(function (e) { return e.name + (e.group ? " <" + e.group + ">" : ""); }).join(", "));
console.log("elite names:", elites.map(function (e) { return e.name + (e.group ? " <" + e.group + ">" : ""); }).join(", "));

var actFiles = ["Act 1_ Overgrowth", "Act 1_ Underdocks", "Act 2_ Hive", "Act 3_ Glory"];
var unresolved = [];
console.log("\n=== acts ===");
actFiles.forEach(function (af) {
  var act = STS.parseAct(STS.parseCSV(read(P + af + ".csv")));
  var nEnc = 0, nMon = 0, nRes = 0;
  act.sections.forEach(function (sec) {
    sec.encounters.forEach(function (enc) {
      nEnc++;
      enc.monsters.forEach(function (raw) {
        nMon++;
        var e = STS.resolveRef(raw, idx);
        if (e) nRes++; else unresolved.push(af + " / " + sec.kind + " / " + enc.name + " :: " + STS.refLabel(raw));
      });
    });
  });
  console.log(af + ": title=\"" + act.title + "\" ancients=[" + act.ancients.join(",") + "] events=" + act.events.length +
    " | encounters=" + nEnc + " monsters=" + nMon + " resolved=" + nRes);
});

console.log("\n=== UNRESOLVED references (" + unresolved.length + ") ===");
unresolved.forEach(function (u) { console.log("  " + u); });

var events = STS.parseEvents(STS.parseCSV(read(P + "Events.csv")));
console.log("\n=== events ===");
console.log("count:", events.length, "| acts:", Array.from(new Set(events.map(function (e) { return e.act; }))).join(" | "));
console.log("sample:", JSON.stringify(events[0]));

console.log("\n=== act event lists (act tab + Events tab) ===");
actFiles.forEach(function (af) {
  var links = STS.linkActEvents(STS.parseAct(STS.parseCSV(read(P + af + ".csv"))), events);
  console.log(af + ": " + links.length + " events | added from Events tab: [" +
    links.filter(function (l) { return l.added; }).map(function (l) { return l.label; }).join(", ") + "] | not in Events tab: [" +
    links.filter(function (l) { return !l.found; }).map(function (l) { return l.label; }).join(", ") + "]");
});

console.log("\n=== dread ===");
var withDom = all.filter(function (e) { return e.dominion; });
console.log("enemies carrying a Dominion:", withDom.length, "| distinct Dominions:", new Set(withDom.map(function (e) { return e.dominion; })).size);
withDom.forEach(function (e) { console.log("  " + e.name + (e.group ? " <" + e.group + ">" : "") + ": " + e.dominion); });
console.log("Dread counts:", all.filter(function (e) { return e.qtyDread; }).map(function (e) { return e.name + " x" + e.qty + " [x" + e.qtyDread + "]"; }).join(", ") || "(none)");
console.log("wiki-sourced notes (not in the sheet):", all.filter(function (e) { return e.wikiNotes.length; }).map(function (e) {
  return e.name + " " + e.wikiNotes.map(function (w) { return w.text; }).join(" ");
}).join(", ") || "(none)");

var ancients = STS.parseAncients(STS.parseCSV(read(P + "Ancients.csv")));
console.log("\n=== ancients ===");
console.log("count:", ancients.length, "names:", ancients.map(function (a) { return a.name + "(" + a.groups.length + "g," + a.groups.reduce(function (n, g) { return n + g.items.length; }, 0) + "i)"; }).join(", "));

var mech = STS.parseMechanics(STS.parseCSV(read(P + "Mechanics_Statistics.csv")));
console.log("\n=== mechanics ===");
console.log("sections:", mech.map(function (s) { return s.title + "(" + s.items.length + ")"; }).join(", "));

// smoke-test HTML builders don't throw
var htmlLen = 0;
all.forEach(function (e) { htmlLen += STS.statCardHtml(e, { appears: true }).length; });
console.log("\nstatCardHtml total length:", htmlLen, "(no throw)");
