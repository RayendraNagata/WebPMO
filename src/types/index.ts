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
  | "userRequirement"            // 1. User Requirement
  | "development"                // 2. Development
  | "testing"                    // 3. Testing
  | "uat"                        // 4. UAT
  | "pentest"                    // 5. Pentest
  | "defectdojo"                 // 6. Defectdojo (Code Quality)
  | "goLive"                     // 7. Go Live
  | "postImplementationSupport"  // 8. Post Implementation Support
  | "projectHandover";           // 9. Project Handover

export type PhaseStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export interface Task {
  id: string;
  phaseKey: PhaseKey; // task ini milik fase yang mana
  nama: string;
  durationMandays: number; // dalam hari kerja, boleh desimal (misal 0.5)
  predecessorIds: string[]; // id Task lain — cross-phase (§6.10)
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

// ─── §6.12: Project Documentation Checklist ───
// Replaces the old free-form Milestone concept.
// 13 fixed items per project — user fills tanggal, link, and status per row.
export type DocStatus = "NOT_YET" | "COMPLETED" | "NOT_NEEDED";

export interface ProjectDocumentation {
  id: string;           // fixed slug, e.g. "PROJECT_CHARTER", "RDM"
  nomor: number;        // 1–13, fixed display order
  nama: string;         // fixed label, e.g. "PROJECT CHARTER"
  tanggal: string | null; // ISO date, user-filled, optional
  link: string | null;    // URL, user-filled, optional
  status: DocStatus;    // NOT_YET (default) | COMPLETED | NOT_NEEDED
}

/** The 13 fixed documentation items, in order. Used to seed and migrate. */
export const DOCUMENTATION_ITEMS: ReadonlyArray<Pick<ProjectDocumentation, "id" | "nomor" | "nama">> = [
  { nomor: 1,  id: "PROJECT_CHARTER",  nama: "PROJECT CHARTER" },
  { nomor: 2,  id: "RDM",              nama: "RDM" },
  { nomor: 3,  id: "BPS",              nama: "BPS" },
  { nomor: 4,  id: "HLD_TSD",          nama: "HLD/TSD" },
  { nomor: 5,  id: "TEST_PLAN",        nama: "TEST PLAN" },
  { nomor: 6,  id: "UAT_REPORT",       nama: "UAT REPORT" },
  { nomor: 7,  id: "JUKLAK",           nama: "JUKLAK" },
  { nomor: 8,  id: "PENTEST_REPORT",   nama: "PENTEST REPORT" },
  { nomor: 9,  id: "WI_DEPLOY",        nama: "WI DEPLOY" },
  { nomor: 10, id: "SOURCE_CODE",      nama: "SOURCE CODE" },
  { nomor: 11, id: "APPS_FORM",        nama: "APPS FORM" },
  { nomor: 12, id: "FAQ",              nama: "FAQ (if any)" },
  { nomor: 13, id: "PROJECT_CLOSURE",  nama: "PROJECT CLOSURE" },
] as const;

/** Returns a fresh 13-item documentation array with all fields empty. */
export function createEmptyDocumentation(): ProjectDocumentation[] {
  return DOCUMENTATION_ITEMS.map((item) => ({
    ...item,
    tanggal: null,
    link: null,
    status: "NOT_YET" as DocStatus,
  }));
}

export interface TeamAssignment {
  "Product Manager": string[];
  BSM: string[];
  BPA: string[];
  "UI/UX": string[];
  DEV: string[];
  PQA: string[];
  ABAP: string[];
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
  documentation: ProjectDocumentation[]; // §6.12 — replaces milestones
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
  "userRequirement",
  "development",
  "testing",
  "uat",
  "pentest",
  "defectdojo",
  "goLive",
  "postImplementationSupport",
  "projectHandover",
] as const;

export const PHASE_LABELS: Record<PhaseKey, string> = {
  userRequirement:           "User Requirement",
  development:               "Development",
  testing:                   "Testing",
  uat:                       "UAT",
  pentest:                   "Pentest",
  defectdojo:                "Defectdojo (Code Quality)",
  goLive:                    "Go Live",
  postImplementationSupport: "Post Implementation Support",
  projectHandover:           "Project Handover",
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

/** Creates a full empty timeline (all 9 phases) */
export function createEmptyTimeline(): Record<PhaseKey, PhaseData> {
  return Object.fromEntries(
    PHASE_ORDER.map((key) => [key, createEmptyPhase()])
  ) as Record<PhaseKey, PhaseData>;
}

/** Creates an empty TeamAssignment with all 7 roles */
export function createEmptyTim(): TeamAssignment {
  return {
    "Product Manager": [],
    BSM:  [],
    BPA:  [],
    "UI/UX": [],
    DEV:  [],
    PQA:  [],
    ABAP: [],
  };
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
    tim: { "Product Manager": [], BSM: [], BPA: [], "UI/UX": [], DEV: [], PQA: [], ABAP: [] },
    timeline: createEmptyTimeline(),
    documentation: createEmptyDocumentation(),
    isArchived: false,
  };
}
