// ─── Data Model (draft.md section 3) — do NOT deviate ───

export type Divisi = "HOTD1" | "HOTD2_FINANCE" | "HOTD2_NONFINANCE";

export type ProjectStatus =
  | "NOT_STARTED"
  | "ON_TRACK"
  | "AT_RISK"
  | "DELAYED"
  | "ON_HOLD"
  | "COMPLETED";

export type PhaseKey =
  | "discovery"
  | "development"
  | "testing"
  | "uat"
  | "goLive"
  | "supportGoLive";

export type PhaseStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export interface Task {
  id: string;
  phaseKey: PhaseKey; // task ini milik fase yang mana
  nama: string;
  durationMandays: number; // dalam hari kerja, boleh desimal (misal 0.5)
  predecessorIds: string[]; // id Task lain — HANYA task di fase yang SAMA
  start: string | null; // COMPUTED, jangan diisi manual
  end: string | null; // COMPUTED, jangan diisi manual
  status: TaskStatus;
  statusManualOverride: boolean;
  order: number; // urutan tampil untuk task tanpa predecessor
  assigneeId?: string; // optional, TeamMember id
}

export interface PhaseData {
  start: string | null; // ISO date, null kalau belum diisi
  end: string | null;
  baselineStart: string | null; // di-set SEKALI saat pertama kali start diisi
  baselineEnd: string | null;
  status: PhaseStatus; // auto-derive dari tanggal (lihat bag. 6.5), bisa di-override manual
  statusManualOverride: boolean; // true kalau PM pernah override manual
  tasks: Task[]; // kalau array ini kosong, fase pakai tanggal manual seperti sekarang
}

export interface Milestone {
  id: string;
  nama: string;
  tanggal: string; // ISO date
}

export interface TeamAssignment {
  BPA: string[]; // array of TeamMember.id
  DEV: string[];
  PQA: string[];
  // role lain bisa ditambah sebagai key baru di objek ini
}

export interface Project {
  id: string;
  divisi: Divisi;
  nama: string;
  deskripsi: string;
  status: ProjectStatus;
  progress: number; // 0-100
  progressMode: "manual" | "auto";
  tim: TeamAssignment;
  timeline: Record<PhaseKey, PhaseData>;
  milestones: Milestone[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  nama: string;
  role: string; // "BPA" | "DEV" | "PQA" | custom
  isActive: boolean;
}

// ─── Holiday (§6.10 Part B) ───
// Global collection — not per-project. Affects all working-day calculations.
export interface Holiday {
  id: string;
  tanggal: string; // ISO date, e.g. "2026-08-17"
  nama: string;    // e.g. "Hari Kemerdekaan RI"
}

// ─── Helpers & Constants ───

export const PHASE_ORDER: PhaseKey[] = [
  "discovery",
  "development",
  "testing",
  "uat",
  "goLive",
  "supportGoLive",
] as const;

export const PHASE_LABELS: Record<PhaseKey, string> = {
  discovery: "Discovery",
  development: "Development",
  testing: "Testing",
  uat: "UAT",
  goLive: "Go Live",
  supportGoLive: "Support Go Live",
};

export const DIVISI_LABELS: Record<Divisi, string> = {
  HOTD1: "HOTD 1",
  HOTD2_FINANCE: "HOTD 2 - Finance",
  HOTD2_NONFINANCE: "HOTD 2 - Non-Finance",
};

/** Map URL slug → Divisi enum value */
export const DIVISI_SLUG_MAP: Record<string, Divisi> = {
  hotd1: "HOTD1",
  "hotd2-finance": "HOTD2_FINANCE",
  "hotd2-nonfinance": "HOTD2_NONFINANCE",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  NOT_STARTED: "Not Started",
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  DELAYED: "Delayed",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
};

/** Creates a blank PhaseData with all null/default values */
export function createEmptyPhase(): PhaseData {
  return {
    start: null,
    end: null,
    baselineStart: null,
    baselineEnd: null,
    status: "NOT_STARTED",
    statusManualOverride: false,
    tasks: [],
  };
}

/** Creates a full empty timeline (all 6 phases) */
export function createEmptyTimeline(): Record<PhaseKey, PhaseData> {
  return Object.fromEntries(
    PHASE_ORDER.map((key) => [key, createEmptyPhase()])
  ) as Record<PhaseKey, PhaseData>;
}

/** Creates a blank Project with sensible defaults */
export function createBlankProject(divisi: Divisi): Omit<Project, "id" | "createdAt" | "updatedAt"> {
  return {
    divisi,
    nama: "",
    deskripsi: "",
    status: "NOT_STARTED",
    progress: 0,
    progressMode: "manual",
    tim: { BPA: [], DEV: [], PQA: [] },
    timeline: createEmptyTimeline(),
    milestones: [],
    isArchived: false,
  };
}
