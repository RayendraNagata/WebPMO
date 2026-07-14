import type { PhaseData, PhaseKey, Task, TaskStatus } from "@/types";
import { PHASE_ORDER, createEmptyPhase } from "@/types";
import { derivePhaseStatus } from "@/utils/computed";

// ─── ISO date helpers (local calendar, no timezone drift) ───

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(today: Date = new Date()): string {
  return formatISODate(today);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Returns true if this date is a non-working day:
 *   - Saturday or Sunday, OR
 *   - A date present in the optional holidays Set<ISO-string> (§6.10 Part B).
 */
function isNonWorking(date: Date, holidays: Set<string>): boolean {
  if (isWeekend(date)) return true;
  if (holidays.size > 0 && holidays.has(formatISODate(date))) return true;
  return false;
}

/**
 * Snap to the next working day (Mon–Fri, not a holiday).
 * §6.10 Part B: also skips dates in the holidays set.
 */
export function normalizeToWorkingDay(
  iso: string,
  holidays: Set<string> = new Set()
): string {
  const date = parseISODate(iso);
  while (isNonWorking(date, holidays)) {
    date.setDate(date.getDate() + 1);
  }
  return formatISODate(date);
}

/**
 * Add N working days (Mon–Fri, excluding holidays).
 * §6.10 Part B: the holidays parameter is optional (default = empty set)
 * so all existing call sites without holidays continue to work unchanged.
 */
export function addWorkingDays(
  iso: string,
  days: number,
  holidays: Set<string> = new Set()
): string {
  const date = parseISODate(iso);
  let remaining = days;

  if (remaining === 0) return formatISODate(date);

  const step = remaining > 0 ? 1 : -1;
  remaining = Math.abs(remaining);

  while (remaining > 0) {
    date.setDate(date.getDate() + step);
    if (!isNonWorking(date, holidays)) remaining--;
  }

  return formatISODate(date);
}

/**
 * end = start + (durationMandays - 1) working days; 1 manday → same day.
 * §6.10 Part B: holidays parameter threaded through to addWorkingDays.
 */
export function computeEndDate(
  start: string,
  durationMandays: number,
  holidays: Set<string> = new Set()
): string {
  if (durationMandays <= 0) return start;
  const extraDays = durationMandays - 1;
  if (extraDays <= 0) return start;
  return addWorkingDays(start, extraDays, holidays);
}

// ─── Task status auto-derive (draft.md 6.5 pattern) ───

export function deriveTaskStatus(task: Task, today: Date = new Date()): TaskStatus {
  if (task.statusManualOverride) return task.status;
  if (!task.start) return "NOT_STARTED";

  const now = today;
  const start = parseISODate(task.start);
  const end = task.end ? parseISODate(task.end) : null;

  if (now < start) return "NOT_STARTED";
  if (end && now > end) return "DONE";
  if (end && now >= start && now <= end) return "IN_PROGRESS";

  return "IN_PROGRESS";
}

// ─── Phase-order helper (§6.10) ───

/**
 * Returns true if phaseA comes AFTER phaseB in the fixed SDLC order.
 * Used to show a warning badge when a predecessor is from a later phase.
 */
export function isLaterPhase(phaseA: PhaseKey, phaseB: PhaseKey): boolean {
  return PHASE_ORDER.indexOf(phaseA) > PHASE_ORDER.indexOf(phaseB);
}

// ─── Circular dependency detection (§6.10: project-wide) ───

export function wouldCreateCycle(
  tasks: Task[],
  taskId: string,
  predecessorIds: string[]
): boolean {
  const ids = new Set(tasks.map((t) => t.id));
  const simulated = tasks.map((t) =>
    t.id === taskId ? { ...t, predecessorIds } : t
  );

  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(id: string): boolean {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    stack.add(id);

    const task = simulated.find((t) => t.id === id);
    if (task) {
      for (const pred of task.predecessorIds) {
        if (ids.has(pred) && dfs(pred)) return true;
      }
    }

    stack.delete(id);
    return false;
  }

  for (const t of simulated) {
    if (dfs(t.id)) return true;
  }
  return false;
}

// ─── Topological sort (project-wide) ───

function topologicalSort(tasks: Task[]): string[] {
  const ids = new Set(tasks.map((t) => t.id));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }

  for (const t of tasks) {
    for (const pred of t.predecessorIds) {
      if (!ids.has(pred)) continue;
      adj.get(pred)!.push(t.id);
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
    }
  }

  const phaseIndex = (t: Task) => PHASE_ORDER.indexOf(t.phaseKey);
  const stableSort = (a: Task, b: Task) => {
    const pd = phaseIndex(a) - phaseIndex(b);
    return pd !== 0 ? pd : a.order - b.order;
  };

  const queue = tasks
    .filter((t) => (inDegree.get(t.id) ?? 0) === 0)
    .sort(stableSort)
    .map((t) => t.id);

  const result: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) {
        queue.push(next);
        queue.sort((a, b) => {
          const ta = tasks.find((t) => t.id === a)!;
          const tb = tasks.find((t) => t.id === b)!;
          return stableSort(ta, tb);
        });
      }
    }
  }

  return result.length === tasks.length ? result : tasks.map((t) => t.id);
}

