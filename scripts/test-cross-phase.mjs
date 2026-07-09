/**
 * Part 1 verification: cross-phase predecessor logic (§6.10)
 * Tests both backward-compat §6.9 scenarios AND new cross-phase scenarios.
 * Run with: node scripts/test-cross-phase.mjs
 */

// ── Inline all functions from taskDates.ts (plain JS, no imports) ──

const PHASE_ORDER = ["discovery","development","testing","uat","goLive","supportGoLive"];

function parseISODate(iso) {
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y, m-1, d);
}
function formatISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function isWeekend(date) { const d = date.getDay(); return d===0||d===6; }
function normalizeToWorkingDay(iso) {
  const date = parseISODate(iso);
  while (isWeekend(date)) date.setDate(date.getDate()+1);
  return formatISODate(date);
}
function addWorkingDays(iso, days) {
  const date = parseISODate(iso);
  if (days===0) return formatISODate(date);
  const step = days>0?1:-1;
  let remaining = Math.abs(days);
  while (remaining>0) {
    date.setDate(date.getDate()+step);
    if (!isWeekend(date)) remaining--;
  }
  return formatISODate(date);
}
function computeEndDate(start, dur) {
  if (dur<=0) return start;
  const extra = dur-1;
  if (extra<=0) return start;
  return addWorkingDays(start, extra);
}
function isLaterPhase(phaseA, phaseB) {
  return PHASE_ORDER.indexOf(phaseA) > PHASE_ORDER.indexOf(phaseB);
}
function wouldCreateCycle(tasks, taskId, predecessorIds) {
  const ids = new Set(tasks.map(t=>t.id));
  const simulated = tasks.map(t => t.id===taskId ? {...t, predecessorIds} : t);
  const visited = new Set();
  const stack = new Set();
  function dfs(id) {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id); stack.add(id);
    const task = simulated.find(t=>t.id===id);
    if (task) for (const pred of task.predecessorIds) if (ids.has(pred) && dfs(pred)) return true;
    stack.delete(id);
    return false;
  }
  for (const t of simulated) if (dfs(t.id)) return true;
  return false;
}
function topologicalSort(tasks) {
  const ids = new Set(tasks.map(t=>t.id));
  const inDegree = new Map(); const adj = new Map();
  for (const t of tasks) { inDegree.set(t.id,0); adj.set(t.id,[]); }
  for (const t of tasks) for (const pred of t.predecessorIds) {
    if (!ids.has(pred)) continue;
    adj.get(pred).push(t.id);
    inDegree.set(t.id, (inDegree.get(t.id)??0)+1);
  }
  const phaseIndex = t => PHASE_ORDER.indexOf(t.phaseKey);
  const stableSort = (a,b) => {
    const pd = phaseIndex(a)-phaseIndex(b);
    return pd!==0 ? pd : a.order-b.order;
  };
  const queue = tasks.filter(t=>(inDegree.get(t.id)??0)===0).sort(stableSort).map(t=>t.id);
  const result = [];
  while (queue.length>0) {
    const id = queue.shift(); result.push(id);
    for (const next of adj.get(id)??[]) {
      const deg = (inDegree.get(next)??1)-1;
      inDegree.set(next, deg);
      if (deg===0) {
        queue.push(next);
        queue.sort((a,b)=>stableSort(tasks.find(t=>t.id===a),tasks.find(t=>t.id===b)));
      }
    }
  }
  return result.length===tasks.length ? result : tasks.map(t=>t.id);
}
function recomputeProjectTasks(allTasks, today=new Date()) {
  const result = new Map();
  for (const key of PHASE_ORDER) result.set(key,[]);
  if (allTasks.length===0) return result;
  const map = new Map(allTasks.map(t=>[t.id,{...t}]));
  const order = topologicalSort(allTasks);
  for (const id of order) {
    const task = map.get(id);
    const validPreds = task.predecessorIds.filter(pid=>map.has(pid));
    let start = null;
    if (validPreds.length>0) {
      const predEnds = validPreds.map(pid=>map.get(pid).end).filter(e=>e!==null);
      if (predEnds.length===validPreds.length) {
        const maxEnd = predEnds.reduce((a,b)=>a>b?a:b);
        start = addWorkingDays(maxEnd,1);
      }
    } else {
      start = task.start ? normalizeToWorkingDay(task.start) : null;
    }
    const end = start ? computeEndDate(start, task.durationMandays) : null;
    map.set(id, {...task, predecessorIds:validPreds, start, end});
  }
  for (const t of allTasks) {
    const updated = map.get(t.id);
    result.get(updated.phaseKey).push(updated);
  }
  for (const [key,tasks] of result) tasks.sort((a,b)=>a.order-b.order);
  return result;
}

