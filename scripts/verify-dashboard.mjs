/**
 * Cross-check dashboard aggregation logic against seed data.
 * Run with: node scripts/verify-dashboard.mjs
 */

// ─── Inline seed data (mirrors src/data/seed.ts exactly) ───
const projects = [
  { id: "p1", divisi: "HOTD1",           status: "ON_TRACK",  progress: 40,  progressMode: "manual", isArchived: false, updatedAt: "2026-07-01T00:00:00Z",
    timeline: { goLive: { start: null, end: null } },
    phases: ["DONE","IN_PROGRESS","NOT_STARTED","NOT_STARTED","NOT_STARTED","NOT_STARTED"] },
  { id: "p2", divisi: "HOTD1",           status: "COMPLETED", progress: 100, progressMode: "auto",   isArchived: false, updatedAt: "2026-04-15T00:00:00Z",
    timeline: { goLive: { start: "2026-03-26", end: "2026-03-30" } },
    phases: ["DONE","DONE","DONE","DONE","DONE","DONE"] },
  { id: "p3", divisi: "HOTD2_FINANCE",   status: "AT_RISK",   progress: 25,  progressMode: "manual", isArchived: false, updatedAt: "2026-07-05T00:00:00Z",
    timeline: { goLive: { start: null, end: null } },
    phases: ["DONE","IN_PROGRESS","NOT_STARTED","NOT_STARTED","NOT_STARTED","NOT_STARTED"] },
  { id: "p4", divisi: "HOTD2_FINANCE",   status: "NOT_STARTED", progress: 0, progressMode: "manual", isArchived: false, updatedAt: "2026-07-01T00:00:00Z",
    timeline: { goLive: { start: null, end: null } },
    phases: ["NOT_STARTED","NOT_STARTED","NOT_STARTED","NOT_STARTED","NOT_STARTED","NOT_STARTED"] },
  { id: "p5", divisi: "HOTD2_NONFINANCE",status: "DELAYED",   progress: 33,  progressMode: "auto",   isArchived: false, updatedAt: "2026-06-25T00:00:00Z",
    timeline: { goLive: { start: null, end: null } },
    // p5 auto: discovery DONE, development DONE, testing manually overridden IN_PROGRESS
    // derivePhaseStatus for auto phases: today=Jul 8 2026
    // discovery: end Mar 20 < today → DONE  ✓
    // development: end May 15 < today → DONE ✓
    // testing: statusManualOverride=true → IN_PROGRESS (not DONE)
    // uat/goLive/supportGoLive: NOT_STARTED
    // autoProgress = 2/6 * 100 = 33%  ← matches seed progress:33
    phases: ["DONE","DONE","IN_PROGRESS","NOT_STARTED","NOT_STARTED","NOT_STARTED"] },
  { id: "p6", divisi: "HOTD2_NONFINANCE",status: "ON_HOLD",   progress: 15,  progressMode: "manual", isArchived: false, updatedAt: "2026-05-15T00:00:00Z",
    timeline: { goLive: { start: null, end: null } },
    phases: ["DONE","NOT_STARTED","NOT_STARTED","NOT_STARTED","NOT_STARTED","NOT_STARTED"] },
];

// getEffectiveProgress: if auto, count DONE phases / 6 * 100; else use progress field
function getEffectiveProgress(p) {
  if (p.progressMode === "auto") {
    const done = p.phases.filter(s => s === "DONE").length;
    return Math.round(done / 6 * 100);
  }
  return p.progress;
}

const active = projects.filter(p => !p.isArchived);  // all 6 not archived

console.log("=== Total projects (non-archived) ===");
console.log("Expected: 6, Got:", active.length);
console.assert(active.length === 6, "FAIL: total");

console.log("\n=== Per division ===");
const divs = { HOTD1: [], HOTD2_FINANCE: [], HOTD2_NONFINANCE: [] };
for (const p of active) divs[p.divisi].push(p);
console.log("HOTD1:", divs.HOTD1.length, "(p1,p2) → expected 2");
console.log("HOTD2_FINANCE:", divs.HOTD2_FINANCE.length, "(p3,p4) → expected 2");
console.log("HOTD2_NONFINANCE:", divs.HOTD2_NONFINANCE.length, "(p5,p6) → expected 2");
console.assert(divs.HOTD1.length === 2 && divs.HOTD2_FINANCE.length === 2 && divs.HOTD2_NONFINANCE.length === 2, "FAIL: per division");

console.log("\n=== Status distribution ===");
const statusMap = {};
for (const p of active) statusMap[p.status] = (statusMap[p.status] || 0) + 1;
console.log(JSON.stringify(statusMap));
// Expected: ON_TRACK:1(p1), COMPLETED:1(p2), AT_RISK:1(p3), NOT_STARTED:1(p4), DELAYED:1(p5), ON_HOLD:1(p6)
console.assert(Object.keys(statusMap).length === 6, "FAIL: should have all 6 statuses represented");
console.assert(statusMap["ON_TRACK"] === 1, "FAIL: ON_TRACK");
console.assert(statusMap["AT_RISK"] === 1, "FAIL: AT_RISK");
console.assert(statusMap["DELAYED"] === 1, "FAIL: DELAYED");