// ─── Per-phase recompute (§6.9) — holidays threaded through ───

export function recomputePhaseTasks(
  tasks: Task[],
  today: Date = new Date(),
  holidays: Set<string> = new Set()
): Task[] {
  if (tasks.length === 0) return tasks;

  const map = new Map(tasks.map((t) => [t.id, { ...t }]));
  const order = topologicalSort(tasks);

  for (const id of order) {
    const task = map.get(id)!;
    const validPreds = task.predecessorIds.filter((pid) => map.has(pid));
    let start: string | null = null;

    if (validPreds.length > 0) {
      const predEnds = validPreds
        .map((pid) => map.get(pid)!.end)
        .filter((e): e is string => e !== null);

      if (predEnds.length === validPreds.length) {
        const maxEnd = predEnds.reduce((a, b) => (a > b ? a : b));
        start = addWorkingDays(maxEnd, 1, holidays);
      }
    } else {
      start = task.start ? normalizeToWorkingDay(task.start, holidays) : null;
    }

    const end = start ? computeEndDate(start, task.durationMandays, holidays) : null;
    const status = deriveTaskStatus({ ...task, start, end }, today);

    map.set(id, {
      ...task,
      predecessorIds: validPreds,
      start,
      end,
      status: task.statusManualOverride ? task.status : status,
    });
  }

  return tasks.map((t) => map.get(t.id)!);
}

// ─── Project-wide task recompute (§6.10) — holidays threaded through ───

export function recomputeProjectTasks(
  allTasks: Task[],
  today: Date = new Date(),
  holidays: Set<string> = new Set()
): Map<PhaseKey, Task[]> {
  if (allTasks.length === 0) {
    const empty = new Map<PhaseKey, Task[]>();
    for (const key of PHASE_ORDER) empty.set(key, []);
    return empty;
  }

  const map = new Map(allTasks.map((t) => [t.id, { ...t }]));
  const order = topologicalSort(allTasks);

  for (const id of order) {
    const task = map.get(id)!;
    const validPreds = task.predecessorIds.filter((pid) => map.has(pid));
    let start: string | null = null;

    if (validPreds.length > 0) {
      const predEnds = validPreds
        .map((pid) => map.get(pid)!.end)
        .filter((e): e is string => e !== null);

      if (predEnds.length === validPreds.length) {
        const maxEnd = predEnds.reduce((a, b) => (a > b ? a : b));
        start = addWorkingDays(maxEnd, 1, holidays);
      }
    } else {
      start = task.start ? normalizeToWorkingDay(task.start, holidays) : null;
    }

    const end = start ? computeEndDate(start, task.durationMandays, holidays) : null;
    const status = deriveTaskStatus({ ...task, start, end }, today);

    map.set(id, {
      ...task,
      predecessorIds: validPreds,
      start,
      end,
      status: task.statusManualOverride ? task.status : status,
    });
  }

  const result = new Map<PhaseKey, Task[]>();
  for (const key of PHASE_ORDER) result.set(key, []);

  for (const t of allTasks) {
    const updated = map.get(t.id)!;
    result.get(updated.phaseKey)!.push(updated);
  }

  for (const [key, tasks] of result) {
    tasks.sort((a, b) => a.order - b.order);
    result.set(key, tasks);
  }

  return result;
}

