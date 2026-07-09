// Plain ESM — no TypeScript, no imports — just the functions inlined.
// Run with: node scripts/run-date-test.mjs

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}
function normalizeToWorkingDay(iso) {
  const date = parseISODate(iso);
  while (isWeekend(date)) date.setDate(date.getDate() + 1);
  return formatISODate(date);
}
function addWorkingDays(iso, days) {
  const date = parseISODate(iso);
  if (days === 0) return formatISODate(date);
  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    date.setDate(date.getDate() + step);
    if (!isWeekend(date)) remaining--;
  }
  return formatISODate(date);
}
function computeEndDate(start, dur) {
  if (dur <= 0) return start;
  const extra = dur - 1;
  if (extra <= 0) return start;
  return addWorkingDays(start, extra);
}

let failed = 0;
function assert(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL  ${label}\n      expected: ${expected}\n      got:      ${actual}`);
    failed++;
  } else {
    console.log(`OK    ${label}: ${actual}`);
  }
}

console.log("=== Weekend / working-day primitives ===");
assert("1 manday same day (Wed)", computeEndDate("2026-07-08", 1), "2026-07-08");
assert("Fri + 1 working day = Mon", addWorkingDays("2026-07-10", 1), "2026-07-13");
assert("Sat normalized to Mon", normalizeToWorkingDay("2026-07-11"), "2026-07-13");
assert("Sun normalized to Mon", normalizeToWorkingDay("2026-07-12"), "2026-07-13");

console.log("\n=== 5-manday trace (start = Wed 8 Jul 2026) ===");
// start = Wed Jul 8  (day 1)
// extra = 5-1 = 4 working days to add
// step1: Thu Jul 9  (day 2)
// step2: Fri Jul 10 (day 3)
// step3: Sat Jul 11 → skip; Sun Jul 12 → skip; Mon Jul 13 (day 4)
// step4: Tue Jul 14 (day 5) ← end
const end5 = computeEndDate("2026-07-08", 5);
assert("5 mandays Wed Jul 8 → end", end5, "2026-07-14");
console.log("  Calendar trace: Wed 8, Thu 9, Fri 10, [skip Sat 11, Sun 12], Mon 13, Tue 14");
console.log("  Weekends skipped: Sat Jul 11, Sun Jul 12 → CONFIRMED excluded");

console.log("\n=== A→B→C predecessor chain (today = Wed Jul 8) ===");
// Task A: 3 mandays, no predecessor, start = today (Jul 8 Wed)
const aStart = "2026-07-08";
const aEnd   = computeEndDate(aStart, 3);
// Task A: extra=2 → Thu 9, Fri 10
assert("A start", aStart, "2026-07-08");
assert("A end (3 md, Wed→Fri)", aEnd, "2026-07-10");

// Task B: 2 mandays, pred=A → start = aEnd + 1 working day
const bStart = addWorkingDays(aEnd, 1);   // Fri Jul 10 + 1 → Mon Jul 13
const bEnd   = computeEndDate(bStart, 2); // extra=1 → Tue Jul 14
assert("B start (Mon after Fri)", bStart, "2026-07-13");
assert("B end (2 md)", bEnd, "2026-07-14");

// Task C: 1 manday, pred=B → start = bEnd + 1 working day
const cStart = addWorkingDays(bEnd, 1);   // Tue Jul 14 + 1 → Wed Jul 15
const cEnd   = computeEndDate(cStart, 1); // 1 md = same day
assert("C start", cStart, "2026-07-15");
assert("C end (1 md = same day)", cEnd, "2026-07-15");

console.log(`\n${failed === 0 ? "ALL TESTS PASSED" : failed + " TESTS FAILED"}`);
process.exit(failed > 0 ? 1 : 0);
