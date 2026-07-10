# WebPMO

A web-based Project Management Office (PMO) tool for tracking and managing projects across multiple organizational divisions. Built as a single-page application with a fully interactive Gantt chart, task-level work breakdown, and working-day scheduling — all running client-side with no backend required.

---

## Overview

WebPMO covers the full project lifecycle across three divisions — **HOTD 1**, **HOTD 2 Finance**, and **HOTD 2 Non-Finance** — through a structured SDLC timeline: Discovery → Development → Testing → UAT → Go Live → Support Go Live.

Each project phase can be further broken down into individual tasks with manday durations and predecessor dependencies. Task start and end dates are computed automatically based on working days, respecting both weekends and a configurable holiday calendar. Changes to any task or holiday cascade instantly to all dependent tasks across the project.

---

## Features

### Project Management
- Per-division project list with search, multi-status filter, phase filter, and sortable columns
- Create and edit projects with name, description, status, and progress tracking
- Progress can be set manually or calculated automatically from completed phases
- Delay indicator on any project where a phase is overdue but still marked in progress

### Timeline & Gantt Chart
- Six-phase SDLC timeline with date pickers and status tracking per phase
- Interactive Gantt chart with drag-to-reschedule on phase bars
- Baseline vs. actual comparison — the original planned dates are captured on first entry and displayed as a ghost bar when the schedule drifts
- Cascade dependency modal when rescheduling a phase overlaps the next one
- Today marker and milestone diamond markers on the chart

### Task-Level WBS
- Each phase can be broken into tasks with a duration in mandays and Finish-to-Start predecessor chains
- Task dates are fully computed — start and end are derived automatically, never entered manually
- Predecessors can reference tasks in any phase within the same project (cross-phase)
- Circular dependency detection blocks invalid predecessor selections
- Changes to duration, predecessors, or start dates cascade instantly through all downstream tasks

### Holiday Calendar
- Global custom holiday calendar applied to all working-day calculations
- Bulk import via comma-separated `MM/DD/YY` paste with label, preview, and deduplication
- Adding or removing a holiday triggers a full recompute of all affected task dates across all projects

### Supporting Modules
- Milestone CRUD with a 5-second undo window on delete
- Team assignment grouped by role (BPA / DEV / PQA) with workload indicators
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
| `pmo-workflow-store` | v2 | Projects and team members |
| `pmo-holiday-store` | v1 | Global holiday calendar |

Schema migrations are applied automatically on load. Clearing browser storage resets the app to its seed data (6 example projects, 12 team members, 3 holidays).

---

## Project Structure

```
src/
├── types/index.ts              # All data model interfaces, enums, and factory helpers
├── data/seed.ts                # Seed projects, team members, and tasks
├── store/
│   ├── pmoStore.ts             # Projects and team members (Zustand + persist)
│   ├── holidayStore.ts         # Global holidays + cascade recompute trigger
│   └── toastStore.ts           # Toast notifications with optional undo action
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
    │   ├── TimelineTable.tsx       # Phase date inputs and task sub-tables
    │   ├── TaskRow.tsx             # Individual task row with inline editing
    │   ├── PredecessorSelect.tsx   # Phase-grouped predecessor multi-select
    │   ├── MilestoneSection.tsx    # Milestone CRUD with undo-delete
    │   ├── CascadeModal.tsx        # Cascade shift confirmation dialog
    │   ├── TeamAssignment.tsx      # Role-grouped team picker (form)
    │   └── TeamDisplay.tsx         # Read-only team display (detail page)
    ├── Shared.tsx                  # StatusBadge, ProgressBar, formatDate
    ├── Sidebar.tsx
    └── ToastContainer.tsx
```

---

## Scope Boundaries

The following are explicitly out of scope for the current version:

- Authentication or role-based access control — single PM role assumed
- Per-division or regional holiday calendars — one global calendar shared across all projects
- Recurring holiday rules — all holidays are entered as individual dates
- Dependency types beyond Finish-to-Start
- Cross-project task predecessors
- Resource leveling and capacity planning
- Backend or real-time data sync — all data lives in the browser

---

## Reference

- [`draft.md`](./draft.md) — full functional and technical specification, including §6.9 (Task-Level WBS) and §6.10 (Cross-Phase Predecessors & Holiday Calendar)
- [`PROGRESS.md`](./PROGRESS.md) — implementation status, file-by-file breakdown, known issues, and future enhancement roadmap
