/**
 * Manual verification script for task date computation (draft.md 6.9).
 * Run: npx tsx scripts/test-task-dates.ts
 */
import {
  addWorkingDays,
  computeEndDate,
  normalizeToWorkingDay,
  recomputePhaseTasks,
  todayISO,
} from "../src/utils/taskDates.ts";
import type { Task } from "../src/types/index.ts";

const TODAY = new Date(2026, 6, 8); // Wed Jul 8, 2026

function assert(label: string, actual: string | null, expected: string) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    process.exitCode = 1;
  } else {
    console.log(`OK   ${label}: ${actual}`);
  }
}

// Weekend skip: Fri + 1 working day = Mon
assert(
  "addWorkingDays Fri→Mon",
  addWorkingDays("2026-07-10", 1),
  "2026-07-13"
);

// 3 mandays from Wed Jul 8 → Fri Jul 10
assert(
  "computeEndDate 3 mandays",
  computeEndDate("2026-07-08", 3),
  "2026-07-10"
);

// Saturday normalizes to Monday
assert(
  "normalizeToWorkingDay Sat→Mon",
  normalizeToWorkingDay("2026-07-11"),
  "2026-07-13"
);

// A → B → C chain
const tasks: Task[] = [
  {
    id: "a",
    phaseKey: "development",
    nama: "Task A",
    durationMandays: 3,
    predecessorIds: [],
    start: null,
    end: null,
    status: "NOT_STARTED",
    statusManualOverride: false,
    order: 0,
  },
  {
    id: "b",
    phaseKey: "development",
    nama: "Task B",
    durationMandays: 2,
    predecessorIds: ["a"],
    start: null,
    end: null,
    status: "NOT_STARTED",
    statusManualOverride: false,
    order: 1,
  },
  {
    id: "c",
    phaseKey: "development",
    nama: "Task C",
    durationMandays: 1,
    predecessorIds: ["b"],
    start: null,
    end: null,
    status: "NOT_STARTED",
    statusManualOverride: false,
    order: 2,
  },
];

const result = recomputePhaseTasks(tasks, TODAY);
const a = result.find((t) => t.id === "a")!;
const b = result.find((t) => t.id === "b")!;
const c = result.find((t) => t.id === "c")!;

console.log(`\nChain test (today = ${todayISO(TODAY)}):`);
assert("Task A start", a.start, "2026-07-08");
assert("Task A end", a.end, "2026-07-10");
assert("Task B start (Mon after Fri)", b.start, "2026-07-13");
assert("Task B end", b.end, "2026-07-14");
assert("Task C start", c.start, "2026-07-15");
assert("Task C end", c.end, "2026-07-15");

if (process.exitCode !== 1) {
  console.log("\nAll task date tests passed.");
}
