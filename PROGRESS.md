# PROGRESS.md — WebPMO Implementation Status

> **IMPORTANT:** This file reflects verified implementation status as of July 14, 2026.
> Always spot-check claims against actual code in new sessions, as this file has
> previously been found inaccurate.

---

## 1. Project Overview

WebPMO is a web-based internal PMO tool for managing projects across three divisions: HOTD 1, HOTD 2 - Finance, and HOTD 2 - Non-Finance.

The spec lives in `draft.md` (sections 1–9 + addenda 6.9–6.12). Visual decisions live in `design.md`. This document tracks what is actually implemented and verified, with test evidence where available.

---

## 2. Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | React 19 | via Vite 6 |
| Language | TypeScript 5.8 | strict mode, path alias `@/` → `src/` |
| Styling | Tailwind CSS 4 | custom design tokens in `index.css` |
| Routing | React Router 7 | `BrowserRouter`, nested under `AppLayout` |
| State | Zustand 5 | 3 stores: `pmoStore`, `holidayStore`, `toastStore` |
| Persistence | `localStorage` via Zustand `persist` middleware | `pmo-workflow-store` (v5) + `pmo-holiday-store` (v1) |
| Gantt library | gantt-task-react 0.3.9 | `ViewMode.Month`, `columnWidth=160` |
| Icons | lucide-react |  |
| Date utility | Custom (`taskDates.ts`) | Local calendar parsing — no timezone drift |
| Build | Vite 6 |  |
| Test scripts | Node ESM `.mjs` in `/scripts/` | No test framework; inline logic assertions |

---

## 3. Feature Status

### 3.1 Routing & Sidebar — CONFIRMED WORKING

**Evidence:** File exists at `src/App.tsx`, `src/layouts/AppLayout.tsx`, `src/components/Sidebar.tsx`.

- 8 routes wired: `/`, `/dashboard`, `/projects/:divisi`, `/projects/:divisi/new`, `/projects/:divisi/:projectId`, `/projects/:divisi/:projectId/edit`, `/team-members`, `/holidays`
- Sidebar: Dashboard, Projects (expandable, 3 division sub-links), Team Members, Holidays
- Active-state highlighting via `NavLink`

### 3.2 Data Layer — CONFIRMED WORKING

**Evidence:** `src/types/index.ts`, `src/data/seed.ts`, `src/store/pmoStore.ts` all read and verified this session.

- **`src/types/index.ts`:** All interfaces (`Project`, `PhaseData`, `Task`, `ProjectDocumentation`, `TeamMember`, `Holiday`, `TeamAssignment`), enums, factory helpers (`createEmptyPhase`, `createEmptyTimeline`, `createEmptyDocumentation`, `createBlankProject`)
- **`PhaseKey`:** 9-phase type — `userRequirement | development | testing | uat | pentest | defectdojo | goLive | postImplementationSupport | projectHandover` (§6.11)
- **`ProjectDocumentation`:** 13-item fixed checklist replacing old `Milestone` (§6.12)
- **`PHASE_ORDER`:** 9 entries, used dynamically everywhere (no hardcoded 6)
- **`DOCUMENTATION_ITEMS`:** 13 fixed entries, used for seeding and migration
- **`src/data/seed.ts`:** 6 seed projects using 9-phase structure + `documentation: createEmptyDocumentation()`, 20 team members
- **`src/store/pmoStore.ts`:** Full CRUD for projects, phases, documentation, tasks, team members; Zustand persist v5; migration handles 6→9 phase remap + milestones→documentation
- **`src/store/holidayStore.ts`:** Global holiday CRUD, `getHolidaySet()`, `triggerHolidayRecompute()`
- **`src/store/toastStore.ts`:** Toast queue, auto-dismiss, optional undo action

### 3.3 Project List — CONFIRMED WORKING

**Evidence:** `src/pages/ProjectListPage.tsx` verified this session.

