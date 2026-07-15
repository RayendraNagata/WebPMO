import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Project,
  TeamMember,
  Divisi,
  PhaseKey,
  PhaseData,
  ProjectDocumentation,
  Task,
  TeamAssignment,
} from "@/types";
import {
  PHASE_ORDER,
  createEmptyPhase,
  createEmptyTim,
  createEmptyDocumentation,
  DOCUMENTATION_ITEMS,
} from "@/types";
import { seedProjects, seedTeamMembers } from "@/data/seed";
import {
  normalizeTimeline,
  removeTaskAndRecomputeProjectWide,
  recomputeProjectTasks,
  rollupPhaseDates,
  wouldCreateCycle,
} from "@/utils/taskDates";
import { derivePhaseStatus } from "@/utils/computed";
import { useHolidayStore } from "@/store/holidayStore";

/** Read current holidays as a Set<ISO-string> for working-day calculations. */
function getHolidays(): Set<string> {
  return useHolidayStore.getState().getHolidaySet();
}

// ─── ID Generator ───
let projectCounter = 100;
let memberCounter = 100;
let taskCounter = 100;

function generateProjectId(): string {
  return `p${++projectCounter}`;
}
function generateMemberId(): string {
  return `tm${++memberCounter}`;
}
function generateTaskId(): string {
  return `t${++taskCounter}`;
}

// ─── Store Interface ───
interface PMOState {
  projects: Project[];
  teamMembers: TeamMember[];
}

interface ProjectActions {
  // Read
  getProjectById: (id: string) => Project | undefined;
  getProjectsByDivisi: (divisi: Divisi) => Project[];
  getActiveProjects: () => Project[];

  // Create
  createProject: (data: Omit<Project, "id" | "createdAt" | "updatedAt">) => Project;

  // Update
  updateProject: (id: string, data: Partial<Omit<Project, "id" | "createdAt">>) => void;
  updatePhase: (projectId: string, phaseKey: PhaseKey, data: Partial<PhaseData>) => void;
  updateProjectStatus: (projectId: string, status: Project["status"]) => void;
  updateProjectProgress: (projectId: string, progress: number) => void;
  updateTeamAssignment: (
    projectId: string,
    role: keyof Project["tim"],
    memberIds: string[]
  ) => void;

  // §6.12 Documentation — update a single field on a single doc row
  updateDocumentation: (
    projectId: string,
    docId: string,
    data: Partial<Pick<ProjectDocumentation, "tanggal" | "link" | "status">>
  ) => void;

  // Task CRUD
  addTask: (projectId: string, phaseKey: PhaseKey, task: Omit<Task, "id">) => void;
  updateTask: (
    projectId: string,
    phaseKey: PhaseKey,
    taskId: string,
    data: Partial<Omit<Task, "id">>
  ) => boolean;
  removeTask: (projectId: string, phaseKey: PhaseKey, taskId: string) => void;

  // Delete / Archive
  archiveProject: (id: string) => void;
  deleteProject: (id: string) => void;

  // Phase helpers
  resetBaseline: (projectId: string, phaseKey: PhaseKey) => void;
}

interface TeamMemberActions {
  // Read
  getMemberById: (id: string) => TeamMember | undefined;
  getActiveMembers: () => TeamMember[];
  getMembersByRole: (role: string) => TeamMember[];

  // CRUD
  createMember: (data: Omit<TeamMember, "id">) => TeamMember;
  updateMember: (id: string, data: Partial<Omit<TeamMember, "id">>) => void;
  deleteMember: (id: string) => void;

  // Workload
  getMemberWorkload: (memberId: string) => number;
}

type PMOStore = PMOState & ProjectActions & TeamMemberActions;

// ─── Initial counters from seed data ───
function initCounters(projects: Project[], members: TeamMember[]) {
  const maxPId = projects.reduce((max, p) => {
    const n = parseInt(p.id.replace("p", ""), 10);
    return n > max ? n : max;
  }, 0);
  const maxMId = members.reduce((max, m) => {
    const n = parseInt(m.id.replace("tm", ""), 10);
    return n > max ? n : max;
  }, 0);
  const maxTaskId = projects.reduce((max, p) => {
    return Object.values(p.timeline).reduce((tmax, phase) => {
      return (phase.tasks ?? []).reduce((ttmax, t) => {
        const n = parseInt(t.id.replace("t", ""), 10);
        return !isNaN(n) && n > ttmax ? n : ttmax;
      }, tmax);
    }, max);
  }, 0);

  if (maxPId >= projectCounter) projectCounter = maxPId;
  if (maxMId >= memberCounter) memberCounter = maxMId;
  if (maxTaskId >= taskCounter) taskCounter = maxTaskId;
}

