import type { TeamMember, Project } from "@/types";
import { createEmptyDocumentation } from "@/types";

// ─── Seed: Team Members ───

export const seedTeamMembers: TeamMember[] = [
  { id: "tm1",  nama: "Andi Pratama",    role: "BPA",             isActive: true },
  { id: "tm2",  nama: "Budi Santoso",    role: "DEV",             isActive: true },
  { id: "tm3",  nama: "Citra Dewi",      role: "DEV",             isActive: true },
  { id: "tm4",  nama: "Dian Permata",    role: "PQA",             isActive: true },
  { id: "tm5",  nama: "Eka Wijaya",      role: "BPA",             isActive: true },
  { id: "tm6",  nama: "Fajar Nugroho",   role: "DEV",             isActive: true },
  { id: "tm7",  nama: "Gita Ayu",        role: "PQA",             isActive: true },
  { id: "tm8",  nama: "Hendra Kusuma",   role: "DEV",             isActive: true },
  { id: "tm9",  nama: "Indah Sari",      role: "BPA",             isActive: true },
  { id: "tm10", nama: "Joko Widodo",     role: "DEV",             isActive: false },
  { id: "tm11", nama: "Kartika Putri",   role: "PQA",             isActive: true },
  { id: "tm12", nama: "Lukman Hakim",    role: "DEV",             isActive: true },
  { id: "tm13", nama: "Maya Susanti",    role: "Product Manager", isActive: true },
  { id: "tm14", nama: "Nanda Rizky",     role: "Product Manager", isActive: true },
  { id: "tm15", nama: "Omar Fauzi",      role: "BSM",             isActive: true },
  { id: "tm16", nama: "Putri Handayani", role: "BSM",             isActive: true },
  { id: "tm17", nama: "Raka Setiawan",   role: "UI/UX",           isActive: true },
  { id: "tm18", nama: "Sari Dewi",       role: "UI/UX",           isActive: true },
  { id: "tm19", nama: "Taufik Hidayat",  role: "ABAP",            isActive: true },
  { id: "tm20", nama: "Uli Ariani",      role: "ABAP",            isActive: true },
];

const EMPTY_TIM = {
  "Product Manager": [] as string[],
  BSM:               [] as string[],
  BPA:               [] as string[],
  "UI/UX":           [] as string[],
  DEV:               [] as string[],
  PQA:               [] as string[],
  ABAP:              [] as string[],
};

const EMPTY_PHASE = {
  start: null, end: null,
  baselineStart: null, baselineEnd: null,
  status: "NOT_STARTED" as const,
  statusManualOverride: false,
  tasks: [],
};

// ─── Seed: Projects ───