// ── Test helpers ──
let failed = 0;
function assert(label, actual, expected) {
  if (actual !== expected) {
    console.error(`  FAIL  ${label}\n        expected: ${expected}\n        got:      ${actual}`);
    failed++;
  } else {
    console.log(`  OK    ${label}: ${actual}`);
  }
}
function assertBool(label, actual, expected) {
  if (actual !== expected) {
    console.error(`  FAIL  ${label}: expected ${expected}, got ${actual}`);
    failed++;
  } else {
    console.log(`  OK    ${label}: ${actual}`);
  }
}

// ── Task factory ──
let idCounter = 0;
function makeTask(phaseKey, overrides={}) {
  return {
    id: `t${++idCounter}`,
    phaseKey,
    nama: overrides.nama ?? `Task ${idCounter}`,
    durationMandays: overrides.durationMandays ?? 1,
    predecessorIds: overrides.predecessorIds ?? [],
    start: overrides.start ?? null,
    end: overrides.end ?? null,
    status: "NOT_STARTED",
    statusManualOverride: false,
    order: overrides.order ?? (idCounter-1),
  };
}


// ════════════════════════════════════════════════════
// SCENARIO 1: No predecessor — task stays unanchored
// ════════════════════════════════════════════════════
console.log("\n=== Scenario 1: No predecessor, start=null ===");
{
  const A = makeTask("development", { durationMandays:3 });
  const result = recomputeProjectTasks([A]);
  const a = result.get("development")[0];
  assert("A start (no pred, null)", a.start, null);
  assert("A end (no pred, null)", a.end, null);
}

// ════════════════════════════════════════════════════
// SCENARIO 2: No predecessor, explicit start (§6.9 baseline)
// ════════════════════════════════════════════════════
console.log("\n=== Scenario 2: No predecessor, explicit start set ===");
{
  idCounter = 0;
  const A = makeTask("development", { durationMandays:3, start:"2026-07-08" }); // Wed
  const result = recomputeProjectTasks([A]);
  const a = result.get("development")[0];
  // Wed Jul 8 + 2 extra working days = Fri Jul 10
  assert("A start (Wed Jul 8)", a.start, "2026-07-08");
  assert("A end (3 md from Wed)", a.end, "2026-07-10");
}

// ════════════════════════════════════════════════════
// SCENARIO 3: Same-phase predecessor chain (§6.9 regression)
// A(3md,start=Wed Jul8) → B(2md) → C(1md)
// ════════════════════════════════════════════════════
console.log("\n=== Scenario 3: Same-phase chain A→B→C ===");
{
  idCounter = 0;
  const A = makeTask("development", { durationMandays:3, start:"2026-07-08", order:0 });
  const B = makeTask("development", { durationMandays:2, predecessorIds:[A.id], order:1 });
  const C = makeTask("development", { durationMandays:1, predecessorIds:[B.id], order:2 });
  const result = recomputeProjectTasks([A,B,C]);
  const [a,b,c] = [result.get("development")[0], result.get("development")[1], result.get("development")[2]];
  // A: Wed Jul 8 → Fri Jul 10 (3 md)
  assert("A start", a.start, "2026-07-08");
  assert("A end",   a.end,   "2026-07-10");
  // B: starts Mon Jul 13 (Fri+1 working day skips Sat/Sun), +1 extra = Tue Jul 14
  assert("B start (Mon after Fri)", b.start, "2026-07-13");
  assert("B end (2 md)",            b.end,   "2026-07-14");
  // C: Wed Jul 15, 1md = same day
  assert("C start", c.start, "2026-07-15");
  assert("C end (1 md = same day)", c.end, "2026-07-15");
}

