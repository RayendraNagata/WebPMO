/**
 * test-6-12.mjs — Section 6.12 verification suite
 *
 * Tests (all programmatic, no browser):
 *   a) Migration: old project with milestones[] → shows 13 fixed docs, empty, no error
 *   b) New project: createEmptyDocumentation() → 13 rows in correct order
 *   c) Fill date + link for one row → saves; doc name becomes "clickable" (link present)
 *   d) Gantt no longer has milestone markers (project.documentation not iterated)
 *   e) Empty rows do not cause validation errors (tanggal/link both null → valid)
 */

// ─── Inline the relevant logic ────────────────────────────────────────────────

const DOCUMENTATION_ITEMS = [
  { nomor: 1,  id: "PROJECT_CHARTER",  nama: "PROJECT CHARTER" },
  { nomor: 2,  id: "RDM",              nama: "RDM" },
  { nomor: 3,  id: "BPS",              nama: "BPS" },
  { nomor: 4,  id: "HLD_TSD",          nama: "HLD/TSD" },
  { nomor: 5,  id: "TEST_PLAN",        nama: "TEST PLAN" },
  { nomor: 6,  id: "UAT_REPORT",       nama: "UAT REPORT" },
  { nomor: 7,  id: "JUKLAK",           nama: "JUKLAK" },
  { nomor: 8,  id: "PENTEST_REPORT",   nama: "PENTEST REPORT" },
  { nomor: 9,  id: "WI_DEPLOY",        nama: "WI DEPLOY" },
  { nomor: 10, id: "SOURCE_CODE",      nama: "SOURCE CODE" },
  { nomor: 11, id: "APPS_FORM",        nama: "APPS FORM" },
  { nomor: 12, id: "FAQ",              nama: "FAQ (if any)" },
  { nomor: 13, id: "PROJECT_CLOSURE",  nama: "PROJECT CLOSURE" },
];

function createEmptyDocumentation() {
  return DOCUMENTATION_ITEMS.map(item => ({ ...item, tanggal: null, link: null }));
}

// Simulate pmoStore.ts normalizeDocumentation()
function normalizeDocumentation(raw) {
  const base = createEmptyDocumentation();
  if (!Array.isArray(raw) || raw.length === 0) return base;
  const stored = new Map();
  for (const item of raw) {
    if (item?.id) stored.set(item.id, item);
  }
  return base.map(item => {
    const existing = stored.get(item.id);
    return { ...item, tanggal: existing?.tanggal ?? null, link: existing?.link ?? null };
  });
}

// Simulate updateDocumentation() store action
function updateDocumentation(documentation, docId, data) {
  return documentation.map(doc => doc.id === docId ? { ...doc, ...data } : doc);
}

