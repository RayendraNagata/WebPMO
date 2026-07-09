# PROGRESS.md — WebPMO Project Status

> **Purpose:** Handoff document + feature reference. Valid as of the session that completed the full polish pass. Use this to orient any new AI session or team member on what exists, how it's structured, and what comes next.

---

## 1. Project Overview

**WebPMO** is a web-based internal PMO (Project Management Office) tool for managing projects across three organizational divisions: HOTD 1, HOTD 2 - Finance, and HOTD 2 - Non-Finance.

The original scope (`draft.md`, sections 1–9) covered project CRUD, a Gantt chart with drag-reschedule and cascade dependency, milestones, team assignment, progress tracking, and a dashboard. Mid-development, two substantial addenda extended the scope significantly:

- **Section 6.9 — Task-Level WBS:** breakdown of each SDLC phase into individual tasks with working-day duration computation, predecessor chains, cascade recompute, and nested Gantt rendering.
- **Section 6.10 — Cross-Phase Predecessor & Custom Holiday Calendar:** predecessors can now span phases project-wide (not just within one phase), with a phase-grouped dropdown, project-wide cycle detection, and a global holiday calendar that excludes additional non-working days from all date calculations.

**Source of truth:** `draft.md` (spec + all addenda), `design.md` (visual/styling decisions). Neither file should be modified lightly — the implementation tracks them closely.

---

## 2. Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **React 19** | via Vite 6 |
| Language | **TypeScript 5.7** | strict mode, path alias `@/` → `src/` |
| Styling | **Tailwind CSS 4** | custom design tokens in `index.css`; no component library |
| Routing | **React Router 7** | `BrowserRouter`, nested under a shared `AppLayout` |
| State | **Zustand 5** | 3 stores: `pmoStore`, `holidayStore`, `toastStore` |
| Persistence | **localStorage** via Zustand `persist` middleware | `pmo-workflow-store` (v2) + `pmo-holiday-store` (v1); migration callbacks handle schema upgrades |
| Gantt library | **gantt-task-react 0.3.9** | `ViewMode.Month`, `columnWidth=160`; contained with CSS `contain: strict` to prevent page-stretch |
| Icons | **lucide-react 1.23** | |
| Date utility | **date-fns 4** (installed but not used directly) | All date math is in `taskDates.ts` using local calendar parsing — no timezone drift |
| Build | **Vite 6** | |
| Test scripts | Node ESM `.mjs` scripts in `/scripts/` | No test framework; pure inline logic assertions |

---

## 3. Feature Status

### 3.1 Routing & Sidebar — ✅ DONE

- All 7 routes wired in `App.tsx`: `/`, `/dashboard`, `/projects/:divisi`, `/projects/:divisi/new`, `/projects/:divisi/:projectId`, `/projects/:divisi/:projectId/edit`, `/team-members`, `/holidays`
- `Sidebar.tsx`: Dashboard, Projects (expandable with 3 division sub-links), Team Members, Holidays
- Active-state highlighting via `NavLink` with `isActive` class logic
- Projects section expand/collapse persists within the session (local `useState`, resets on reload — by design)

### 3.2 Data Layer — ✅ DONE

- **`src/types/index.ts`:** all interfaces (`Project`, `PhaseData`, `Task`, `Milestone`, `TeamMember`, `Holiday`, `TeamAssignment`), enums/const arrays (`PHASE_ORDER`, `PHASE_LABELS`, `DIVISI_LABELS`, etc.), helper factories (`createEmptyPhase`, `createEmptyTimeline`, `createBlankProject`)
- **`src/data/seed.ts`:** 6 seed projects across all 3 divisions (covering all `ProjectStatus` values), 12 seed team members, seed tasks on p1's development phase (5 chained tasks)
- **`src/store/pmoStore.ts`:** full CRUD for projects, phases, milestones, tasks, team members; Zustand persist with v2 migration; exports `getAllProjectTasks()` helper
- **`src/store/holidayStore.ts`:** global holiday CRUD, seed holidays, `getHolidaySet()`, `triggerHolidayRecompute()` async cascade function
- **`src/store/toastStore.ts`:** toast queue with auto-dismiss, configurable duration, optional action button (used for milestone undo)

### 3.3 Project List — ✅ DONE

- One page (`ProjectListPage.tsx`) handles all 3 divisions via `:divisi` param
- All 8 spec columns: Name (with Delay badge), Status, Active Phase, Progress (bar + %), Start, Target End, Team count, Actions
- Filters: status multi-select (with Clear), active phase single-select
- Search: case-insensitive substring, 300ms debounce
- Sort: Name / Progress / Target End, toggle asc/desc
- Empty state: icon + "Belum ada project di divisi ini" + Create CTA
- Filter-empty state: "No projects match your filters" in table body
- Two-step delete/archive modal per row
- Delay badge next to project name when any phase is overdue but still IN_PROGRESS