export const seedProjects: Project[] = [
  // ── p1: HOTD1 — baseline differs from aktual for Gantt testing ──
  {
    id: "p1",
    divisi: "HOTD1",
    nama: "Migrasi Sistem Approval",
    deskripsi: "Migrasi alur approval dari sistem lama ke platform baru",
    status: "ON_TRACK",
    progress: 40,
    progressMode: "manual",
    tim: { ...EMPTY_TIM, BPA: ["tm1"], DEV: ["tm2", "tm3"], PQA: ["tm4"] },
    timeline: {
      userRequirement: {
        start: "2026-05-01", end: "2026-05-15",
        baselineStart: "2026-05-01", baselineEnd: "2026-05-15",
        status: "DONE", statusManualOverride: false, tasks: [],
      },
      development: {
        start: "2026-05-16", end: "2026-06-30",
        baselineStart: "2026-05-16", baselineEnd: "2026-06-20",
        status: "IN_PROGRESS", statusManualOverride: false,
        tasks: [
          {
            id: "t1", phaseKey: "development", nama: "Setup dev environment",
            durationMandays: 2, predecessorIds: [], start: "2026-05-16", end: null,
            status: "NOT_STARTED", statusManualOverride: false, order: 0, assigneeId: "tm2",
          },
          {
            id: "t2", phaseKey: "development", nama: "Migrate core API endpoints",
            durationMandays: 5, predecessorIds: ["t1"], start: null, end: null,
            status: "NOT_STARTED", statusManualOverride: false, order: 1, assigneeId: "tm3",
          },
          {
            id: "t3", phaseKey: "development", nama: "UI integration & wiring",
            durationMandays: 4, predecessorIds: ["t2"], start: null, end: null,
            status: "NOT_STARTED", statusManualOverride: false, order: 2, assigneeId: "tm2",
          },
          {
            id: "t4", phaseKey: "development", nama: "Unit & integration testing",
            durationMandays: 3, predecessorIds: ["t3"], start: null, end: null,
            status: "NOT_STARTED", statusManualOverride: false, order: 3, assigneeId: "tm6",
          },
          {
            id: "t5", phaseKey: "development", nama: "Code review & merge",
            durationMandays: 1, predecessorIds: ["t4"], start: null, end: null,
            status: "NOT_STARTED", statusManualOverride: false, order: 4, assigneeId: "tm8",
          },
        ],
      },
      testing: {
        start: "2026-07-01", end: "2026-07-15",
        baselineStart: "2026-06-21", baselineEnd: "2026-07-05",
        status: "NOT_STARTED", statusManualOverride: false, tasks: [],
      },
      uat:                      { ...EMPTY_PHASE },
      pentest:                  { ...EMPTY_PHASE },
      defectdojo:               { ...EMPTY_PHASE },
      goLive:                   { ...EMPTY_PHASE },
      postImplementationSupport:{ ...EMPTY_PHASE },
      projectHandover:          { ...EMPTY_PHASE },
    },
    documentation: createEmptyDocumentation(),
    isArchived: false,
    createdAt: "2026-04-20T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },

  // ── p2: HOTD1 — COMPLETED (all 9 phases done) ──
  {
    id: "p2",
    divisi: "HOTD1",
    nama: "Dashboard Monitoring Inventory",
    deskripsi: "Dashboard real-time untuk monitoring stok inventory gudang",
    status: "COMPLETED",
    progress: 100,
    progressMode: "auto",
    tim: { ...EMPTY_TIM, BPA: ["tm5"], DEV: ["tm6"], PQA: ["tm7"] },
    timeline: {
      userRequirement:          { start: "2026-01-10", end: "2026-01-25", baselineStart: "2026-01-10", baselineEnd: "2026-01-25", status: "DONE", statusManualOverride: false, tasks: [] },
      development:              { start: "2026-01-26", end: "2026-02-28", baselineStart: "2026-01-26", baselineEnd: "2026-02-28", status: "DONE", statusManualOverride: false, tasks: [] },
      testing:                  { start: "2026-03-01", end: "2026-03-15", baselineStart: "2026-03-01", baselineEnd: "2026-03-15", status: "DONE", statusManualOverride: false, tasks: [] },
      uat:                      { start: "2026-03-16", end: "2026-03-25", baselineStart: "2026-03-16", baselineEnd: "2026-03-25", status: "DONE", statusManualOverride: false, tasks: [] },
      pentest:                  { start: "2026-03-26", end: "2026-03-28", baselineStart: "2026-03-26", baselineEnd: "2026-03-28", status: "DONE", statusManualOverride: false, tasks: [] },
      defectdojo:               { start: "2026-03-26", end: "2026-03-28", baselineStart: "2026-03-26", baselineEnd: "2026-03-28", status: "DONE", statusManualOverride: false, tasks: [] },
      goLive:                   { start: "2026-03-29", end: "2026-03-30", baselineStart: "2026-03-29", baselineEnd: "2026-03-30", status: "DONE", statusManualOverride: false, tasks: [] },
      postImplementationSupport:{ start: "2026-03-31", end: "2026-06-30", baselineStart: "2026-03-31", baselineEnd: "2026-06-30", status: "DONE", statusManualOverride: false, tasks: [] },
      projectHandover:          { start: "2026-07-01", end: "2026-07-05", baselineStart: "2026-07-01", baselineEnd: "2026-07-05", status: "DONE", statusManualOverride: false, tasks: [] },
    },
    documentation: createEmptyDocumentation(),
    isArchived: false,
    createdAt: "2026-01-05T00:00:00Z",
    updatedAt: "2026-07-05T00:00:00Z",
  },

  // ── p3: HOTD2_FINANCE — AT_RISK ──
  {
    id: "p3",
    divisi: "HOTD2_FINANCE",
    nama: "Integrasi Payment Gateway",
    deskripsi: "Integrasi dengan payment gateway baru untuk transaksi digital",
    status: "AT_RISK",
    progress: 25,
    progressMode: "manual",
    tim: { ...EMPTY_TIM, BPA: ["tm1", "tm9"], DEV: ["tm2", "tm8", "tm12"], PQA: ["tm4"] },
    timeline: {
      userRequirement:          { start: "2026-05-15", end: "2026-06-01", baselineStart: "2026-05-15", baselineEnd: "2026-06-01", status: "DONE",        statusManualOverride: false, tasks: [] },
      development:              { start: "2026-06-02", end: "2026-07-20", baselineStart: "2026-06-02", baselineEnd: "2026-07-10", status: "IN_PROGRESS", statusManualOverride: false, tasks: [] },
      testing:                  { start: "2026-07-21", end: "2026-08-10", baselineStart: "2026-07-11", baselineEnd: "2026-07-25", status: "NOT_STARTED", statusManualOverride: false, tasks: [] },
      uat:                      { ...EMPTY_PHASE },
      pentest:                  { ...EMPTY_PHASE },
      defectdojo:               { ...EMPTY_PHASE },
      goLive:                   { ...EMPTY_PHASE },
      postImplementationSupport:{ ...EMPTY_PHASE },
      projectHandover:          { ...EMPTY_PHASE },
    },
    documentation: createEmptyDocumentation(),
    isArchived: false,
    createdAt: "2026-05-10T00:00:00Z",
    updatedAt: "2026-07-05T00:00:00Z",
  },

  // ── p4: HOTD2_FINANCE — NOT_STARTED ──
  {
    id: "p4",
    divisi: "HOTD2_FINANCE",
    nama: "Revamp Modul Reporting",
    deskripsi: "Redesign modul reporting keuangan agar lebih fleksibel",
    status: "NOT_STARTED",
    progress: 0,
    progressMode: "manual",
    tim: { ...EMPTY_TIM },
    timeline: {
      userRequirement:          { ...EMPTY_PHASE },
      development:              { ...EMPTY_PHASE },
      testing:                  { ...EMPTY_PHASE },
      uat:                      { ...EMPTY_PHASE },
      pentest:                  { ...EMPTY_PHASE },
      defectdojo:               { ...EMPTY_PHASE },
      goLive:                   { ...EMPTY_PHASE },
      postImplementationSupport:{ ...EMPTY_PHASE },
      projectHandover:          { ...EMPTY_PHASE },
    },
    documentation: createEmptyDocumentation(),
    isArchived: false,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },

  // ── p5: HOTD2_NONFINANCE — DELAYED ──
  {
    id: "p5",
    divisi: "HOTD2_NONFINANCE",
    nama: "Sistem Manajemen Dokumen HR",
    deskripsi: "Digitalisasi dan manajemen dokumen karyawan HR",
    status: "DELAYED",
    progress: 33,
    progressMode: "auto",
    tim: { ...EMPTY_TIM, BPA: ["tm5"], DEV: ["tm3", "tm6"], PQA: ["tm11"] },
    timeline: {
      userRequirement:          { start: "2026-03-01", end: "2026-03-20", baselineStart: "2026-03-01", baselineEnd: "2026-03-15", status: "DONE",        statusManualOverride: false, tasks: [] },
      development:              { start: "2026-03-21", end: "2026-05-15", baselineStart: "2026-03-16", baselineEnd: "2026-04-30", status: "DONE",        statusManualOverride: false, tasks: [] },
      testing:                  { start: "2026-05-16", end: "2026-06-10", baselineStart: "2026-05-01", baselineEnd: "2026-05-20", status: "IN_PROGRESS", statusManualOverride: true,  tasks: [] },
      uat:                      { ...EMPTY_PHASE },
      pentest:                  { ...EMPTY_PHASE },
      defectdojo:               { ...EMPTY_PHASE },
      goLive:                   { ...EMPTY_PHASE },
      postImplementationSupport:{ ...EMPTY_PHASE },
      projectHandover:          { ...EMPTY_PHASE },
    },
    documentation: createEmptyDocumentation(),
    isArchived: false,
    createdAt: "2026-02-20T00:00:00Z",
    updatedAt: "2026-06-25T00:00:00Z",
  },

  // ── p6: HOTD2_NONFINANCE — ON_HOLD ──
  {
    id: "p6",
    divisi: "HOTD2_NONFINANCE",
    nama: "Portal Self-Service Karyawan",
    deskripsi: "Portal untuk karyawan manage data pribadi dan cuti",
    status: "ON_HOLD",
    progress: 15,
    progressMode: "manual",
    tim: { ...EMPTY_TIM, BPA: ["tm9"], DEV: ["tm8"] },
    timeline: {
      userRequirement:          { start: "2026-04-01", end: "2026-04-20", baselineStart: "2026-04-01", baselineEnd: "2026-04-20", status: "DONE",        statusManualOverride: false, tasks: [] },
      development:              { start: "2026-04-21", end: "2026-05-30", baselineStart: "2026-04-21", baselineEnd: "2026-05-30", status: "NOT_STARTED", statusManualOverride: true,  tasks: [] },
      testing:                  { ...EMPTY_PHASE },
      uat:                      { ...EMPTY_PHASE },
      pentest:                  { ...EMPTY_PHASE },
      defectdojo:               { ...EMPTY_PHASE },
      goLive:                   { ...EMPTY_PHASE },
      postImplementationSupport:{ ...EMPTY_PHASE },
      projectHandover:          { ...EMPTY_PHASE },
    },
    documentation: createEmptyDocumentation(),
    isArchived: false,
    createdAt: "2026-03-25T00:00:00Z",
    updatedAt: "2026-05-15T00:00:00Z",
  },
];
