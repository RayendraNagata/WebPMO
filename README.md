# WebPMO

Internal PMO (Project Management Office) web tool for managing projects across three divisions: **HOTD 1**, **HOTD 2 - Finance**, and **HOTD 2 - Non-Finance**.

Built with React + Zustand + Tailwind CSS. All data lives in `localStorage` — no backend required.

---

## Features

- **Project List** per division — search, filter by status/phase, sort, delay indicator
- **Create / Edit projects** — name, description, status, progress (manual or auto-calculated), team assignment
- **Timeline & Gantt** — drag-to-reschedule phase bars, baseline vs actual comparison, cascade dependency modal
- **Task-Level WBS** — break each phase into tasks with duration (mandays), predecessors, auto-computed working-day dates, nested Gantt rendering
- **Cross-phase predecessors** — tasks can depend on tasks in other phases; grouped dropdown with warning badge for reverse-order dependencies
- **Custom Holiday Calendar** — add/remove global holidays that are excluded from all working-day calculations
- **Milestones** — per-project milestones with undo-delete (5-second window)
- **Team Assignment** — role-grouped (BPA / DEV / PQA) multi-select per project; separate Team Members CRUD page
- **Dashboard** — total projects, status distribution chart, avg progress per division, "needs attention" list, go-live this month

---

## Tech Stack

| | |
|---|---|
| Framework | React 19 + Vite 6 |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS 4 (custom design tokens) |
| State | Zustand 5 (with `localStorage` persist) |
| Routing | React Router 7 |
| Gantt | gantt-task-react 0.3.9 |
| Icons | lucide-react |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build
```

App runs at `http://localhost:5173` by default. No environment variables or backend setup needed.

---

## Project Structure

```
src/
├── types/index.ts          # All data model interfaces & constants
├── data/seed.ts            # Seed projects, team members, and tasks
├── store/
│   ├── pmoStore.ts         # Projects & team members (Zustand + persist)
│   ├── holidayStore.ts     # Global holidays + cascade recompute trigger
│   └── toastStore.ts       # Toast notifications with undo-action support
├── utils/
│   ├── taskDates.ts        # Working-day math, predecessor computation, cycle detection
│   └── computed.ts         # Phase status, progress, delay/gap helpers
├── pages/
│   ├── DashboardPage.tsx
│   ├── ProjectListPage.tsx
│   ├── ProjectFormPage.tsx
│   ├── ProjectDetailPage.tsx
│   ├── TeamMembersPage.tsx
│   └── HolidaysPage.tsx
└── components/
    ├── project/
    │   ├── GanttChart.tsx         # Gantt with phase + task bars
    │   ├── TimelineTable.tsx      # Phase timeline input + task sub-tables
    │   ├── TaskRow.tsx            # Single task row (inline edit + 2-step delete)
    │   ├── PredecessorSelect.tsx  # Phase-grouped predecessor multi-select
    │   ├── MilestoneSection.tsx   # Milestone CRUD with undo-delete
    │   ├── CascadeModal.tsx       # Cascade shift confirmation
    │   ├── TeamAssignment.tsx     # Role-grouped team picker (form)
    │   └── TeamDisplay.tsx        # Grouped team display (detail page)
    ├── Shared.tsx                 # StatusBadge, ProgressBar, formatDate
    ├── Sidebar.tsx
    └── ToastContainer.tsx
```

---

## Data Persistence

All data is stored in `localStorage` under two keys:

- `pmo-workflow-store` (v2) — projects and team members
- `pmo-holiday-store` (v1) — global holidays

Clearing browser storage resets the app to seed data. Schema migrations are handled automatically on load.

---

## Reference Docs

- [`draft.md`](./draft.md) — full feature spec including §6.9 (Task-Level WBS) and §6.10 (Cross-Phase Predecessor & Holiday Calendar)
- [`PROGRESS.md`](./PROGRESS.md) — complete implementation status, file-by-file breakdown, known issues, and future enhancement roadmap