### 3.4 Create/Edit Form — ✅ DONE

- Single component `ProjectFormPage.tsx` handles both modes (`isEdit` detection from `projectId` param)
- Fields: name (required, 3–100 chars, counter), description (optional, max 500, counter), status (all 6 options), progress (manual number input or auto-calculated read-only), progressMode toggle with confirmation modal
- Team assignment inline via `TeamAssignment.tsx`
- Dirty tracking → discard-changes modal on cancel
- Create: redirect to detail page
- Edit: redirect to detail page
- Delete/Archive: 2-step modal (Archive recommended / Delete Permanently) — only appears in edit mode
- "Manage Timeline & Team" button in edit mode navigates to detail (with dirty-check)

### 3.5 Project Detail Page — ✅ DONE

- `ProjectDetailPage.tsx`: summary cards (active phase, progress with bar, start date, target end), then Timeline Table, Gantt Chart, Milestones, Team Display sections
- All detail-page changes are **auto-save** (direct store mutations, no Submit button) per §9
- Cascade dependency modal (`CascadeModal.tsx`) for Gantt drag conflicts

### 3.6 Timeline Input Table — ✅ DONE

- `TimelineTable.tsx`: collapsible section, 6 phase rows in fixed SDLC order
- Each row: start/end date pickers, baseline display (with ⚠ when drifted), status dropdown (with manual override indicator), Add Task button, Delay/Gap badges
- Baseline capture: set once on first fill, Reset baseline with 2-step confirm
- Validation: end < start blocked with inline error
- Gap warning badge (+Xd) between phases
- Delay badge when phase past end but still IN_PROGRESS
- Task sub-table: expandable per phase, shows all tasks with full TaskRow

### 3.7 Gantt Chart — ✅ DONE

- `GanttChart.tsx`: uses `gantt-task-react` in `ViewMode.Month`
- Phase bars (solid color) + baseline bars (gray, only when different from actual)
- Milestones as diamond markers
- Today vertical line (built into library via `todayColor`)
- Tooltips: phase name, dates, baseline comparison, "Computed from duration & predecessors" for task bars
- Drag-to-reschedule: fires `onDateChange` → cascade overlap check → `CascadeModal` or direct update
- Nested task bars: expand/collapse per phase via `type: "project"` + `hideChildren`; task bars are `isDisabled: true` (computed, no drag); lighter tint color per phase
- Gantt container: `contain: strict` + fixed pixel height prevents SVG content from stretching the page
- Legend shows phase colors + task count

### 3.8 Task-Level WBS (§6.9) — ✅ DONE

- `Task` model: `id`, `phaseKey`, `nama`, `durationMandays`, `predecessorIds[]`, `start` (computed), `end` (computed), `status`, `statusManualOverride`, `order`, `assigneeId?`
- `TaskRow.tsx`: name input, duration number input, predecessor dropdown, start (editable when no predecessors / read-only when computed), end (always read-only), assignee dropdown, status dropdown (amber when manually overridden), 2-step inline delete
- `PredecessorSelect.tsx`: multi-select dropdown, grouped by phase (§6.10 upgrade), search across all phases, chips with × for selected predecessors, clear-all option
- Working-day computation in `taskDates.ts`:
  - `addWorkingDays(iso, days, holidays?)` — skips Sat/Sun + any holiday dates
  - `computeEndDate(start, duration, holidays?)` — 1 manday = same day
  - `normalizeToWorkingDay(iso, holidays?)` — snaps weekends/holidays forward
  - `recomputePhaseTasks()` — per-phase topological sort + date propagation
  - `recomputeProjectTasks()` — project-wide topological sort, returns `Map<PhaseKey, Task[]>`
- Cascade recompute: every `updateTask` call → `applyPhaseTaskUpdate` → `normalizePhaseData` → full phase recompute
- Phase rollup: when `tasks.length > 0`, `phase.start = MIN(task.start)`, `phase.end = MAX(task.end)` via `rollupPhaseDates()`
- Circular dependency: `wouldCreateCycle()` DFS check (project-wide since §6.10); blocks save + shows inline red error in `PredecessorSelect`
- Task deletion: `removeTaskAndRecomputeProjectWide()` nulls `start`/`end` on tasks that lose their only predecessor (date picker re-enables)
- localStorage migration: 3-layer defense (`migrate` callback + `normalizeProject` + `createEmptyPhase()` fallback)
- Seed data: p1 development phase has 5 chained tasks (t1–t5)

