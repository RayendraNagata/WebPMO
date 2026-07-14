# WebPMO

A web-based Project Management Office (PMO) tool for tracking and managing projects across multiple organizational divisions. Built as a single-page application with a fully interactive Gantt chart, task-level work breakdown, and working-day scheduling — all running client-side with no backend required.

---

## Overview

WebPMO covers the full project lifecycle across three divisions — **HOTD 1**, **HOTD 2 Finance**, and **HOTD 2 Non-Finance** — through a structured 9-phase SDLC timeline: User Requirement → Development → Testing → UAT → Pentest → Defectdojo → Go Live → Post Implementation Support → Project Handover.

Each project phase can be further broken down into individual tasks with manday durations and predecessor dependencies. Task start and end dates are computed automatically based on working days, respecting both weekends and a configurable holiday calendar. Changes to any task or holiday cascade instantly to all dependent tasks across the project.

---

## Features

### Project Management
- Per-division project list with search, multi-status filter, phase filter, and sortable columns
- Create and edit projects with name, description, status, and progress tracking
- Progress can be set manually or calculated automatically from completed phases (divides by 9 dynamically)
- Delay indicator on any project where a phase is overdue but still marked in progress

### Timeline & Gantt Chart
- 9-phase SDLC timeline with date pickers and status tracking per phase
- Interactive Gantt chart with drag-to-reschedule on phase bars
- Baseline vs. actual comparison — original planned dates captured on first entry, displayed as ghost bar when schedule drifts
- Cascade dependency modal when rescheduling a phase overlaps the next one
- Today marker on the chart

### Task-Level WBS
- Each phase can be broken into tasks with a duration in mandays and Finish-to-Start predecessor chains
- Task dates are fully computed — start and end are derived automatically, never entered manually
- Predecessors can reference tasks in any phase within the same project (cross-phase)
- Circular dependency detection blocks invalid predecessor selections
- Changes to duration, predecessors, or start dates cascade instantly through all downstream tasks

### Holiday Calendar
- Global custom holiday calendar applied to all working-day calculations
- Adding or removing a holiday triggers a full recompute of all affected task dates across all projects

### Project Documentation Checklist (§6.12)
- Each project has a fixed 13-item SDLC documentation checklist (PROJECT CHARTER → PROJECT CLOSURE)
- User fills in a date and link per item; no add/remove controls — the list is always fixed
- Document names become clickable links when a URL is filled in
- Basic URL format validation (must start with `http://` or `https://`)

### Supporting Modules
- Team assignment grouped by role (Product Manager / BSM / BPA / UI/UX / DEV / PQA / ABAP) with workload indicators
- Team Members management page with full CRUD
- Dashboard with status distribution, average progress per division, at-risk projects, and go-live schedule for the current month

---

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | React 19 + Vite 6 |
| Language | TypeScript 5.8 |
| Styling | Tailwind CSS 4 with custom design tokens |
| State management | Zustand 5 with `localStorage` persistence |
| Routing | React Router 7 |
| Gantt chart | gantt-task-react 0.3.9 |
| Icons | lucide-react |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build
```

The app runs at `http://localhost:5173` by default. No environment variables, authentication, or backend setup required — all data is stored in `localStorage`.

---

## Data Persistence

Data is stored in the browser under two `localStorage` keys:

| Key | Version | Contents |
|---|---|---|
| `pmo-workflow-store` | v5 | Projects and team members |
| `pmo-holiday-store` | v1 | Global holiday calendar |

Schema migrations are applied automatically on load. Clearing browser storage resets the app to its seed data (6 example projects, 20 team members, 3 holidays).

**Migration history:**
- v2: added `tasks` array to PhaseData
- v3: expanded TeamAssignment roles
- v4: migrated 6-phase structure → 9-phase (§6.11): `discovery→userRequirement`, `supportGoLive→postImplementationSupport`, added `pentest`/`defectdojo`/`projectHandover`
- v5: replaced `milestones[]` with `documentation[]` — 13 fixed SDLC document entries (§6.12)

---

## Project Structure

```
src/
├── types/index.ts              # All data model interfaces, enums, and factory helpers
├── data/seed.ts                # Seed projects (9-phase), team members
├── store/
│   ├── pmoStore.ts             # Projects + team members CRUD, Zustand persist v5
│   ├── holidayStore.ts         # Global holidays + cascade recompute
│   └── toastStore.ts           # Toast notifications with optional undo
├── utils/
│   ├── taskDates.ts            # Working-day math, topological sort, cycle detection
│   └── computed.ts             # Phase status, progress calculation, delay/gap helpers
├── pages/
│   ├── DashboardPage.tsx
│   ├── ProjectListPage.tsx
│   ├── ProjectFormPage.tsx
│   ├── ProjectDetailPage.tsx
│   ├── TeamMembersPage.tsx
│   └── HolidaysPage.tsx
└── components/
    ├── project/
    │   ├── GanttChart.tsx          # Phase and task Gantt with drag-reschedule
    │   ├── TimelineTable.tsx       # 9-phase date inputs and task sub-tables
    │   ├── TaskRow.tsx             # Individual task row with inline editing
    │   ├── PredecessorSelect.tsx   # Phase-grouped predecessor multi-select
    │   ├── DocumentationSection.tsx# §6.12: 13-item documentation checklist
    │   ├── CascadeModal.tsx        # Cascade shift confirmation dialog
    │   ├── TeamAssignment.tsx      # Role-grouped team picker (form)
    │   └── TeamDisplay.tsx         # Read-only team display (detail page)
    ├── Shared.tsx                  # StatusBadge, ProgressBar, formatDate
    ├── Sidebar.tsx
    └── ToastContainer.tsx
```

---

## SDLC Phases

| # | Key | Label |
|---|---|---|
| 1 | `userRequirement` | User Requirement |
| 2 | `development` | Development |
| 3 | `testing` | Testing |
| 4 | `uat` | UAT |
| 5 | `pentest` | Pentest |
| 6 | `defectdojo` | Defectdojo (Code Quality) |
| 7 | `goLive` | Go Live |
| 8 | `postImplementationSupport` | Post Implementation Support |
| 9 | `projectHandover` | Project Handover |

**Phase 8 special rule:** when the start date is set for the first time, the end date automatically defaults to start + 3 months. This default can be overridden at any time.

---

## Scope Boundaries

The following are explicitly out of scope for the current version:

- Authentication or role-based access control
- Per-division or regional holiday calendars (one global calendar shared across all projects)
- Recurring holiday rules — all holidays are entered as individual dates
- Dependency types beyond Finish-to-Start
- Cross-project task predecessors
- Resource leveling and capacity planning
- Backend or real-time data sync — all data lives in the browser

---

## Reference

- [`draft.md`](./draft.md) — full functional and technical specification (§§1–9 + addenda 6.9–6.12)
- [`PROGRESS.md`](./PROGRESS.md) — verified implementation status with test evidence