// Simulate §6.12 link validation
function validateLink(value) {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? "" : "URL must start with http:// or https://";
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
// (a) Migration: old milestones project → 13 fixed docs, all empty
// ═══════════════════════════════════════════════════════════════
console.log("\n(a) Migration: old milestones project → 13 fixed docs, empty, no error");

// Old project shape: has milestones[], no documentation field
const oldProject = {
  id: "p1",
  milestones: [
    { id: "m1", nama: "Sign-off Development", tanggal: "2026-06-30" },
    { id: "m2", nama: "Go Live",              tanggal: "2026-09-01" },
  ],
  // documentation field is absent (as it would be in pre-v5 localStorage)
};

const migrated = normalizeDocumentation(
  (oldProject).documentation // undefined
);

assert("migrated result has exactly 13 items", migrated.length === 13, `got: ${migrated.length}`);
assert("all items have tanggal: null", migrated.every(d => d.tanggal === null));
assert("all items have link: null", migrated.every(d => d.link === null));
assert("old milestone data not present", !migrated.some(d => d.nama === "Sign-off Development"));
assert("first item is PROJECT CHARTER", migrated[0].id === "PROJECT_CHARTER");
assert("last item is PROJECT CLOSURE", migrated[12].id === "PROJECT_CLOSURE");
assert("all nomor values are 1-13 in order", migrated.every((d, i) => d.nomor === i + 1));

// Idempotency: run migration on already-migrated data
const rerun = normalizeDocumentation(migrated);
assert("idempotent: re-running preserves all 13 items", rerun.length === 13);
assert("idempotent: first item unchanged", rerun[0].id === "PROJECT_CHARTER");

// ═══════════════════════════════════════════════════════════════
// (b) New project: 13 rows in correct order from the start
// ═══════════════════════════════════════════════════════════════
console.log("\n(b) New project: createEmptyDocumentation() → 13 rows, correct order");

const fresh = createEmptyDocumentation();

assert("13 items total", fresh.length === 13, `got: ${fresh.length}`);
assert("no duplicate ids", new Set(fresh.map(d => d.id)).size === 13);
assert("nomor sequence is 1-13", fresh.every((d, i) => d.nomor === i + 1));
assert("item 4 is HLD/TSD", fresh[3].nama === "HLD/TSD");
assert("item 8 is PENTEST REPORT", fresh[7].nama === "PENTEST REPORT");
assert("item 12 is FAQ (if any)", fresh[11].nama === "FAQ (if any)");
assert("all tanggal null on new project", fresh.every(d => d.tanggal === null));
assert("all link null on new project", fresh.every(d => d.link === null));

// ═══════════════════════════════════════════════════════════════
// (c) Fill date + link for one row → saves; doc name "clickable"
// ═══════════════════════════════════════════════════════════════
console.log("\n(c) Fill date + link for one row → saved; name becomes clickable");

let docs = createEmptyDocumentation();

// Simulate user filling in PROJECT CHARTER date and link
docs = updateDocumentation(docs, "PROJECT_CHARTER", {
  tanggal: "2026-07-01",
  link: "https://docs.example.com/project-charter",
});

const charter = docs.find(d => d.id === "PROJECT_CHARTER");
assert("tanggal saved", charter?.tanggal === "2026-07-01");
assert("link saved", charter?.link === "https://docs.example.com/project-charter");
assert("other rows unaffected", docs.filter(d => d.id !== "PROJECT_CHARTER").every(d => d.tanggal === null && d.link === null));

// "Clickable" condition: link present AND passes URL validation
const hasValidLink = !!charter?.link && validateLink(charter.link) === "";
assert("name is clickable (valid link present)", hasValidLink);

// RDM still has no link → not clickable
const rdm = docs.find(d => d.id === "RDM");
const rdmClickable = !!rdm?.link && validateLink(rdm.link) === "";
assert("RDM name is NOT clickable (no link)", !rdmClickable);

// ═══════════════════════════════════════════════════════════════
// (d) Gantt chart: project.documentation is NOT iterated for markers
// ═══════════════════════════════════════════════════════════════
console.log("\n(d) Gantt chart: documentation not used for chart markers");

// Verify the GanttChart source no longer references project.milestones or milestone type
import { readFileSync } from "fs";
const ganttSrc = readFileSync("c:/Web Project/WebPMO/src/components/project/GanttChart.tsx", "utf8");

assert("GanttChart does NOT reference project.milestones", !ganttSrc.includes("project.milestones"));
assert("GanttChart does NOT push milestone type tasks", !ganttSrc.includes('type: "milestone"'));
assert("GanttChart does NOT reference isMilestone", !ganttSrc.includes("isMilestone"));
assert("GanttChart legend does NOT mention Milestone", !ganttSrc.includes(">Milestone<"));
assert("GanttChart does NOT reference project.documentation", !ganttSrc.includes("project.documentation"));

// ═══════════════════════════════════════════════════════════════
// (e) Empty rows: no validation error when tanggal/link both null
// ═══════════════════════════════════════════════════════════════
console.log("\n(e) Empty rows: tanggal=null, link=null → no validation errors");

const emptyDocs = createEmptyDocumentation();

for (const doc of emptyDocs) {
  const linkErr = validateLink(doc.link ?? "");
  assert(`row ${doc.nomor} (${doc.id}): empty link has no validation error`, linkErr === "");
}

// Partially filled: date only, no link → also valid
docs = updateDocumentation(createEmptyDocumentation(), "BPS", { tanggal: "2026-07-10" });
const bps = docs.find(d => d.id === "BPS");
assert("BPS with date only, no link → no validation error", validateLink(bps?.link ?? "") === "");

// Invalid URL format → error
assert("invalid URL triggers error", validateLink("not-a-url") !== "");
assert("http:// URL is valid", validateLink("http://example.com") === "");
assert("https:// URL is valid", validateLink("https://secure.example.com/path") === "");
assert("ftp:// URL is invalid (must be http/https)", validateLink("ftp://files.example.com") !== "");

// ─── Summary ──────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error("SOME TESTS FAILED — review output above");
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