### 3.9 Cross-Phase Predecessor (§6.10 Part A) — ✅ DONE

- Predecessor scope expanded from same-phase-only to **project-wide**
- `wouldCreateCycle()` takes full flat task list across all phases
- `recomputeProjectTasks()` handles cross-phase dependency chains via project-wide topological sort
- `PredecessorSelect.tsx` groups options by phase header (sticky), searches across all phases
- Warning badge (amber chip + `AlertTriangle` icon) on chips for predecessors from a **later** phase (non-blocking, per spec)
- `isLaterPhase(phaseA, phaseB)` helper in `taskDates.ts`
- `updateTask` in store uses `getAllProjectTasks(project)` for cycle check (not just single phase)
- `removeTask` uses `removeTaskAndRecomputeProjectWide()` (handles cross-phase predecessor cleanup)
- **Tested:** 9-scenario test suite in `scripts/test-cross-phase.mjs` (27 assertions, all pass)

### 3.10 Custom Holiday Calendar (§6.10 Part B) — ✅ DONE

- `Holiday` interface: `{ id, tanggal: string (ISO date), nama: string }`
- **Global** collection — not per-project; affects all working-day calculations
- `holidayStore.ts`: Zustand + persist, `addHoliday`, `removeHoliday`, `getHolidaySet()` → `Set<string>`
- Seed holidays: Tahun Baru (2026-01-01, Thu), Hari Kemerdekaan RI (2026-08-17, Mon), Hari Natal (2026-12-25, Fri)
- `HolidaysPage.tsx`: sorted table, "+ Add Holiday" modal (date + name, validation), 2-step inline delete (trash → "Remove? Yes/No")
- Route `/holidays` + "Holidays" sidebar nav item (`CalendarX` icon)
- `triggerHolidayRecompute()` in `holidayStore.ts`: async, lazy-imports `pmoStore` to avoid circular dep, iterates all projects and re-runs `recomputeProjectTasks(allTasks, today, holidaySet)` on each
- `addWorkingDays`, `computeEndDate`, `normalizeToWorkingDay` all accept optional `holidays: Set<string>` param (default = empty set → backward compatible)
- `pmoStore` calls `getHolidays()` on every recompute path (`normalizeProject`, `applyPhaseTaskUpdate`, `removeTask`)
- **Tested:** `scripts/test-holidays.mjs` (15 assertions, all pass); verifies no-overlap case, holiday-shifts-end, undo-to-original, weekend+holiday combined

### 3.11 Team Assignment — ✅ DONE

- `TeamAssignment.tsx`: role-grouped multi-select dropdowns (BPA / DEV / PQA), each with search, active-only filtering, chips with × remove, workload badge (project count) per member
- `TeamDisplay.tsx`: read-only grouped display on detail page; shows "Belum ada" for empty roles
- `TeamMembersPage.tsx`: full CRUD table — role/status filter, add/edit modal (name, role, active toggle), inline active toggle (single click), 2-step inline delete
- All 3 store actions (`createMember`, `updateMember`, `deleteMember`) confirmed wired

### 3.12 Progress Auto-Calculate — ✅ DONE

- `progressMode: "manual" | "auto"` field on `Project`
- Auto mode: `calculateAutoProgress()` counts `DONE` phases / 6 × 100, `Math.round`
- `getEffectiveProgress()` respects `progressMode`
- Toggle in Create/Edit form with confirmation modal on switching to auto
- Read-only display in auto mode with "Calculated automatically" label
- Used throughout: project list progress bar, detail page summary card, dashboard aggregations

### 3.13 Dashboard — ✅ DONE (`DashboardPage.tsx`)

All 5 §8.1 widgets implemented, computed fresh on every render (no caching, per §9):

1. **Total projects + per-division breakdown** — stat cards + clickable division rows with avg progress
2. **Status distribution** — CSS horizontal bar chart, all 6 `ProjectStatus` values, count + %
3. **Average progress** — overall + per-division with `ProgressBar`; uses `getEffectiveProgress()` (respects manual/auto mode); task-level data has zero effect on this calculation (progress is project-level only)
4. **Needs Attention** — AT_RISK + DELAYED, sorted by `updatedAt` desc, max 10 with "+ N more"; "All projects on track!" empty state
5. **Go-Live This Month** — `goLive.start ≤ monthEnd AND goLive.end ≥ monthStart`; "No go-live events this month" empty state

Cross-checked numerically against seed data: total=6, avg progress=36%, AT_RISK/DELAYED=2 (p3 Jul-5 first, p5 Jun-25 second), Go-Live count=0 for July 2026.

