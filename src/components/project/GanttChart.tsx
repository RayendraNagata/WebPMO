import { useMemo, useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Gantt, ViewMode } from "gantt-task-react";
import type { Task as GanttTask } from "gantt-task-react";
import type { Project, PhaseKey } from "@/types";
import { PHASE_ORDER, PHASE_LABELS } from "@/types";
import { formatDate } from "@/components/Shared";
import { parseISODate } from "@/utils/taskDates";
import "gantt-task-react/dist/index.css";

interface Props {
  project: Project;
  onDateChange: (phaseKey: PhaseKey, start: Date, end: Date) => void;
  onAddTask: (phaseKey: PhaseKey) => void;
}

// ─── Color palette for phase bars ───
const PHASE_COLORS: Record<PhaseKey, string> = {
  userRequirement:           "#4262ff", // blue        (was discovery)
  development:               "#0fbcb0", // teal
  testing:                   "#f59e0b", // amber
  uat:                       "#8b5cf6", // purple
  pentest:                   "#ef4444", // red
  defectdojo:                "#f97316", // orange
  goLive:                    "#10b981", // green
  postImplementationSupport: "#6b7280", // gray        (was supportGoLive)
  projectHandover:           "#0ea5e9", // sky blue
};

/** Slightly desaturated/lighter tint for task child bars */
function taskColor(hex: string): string {
  // Blend with white at 45% to produce a lighter tint
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (c: number) => Math.round(c + (255 - c) * 0.45);
  return `rgb(${blend(r)},${blend(g)},${blend(b)})`;
}

/** Safe end: gantt-task-react requires end > start */
function safeEnd(start: Date, end: Date): Date {
  return end <= start ? new Date(start.getTime() + 86_400_000) : end;
}

