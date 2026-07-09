/**
 * Part 1 full test suite: §6.9 regressions + §6.10 cross-phase scenarios.
 * Run with: node scripts/test-part1.mjs
 */

// ─── Inline the logic from taskDates.ts (plain JS, no imports) ─────────────

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
function isWeekend(d) { const w = d.getDay(); return w===0||w===6; }
function normalizeToWorkingDay(iso) {
  const d = parseISODate(iso);
  while (isWeekend(d)) d.setDate(d.getDate()+1);
  return formatISODate(d);
}
function addWorkingDays(iso, days) {
  const d = parseISODate(iso);
  if (days===0) return formatISODate(d);
  const step = days>0?1:-1;
  let rem = Math.abs(days);
  while (rem>0) { d.setDate(d.getDate()+step); if (!isWeekend(d)) rem--; }
  return formatISODate(d);
}
function computeEndDate(start, dur) {
  if (dur<=0) return start;
  const extra = dur-1;
  if (extra<=0) return start;
  return addWorkingDays(start, extra);
}
function wouldCreateCycle(tasks, taskId, predecessorIds) {
  const ids = new Set(tasks.map(t=>t.id));
  const sim = tasks.map(t => t.id===taskId ? {...t, predecessorIds} : t);
  const visited = new Set(), stack = new Set();
  function dfs(id) {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id); stack.add(id);
    const t = sim.find(x=>x.id===id);
    if (t) for (const p of t.predecessorIds) if (ids.has(p) && dfs(p)) return true;
    stack.delete(id); return false;
  }
  for (const t of sim) if (dfs(t.id)) return true;
  return false;
}
function topologicalSort(tasks) {
  const ids = new Set(tasks.map(t=>t.id));
  const inDeg = new Map(), adj = new Map();
  for (const t of tasks) { inDeg.set(t.id,0); adj.set(t.id,[]); }
  for (const t of tasks) for (const p of t.predecessorIds) {
    if (!ids.has(p)) continue;
    adj.get(p).push(t.id);
    inDeg.set(t.id,(inDeg.get(t.id)??0)+1);
  }
  const pi = t => PHASE_ORDER.indexOf(t.phaseKey);
  const ss = (a,b) => { const d = pi(a)-pi(b); return d!==0?d:a.order-b.order; };
  const q = tasks.filter(t=>(inDeg.get(t.id)??0)===0).sort(ss).map(t=>t.id);
  const result = [];
  while (q.length>0) {
    const id = q.shift(); result.push(id);
    for (const next of adj.get(id)??[]) {
      const deg = (inDeg.get(next)??1)-1; inDeg.set(next,deg);
      if (deg===0) { q.push(next); q.sort((a,b)=>ss(tasks.find(t=>t.id===a),tasks.find(t=>t.id===b))); }
    }
  }
  return result.length===tasks.length ? result : tasks.map(t=>t.id);
}
function recomputeProjectTasks(allTasks) {
  const result = new Map(); for (const k of PHASE_ORDER) result.set(k,[]);
  if (allTasks.length===0) return result;
  const map = new Map(allTasks.map(t=>[t.id,{...t}]));
  const order = topologicalSort(allTasks);
  for (const id of order) {
    const task = map.get(id);
    const validPreds = task.predecessorIds.filter(p=>map.has(p));
    let start = null;
    if (validPreds.length>0) {
      const ends = validPreds.map(p=>map.get(p).end).filter(e=>e!==null);
      if (ends.length===validPreds.length) { const max = ends.reduce((a,b)=>a>b?a:b); start = addWorkingDays(max,1); }
    } else { start = task.start ? normalizeToWorkingDay(task.start) : null; }
    const end = start ? computeEndDate(start, task.durationMandays) : null;
    map.set(id, {...task, predecessorIds:validPreds, start, end});
  }
  for (const t of allTasks) { const u=map.get(t.id); result.get(u.phaseKey).push(u); }
  for (const [k,ts] of result) ts.sort((a,b)=>a.order-b.order);
  return result;
}
function rollupPhaseDates(tasks) {
  if (tasks.length===0) return {start:null, end:null};
  const starts = tasks.map(t=>t.start).filter(Boolean);
  const ends   = tasks.map(t=>t.end).filter(Boolean);
  if (!starts.length||!ends.length) return {start:null,end:null};
  return { start:starts.reduce((a,b)=>a<b?a:b), end:ends.reduce((a,b)=>a>b?a:b) };
}
function removeTaskAndRecomputeProjectWide(allTasks, taskId) {
  const remaining = allTasks.filter(t=>t.id!==taskId).map(t => {
    const had = t.predecessorIds.includes(taskId);
    const newPreds = t.predecessorIds.filter(p=>p!==taskId);
    const lost = had && newPreds.length===0;
    return {...t, predecessorIds:newPreds, start:lost?null:t.start, end:lost?null:t.end};
  });
  return recomputeProjectTasks(remaining);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function ok(label, actual, expected) {
  if (actual !== expected) {
    console.error(`  FAIL  ${label}\n        expected: ${expected}\n        got:      ${actual}`);
    failed++;
  } else {
    console.log(`  PASS  ${label}: ${actual}`);
    passed++;
  }
}
function okBool(label, actual, expected) {
  ok(label, String(actual), String(expected));
}

let id = 0;
function task(phaseKey, overrides={}) {
  return {
    id: `t${++id}`,
    phaseKey,
    nama: overrides.nama ?? `Task ${id}`,
    durationMandays: overrides.durationMandays ?? 1,
    predecessorIds: overrides.predecessorIds ?? [],
    start: overrides.start ?? null,
    end: overrides.end ?? null,
    status: "NOT_STARTED",
    statusManualOverride: false,
    order: overrides.order ?? (id-1),
  };
}
function section(title) { console.log(`\n${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}`); }

// ─────────────────────────────────────────────────────────────────────────────
// TEST a: Basic §6.9 regression — task with no predecessor
// ─────────────────────────────────────────────────────────────────────────────
section("TEST a: §6.9 regression — no predecessor, start=null");
{
  id = 0;
  const A = task("development", { durationMandays:3 });
  const r = recomputeProjectTasks([A]);
  const a = r.get("development")[0];
  ok("A start stays null (no pred, no explicit start)", a.start, null);
  ok("A end stays null (no start → no end)", a.end, null);
}

section("TEST a2: §6.9 regression — no predecessor, explicit start set");
{
  id = 0;
  // Wed Jul 8 2026
  const A = task("development", { durationMandays:3, start:"2026-07-08" });
  const r = recomputeProjectTasks([A]);
  const a = r.get("development")[0];
  ok("A start (Wed Jul 8 preserved)", a.start, "2026-07-08");
  // 3 mandays: day1=Wed8, +2 extra = Thu9, Fri10
  ok("A end (3md from Wed = Fri)", a.end, "2026-07-10");
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST b: Same-phase predecessor chain A→B→C
// ─────────────────────────────────────────────────────────────────────────────
section("TEST b: Same-phase predecessor chain (§6.9 regression)");
{
  id = 0;
  const A = task("development", { durationMandays:3, start:"2026-07-08", order:0 }); // Wed
  const B = task("development", { durationMandays:2, predecessorIds:[A.id], order:1 });
  const C = task("development", { durationMandays:1, predecessorIds:[B.id], order:2 });
  const r = recomputeProjectTasks([A,B,C]);
  const [a,b,c] = [r.get("development")[0], r.get("development")[1], r.get("development")[2]];

  // A: Wed Jul 8 → Fri Jul 10
  ok("A.start", a.start, "2026-07-08");
  ok("A.end (3md)", a.end, "2026-07-10");
  // B: Fri Jul 10 +1 working day = Mon Jul 13; 2md → Tue Jul 14
  ok("B.start (Mon after Fri, weekend skipped)", b.start, "2026-07-13");
  ok("B.end (2md)", b.end, "2026-07-14");
  // C: Tue Jul 14 +1 = Wed Jul 15; 1md = same day
  ok("C.start", c.start, "2026-07-15");
  ok("C.end (1md = same day)", c.end, "2026-07-15");
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST c: Cross-phase predecessor — Testing task depends on Development task
// ─────────────────────────────────────────────────────────────────────────────
section("TEST c: Cross-phase predecessor (§6.10 new)");
{
  id = 0;
  // D1: development, 5 mandays, start Wed Jul 8
  //   Wed8→Thu9→Fri10→[skip Sat11,Sun12]→Mon13→Tue14  → end = Jul 14
  const D1 = task("development", { durationMandays:5, start:"2026-07-08", order:0 });
  // T1: testing, 3 mandays, predecessor=D1 (cross-phase)
  //   start = Tue Jul 14 + 1 working day = Wed Jul 15; 3md → Wed15,Thu16,Fri17
  const T1 = task("testing", { durationMandays:3, predecessorIds:[D1.id], order:0 });

  const allTasks = [D1, T1];
  const r = recomputeProjectTasks(allTasks);
  const d1 = r.get("development")[0];
  const t1 = r.get("testing")[0];

  ok("D1.start", d1.start, "2026-07-08");
  ok("D1.end (5md crosses weekend)", d1.end, "2026-07-14");
  ok("T1.start (cross-phase, day after D1.end)", t1.start, "2026-07-15");
  ok("T1.end (3md from Wed)", t1.end, "2026-07-17");

  // Also verify rollup: Development rollup uses only D1 dates (not T1)
  const devRollup = rollupPhaseDates(r.get("development"));
  const testRollup = rollupPhaseDates(r.get("testing"));
  ok("Dev rollup start (own tasks only)", devRollup.start, "2026-07-08");
  ok("Dev rollup end (own tasks only)", devRollup.end, "2026-07-14");
  ok("Test rollup start", testRollup.start, "2026-07-15");
  ok("Test rollup end", testRollup.end, "2026-07-17");
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST d: Cross-phase cycle detection
// D1 (development) has no preds.  T1 (testing) depends on D1.
// Try making D1 depend on T1 → D1→T1→D1 cycle, must be blocked.
// ─────────────────────────────────────────────────────────────────────────────
section("TEST d: Cross-phase cycle detection (§6.10 new)");
{
  id = 0;
  const D1 = task("development", { order:0 });
  const T1 = task("testing",     { predecessorIds:[D1.id], order:0 });
  const allTasks = [D1, T1];

  // T1 depends on D1. Try to make D1 depend on T1 → cycle D1→T1→D1.
  okBool(
    "D1 depends on T1 → cycle detected (cross-phase)",
    wouldCreateCycle(allTasks, D1.id, [T1.id]),
    true
  );

  // Confirm the valid direction is still allowed (T1 depends on D1 — already set)
  okBool(
    "T1 depends on D1 → no cycle (valid cross-phase dep)",
    wouldCreateCycle(allTasks, T1.id, [D1.id]),
    false
  );

  // Same-phase cycle still works correctly
  const D2 = task("development", { predecessorIds:[D1.id], order:1 });
  const sp = [D1, D2, T1];
  okBool(
    "D1 depends on D2 (D1←D2←D1 same-phase) → cycle detected",
    wouldCreateCycle(sp, D1.id, [D2.id]),
    true
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST e: Removal ripple — delete X (Development), Y (Testing) falls back to null
// ─────────────────────────────────────────────────────────────────────────────
section("TEST e: Removal — cross-phase predecessor deleted");
{
  id = 0;
  // X in development, start=Wed Jul 8, 3 mandays → end Fri Jul 10
  const X = task("development", { durationMandays:3, start:"2026-07-08", order:0 });
  // Y in testing, depends ONLY on X → start computed from X.end
  const Y = task("testing", { durationMandays:2, predecessorIds:[X.id], order:0 });

  // Verify initial computed state
  const before = recomputeProjectTasks([X, Y]);
  ok("Before delete: X.end", before.get("development")[0].end, "2026-07-10");
  ok("Before delete: Y.start (cross-phase from X)", before.get("testing")[0].start, "2026-07-13");
  ok("Before delete: Y.end", before.get("testing")[0].end, "2026-07-14");

  // Delete X — Y loses its only predecessor
  const after = removeTaskAndRecomputeProjectWide([X, Y], X.id);

  // X is gone from development
  ok("After delete: development task count", String(after.get("development").length), "0");
  // Y's predecessorIds should be empty
  const yAfter = after.get("testing")[0];
  ok("After delete: Y.predecessorIds is empty", String(yAfter.predecessorIds.length), "0");
  // Y.start must revert to null — it had no explicit start, only a computed one
  ok("After delete: Y.start reverts to null (needs manual start date)", yAfter.start, null);
  ok("After delete: Y.end reverts to null", yAfter.end, null);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST e2: Removal — Y has TWO predecessors; only one is deleted, other survives
// ─────────────────────────────────────────────────────────────────────────────
section("TEST e2: Removal — partial predecessor removal (other pred survives)");
{
  id = 0;
  const X  = task("development", { durationMandays:3, start:"2026-07-08", order:0 }); // ends Fri Jul 10
  const X2 = task("development", { durationMandays:1, start:"2026-07-09", order:1 }); // ends Thu Jul 9
  // Y depends on BOTH X and X2. MAX(X.end=Jul10, X2.end=Jul9)=Jul10 → Y.start=Jul13
  const Y = task("testing", { durationMandays:2, predecessorIds:[X.id, X2.id], order:0 });

  const before = recomputeProjectTasks([X, X2, Y]);
  ok("Before: Y.start (max of both preds = Jul13)", before.get("testing")[0].start, "2026-07-13");

  // Delete X (the later-ending one). X2 survives (ends Jul 9).
  // Y still has X2 as predecessor → Y.start = X2.end + 1 = Jul 9 + 1 = Jul 10 (Thu)
  const after = removeTaskAndRecomputeProjectWide([X, X2, Y], X.id);
  const yAfter = after.get("testing")[0];
  ok("After delete X: Y.predecessorIds has X2 only", String(yAfter.predecessorIds.length), "1");
  ok("After delete X: Y still has X2 as pred", yAfter.predecessorIds[0], X2.id);
  ok("After delete X: Y.start re-anchored to X2.end+1 (Jul10)", yAfter.start, "2026-07-10");
  ok("After delete X: Y NOT reverted to null (still has pred)", yAfter.start !== null ? "not-null" : "null", "not-null");
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(60)}`);
const total = passed + failed;
if (failed === 0) {
  console.log(`✓  ALL ${total} ASSERTIONS PASSED`);
} else {
  console.log(`✗  ${failed} of ${total} ASSERTIONS FAILED`);
}
process.exit(failed > 0 ? 1 : 0);
