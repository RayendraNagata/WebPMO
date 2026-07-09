/**
 * Global holiday store — §6.10 Part B.
 *
 * Holidays are global (not per-project). Any change triggers a full
 * project-wide task recompute so affected dates update immediately.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Holiday } from "@/types";

// ─── Seed data: 3 Indonesian national holidays in 2026 (weekdays only) ───
// Chosen to fall on working days so they actually affect task-date tests.
export const seedHolidays: Holiday[] = [
  { id: "h1", tanggal: "2026-01-01", nama: "Tahun Baru 2026"           }, // Thu
  { id: "h2", tanggal: "2026-08-17", nama: "Hari Kemerdekaan RI"       }, // Mon
  { id: "h3", tanggal: "2026-12-25", nama: "Hari Natal"                }, // Fri
];

// ─── ID generator ───
let holidayCounter = seedHolidays.length; // starts after seed
function generateHolidayId(): string {
  return `h${++holidayCounter}`;
}

// ─── Store interface ───
interface HolidayState {
  holidays: Holiday[];
}
interface HolidayActions {
  addHoliday:    (data: Omit<Holiday, "id">) => Holiday;
  removeHoliday: (id: string) => void;
  /** Returns a Set<ISO-date-string> for O(1) lookup in addWorkingDays. */
  getHolidaySet: () => Set<string>;
}

export type HolidayStore = HolidayState & HolidayActions;

// ─── Store ───
export const useHolidayStore = create<HolidayStore>()(
  persist(
    (set, get) => ({
      holidays: seedHolidays,

      addHoliday: (data) => {
        const holiday: Holiday = { ...data, id: generateHolidayId() };
        set((s) => ({ holidays: [...s.holidays, holiday] }));
        // Cascade recompute deferred to avoid circular import at module init;
        // the caller (HolidaysPage) triggers it via triggerHolidayRecompute().
        return holiday;
      },

      removeHoliday: (id) => {
        set((s) => ({ holidays: s.holidays.filter((h) => h.id !== id) }));
      },

      getHolidaySet: () => {
        return new Set(get().holidays.map((h) => h.tanggal));
      },
    }),
    {
      name: "pmo-holiday-store",
      version: 1,
      migrate: (persisted) => {
        const state = persisted as HolidayState;
        if (!state?.holidays) return { holidays: seedHolidays } as HolidayStore;
        // Ensure counter is ahead of persisted IDs
        const maxId = state.holidays.reduce((max, h) => {
          const n = parseInt(h.id.replace("h", ""), 10);
          return !isNaN(n) && n > max ? n : max;
        }, holidayCounter);
        if (maxId >= holidayCounter) holidayCounter = maxId;
        return state as HolidayStore;
      },
    }
  )
);

/**
 * Trigger a full project-wide task recompute after holidays change.
 * Called explicitly by HolidaysPage after add/remove — avoids circular
 * imports at module evaluation time.
 *
 * Import pattern: import { triggerHolidayRecompute } from "@/store/holidayStore"
 * Call AFTER the store mutation has committed.
 */
export async function triggerHolidayRecompute(): Promise<void> {
  // Lazy-import pmoStore to break circular dependency
  const { usePMOStore, getAllProjectTasks } = await import("@/store/pmoStore");
  const { recomputeProjectTasks, rollupPhaseDates } = await import("@/utils/taskDates");
  const { derivePhaseStatus } = await import("@/utils/computed");
  const { PHASE_ORDER } = await import("@/types");

  const holidaySet = useHolidayStore.getState().getHolidaySet();
  const { projects } = usePMOStore.getState();

  for (const project of projects) {
    const allTasks = getAllProjectTasks(project);
    if (allTasks.length === 0) continue; // no tasks → nothing to recompute

    const recomputed = recomputeProjectTasks(allTasks, new Date(), holidaySet);

    // Build updated timeline and write it back in one set() call
    const timeline = { ...project.timeline };
    for (const key of PHASE_ORDER) {
      const tasks = recomputed.get(key) ?? [];
      const phase = timeline[key];
      if (tasks.length === 0) {
        timeline[key] = { ...phase, tasks: [] };
      } else {
        const rollup = rollupPhaseDates(tasks);
        timeline[key] = {
          ...phase,
          tasks,
          ...rollup,
          status: phase.statusManualOverride
            ? phase.status
            : derivePhaseStatus({ ...phase, ...rollup }),
        };
      }
    }

    usePMOStore.setState((state) => ({
      projects: state.projects.map((p) =>
        p.id === project.id
          ? { ...p, timeline, updatedAt: new Date().toISOString() }
          : p
      ),
    }));
  }
}