// ════════════════════════════════════════════════════
// SCENARIO 4: Cycle detection — same phase (§6.9 regression)
// A → B → A  (cycle)
// ════════════════════════════════════════════════════
console.log("\n=== Scenario 4: Cycle detection — same phase ===");
{
  idCounter = 0;
  const A = makeTask("development", { order:0 });
  const B = makeTask("development", { predecessorIds:[A.id], order:1 });
  // A already has no preds; B depends on A. Now try making A depend on B → cycle.
  const allTasks = [A, B];
  assertBool("A→B→A cycle detected", wouldCreateCycle(allTasks, A.id, [B.id]), true);
  assertBool("B→A (valid, no cycle)",  wouldCreateCycle(allTasks, B.id, [A.id]), false);
}

// ════════════════════════════════════════════════════
// SCENARIO 5: Cross-phase — Testing task depends on Development task
// Dev task D1: start=Wed Jul 8, 5 md → end=Tue Jul 14
// Testing task T1: pred=D1, 3 md → start=Wed Jul 15, end=Fri Jul 17
// ════════════════════════════════════════════════════
console.log("\n=== Scenario 5: Cross-phase — Testing depends on Development ===");
{
  idCounter = 0;
  const D1 = makeTask("development", { durationMandays:5, start:"2026-07-08", order:0 });
  const T1 = makeTask("testing",     { durationMandays:3, predecessorIds:[D1.id], order:0 });
  const allTasks = [D1, T1];
  const result = recomputeProjectTasks(allTasks);
  const d1 = result.get("development")[0];
  const t1 = result.get("testing")[0];
  // D1: Wed Jul 8 + 4 extra = Wed8,Thu9,Fri10,[skip Sat11,Sun12],Mon13,Tue14 → end Tue Jul 14
  assert("D1 start", d1.start, "2026-07-08");
  assert("D1 end (5md, crosses weekend)", d1.end, "2026-07-14");
  // T1: starts Wed Jul 15 (Tue Jul 14 + 1 working day), 3md → end Fri Jul 17
  assert("T1 start (day after D1 end, cross-phase)", t1.start, "2026-07-15");
  assert("T1 end (3md from Wed)", t1.end, "2026-07-17");
}

// ════════════════════════════════════════════════════
// SCENARIO 6: Cross-phase rollup — phase dates from own tasks only
// D1 ends Jul 14; T1 starts Jul 15. Development rollup = D1 only.
// Testing rollup = T1 only. Cross-phase pred does NOT bleed into rollup.
// ════════════════════════════════════════════════════
console.log("\n=== Scenario 6: Phase rollup stays per-phase ===");
{
  idCounter = 0;
  const D1 = makeTask("development", { durationMandays:5, start:"2026-07-08", order:0 });
  const D2 = makeTask("development", { durationMandays:2, predecessorIds:[D1.id], order:1 });
  const T1 = makeTask("testing",     { durationMandays:3, predecessorIds:[D1.id], order:0 });
  const result = recomputeProjectTasks([D1, D2, T1]);
  const devTasks  = result.get("development"); // [D1, D2]
  const testTasks = result.get("testing");     // [T1]
  // D1: Jul 8 → Jul 14;  D2: starts Jul 15, 2md → Jul 16
  // T1: starts Jul 15, 3md → Jul 17
  // Development rollup: MIN(D1.start, D2.start)=Jul8 / MAX(D1.end, D2.end)=Jul16
  // Testing rollup: MIN=Jul15 / MAX=Jul17
  const devStarts = devTasks.map(t=>t.start);
  const devEnds   = devTasks.map(t=>t.end);
  const devRollupStart = devStarts.reduce((a,b)=>a<b?a:b);
  const devRollupEnd   = devEnds.reduce((a,b)=>a>b?a:b);
  assert("Dev rollup start (D1 only)", devRollupStart, "2026-07-08");
  assert("Dev rollup end (max D1,D2)",  devRollupEnd,   "2026-07-16");
  assert("Test rollup start", testTasks[0].start, "2026-07-15");
  assert("Test rollup end",   testTasks[0].end,   "2026-07-17");
}