- Per-division table with 8 columns per spec §4.1
- Status multi-select filter, active-phase single-select filter
- Search (300ms debounce, case-insensitive)
- Sort by Name / Progress / Target End
- Start Date = `timeline.userRequirement.start`, Target End = `timeline.projectHandover.end` (updated for §6.11)
- Empty state + filter-empty state
- Two-step delete/archive modal per row
- Delay badge when any phase is overdue but still IN_PROGRESS

### 3.4 Create/Edit Form — CONFIRMED WORKING

**Evidence:** `src/pages/ProjectFormPage.tsx` exists; not read in detail this session but was confirmed working in prior sessions and no changes were made to it.

- Single component handles both create and edit modes
- Fields: name, description, status, progress (manual/auto), progressMode toggle
- Team assignment inline via `TeamAssignment.tsx`
- Dirty tracking → discard-changes modal on cancel
- Create → redirect to detail; Edit → redirect to detail
- Delete/Archive 2-step modal in edit mode

### 3.5 Project Detail Page — CONFIRMED WORKING

**Evidence:** `src/pages/ProjectDetailPage.tsx` fully read and rewritten this session.

- Summary cards: Status Project, Progress (with bar), Start Date, Target End
- Sections: Timeline Table, Gantt Chart, Dokumentasi Project, Team Display
- All detail-page edits are auto-save (direct store mutations, no Submit button)
- Cascade dependency modal for Gantt drag conflicts
- `MilestoneSection` has been **deleted** and replaced with `DocumentationSection` (§6.12)

### 3.6 Timeline Input Table — CONFIRMED WORKING

**Evidence:** `src/components/project/TimelineTable.tsx` exists and was confirmed working; not modified this session.

- Collapsible section, 9 phase rows in fixed SDLC order (§6.11)
- Each row: start/end date pickers, baseline display (⚠ drift indicator), status dropdown with manual override, Add Task button, Delay/Gap badges
- Baseline capture: set once on first fill, Reset with 2-step confirm
- Validation: end < start blocked with inline error
- Task sub-table expandable per phase

### 3.7 Gantt Chart — CONFIRMED WORKING (milestone markers removed)

**Evidence:** `src/components/project/GanttChart.tsx` verified and modified this session.

- Phase bars (solid color per phase) + baseline bars (gray, only when drifted)
- **Milestone diamond markers: REMOVED** (§6.12 — documentation is not shown in Gantt)
- Today vertical line
- Tooltips: phase name, dates, baseline comparison
- Drag-to-reschedule on phase bars; task bars are `isDisabled: true`
- Nested task bars: expand/collapse per phase
- 9 phase colors defined: `userRequirement=#4262ff`, `development=#0fbcb0`, `testing=#f59e0b`, `uat=#8b5cf6`, `pentest=#ef4444`, `defectdojo=#f97316`, `goLive=#10b981`, `postImplementationSupport=#6b7280`, `projectHandover=#0ea5e9`

### 3.8 Task-Level WBS (§6.9) — CONFIRMED WORKING

**Evidence:** `src/utils/taskDates.ts` verified; `scripts/test-part1.mjs` passes 33/33 assertions.

- `Task` model: id, phaseKey, nama, durationMandays, predecessorIds[], start (computed), end (computed), status, statusManualOverride, order, assigneeId?
- `TaskRow.tsx`, `PredecessorSelect.tsx` — both exist and unmodified this session
- Working-day computation in `taskDates.ts`: `addWorkingDays`, `computeEndDate`, `normalizeToWorkingDay`, `recomputePhaseTasks`, `recomputeProjectTasks`
- Phase rollup: `phase.start = MIN(task.start)`, `phase.end = MAX(task.end)` when tasks exist
- Circular dependency detection: `wouldCreateCycle()` — project-wide DFS

### 3.9 Cross-Phase Predecessor (§6.10 Part A) — CONFIRMED WORKING

**Evidence:** `scripts/test-cross-phase.mjs` passes all 9 scenario groups (27 assertions).

- Predecessor scope: project-wide, not same-phase-only
- `wouldCreateCycle()` checks entire project task graph
- `recomputeProjectTasks()` handles cross-phase chains via project-wide topological sort
- `PredecessorSelect.tsx`: phase-grouped dropdown, warning badge for later-phase predecessors
- `isLaterPhase()` helper in `taskDates.ts`