### 3.14 General Conventions Polish — ✅ DONE

- **Loading states:** no async data loading except `triggerHolidayRecompute()`; `HolidaysPage` disables Add button via `submitting` state during async call
- **Empty states:** all lists have message + CTA; "No tasks" handled by always-visible Add Task button + the task sub-table only renders when tasks exist
- **Toasts:** every create/edit/delete action fires a toast; error toast for cycle detection; milestone uses undo toast with 5-second Undo action; double-toast bug fixed (removed redundant `addToast` from `handleRemoveMilestone` in `ProjectDetailPage`)
- **Date formatting:** `formatDate()` in `Shared.tsx` — local calendar parsing (no UTC shift bug), DD MMM YYYY throughout; all `new Date(isoString)` calls replaced with `parseISODate()` across computed.ts, GanttChart, ProjectDetailPage, DashboardPage
- **Percentages:** `Math.round` upstream, `{value}%` everywhere
- **Auto-save:** all detail-page edits (timeline, tasks, milestones, Gantt drag) commit directly to store — no Submit button; Create/Edit form retains explicit submit
- **Destructive confirmations:** project delete (2-step modal, 3 locations), milestone delete (undo toast §6.7), holiday delete (2-step inline), task delete (2-step inline — fixed from browser `confirm()`), team member delete (2-step inline)

---

## 4. Known Issues

| # | File | Issue | Severity |
|---|---|---|---|
| 1 | `ProjectListPage.tsx` | Debounce timer leak: `handleSearchChange` returns a cleanup function but it's not used in a `useEffect` — the timer from the previous call leaks | Cosmetic; harmless at human typing speeds but technically non-compliant with React cleanup conventions |

No functional bugs known at time of writing.

---

## 5. File Structure

```
src/
├── App.tsx                          # Route definitions (8 routes)
├── main.tsx                         # React root mount, ToastContainer
├── index.css                        # Tailwind config + custom design tokens
├── vite-env.d.ts

├── types/
│   └── index.ts                     # All interfaces, enums, constants, factory helpers

├── data/
│   └── seed.ts                      # 6 seed projects, 12 team members, seed tasks

├── store/
│   ├── pmoStore.ts                  # Projects + TeamMembers CRUD, Zustand persist v2
│   ├── holidayStore.ts              # Global holidays CRUD + triggerHolidayRecompute()
│   └── toastStore.ts                # Toast queue with action button support

├── utils/
│   ├── taskDates.ts                 # All working-day math: addWorkingDays, computeEndDate,
│   │                                #   normalizeToWorkingDay, wouldCreateCycle, isLaterPhase,
│   │                                #   recomputePhaseTasks, recomputeProjectTasks,
│   │                                #   rollupPhaseDates, removeTaskAndRecomputeProjectWide,
│   │                                #   normalizePhaseData, normalizeTimeline
│   └── computed.ts                  # derivePhaseStatus, getActivePhase, calculateAutoProgress,
│                                    #   getEffectiveProgress, hasPotentialDelay, getPhaseGapDays,
│                                    #   projectHasPotentialDelay, getUniqueTeamCount

├── layouts/
│   └── AppLayout.tsx                # Shell: Sidebar + <Outlet />

├── components/
│   ├── Shared.tsx                   # StatusBadge, ProgressBar, formatDate
│   ├── Sidebar.tsx                  # Nav with active states, Projects expand/collapse
│   ├── ToastContainer.tsx           # Fixed bottom-right toast stack with Undo support
│   └── project/
│       ├── GanttChart.tsx           # gantt-task-react wrapper, phase + task + milestone bars
│       ├── TimelineTable.tsx        # Collapsible 6-phase table, task sub-tables per phase
│       ├── TaskRow.tsx              # Task row: all fields + 2-step inline delete
│       ├── PredecessorSelect.tsx    # Phase-grouped multi-select dropdown for predecessors
│       ├── MilestoneSection.tsx     # Milestone list + add/edit form + undo-delete
│       ├── CascadeModal.tsx         # Gantt drag cascade choice modal
│       ├── TeamAssignment.tsx       # Role-grouped multi-select for form
│       └── TeamDisplay.tsx          # Read-only grouped team display for detail page

├── pages/
│   ├── DashboardPage.tsx            # 5-widget dashboard
│   ├── ProjectListPage.tsx          # Per-division table with filters/sort/search
│   ├── ProjectFormPage.tsx          # Create + Edit (single component, isEdit mode)
│   ├── ProjectDetailPage.tsx        # Full detail: timeline, Gantt, milestones, team
│   ├── TeamMembersPage.tsx          # CRUD table for team members
│   └── HolidaysPage.tsx             # CRUD table for global holidays

scripts/                             # Node ESM test scripts (not part of the app)
│   ├── run-date-test.mjs            # Basic working-day primitives
│   ├── test-task-dates.ts           # (legacy, requires tsx)
│   ├── test-part1.mjs               # §6.9 + §6.10 Part A regression suite (33 assertions)
│   ├── test-cross-phase.mjs         # Cross-phase predecessor scenarios (27 assertions)
│   ├── test-holidays.mjs            # Holiday calendar scenarios (15 assertions)
│   └── verify-dashboard.mjs        # Dashboard aggregation cross-check (all seed data)
```

