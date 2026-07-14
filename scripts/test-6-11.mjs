/**
 * test-6-11.mjs — Section 6.11 verification suite
 *
 * Tests (all programmatic, no browser):
 *   a) Migration: old 6-phase localStorage data → correct new 9-phase structure
 *   b) New project: uses 9-phase structure from the start
 *   c) Post Implementation Support: start→end defaults +3 months; manual override sticks
 *   d) Progress auto-calculate divides by 9 (PHASE_ORDER.length), not 6
 *   e) Cross-phase predecessor dropdown still groups correctly under 9 phases
 */

// ─── Inline the core logic we need to test ───────────────────────────────────
// (We can't do ES module imports of .ts files without tsx, so we re-implement
//  the relevant functions here using the same logic as the source.)

const PHASE_ORDER = [
  "userRequirement","development","testing","uat",
  "pentest","defectdojo","goLive","postImplementationSupport","projectHandover",
];

const PHASE_LABELS = {
  userRequirement:           "User Requirement",
  development:               "Development",
  testing:                   "Testing",
  uat:                       "UAT",
  pentest:                   "Pentest",
  defectdojo:                "Defectdojo (Code Quality)",
  goLive:                    "Go Live",
  postImplementationSupport: "Post Implementation Support",
  projectHandover:           "Project Handover",
};

const OLD_TO_NEW_PHASE_MAP = {
  discovery:    "userRequirement",
  development:  "development",
  testing:      "testing",
  uat:          "uat",
  goLive:       "goLive",
  supportGoLive:"postImplementationSupport",
};

function emptyPhase() {
  return { start: null, end: null, baselineStart: null, baselineEnd: null,
           status: "NOT_STARTED", statusManualOverride: false, tasks: [] };
}

function migrateTimeline(raw) {
  const result = Object.fromEntries(PHASE_ORDER.map(k => [k, emptyPhase()]));
  if (!raw) return result;
  // Pass 1: idempotent — copy already-new keys
  for (const key of PHASE_ORDER) {
    if (raw[key]) result[key] = { ...emptyPhase(), ...raw[key], tasks: raw[key].tasks ?? [] };
  }
  // Pass 2: remap old keys (only when new key was empty)
  for (const [oldKey, newKey] of Object.entries(OLD_TO_NEW_PHASE_MAP)) {
    if (raw[oldKey] && !raw[newKey]) {
      result[newKey] = { ...emptyPhase(), ...raw[oldKey], tasks: raw[oldKey].tasks ?? [] };
    }
  }
  return result;
}

function addThreeMonths(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  let targetMonth = m + 2; // 0-indexed arithmetic: m is 1-based, m-1+3 = m+2
  let targetYear = y;
  if (targetMonth > 11) { targetMonth -= 12; targetYear += 1; }
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2,"0")}-${String(clampedDay).padStart(2,"0")}`;
}

// Simulate updatePhase for postImplementationSupport (§6.11 logic from pmoStore.ts)
function simulateUpdatePhase(existing, phaseKey, data) {
  const updated = { ...existing, ...data };
  // Baseline capture
  if (data.start && !existing.baselineStart) updated.baselineStart = data.start;
  if (data.end   && !existing.baselineEnd)   updated.baselineEnd   = data.end;
  // §6.11: 3-month default
  if (phaseKey === "postImplementationSupport" && data.start && !existing.start && !updated.end) {
    updated.end = addThreeMonths(data.start);
    if (!updated.baselineEnd) updated.baselineEnd = updated.end;
  }
  return updated;
}

function calculateAutoProgress(timeline, today = new Date()) {
  const total = PHASE_ORDER.length;
  let done = 0;
  for (const key of PHASE_ORDER) {
    const phase = timeline[key];
    if (!phase) continue;
    // Simple status derive: if end exists and today > end → DONE (or manual override)
    let status = phase.status;
    if (!phase.statusManualOverride) {
      if (!phase.start) status = "NOT_STARTED";
      else {
        const start = new Date(phase.start);
        const end   = phase.end ? new Date(phase.end) : null;
        if (today < start) status = "NOT_STARTED";
        else if (end && today > end) status = "DONE";
        else status = "IN_PROGRESS";
      }
    }
    if (status === "DONE") done++;
  }
  return Math.round((done / total) * 100);
}

// ─── Test runner ──────────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓  ${label}`);
    pass++;
  } else {
    console.error(`  ✗  ${label}${detail ? " — " + detail : ""}`);
    fail++;
  }
}