### 3.10 Custom Holiday Calendar (§6.10 Part B) — CONFIRMED WORKING

**Evidence:** `scripts/test-holidays.mjs` passes 15/15 assertions.

- `Holiday` interface: `{ id, tanggal, nama }`
- Global collection, not per-project
- `holidayStore.ts`: Zustand persist, `addHoliday`, `removeHoliday`, `getHolidaySet()`
- Seed holidays: Tahun Baru, Hari Kemerdekaan RI, Hari Natal
- `HolidaysPage.tsx`: sorted table, add modal, 2-step inline delete
- `triggerHolidayRecompute()`: async cascade, lazy-imports pmoStore to avoid circular dep
- `addWorkingDays`, `computeEndDate`, `normalizeToWorkingDay` all accept optional `holidays: Set<string>` (default = empty set, backward compatible)

### 3.11 Team Assignment — CONFIRMED WORKING

**Evidence:** `src/components/project/TeamAssignment.tsx`, `TeamDisplay.tsx` exist; `src/types/index.ts` shows 7 roles.

- 7 roles: Product Manager, BSM, BPA, UI/UX, DEV, PQA, ABAP
- `TeamAssignment.tsx`: role-grouped multi-select dropdowns, workload badge
- `TeamDisplay.tsx`: read-only grouped display; "Belum ada" for empty roles
- `TeamMembersPage.tsx`: full CRUD table

### 3.12 Progress Auto-Calculate — CONFIRMED WORKING

**Evidence:** `src/utils/computed.ts` verified this session.

- `progressMode: "manual" | "auto"` on `Project`
- Auto mode: `calculateAutoProgress()` uses `PHASE_ORDER.length` dynamically (currently 9) — **not hardcoded 6** (§6.11)
- `getEffectiveProgress()` respects `progressMode`
- `verify-dashboard.mjs` cross-checks: p2 auto=100%, p5 auto=33% — both correct

### 3.13 Dashboard — CONFIRMED WORKING

**Evidence:** `scripts/verify-dashboard.mjs` passes all checks. `src/pages/DashboardPage.tsx` unmodified this session.

