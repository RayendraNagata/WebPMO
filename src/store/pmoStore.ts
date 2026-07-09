import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Project,
  TeamMember,
  Divisi,
  PhaseKey,
  PhaseData,
  Milestone,
  Task,
} from "@/types";
import { PHASE_ORDER, createEmptyPhase } from "@/types";
import { seedProjects, seedTeamMembers } from "@/data/seed";
import {
  normalizePhaseData,
  normalizeTimeline,
  removeTaskAndRecomputeProjectWide,
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
let milestoneCounter = 100;
let taskCounter = 100;

function generateProjectId(): string {
  return `p${++projectCounter}`;
}
function generateMemberId(): string {
  return `tm${++memberCounter}`;
}
function generateMilestoneId(): string {
  return `m${++milestoneCounter}`;
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

  // Milestone CRUD
  addMilestone: (projectId: string, milestone: Omit<Milestone, "id">) => void;
  updateMilestone: (projectId: string, milestoneId: string, data: Partial<Omit<Milestone, "id">>) => void;
  removeMilestone: (projectId: string, milestoneId: string) => void;

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
  const maxMilestoneId = projects.reduce((max, p) => {
    return p.milestones.reduce((mmax, ms) => {
      const n = parseInt(ms.id.replace("m", ""), 10);
      return n > mmax ? n : mmax;
    }, max);
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
  if (maxMilestoneId >= milestoneCounter) milestoneCounter = maxMilestoneId;
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

  return { ...project, timeline };
}

function normalizeProjects(projects: Project[]): Project[] {
  return projects.map(normalizeProject);
}

function applyPhaseTaskUpdate(
  phase: PhaseData,
  tasks: Task[]
): PhaseData {
  if (tasks.length === 0) {
    return { ...phase, tasks: [] };
  }
  return normalizePhaseData({ ...phase, tasks }, new Date(), getHolidays());
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

      // ── Milestone CRUD ──

      addMilestone: (projectId, milestone) => {
        const newMilestone: Milestone = {
          ...milestone,
          id: generateMilestoneId(),
        };
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, milestones: [...p.milestones, newMilestone], updatedAt: now() }
              : p
          ),
        }));
      },

      updateMilestone: (projectId, milestoneId, data) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  milestones: p.milestones.map((m) =>
                    m.id === milestoneId ? { ...m, ...data } : m
                  ),
                  updatedAt: now(),
                }
              : p
          ),
        }));
      },

      removeMilestone: (projectId, milestoneId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  milestones: p.milestones.filter((m) => m.id !== milestoneId),
                  updatedAt: now(),
                }
              : p
          ),
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
            // Append raw — do NOT recompute here.
            // A brand-new task has predecessorIds:[] and start:null by design
            // (spec §6.9: "start = date user explicitly sets, OR default to today
            // if never set"). Triggering recomputePhaseTasks would immediately
            // anchor start=today and persist it before the user has touched
            // anything, making start look user-set on the very next render.
            // Recompute only fires when the user actually changes duration,
            // predecessors, or start date (all go through updateTask).
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

      updateTask: (projectId, phaseKey, taskId, data) => {
        const project = get().projects.find((p) => p.id === projectId);
        if (!project) return false;

        const phase = project.timeline[phaseKey];
        const tasks = phase.tasks ?? [];

        // §6.10: cycle check must use ALL project tasks, not just one phase
        if (data.predecessorIds !== undefined) {
          const allTasks = getAllProjectTasks(project);
          if (wouldCreateCycle(allTasks, taskId, data.predecessorIds)) {
            return false;
          }
        }

        const updatedTasks = tasks.map((t) =>
          t.id === taskId ? { ...t, ...data } : t
        );

        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            const currentPhase = p.timeline[phaseKey];
            return {
              ...p,
              timeline: {
                ...p.timeline,
                [phaseKey]: applyPhaseTaskUpdate(currentPhase, updatedTasks),
              },
              updatedAt: now(),
            };
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
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as PMOState;
        if (!state?.projects) return state as PMOStore;

        const migrated: PMOState = {
          ...state,
          projects: state.projects.map((p) => {
            const timeline = Object.fromEntries(
              PHASE_ORDER.map((key) => {
                const raw = p.timeline?.[key] ?? createEmptyPhase();
                return [
                  key,
                  {
                    ...createEmptyPhase(),
                    ...raw,
                    tasks: raw.tasks ?? [],
                  },
                ];
              })
            ) as Record<PhaseKey, PhaseData>;

            return normalizeProject({ ...p, timeline });
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