// ════════════════════════════════════════════════════
// SCENARIO 7: Cycle detection — cross-phase
// D1 (development) has no preds.  T1 (testing) depends on D1.
// Try to make D1 depend on T1 → cross-phase cycle, must be blocked.
// ════════════════════════════════════════════════════
console.log("\n=== Scenario 7: Cycle detection — cross-phase ===");
{
  idCounter = 0;
  const D1 = makeTask("development", { order:0 });
  const T1 = makeTask("testing",     { predecessorIds:[D1.id], order:0 });
  const allTasks = [D1, T1];
  // T1 already depends on D1. Try making D1 depend on T1 → D1→T1→D1 cycle.
  assertBool("Cross-phase cycle D1→T1→D1 detected", wouldCreateCycle(allTasks, D1.id, [T1.id]), true);
  // Adding an unrelated predecessor to D1 that doesn't form a cycle is fine.
  const D0 = makeTask("discovery", { order:0 });
  const allWithD0 = [D0, D1, T1];
  assertBool("D1 depends on D0 (no cycle, earlier phase)", wouldCreateCycle(allWithD0, D1.id, [D0.id]), false);
}

// ════════════════════════════════════════════════════
// SCENARIO 8: isLaterPhase helper
// ════════════════════════════════════════════════════
console.log("\n=== Scenario 8: isLaterPhase helper ===");
assertBool("testing > development",   isLaterPhase("testing","development"),   true);
assertBool("development > testing",   isLaterPhase("development","testing"),   false);
assertBool("development > discovery", isLaterPhase("development","discovery"), true);
assertBool("same phase",              isLaterPhase("development","development"),false);
assertBool("goLive > uat",            isLaterPhase("goLive","uat"),             true);

// ════════════════════════════════════════════════════
// SCENARIO 9: Later-phase predecessor warning (non-blocking)
// T1 (testing) depends on D1 (development) — earlier phase, no warning.
// D1 (development) depends on T1 (testing) — later phase, should warn.
// (Cycle check runs first so a true cross-backward cycle IS blocked;
//  this scenario is when it's set up so no cycle exists yet but
//  the predecessor is from a later phase.)
// ════════════════════════════════════════════════════
console.log("\n=== Scenario 9: Warning for later-phase predecessor ===");
{
  // T1 in testing depending on D1 in development → predecessor is EARLIER → no warning
  assertBool("T1 pred D1: earlier phase, no warning", isLaterPhase("development","testing"), false);
  // D1 in development depending on T1 in testing → predecessor phase (testing) is LATER → warning
  // isLaterPhase(predecessorPhase, ownerPhase) → is pred in a later phase than owner?
  assertBool("D1 pred T1: testing > development → warn", isLaterPhase("testing","development"), true);
}

console.log(`\n${"─".repeat(50)}`);
if (failed === 0) {
  console.log(`ALL ${9} SCENARIO GROUPS PASSED ✓`);
} else {
  console.log(`${failed} assertion(s) FAILED`);
}
process.exit(failed > 0 ? 1 : 0);