// Initialize counters from seed
initCounters(seedProjects, seedTeamMembers);

/** Ensure every phase has a tasks array and recompute task-driven dates. */
function normalizeProject(project: Project): Project {
  const timeline = normalizeTimeline(
    Object.fromEntries(
      PHASE_ORDER.map((key) => {
        const phase = project.timeline[key] ?? createEmptyPhase();
        return [key, { ...createEmptyPhase(), ...phase, tasks: phase.tasks ?? [] }];
      })
    ) as Record<PhaseKey, PhaseData>,
    new Date(),
    getHolidays()
  );

  // §6.12: ensure documentation array is always the full 13-item list.
  // If the project has a valid documentation array already (13 items with
  // the correct ids), leave it untouched. Otherwise seed it fresh.
  const existingDoc = (project as unknown as Record<string, unknown>).documentation;
  const documentation = normalizeDocumentation(existingDoc);

  return { ...project, timeline, documentation };
}

/**
 * §6.12 migration helper: given whatever is stored under "documentation"
 * (may be undefined, empty, partial, or already the correct 13-item array),
 * return a valid 13-item array, preserving any tanggal/link the user has filled.
 * Idempotent — safe to run on already-migrated data.
 */
function normalizeDocumentation(raw: unknown): ProjectDocumentation[] {
  const base = createEmptyDocumentation();

  if (!Array.isArray(raw) || raw.length === 0) {
    // Missing entirely (old milestones-era data) or empty — start fresh
    return base;
  }

  // Build a map from id → stored entry for quick lookup
  const stored = new Map<string, Partial<ProjectDocumentation>>();
  for (const item of raw as Partial<ProjectDocumentation>[]) {
    if (item?.id) stored.set(item.id, item);
  }

  // Merge: keep the fixed structure (nomor/nama from DOCUMENTATION_ITEMS),
  // but preserve any tanggal/link/status the user already filled in.
  // status defaults to "NOT_YET" if not present (handles pre-status data in localStorage).
  return base.map((item) => {
    const existing = stored.get(item.id);
    return {
      ...item,
      tanggal: existing?.tanggal ?? null,
      link: existing?.link ?? null,
      status: existing?.status ?? "NOT_YET",
    };
  });
}

function normalizeProjects(projects: Project[]): Project[] {
  return projects.map(normalizeProject);
}

/** Collect all tasks across every phase of a project into a flat array. */
export function getAllProjectTasks(project: Project): Task[] {
  return PHASE_ORDER.flatMap((key) => project.timeline[key]?.tasks ?? []);
}

function applyProjectTaskUpdate(
  project: Project,
  recomputed: Map<PhaseKey, Task[]>
): Project["timeline"] {
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
  return timeline;
}

// ─── Helper: now ISO string ───
function now(): string {
  return new Date().toISOString();
}

/**
 * §6.11: Post Implementation Support default end = start + 3 months.
 * Uses local calendar so there's no UTC-midnight drift on positive offsets.
 */