export default function ProjectGanttChart({ project, onDateChange, onAddTask }: Props) {
  // ─── Expand/collapse state — local only, resets on page reload (by design) ───
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  const togglePhase = useCallback((phaseId: string) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }, []);

  // ─── Build gantt-task-react task list ───
  const ganttTasks: GanttTask[] = useMemo(() => {
    const result: GanttTask[] = [];

    for (const key of PHASE_ORDER) {
      const phase = project.timeline[key];
      if (!phase.start || !phase.end) continue;

      const phaseId = `phase-${key}`;
      const phaseColor = PHASE_COLORS[key];
      const phaseTasks = phase.tasks ?? [];
      const hasTasks = phaseTasks.length > 0;
      const isCollapsed = collapsedPhases.has(phaseId);

      const phaseStart = parseISODate(phase.start);
      const phaseEnd = safeEnd(phaseStart, parseISODate(phase.end));

      // ── Baseline bar (only when baseline differs from actual) ──
      if (
        phase.baselineStart &&
        phase.baselineEnd &&
        (phase.baselineStart !== phase.start || phase.baselineEnd !== phase.end)
      ) {
        const bStart = parseISODate(phase.baselineStart);
        const bEnd = safeEnd(bStart, parseISODate(phase.baselineEnd));
        result.push({
          id: `baseline-${key}`,
          type: "task",
          name: `${PHASE_LABELS[key]} (Baseline)`,
          start: bStart,
          end: bEnd,
          progress: 0,
          isDisabled: true,
          styles: {
            backgroundColor: "#e5e7eb",
            backgroundSelectedColor: "#e5e7eb",
            progressColor: "transparent",
            progressSelectedColor: "transparent",
          },
        });
      }

      // ── Phase bar — "project" type when it has tasks (enables expand/collapse) ──
      result.push({
        id: phaseId,
        type: hasTasks ? "project" : "task",
        name: PHASE_LABELS[key],
        start: phaseStart,
        end: phaseEnd,
        progress: 0,
        hideChildren: hasTasks ? isCollapsed : undefined,
        styles: {
          backgroundColor: phaseColor,
          backgroundSelectedColor: phaseColor,
          progressColor: "transparent",
          progressSelectedColor: "transparent",
        },
      });

      // ── Child task bars (only when phase has tasks) ──
      if (hasTasks) {
        const childColor = taskColor(phaseColor);
        for (const task of phaseTasks) {
          if (!task.start || !task.end) continue;
          const tStart = parseISODate(task.start);
          const tEnd = safeEnd(tStart, parseISODate(task.end));
          result.push({
            id: `task-${task.id}`,
            type: "task",
            name: task.nama || "Unnamed task",
            start: tStart,
            end: tEnd,
            progress: 0,
            project: phaseId,           // links to parent for indentation
            isDisabled: true,           // task dates are computed — no drag
            styles: {
              backgroundColor: childColor,
              backgroundSelectedColor: childColor,
              progressColor: "transparent",
              progressSelectedColor: "transparent",
            },
          });
        }
      }
    }

    return result;
  }, [project.timeline, collapsedPhases]);

  // ─── Handle drag on phase bars (task bars are isDisabled so won't fire) ───
  const handleDateChange = useCallback(
    (task: GanttTask) => {
      if (!task.id.startsWith("phase-")) return;
      const phaseKey = task.id.replace("phase-", "") as PhaseKey;
      if (!PHASE_ORDER.includes(phaseKey)) return;
      onDateChange(phaseKey, task.start, task.end);
    },
    [onDateChange]
  );

  // ─── Handle expand/collapse from the library's built-in expander ───
  const handleExpanderClick = useCallback(
    (task: GanttTask) => {
      togglePhase(task.id);
    },
    [togglePhase]
  );

  // ─── Don't render if no phases have dates ───
  const hasAnyDates = PHASE_ORDER.some(
    (k) => project.timeline[k].start && project.timeline[k].end
  );

  // Total row count for dynamic height (collapsed phases hide their children)
  const visibleRowCount = ganttTasks.filter((t) => {
    if (!t.project) return true; // top-level rows always visible
    // child rows hidden when parent is collapsed
    const parentId = t.project as string;
    return !collapsedPhases.has(parentId);
  }).length;
  // Fixed row heights. Cap at 400px of bar area so the container stays reasonable
  // regardless of how many tasks are expanded; user can scroll vertically inside.
  const ganttHeight = Math.min(Math.max(visibleRowCount * 44, 88), 400);

  const addTaskButtons = (
    <div className="flex flex-wrap gap-2 mb-4">
      {PHASE_ORDER.map((key) => (
        <button
          key={key}
          onClick={() => onAddTask(key)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-brand-blue border border-brand-blue/30 hover:bg-brand-blue/10 transition-colors"
          title={`Add task to ${PHASE_LABELS[key]}`}
        >
          <Plus size={12} />
          Add Task — {PHASE_LABELS[key]}
        </button>
      ))}
    </div>
  );

  if (!hasAnyDates) {
    return (
      <div className="bg-canvas rounded-xl border border-hairline-soft p-6">
        <GanttHeader />
        {addTaskButtons}
        <p className="text-sm text-stone">
          Fill in at least one phase's start and end dates above to see the Gantt chart.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-canvas rounded-xl border border-hairline-soft p-6">
      <GanttHeader />
      {addTaskButtons}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {PHASE_ORDER.map((key) => {
          const phase = project.timeline[key];
          if (!phase.start) return null;
          const tasks = phase.tasks ?? [];
          return (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: PHASE_COLORS[key] }}
              />
              {PHASE_LABELS[key]}
              {tasks.length > 0 && (
                <span className="text-stone">({tasks.length} tasks)</span>
              )}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-200" />
          Baseline
        </span>
      </div>

      {/*
        ── Gantt containment wrapper ──────────────────────────────────────────
        The library renders SVG elements whose pixel width = dates.length × columnWidth.
        For a multi-month project at 160px/month this easily exceeds 1 000 px.
        Without containment those SVGs push the wrapper — and the whole page —
        wider than the viewport.

        Fix: `contain: strict` creates a layout/paint/size containment context.
        The browser treats this element as an independent formatting root whose
        children's sizes cannot affect anything outside it, no matter how wide the
        SVGs grow. Combined with `overflow: auto` the content scrolls inside this
        box rather than expanding it.

        Height is fixed (not max-height) so vertical containment is also hard.
        We add 1.2rem (~20px) to ganttHeight to show the library's own horizontal
        scrollbar row (HorizontalScroll renders below the wrapperRef at that height).
      ──────────────────────────────────────────────────────────────────────── */}
      <div
        className="rounded-lg border border-hairline-soft"
        style={{
          width: "100%",
          height: ganttHeight + 50 + 24,   // rows + headerHeight(50) + HorizontalScroll(24)
          overflow: "auto",
          contain: "strict",
          position: "relative",           // for the library's absolute tooltip
        }}
      >
        <Gantt
          tasks={ganttTasks}
          viewMode={ViewMode.Month}
          onDateChange={handleDateChange}
          onExpanderClick={handleExpanderClick}
          columnWidth={160}
          barCornerRadius={4}
          handleWidth={10}
          barFill={60}
          rowHeight={44}
          headerHeight={50}
          todayColor="rgba(66, 98, 255, 0.15)"
          fontFamily="Inter, sans-serif"
          fontSize="12px"
          barBackgroundColor="#4262ff"
          barProgressColor="transparent"
          TooltipContent={CustomTooltip}
          TaskListHeader={EmptyListHeader}
          TaskListTable={EmptyListTable}
          listCellWidth="0px"
          ganttHeight={ganttHeight}
        />
      </div>

      <p className="text-[11px] text-stone mt-2">
        Click the ▶ arrow on a phase bar to expand/collapse its tasks.
        Task bars cannot be dragged — dates are computed from duration and predecessors.
      </p>
    </div>
  );
}

// ─── Shared header icon+title ───
function GanttHeader() {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <svg
        className="text-slate"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 3v18" />
      </svg>
      <h2 className="text-base font-medium text-ink">Gantt Chart</h2>
    </div>
  );
}

// ─── Custom tooltip ───
function CustomTooltip({
  task,
}: {
  task: GanttTask;
  fontSize: string;
  fontFamily: string;
}) {
  const isBaseline = task.id.startsWith("baseline-");
  const isTaskChild = task.id.startsWith("task-");

  return (
    <div className="bg-ink text-white rounded-lg px-3 py-2 text-xs shadow-lg max-w-[220px]">
      <p className="font-medium mb-0.5">{task.name}</p>
      <div className="text-white/70 space-y-0.5">
        <p>
          {formatDate(task.start.toISOString())} →{" "}
          {formatDate(task.end.toISOString())}
        </p>
        {isBaseline && (
          <p className="text-white/50 italic">Baseline plan</p>
        )}
        {isTaskChild && (
          <p className="text-white/50 italic">Computed from duration &amp; predecessors</p>
        )}
      </div>
    </div>
  );
}

// ─── Empty list panel (we use our own TimelineTable for the label column) ───
function EmptyListHeader() {
  return <div />;
}
function EmptyListTable() {
  return <div />;
}
