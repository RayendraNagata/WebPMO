/**
 * Holiday Calendar test suite (§6.10 Part B).
 * Tests a-d with actual computed dates.
 * Run with: node scripts/test-holidays.mjs
 */

// ── Inline logic (plain JS, mirrors taskDates.ts exactly) ──────────────────

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
function isNonWorking(date, holidays) {
  if (isWeekend(date)) return true;
  if (holidays.size > 0 && holidays.has(formatISODate(date))) return true;
  return false;
}
function normalizeToWorkingDay(iso, holidays = new Set()) {
  const d = parseISODate(iso);
  while (isNonWorking(d, holidays)) d.setDate(d.getDate() + 1);
  return formatISODate(d);
}
function addWorkingDays(iso, days, holidays = new Set()) {
  const d = parseISODate(iso);
  if (days === 0) return formatISODate(d);
  const step = days > 0 ? 1 : -1;
  let rem = Math.abs(days);
  while (rem > 0) {
    d.setDate(d.getDate() + step);
    if (!isNonWorking(d, holidays)) rem--;
  }
  return formatISODate(d);
}
function computeEndDate(start, dur, holidays = new Set()) {
  if (dur <= 0) return start;
  const extra = dur - 1;
  if (extra <= 0) return start;
  return addWorkingDays(start, extra, holidays);
}

// ── Assertions ─────────────────────────────────────────────────────────────

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
function section(title) {
  console.log(`\n${"═".repeat(62)}\n  ${title}\n${"═".repeat(62)}`);
}

// ─── Calendar reference ────────────────────────────────────────────────────
// Week of Jul 6-10 2026:  Mon=7, Tue=8, Wed=9, Thu=10, Fri=11 [skip Sat=12, Sun=13]
// Actually: let's verify day names for our test window
// Jul 6 2026 = Mon (confirmed)
// Jul 7 = Tue, Jul 8 = Wed, Jul 9 = Thu, Jul 10 = Fri
// Jul 11 = Sat, Jul 12 = Sun, Jul 13 = Mon

// ──────────────────────────────────────────────────────────────────────────
// TEST a: Task NOT crossing any holiday — dates unaffected
// Task: 5 mandays, start Mon Jul 6 2026. No holiday in range Jul 6-10.
// Holidays defined but none overlap this range.
// ──────────────────────────────────────────────────────────────────────────
section("TEST a: Task not crossing any holiday — dates unaffected");
{
  const holidays = new Set(["2026-08-17"]); // Aug 17 — far away from Jul
  // 5 mandays from Mon Jul 6: Mon6,Tue7,Wed8,Thu9,Fri10 → end = Fri Jul 10
  const end = computeEndDate("2026-07-06", 5, holidays);
  ok("5md Mon Jul 6 (no nearby holiday) → end Fri Jul 10", end, "2026-07-10");

  // Same without any holidays — must be identical
  const endNoHol = computeEndDate("2026-07-06", 5, new Set());
  ok("Same task without holidays → identical result", end, endNoHol);
}

// ──────────────────────────────────────────────────────────────────────────
// TEST b: Add a holiday within the range → end shifts by 1 day
// Task: 5 mandays, start Mon Jul 6.
// Add holiday on Wed Jul 8 (a working weekday inside the range).
//
// Without holiday: day1=Mon6, day2=Tue7, day3=Wed8, day4=Thu9, day5=Fri10 → end = Fri Jul 10
// With Wed Jul 8 as holiday (it's skipped, not counted as a working day):
//   day1=Mon6, day2=Tue7, [skip Wed8 holiday], day3=Thu9, day4=Fri10,
//   [skip Sat11, Sun12], day5=Mon13 → end = Mon Jul 13
//   (shifted by 3 calendar days — Fri10→Mon13 — because the holiday pushes day5
//    from Friday across the weekend to the next Monday)
// ──────────────────────────────────────────────────────────────────────────
section("TEST b: Holiday within range → end shifts (holiday pushes end across weekend)");
{
  const noHolidays = new Set();
  const withHoliday = new Set(["2026-07-08"]); // Wed Jul 8

  const endBefore = computeEndDate("2026-07-06", 5, noHolidays);
  ok("Before adding holiday: 5md Mon Jul 6 → Fri Jul 10", endBefore, "2026-07-10");

  const endAfter = computeEndDate("2026-07-06", 5, withHoliday);
  ok("After adding holiday Wed Jul 8: 5md Mon Jul 6 → Mon Jul 13", endAfter, "2026-07-13");

  // Fri Jul 10 → Mon Jul 13 = 3 calendar days difference
  const diffDays = (parseISODate(endAfter) - parseISODate(endBefore)) / (1000 * 86400);
  ok("Date difference is 3 calendar days (Fri→Mon: holiday pushed end across weekend)", String(diffDays), "3");
}