---

## 6. Deliberately Out of Scope (per spec)

These were **explicitly excluded** in `draft.md`, §6.9, or §6.10 and are **not** partially implemented:

| Feature | Where excluded | Notes |
|---|---|---|
| Kalender libur/cuti per divisi (per-division holiday calendars) | §6.10 Part B | All divisions share the same global holiday list |
| Recurring holiday rules ("every last Friday of month") | §6.10 Part B | All holidays are manual per-date entries |
| Dependency types beyond Finish-to-Start | §6.9, §6.10 | No Start-to-Start, Finish-to-Finish, Start-to-Finish |
| Predecessor linking across projects | §6.10 Part A | Predecessors are within-project only |
| Resource leveling / conflict detection across assignees | §6.9 | No capacity planning |
| Critical path highlight at task level | §6.9 ("optional, §9.5") | Critical path exists at phase level only (conceptually) |
| Kalender hari libur nasional auto-import | §6.10 Part B | Manual entry only |
| Login / RBAC | §0 ("Single-role PM for now") | No authentication; single PM role assumed |
| Real-time / polling | §8.2 | Dashboard recomputes on navigation, no WebSocket/polling |

---

## 7. Possible Future Enhancements

### Small / Quick (days)

- **Workload indicator in assignment dropdown** (§7.4): badge next to each team member name in `TeamAssignment.tsx` showing count of active projects they're already on. Infrastructure ready (`getMemberWorkload()` already exists in `pmoStore`); just needs a UI badge in `RoleSelect`.
- **Critical path highlight** (§9.5): in the Gantt chart, visually highlight the longest dependency chain at task level. The topological sort in `taskDates.ts` already processes tasks in dependency order; critical path = tasks where removing any one task pushes the phase end date.
- **Debounce cleanup fix** in `ProjectListPage.tsx`: wrap `handleSearchChange` in `useEffect` properly or switch to a `useRef`-based debounce hook.

### Medium (weeks)

- **Basic export** (PDF/Excel): project summary report, Gantt screenshot, task list export. Would need a library like `jsPDF` or `xlsx`.
- **Notifications / reminders**: browser `Notification` API or in-app badge for phases approaching their end date.
- **Recurring holiday rules**: instead of manual per-date entry, support patterns like "every public holiday in Indonesia" via a `type: "recurring"` holiday entry.
- **Undo/redo stack**: extend the toast-based undo pattern (currently only milestones) to cover task deletions and phase date changes.

### Large / Structural (months)

- **Multi-user login & RBAC**: PM, team member, admin roles with different permissions (view-only vs edit). Would require a backend (Node/FastAPI/etc.) + JWT auth. Currently there's no authentication at all.
- **Backend + real database**: replace `localStorage`/Zustand persist with a proper REST or GraphQL API + PostgreSQL. The data model in `types/index.ts` maps cleanly to relational tables. Migration path: add an API layer; keep the same Zustand stores but replace localStorage persistence with API calls.
- **Dependency types beyond Finish-to-Start**: Start-to-Start, Finish-to-Finish, lead/lag times. Would require changes to `Task.predecessorIds` (currently plain string[]) to store `{ taskId, type, lag }` objects, and updates to `addWorkingDays` callers in `recomputeProjectTasks`.
- **Resource leveling**: detect and surface when a team member is over-allocated across concurrent tasks in different projects. Needs cross-project task awareness.
- **Mobile-responsive layout**: currently designed for desktop. Sidebar collapses, Gantt chart and task tables would need responsive breakpoints.
- **Gantt: per-day view for task-level zoom**: the chart is currently locked to `ViewMode.Month`. Adding a zoom control (Month / Week / Day) with the correct `columnWidth` scaling per mode would allow day-granularity task bar inspection.

---

*Last updated: end of full polish pass. Build status: `tsc --noEmit` ✅, `vite build` ✅ (zero errors in application code). All test scripts: ✅ (75 total assertions across 4 test files, all pass).*