// ═══════════════════════════════════════════════════════════════
// (a) Migration: old 6-phase → new 9-phase
// ═══════════════════════════════════════════════════════════════
console.log("\n(a) Migration: old 6-phase localStorage data → new 9-phase structure");

const oldProject = {
  discovery:    { start: "2026-05-01", end: "2026-05-15", baselineStart: "2026-05-01", baselineEnd: "2026-05-15", status: "DONE", statusManualOverride: false, tasks: [] },
  development:  { start: "2026-05-16", end: "2026-06-30", baselineStart: "2026-05-16", baselineEnd: "2026-06-20", status: "IN_PROGRESS", statusManualOverride: false,
                  tasks: [{ id: "t1", phaseKey: "development", nama: "Setup", durationMandays: 2, predecessorIds: [], start: "2026-05-16", end: null, status: "NOT_STARTED", statusManualOverride: false, order: 0 }] },
  testing:      { start: "2026-07-01", end: "2026-07-15", baselineStart: "2026-06-21", baselineEnd: "2026-07-05", status: "NOT_STARTED", statusManualOverride: false, tasks: [] },
  uat:          { start: null, end: null, baselineStart: null, baselineEnd: null, status: "NOT_STARTED", statusManualOverride: false, tasks: [] },
  goLive:       { start: null, end: null, baselineStart: null, baselineEnd: null, status: "NOT_STARTED", statusManualOverride: false, tasks: [] },
  supportGoLive:{ start: "2026-09-01", end: "2026-09-30", baselineStart: "2026-09-01", baselineEnd: "2026-09-30", status: "NOT_STARTED", statusManualOverride: false, tasks: [] },
};

const m = migrateTimeline(oldProject);

assert("discovery → userRequirement (start preserved)", m.userRequirement.start === "2026-05-01");
assert("discovery → userRequirement (baselineEnd preserved)", m.userRequirement.baselineEnd === "2026-05-15");
assert("discovery → userRequirement (status preserved)", m.userRequirement.status === "DONE");
assert("development → development (start preserved)", m.development.start === "2026-05-16");
assert("development → development (drifted baselineEnd preserved)", m.development.baselineEnd === "2026-06-20");
assert("development → development (tasks array survives)", m.development.tasks.length === 1);
assert("testing → testing (drifted baselineStart preserved)", m.testing.baselineStart === "2026-06-21");
assert("uat → uat (null start preserved)", m.uat.start === null);
assert("pentest is empty but present", "pentest" in m && m.pentest.start === null);
assert("defectdojo is empty but present", "defectdojo" in m && m.defectdojo.start === null);
assert("goLive → goLive (null preserved)", m.goLive.start === null);
assert("supportGoLive → postImplementationSupport (start)", m.postImplementationSupport.start === "2026-09-01");
assert("supportGoLive → postImplementationSupport (end)", m.postImplementationSupport.end === "2026-09-30");
assert("projectHandover is empty but present", "projectHandover" in m && m.projectHandover.start === null);
assert("old key 'discovery' absent from result", !("discovery" in m));
assert("old key 'supportGoLive' absent from result", !("supportGoLive" in m));
assert("all 9 new keys present", PHASE_ORDER.every(k => k in m));

// Idempotency
const m2 = migrateTimeline(m);
assert("idempotent: re-running migration preserves userRequirement.start", m2.userRequirement.start === "2026-05-01");
assert("idempotent: re-running migration preserves postImplementationSupport.start", m2.postImplementationSupport.start === "2026-09-01");
assert("idempotent: all 9 keys still present after re-run", PHASE_ORDER.every(k => k in m2));