function addThreeMonths(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  let targetMonth = m + 2; // 0-indexed: month is m-1, so m+2 = m-1+3
  let targetYear = y;
  if (targetMonth > 11) {
    targetMonth -= 12;
    targetYear += 1;
  }
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

// ─── Store ───
export const usePMOStore = create<PMOStore>()(
  persist(
    (set, get) => ({
      // ── State ──
      projects: normalizeProjects(seedProjects),
      teamMembers: seedTeamMembers,

      // ═══════════════════════════════════════
      //  PROJECT ACTIONS
      // ═══════════════════════════════════════

      getProjectById: (id) => get().projects.find((p) => p.id === id),

      getProjectsByDivisi: (divisi) =>
        get().projects.filter((p) => p.divisi === divisi && !p.isArchived),

      getActiveProjects: () =>
        get().projects.filter(
          (p) => !p.isArchived && p.status !== "COMPLETED" && p.status !== "ON_HOLD"
        ),

      createProject: (data) => {
        const timestamp = now();
        const currentProjects = get().projects;
        const maxExisting = currentProjects.reduce((max, p) => {
          const n = parseInt(p.id.replace("p", ""), 10);
          return !isNaN(n) && n > max ? n : max;
        }, projectCounter);
        if (maxExisting > projectCounter) projectCounter = maxExisting;

        const project: Project = {
          ...data,
          id: generateProjectId(),
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((state) => ({ projects: [...state.projects, project] }));
        return project;
      },

      updateProject: (id, data) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...data, updatedAt: now() } : p
          ),
        }));
      },

      updatePhase: (projectId, phaseKey, data) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            const existing = p.timeline[phaseKey];
            const updated: PhaseData = { ...existing, ...data };

            // Baseline capture (draft.md 6.1): set baseline on FIRST fill
            if (data.start && !existing.baselineStart) {
              updated.baselineStart = data.start;
            }
            if (data.end && !existing.baselineEnd) {
              updated.baselineEnd = data.end;
            }

            // §6.11: Post Implementation Support 3-month default end
            if (
              phaseKey === "postImplementationSupport" &&
              data.start &&
              !existing.start &&
              !updated.end
            ) {
              updated.end = addThreeMonths(data.start);
              if (!updated.baselineEnd) {
                updated.baselineEnd = updated.end;
              }
            }

            return {
              ...p,
              timeline: { ...p.timeline, [phaseKey]: updated },
              updatedAt: now(),
            };
          }),
        }));
      },

      updateProjectStatus: (projectId, status) => {
        get().updateProject(projectId, { status });
      },

      updateProjectProgress: (projectId, progress) => {
        get().updateProject(projectId, { progress: Math.min(100, Math.max(0, progress)) });
      },

      updateTeamAssignment: (projectId, role, memberIds) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, tim: { ...p.tim, [role]: memberIds }, updatedAt: now() }
              : p
          ),
        }));
      },

      // ── §6.12 Documentation CRUD ──

      updateDocumentation: (projectId, docId, data) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              documentation: p.documentation.map((doc) =>
                doc.id === docId ? { ...doc, ...data } : doc
              ),
              updatedAt: now(),
            };
          }),
        }));
      },

      // ── Task CRUD ──

      addTask: (projectId, phaseKey, task) => {
        const newTask: Task = {
          ...task,
          id: generateTaskId(),
        };
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            const phase = p.timeline[phaseKey];
            return {
              ...p,
              timeline: {
                ...p.timeline,
                [phaseKey]: { ...phase, tasks: [...(phase.tasks ?? []), newTask] },
              },
              updatedAt: now(),
            };
          }),
        }));
      },

      updateTask: (projectId, _phaseKey, taskId, data) => {
        const project = get().projects.find((p) => p.id === projectId);
        if (!project) return false;

        if (data.predecessorIds !== undefined) {
          const allTasks = getAllProjectTasks(project);
          if (wouldCreateCycle(allTasks, taskId, data.predecessorIds)) {
            return false;
          }
        }

        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            const allTasks = getAllProjectTasks(p).map((t) =>
              t.id === taskId ? { ...t, ...data } : t
            );
            const recomputed = recomputeProjectTasks(allTasks, new Date(), getHolidays());
            const updatedTimeline = applyProjectTaskUpdate(p, recomputed);
            return { ...p, timeline: updatedTimeline, updatedAt: now() };
          }),
        }));
        return true;
      },

      removeTask: (projectId, _phaseKey, taskId) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            const allTasks = getAllProjectTasks(p);
            const recomputed = removeTaskAndRecomputeProjectWide(
              allTasks,
              taskId,
              new Date(),
              getHolidays()
            );
            const updatedTimeline = applyProjectTaskUpdate(p, recomputed);
            return { ...p, timeline: updatedTimeline, updatedAt: now() };
          }),
        }));
      },

      // ── Delete / Archive ──

      archiveProject: (id) => {
        get().updateProject(id, { isArchived: true });
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        }));
      },

      // ── Phase helpers ──

      resetBaseline: (projectId, phaseKey) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            const phase = p.timeline[phaseKey];
            return {
              ...p,
              timeline: {
                ...p.timeline,
                [phaseKey]: {
                  ...phase,
                  baselineStart: phase.start,
                  baselineEnd: phase.end,
                },
              },
              updatedAt: now(),
            };
          }),
        }));
      },

      // ═══════════════════════════════════════
      //  TEAM MEMBER ACTIONS
      // ═══════════════════════════════════════

      getMemberById: (id) => get().teamMembers.find((m) => m.id === id),

      getActiveMembers: () => get().teamMembers.filter((m) => m.isActive),

      getMembersByRole: (role) =>
        get().teamMembers.filter((m) => m.role === role && m.isActive),

      createMember: (data) => {
        const member: TeamMember = {
          ...data,
          id: generateMemberId(),
        };
        set((state) => ({ teamMembers: [...state.teamMembers, member] }));
        return member;
      },

      updateMember: (id, data) => {
        set((state) => ({
          teamMembers: state.teamMembers.map((m) =>
            m.id === id ? { ...m, ...data } : m
          ),
        }));
      },

      deleteMember: (id) => {
        set((state) => ({
          teamMembers: state.teamMembers.filter((m) => m.id !== id),
        }));
      },

      getMemberWorkload: (memberId) => {
        return get().projects.filter(
          (p) =>
            !p.isArchived &&
            p.status !== "COMPLETED" &&
            p.status !== "ON_HOLD" &&
            Object.values(p.tim).some((ids) => ids.includes(memberId))
        ).length;
      },
    }),
    {
      name: "pmo-workflow-store",
      version: 6,
      migrate: (persistedState, version) => {
        const state = persistedState as PMOState;
        if (!state?.projects) return state as PMOStore;

        // ── §6.11 Phase key migration mapping (still needed for pre-v4 data) ──
        const OLD_TO_NEW_PHASE_MAP: Record<string, string> = {
          discovery:    "userRequirement",
          development:  "development",
          testing:      "testing",
          uat:          "uat",
          goLive:       "goLive",
          supportGoLive:"postImplementationSupport",
        };

        function migrateTimeline(
          rawTimeline: Record<string, PhaseData> | undefined
        ): Record<PhaseKey, PhaseData> {
          const result: Record<string, PhaseData> = Object.fromEntries(
            PHASE_ORDER.map((k) => [k, createEmptyPhase()])
          );
          if (!rawTimeline) return result as Record<PhaseKey, PhaseData>;

          for (const key of PHASE_ORDER) {
            if (rawTimeline[key]) {
              result[key] = {
                ...createEmptyPhase(),
                ...rawTimeline[key],
                tasks: (rawTimeline[key] as PhaseData).tasks ?? [],
              };
            }
          }
          for (const [oldKey, newKey] of Object.entries(OLD_TO_NEW_PHASE_MAP)) {
            if (rawTimeline[oldKey] && !rawTimeline[newKey]) {
              result[newKey] = {
                ...createEmptyPhase(),
                ...rawTimeline[oldKey],
                tasks: (rawTimeline[oldKey] as PhaseData).tasks ?? [],
              };
            }
          }
          return result as Record<PhaseKey, PhaseData>;
        }

        const migrated: PMOState = {
          ...state,
          projects: state.projects.map((p) => {
            const timeline = migrateTimeline(
              p.timeline as unknown as Record<string, PhaseData>
            );
            const emptyTim = createEmptyTim();
            const tim = { ...emptyTim, ...p.tim } as TeamAssignment;

            // §6.12: migrate documentation — drop old milestones, seed fresh 13-item array.
            // normalizeDocumentation handles: missing field, empty array, partial array,
            // and already-complete array (idempotent).
            const rawDoc = (p as unknown as Record<string, unknown>).documentation;
            const documentation = normalizeDocumentation(rawDoc);

            return normalizeProject({ ...p, tim, timeline, documentation });
          }),
        };

        if (version < 2) {
          initCounters(migrated.projects, state.teamMembers ?? seedTeamMembers);
        }

        return { ...migrated, teamMembers: state.teamMembers ?? seedTeamMembers } as PMOStore;
      },
    }
  )
);

// Keep DOCUMENTATION_ITEMS accessible for components that need the ordered list
export { DOCUMENTATION_ITEMS };