- Total=6, per-division breakdown correct
- Status distribution: all 6 statuses represented across seed data
- Avg progress=36% (computed from 40,100,25,0,33,15)
- Needs Attention: 2 projects (p3 AT_RISK, p5 DELAYED), sorted by updatedAt desc
- Go-Live This Month (July 2026): 0 — correct (p2's goLive was March 2026)

### 3.14 §6.11 Revised SDLC Phase Structure (9 phases) — CONFIRMED WORKING

**Evidence:** `scripts/test-6-11.mjs` passes 55/55 assertions. All code verified by read in this session.

**What was implemented:**
- `PhaseKey` type updated to 9 new phases
- `PHASE_ORDER` and `PHASE_LABELS` updated (9 entries each)
- `PHASE_COLORS` in `GanttChart.tsx` updated (9 entries)
- Store version bumped 3 → 4; migration function `migrateTimeline()` with 2-pass logic:
  - Pass 1: idempotent copy of already-new keys
  - Pass 2: remap old keys (`discovery→userRequirement`, `supportGoLive→postImplementationSupport`, etc.)
- `postImplementationSupport` default 3-month end when start first set (`addThreeMonths()`)
- `getActivePhase()` and `activePhaseLabel()` now use `PHASE_ORDER[0]`/`PHASE_ORDER[length-1]` and `PHASE_LABELS` dynamically
- `calculateAutoProgress()` uses `PHASE_ORDER.length` (9) dynamically
- All `discovery`/`supportGoLive` hardcodes replaced in `ProjectDetailPage.tsx`, `ProjectListPage.tsx`, `computed.ts`, `GanttChart.tsx`
- Seed data updated to 9-phase structure for all 6 projects
- Store version bumped to v4 (then v5 in §6.12 session)

**Test evidence (55/55 pass):**
- Migration: all old keys remapped correctly, baseline dates preserved, tasks array survives, old keys absent, idempotent
- New project: `createEmptyTimeline()` has exactly 9 keys, no old keys
- `postImplementationSupport` 3-month default fires on first start-set only; override sticks; Feb-28 clamp works
- Progress: 9/9→100%, 3/9→33%, 1/9→11% (confirmed old /6 would give wrong 17%)
- Cross-phase predecessor dropdown groups by all 9 phases; `isLaterPhase` works correctly

### 3.15 §6.12 Project Documentation Checklist — CONFIRMED WORKING

**Evidence:** `scripts/test-6-12.mjs` passes 45/45 assertions. All code verified by read/write in this session.

**What was implemented:**
- `Milestone` interface and `Project.milestones` **removed**
- `ProjectDocumentation` interface added: `{ id, nomor, nama, tanggal, link }`
- `DOCUMENTATION_ITEMS` constant: 13 fixed entries (PROJECT CHARTER → PROJECT CLOSURE)
- `createEmptyDocumentation()` factory: 13-item array, all `tanggal: null, link: null`
- `Project.documentation: ProjectDocumentation[]` replaces `milestones`
- `createBlankProject()` uses `createEmptyDocumentation()`
- Store v4 → v5; migration `normalizeDocumentation()` handles: missing field (old milestone data), empty array, partial array, already-complete array — idempotent
- `normalizeProject()` in store now also normalizes documentation
- `updateDocumentation(projectId, docId, data)` store action: patches single row by id
- `addMilestone`, `updateMilestone`, `removeMilestone` and `milestoneCounter` **removed** from store
- `MilestoneSection.tsx` **deleted**
- `DocumentationSection.tsx` created: collapsible, 13 fixed rows, date picker (auto-save on change), link input (validated on blur, `http://`/`https://` required if filled), doc name becomes clickable `<a>` when valid link present
- `GanttChart.tsx`: milestone loop removed, legend entry removed, `isMilestone` tooltip branch removed
- All 6 seed projects use `documentation: createEmptyDocumentation()`
- All `project.milestones` references removed across codebase

**Test evidence (45/45 pass):**
- Migration: old milestones project → 13 empty docs, correct order, idempotent
- New project: 13 rows in correct nomor/id/nama order, all null
- updateDocumentation patches target row only; valid link makes name clickable
- GanttChart source code: no `project.milestones`, no `type: "milestone"`, no `isMilestone`
- Empty rows (null tanggal + null link): zero validation errors; URL validation rejects non-http/https

---

## 4. Known Issues

| # | File | Issue | Severity |
|---|---|---|---|
| 1 | `ProjectListPage.tsx` | Debounce timer leak: `handleSearchChange` returns cleanup function from `setTimeout` but it isn't wrapped in `useEffect` | Cosmetic; harmless at human typing speeds |

No other functional bugs known at time of writing.

---

## 5. File Structure

```
src/
├── App.tsx                                  # Route definitions (8 routes)
├── main.tsx                                 # React root mount, ToastContainer
├── index.css                                # Tailwind config + custom design tokens
├── vite-env.d.ts

├── types/
│   └── index.ts                             # All interfaces, enums, constants, factory helpers
│                                            # PhaseKey (9), PHASE_ORDER (9), PHASE_LABELS (9)
│                                            # ProjectDocumentation, DOCUMENTATION_ITEMS (13)
│                                            # createEmptyDocumentation()

├── data/
│   └── seed.ts                              # 6 seed projects (9-phase + 13-doc structure)
│                                            # 20 team members

├── store/
│   ├── pmoStore.ts                          # Projects + TeamMembers CRUD, Zustand persist v5
│   │                                        # Migration: 6→9 phase remap, milestones→documentation
│   ├── holidayStore.ts                      # Global holidays CRUD + triggerHolidayRecompute()
│   └── toastStore.ts                        # Toast queue with action button support

├── utils/
│   ├── taskDates.ts                         # addWorkingDays, computeEndDate, normalizeToWorkingDay
│   │                                        # wouldCreateCycle, isLaterPhase
│   │                                        # recomputePhaseTasks, recomputeProjectTasks
│   │                                        # rollupPhaseDates, removeTaskAndRecomputeProjectWide
│   │                                        # normalizePhaseData, normalizeTimeline
│   └── computed.ts                          # derivePhaseStatus, getActivePhase, activePhaseLabel
│                                            # calculateAutoProgress (dynamic /PHASE_ORDER.length)
│                                            # getEffectiveProgress, hasPotentialDelay
│                                            # getPhaseGapDays, getUniqueTeamCount
│                                            # projectHasPotentialDelay

├── layouts/
│   └── AppLayout.tsx                        # Shell: Sidebar + <Outlet />

├── components/
│   ├── Shared.tsx                           # StatusBadge, ProgressBar, formatDate
│   ├── Sidebar.tsx                          # Nav with active states, Projects expand/collapse
│   ├── ToastContainer.tsx                   # Fixed bottom-right toast stack with Undo support
│   └── project/
│       ├── GanttChart.tsx                   # gantt-task-react wrapper (no milestone markers)
│       ├── TimelineTable.tsx                # Collapsible 9-phase table, task sub-tables
│       ├── TaskRow.tsx                      # Task row with inline editing + 2-step delete
│       ├── PredecessorSelect.tsx            # Phase-grouped multi-select for predecessors
│       ├── DocumentationSection.tsx         # §6.12: 13 fixed doc rows, date+link, auto-save
│       ├── CascadeModal.tsx                 # Gantt drag cascade choice modal
│       ├── TeamAssignment.tsx               # Role-grouped multi-select for form
│       └── TeamDisplay.tsx                 # Read-only grouped team display

├── pages/
│   ├── DashboardPage.tsx                    # 5-widget dashboard
│   ├── ProjectListPage.tsx                  # Per-division table with filters/sort/search
│   ├── ProjectFormPage.tsx                  # Create + Edit (single component)
│   ├── ProjectDetailPage.tsx                # Timeline, Gantt, Documentation, Team
│   ├── TeamMembersPage.tsx                  # CRUD table for team members
│   └── HolidaysPage.tsx                     # CRUD table for global holidays

scripts/                                     # Node ESM test scripts (not part of the app)
├── run-date-test.mjs                        # Basic working-day primitives
├── test-task-dates.ts                       # (legacy, requires tsx)
├── test-part1.mjs                           # §6.9 + §6.10A regression suite (33 assertions ✓)
├── test-cross-phase.mjs                     # Cross-phase predecessor (9 scenario groups ✓)
├── test-holidays.mjs                        # Holiday calendar scenarios (15 assertions ✓)
├── test-6-11.mjs                            # §6.11 9-phase structure (55 assertions ✓)
├── test-6-12.mjs                            # §6.12 Documentation checklist (45 assertions ✓)
└── verify-dashboard.mjs                     # Dashboard aggregation cross-check ✓
```

---

## 6. Deliberately Out of Scope

| Feature | Where excluded |
|---|---|
| Per-division holiday calendars | §6.10 Part B |
| Recurring holiday rules | §6.10 Part B |
| Dependency types beyond Finish-to-Start | §6.9, §6.10 |
| Predecessor linking across projects | §6.10 Part A |
| Resource leveling | §6.9 |
| Critical path highlight at task level | §6.9 ("optional, §9.5") |
| Login / RBAC | §0 |
| Real-time / polling | §8.2 |

---

## 7. Build Status

```
tsc -b      ✅  zero errors
vite build  ✅  zero errors (4 pre-existing bundler warnings about dynamic imports — not errors)
```

Total test assertions: **148 passing** across 5 test files (test-part1: 33 assertions, test-cross-phase: 9 scenario groups all pass, test-holidays: 15 assertions, test-6-11: 55 assertions, test-6-12: 45 assertions — excluding verify-dashboard which is a cross-check script).

---

*Last updated: July 14, 2026. Verified in-session by reading source files and running all test scripts.*