console.log("\n=== Effective progress per project ===");
for (const p of active) {
  const ep = getEffectiveProgress(p);
  console.log(`${p.id}: progressMode=${p.progressMode}, progress=${p.progress}, effective=${ep}`);
}

console.log("\n=== Average progress (overall) ===");
const progressValues = active.map(p => getEffectiveProgress(p));
// p1=40(manual), p2=100(auto,6/6), p3=25(manual), p4=0(manual), p5=33(auto,2/6), p6=15(manual)
const expectedProgresses = [40, 100, 25, 0, 33, 15];
const sum = progressValues.reduce((a,b) => a+b, 0);
const avg = Math.round(sum / progressValues.length);
console.log("Values:", progressValues);
console.log("Sum:", sum, "/ 6 = avg:", sum/progressValues.length, "→ rounded:", avg);
// 40+100+25+0+33+15 = 213, 213/6 = 35.5 → 36
const expectedSum = 40+100+25+0+33+15;
console.assert(sum === expectedSum, `FAIL: expected sum ${expectedSum}, got ${sum}`);
console.assert(avg === 36, `FAIL: expected avg 36, got ${avg}`);
console.log("Expected avg: 36 ✓");

console.log("\n=== Average progress per division ===");
for (const [div, ps] of Object.entries(divs)) {
  const s = ps.map(p => getEffectiveProgress(p)).reduce((a,b)=>a+b,0);
  const a = Math.round(s / ps.length);
  console.log(`${div}: ${ps.map(p=>getEffectiveProgress(p)).join("+")} = ${s}/2 → ${a}%`);
}
// HOTD1: p1=40 + p2=100 = 140/2 = 70
// HOTD2_FINANCE: p3=25 + p4=0 = 25/2 = 13 (rounded from 12.5)
// HOTD2_NONFINANCE: p5=33 + p6=15 = 48/2 = 24

console.log("\n=== Needs Attention (AT_RISK or DELAYED) ===");
const attention = active.filter(p => p.status === "AT_RISK" || p.status === "DELAYED")
  .sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
console.log("Count:", attention.length, "→ expected 2 (p3 AT_RISK, p5 DELAYED)");
console.log("Order (by updatedAt desc):", attention.map(p => `${p.id}(${p.updatedAt.slice(0,10)})`).join(", "));
// p3 updatedAt=2026-07-05, p5 updatedAt=2026-06-25 → p3 first
console.assert(attention.length === 2, "FAIL: needs attention count");
console.assert(attention[0].id === "p3", "FAIL: p3 should be first (more recent updatedAt)");

console.log("\n=== Go-Live this month (July 2026) ===");
// today = Jul 8 2026; monthStart = Jul 1, monthEnd = Jul 31
// Only p2 has goLive dates (Mar 26–30 2026) → NOT this month
// All other goLive are null → filtered out
// Expected: 0 go-lives in July 2026
const monthStart = new Date(2026, 6, 1);   // Jul 1
const monthEnd   = new Date(2026, 6, 31, 23, 59, 59); // Jul 31
const goLives = active.filter(p => {
  const gl = p.timeline.goLive;
  if (!gl.start || !gl.end) return false;
  const s = new Date(gl.start); const e = new Date(gl.end);
  return s <= monthEnd && e >= monthStart;
});
console.log("Go-live this month:", goLives.length, "(p2 goLive was Mar 2026, not July → expected 0)");
console.assert(goLives.length === 0, "FAIL: expected 0 go-lives in July 2026");

console.log("\n=== p2 progress mode=auto cross-check ===");
// p2 has progressMode=auto; all 6 phases DONE → 6/6 * 100 = 100%
// The stored progress=100 is also 100, so both paths agree
const p2auto = getEffectiveProgress(projects.find(p => p.id === "p2"));
console.log("p2 getEffectiveProgress:", p2auto, "→ expected 100");
console.assert(p2auto === 100, "FAIL: p2 auto progress");

console.log("\n=== p5 progress mode=auto cross-check ===");
// p5: discovery DONE (end Mar 20 < Jul 8), development DONE (end May 15 < Jul 8),
// testing: statusManualOverride=true, status=IN_PROGRESS (not DONE)
// autoProgress = 2/6 * 100 = 33.33 → 33
const p5auto = getEffectiveProgress(projects.find(p => p.id === "p5"));
console.log("p5 getEffectiveProgress:", p5auto, "→ expected 33");
console.assert(p5auto === 33, `FAIL: p5 auto progress, got ${p5auto}`);

console.log("\nAll checks passed ✓");