// ──────────────────────────────────────────────────────────────────────────
// TEST c: Delete that holiday → dates recompute back to original
// Simply re-run with empty holiday set — must match test a's result exactly.
// ──────────────────────────────────────────────────────────────────────────
section("TEST c: Remove holiday → dates recompute back to original");
{
  const withHoliday    = new Set(["2026-07-08"]);
  const holidayRemoved = new Set();               // simulates after delete

  const endWith    = computeEndDate("2026-07-06", 5, withHoliday);
  const endWithout = computeEndDate("2026-07-06", 5, holidayRemoved);

  ok("With holiday Wed Jul 8: end = Mon Jul 13", endWith, "2026-07-13");
  ok("After removing holiday: end back to Fri Jul 10", endWithout, "2026-07-10");
  ok("Restored matches original (no-holiday) result", endWithout, "2026-07-10");
}

// ──────────────────────────────────────────────────────────────────────────
// TEST d: Task spanning BOTH a weekend AND a custom holiday
// Task: 5 mandays, start Thu Jul 9 2026.
// There is a custom holiday on Mon Jul 13 (the first Mon after the weekend).
//
// Without holiday:
//   start=Thu9; +4 extra working days:
//   step1: Fri Jul 10 (rem=3)
//   step2: skip Sat Jul 11, Sun Jul 12; Mon Jul 13 (rem=2)
//   step3: Tue Jul 14 (rem=1)
//   step4: Wed Jul 15 (rem=0) → end = Wed Jul 15
//
// With holiday Mon Jul 13:
//   step1: Fri Jul 10 (rem=3)
//   step2: skip Sat Jul 11, Sun Jul 12; Mon Jul 13 → HOLIDAY, skip; Tue Jul 14 (rem=2)
//   step3: Wed Jul 15 (rem=1)
//   step4: Thu Jul 16 (rem=0) → end = Thu Jul 16
//   (both weekend AND holiday skipped)
// ──────────────────────────────────────────────────────────────────────────
section("TEST d: Spanning both a weekend AND a custom holiday");
{
  const noHolidays    = new Set();
  const monHoliday    = new Set(["2026-07-13"]); // Mon Jul 13

  // Verify Thu Jul 9 is correct start
  const dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][parseISODate("2026-07-09").getDay()];
  ok("2026-07-09 is a Thursday", dayName, "Thu");

  const endNoHol = computeEndDate("2026-07-09", 5, noHolidays);
  ok("5md Thu Jul 9 (no holiday): crosses Sat/Sun → end Wed Jul 15", endNoHol, "2026-07-15");

  const endWithHol = computeEndDate("2026-07-09", 5, monHoliday);
  ok("5md Thu Jul 9 (Mon Jul 13 holiday): crosses Sat+Sun+holiday → end Thu Jul 16", endWithHol, "2026-07-16");

  // The shift from no-holiday to with-holiday should be exactly 1 extra calendar day
  const diff = (parseISODate(endWithHol) - parseISODate(endNoHol)) / (1000 * 86400);
  ok("Shift = exactly 1 calendar day (one holiday skipped)", String(diff), "1");

  // Also verify addWorkingDays directly: Thu Jul 9 + 1 working day with Mon holiday
  // Should skip Fri10 NO wait — +1 from Thu9 is Fri10 (no holiday there)
  const nextDay = addWorkingDays("2026-07-09", 1, monHoliday);
  ok("Thu Jul 9 + 1 working day (no holiday on Fri) = Fri Jul 10", nextDay, "2026-07-10");

  // And: Fri Jul 10 + 1 working day with Mon holiday
  // Fri10 → skip Sat11, Sun12, then Mon13 is HOLIDAY → skip → Tue Jul 14
  const afterWeekendAndHoliday = addWorkingDays("2026-07-10", 1, monHoliday);
  ok("Fri Jul 10 + 1 working day (Mon 13 holiday): skips Sat+Sun+Mon → Tue Jul 14", afterWeekendAndHoliday, "2026-07-14");

  // normalizeToWorkingDay on Mon Jul 13 (holiday) → should advance to Tue Jul 14
  const normalized = normalizeToWorkingDay("2026-07-13", monHoliday);
  ok("normalizeToWorkingDay(Mon Jul 13, holiday) → Tue Jul 14", normalized, "2026-07-14");
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(62)}`);
const total = passed + failed;
if (failed === 0) {
  console.log(`✓  ALL ${total} ASSERTIONS PASSED`);
} else {
  console.log(`✗  ${failed} of ${total} ASSERTIONS FAILED`);
}
process.exit(failed > 0 ? 1 : 0);