export function rollupPhaseDates(tasks: Task[]): Pick<PhaseData, "start" | "end"> {
  if (tasks.length === 0) return { start: null, end: null };

  const starts = tasks.map((t) => t.start).filter((s): s is string => s !== null);
  const ends = tasks.map((t) => t.end).filter((e): e is string => e !== null);

  if (starts.length === 0 || ends.length === 0) {
    return { start: null, end: null };
  }

  return {
    start: starts.reduce((a, b) => (a < b ? a : b)),
    end: ends.reduce((a, b) => (a > b ? a : b)),
  };
}

/** Strip deleted task project-wide, then recompute with holidays. */
export function removeTaskAndRecomputeProjectWide(
  allTasks: Task[],
  taskId: string,
  today: Date = new Date(),
  holidays: Set<string> = new Set()
): Map<PhaseKey, Task[]> {
  const remaining = allTasks
    .filter((t) => t.id !== taskId)
    .map((t) => {
      const hadDeletedAsPred = t.predecessorIds.includes(taskId);
      const newPredIds = t.predecessorIds.filter((pid) => pid !== taskId);
      const lostOnlyPredecessor = hadDeletedAsPred && newPredIds.length === 0;
      return {
        ...t,
        predecessorIds: newPredIds,
        start: lostOnlyPredecessor ? null : t.start,
        end: lostOnlyPredecessor ? null : t.end,
      };
    });

  return recomputeProjectTasks(remaining, today, holidays);
}

// Legacy per-phase remove (backward compat)
export function removeTaskAndRecompute(
  tasks: Task[],
  taskId: string,
  today: Date = new Date(),
  holidays: Set<string> = new Set()
): Task[] {
  const remaining = tasks
    .filter((t) => t.id !== taskId)
    .map((t) => {
      const hadDeletedAsPred = t.predecessorIds.includes(taskId);
      const newPredIds = t.predecessorIds.filter((pid) => pid !== taskId);
      const lostOnlyPredecessor = hadDeletedAsPred && newPredIds.length === 0;
      return {
        ...t,
        predecessorIds: newPredIds,
        start: lostOnlyPredecessor ? null : t.start,
        end: lostOnlyPredecessor ? null : t.end,
      };
    });

  return recomputePhaseTasks(remaining, today, holidays);
}

export function normalizePhaseData(
  phase: PhaseData,
  today: Date = new Date(),
  holidays: Set<string> = new Set()
): PhaseData {
  const tasks = phase.tasks ?? [];
  if (tasks.length === 0) {
    return { ...phase, tasks: [] };
  }

  const recomputed = recomputePhaseTasks(tasks, today, holidays);
  const rollup = rollupPhaseDates(recomputed);

  return {
    ...phase,
    tasks: recomputed,
    ...rollup,
    status: phase.statusManualOverride
      ? phase.status
      : derivePhaseStatus({ ...phase, ...rollup }, today),
  };
}

export function normalizeTimeline(
  timeline: Record<PhaseKey, PhaseData>,
  today: Date = new Date(),
  holidays: Set<string> = new Set()
): Record<PhaseKey, PhaseData> {
  // Collect ALL tasks across all phases for project-wide recompute (§6.10).
  // Using per-phase normalizePhaseData here would silently strip cross-phase
  // predecessorIds because each phase's map only contains same-phase tasks.
  const allTasks: Task[] = PHASE_ORDER.flatMap(
    (key) => (timeline[key] ?? createEmptyPhase()).tasks ?? []
  );

  // Run project-wide topological sort + date recompute
  const recomputedByPhase = recomputeProjectTasks(allTasks, today, holidays);

  return Object.fromEntries(
    PHASE_ORDER.map((key) => {
      const phase = timeline[key] ?? createEmptyPhase();
      const tasks = recomputedByPhase.get(key) ?? [];

      if (tasks.length === 0) {
        return [key, { ...phase, tasks: [] }];
      }

      const rollup = rollupPhaseDates(tasks);
      return [
        key,
        {
          ...phase,
          tasks,
          ...rollup,
          status: phase.statusManualOverride
            ? phase.status
            : derivePhaseStatus({ ...phase, ...rollup }, today),
        },
      ];
    })
  ) as Record<PhaseKey, PhaseData>;
}