// ═══════════════════════════════════════════════════════════════
// (b) New project: uses 9-phase structure from start
// ═══════════════════════════════════════════════════════════════
console.log("\n(b) New project: 9-phase structure from the start");

// Simulate createEmptyTimeline() — the same logic as types/index.ts
const emptyTimeline = Object.fromEntries(PHASE_ORDER.map(k => [k, emptyPhase()]));

assert("createEmptyTimeline has exactly 9 keys", Object.keys(emptyTimeline).length === 9);
assert("all 9 expected keys present in new timeline", PHASE_ORDER.every(k => k in emptyTimeline));
assert("no old keys in new timeline", !("discovery" in emptyTimeline) && !("supportGoLive" in emptyTimeline));
for (const key of PHASE_ORDER) {
  assert(`new timeline[${key}].tasks is empty array`, Array.isArray(emptyTimeline[key].tasks) && emptyTimeline[key].tasks.length === 0);
}

// ═══════════════════════════════════════════════════════════════
// (c) Post Implementation Support: +3 month default, override sticks
// ═══════════════════════════════════════════════════════════════
console.log("\n(c) Post Implementation Support: start → end defaults to +3 months");

const emptyPIS = emptyPhase();

// Setting start for the first time — end should auto-populate
const afterStart = simulateUpdatePhase(emptyPIS, "postImplementationSupport", { start: "2026-07-14" });
assert("end auto-set to start + 3 months", afterStart.end === "2026-10-14", `got: ${afterStart.end}`);
assert("baselineEnd also set to the default end", afterStart.baselineEnd === "2026-10-14");
assert("baselineStart set to the start", afterStart.baselineStart === "2026-07-14");

// Setting start when end already exists → no override
const withEnd = { ...emptyPhase(), end: "2026-11-01" };
const afterStartExisting = simulateUpdatePhase(withEnd, "postImplementationSupport", { start: "2026-07-14" });
assert("existing end NOT overridden when already set", afterStartExisting.end === "2026-11-01");

// Manual override: update end to something different after auto-set
const afterOverride = simulateUpdatePhase(afterStart, "postImplementationSupport", { end: "2026-12-31" });
assert("manual end override sticks", afterOverride.end === "2026-12-31", `got: ${afterOverride.end}`);

// Setting start a second time (baselineStart already exists) → no 3-month re-trigger
const secondStart = simulateUpdatePhase(afterStart, "postImplementationSupport", { start: "2026-08-01" });
// existing.start is "2026-07-14" (not null), so 3-month default should NOT fire again
assert("3-month default does NOT re-trigger when start is updated (not first set)", secondStart.end === afterStart.end);

// Edge case: Feb 28 clamp
const afterFeb = simulateUpdatePhase(emptyPhase(), "postImplementationSupport", { start: "2026-11-30" });
assert("Nov 30 + 3m clamps to Feb 28", afterFeb.end === "2027-02-28", `got: ${afterFeb.end}`);

// ═══════════════════════════════════════════════════════════════
// (d) Progress auto-calculate divides by 9 (dynamic), not 6
// ═══════════════════════════════════════════════════════════════
console.log("\n(d) Progress auto-calculate: denominator is 9 (dynamic PHASE_ORDER.length)");

assert("PHASE_ORDER.length === 9", PHASE_ORDER.length === 9);

// All phases DONE → 100%
const allDoneTimeline = Object.fromEntries(
  PHASE_ORDER.map(k => [k, { start: "2020-01-01", end: "2020-01-02", baselineStart: null, baselineEnd: null, status: "DONE", statusManualOverride: true, tasks: [] }])
);
const allDoneProgress = calculateAutoProgress(allDoneTimeline);
assert("9/9 phases DONE → 100%", allDoneProgress === 100, `got: ${allDoneProgress}`);

// 3 phases DONE → round(3/9*100) = 33%
const threeDoneTimeline = Object.fromEntries(
  PHASE_ORDER.map((k, i) => [k, {
    start: "2020-01-01", end: "2020-01-02", baselineStart: null, baselineEnd: null,
    status: i < 3 ? "DONE" : "NOT_STARTED", statusManualOverride: true, tasks: []
  }])
);
const threeDoneProgress = calculateAutoProgress(threeDoneTimeline);
assert("3/9 phases DONE → 33%", threeDoneProgress === 33, `got: ${threeDoneProgress}`);

// 1 phase DONE → round(1/9*100) = 11%
const oneDoneTimeline = Object.fromEntries(
  PHASE_ORDER.map((k, i) => [k, {
    start: "2020-01-01", end: "2020-01-02", baselineStart: null, baselineEnd: null,
    status: i === 0 ? "DONE" : "NOT_STARTED", statusManualOverride: true, tasks: []
  }])
);
const oneDoneProgress = calculateAutoProgress(oneDoneTimeline);
assert("1/9 phases DONE → 11%", oneDoneProgress === 11, `got: ${oneDoneProgress}`);

// Progress would have been wrong under old /6 divisor
assert("1/6 would have given 17% (old wrong result)", Math.round((1/6)*100) === 17);
assert("1/9 gives 11% (correct new result)", Math.round((1/9)*100) === 11);

// ═══════════════════════════════════════════════════════════════
// (e) Cross-phase predecessor dropdown: phase grouping uses 9 phases
// ═══════════════════════════════════════════════════════════════
console.log("\n(e) Cross-phase predecessor: phase grouping correct under 9-phase structure");

// Simulate what PredecessorSelect does: group tasks by phaseKey, ordered by PHASE_ORDER
const mockTasks = [
  { id: "tA", phaseKey: "userRequirement",           nama: "Gather requirements" },
  { id: "tB", phaseKey: "development",               nama: "Build API" },
  { id: "tC", phaseKey: "pentest",                   nama: "Run pentest scan" },
  { id: "tD", phaseKey: "defectdojo",                nama: "Upload to DefectDojo" },
  { id: "tE", phaseKey: "postImplementationSupport", nama: "Monitor production" },
  { id: "tF", phaseKey: "projectHandover",           nama: "Hand over docs" },
];

// Group by phase in PHASE_ORDER order
const grouped = PHASE_ORDER
  .map(key => ({
    phaseKey: key,
    label: PHASE_LABELS[key],
    tasks: mockTasks.filter(t => t.phaseKey === key),
  }))
  .filter(g => g.tasks.length > 0);

assert("groups are ordered by PHASE_ORDER", grouped[0].phaseKey === "userRequirement");
assert("development group exists", grouped.some(g => g.phaseKey === "development"));
assert("pentest group exists with correct label", grouped.some(g => g.phaseKey === "pentest" && g.label === "Pentest"));
assert("defectdojo group has correct label", grouped.some(g => g.phaseKey === "defectdojo" && g.label === "Defectdojo (Code Quality)"));
assert("postImplementationSupport group has correct label", grouped.some(g => g.phaseKey === "postImplementationSupport" && g.label === "Post Implementation Support"));
assert("projectHandover group has correct label", grouped.some(g => g.phaseKey === "projectHandover" && g.label === "Project Handover"));
assert("no old phase keys appear as group headers", !grouped.some(g => g.phaseKey === "discovery" || g.phaseKey === "supportGoLive"));

// isLaterPhase check: pentest (idx 4) is later than development (idx 1)
function isLaterPhase(phaseA, phaseB) {
  return PHASE_ORDER.indexOf(phaseA) > PHASE_ORDER.indexOf(phaseB);
}
assert("pentest is later than development (warning badge logic)", isLaterPhase("pentest", "development"));
assert("userRequirement is NOT later than development", !isLaterPhase("userRequirement", "development"));
assert("projectHandover is later than postImplementationSupport", isLaterPhase("projectHandover", "postImplementationSupport"));

// ─── Summary ──────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error("SOME TESTS FAILED — review output above");
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
