import type { Project, PhaseKey, PhaseData, PhaseStatus } from "@/types";
import { PHASE_ORDER } from "@/types";
// parseISODate constructs dates from local year/month/day components,
// avoiding the UTC-midnight shift that new Date("YYYY-MM-DD") causes in
// positive-offset timezones.
import { parseISODate } from "@/utils/taskDates";

// ─── draft.md 6.5: Auto-derive phase status from dates ───

export function derivePhaseStatus(phase: PhaseData, today?: Date): PhaseStatus {
  if (phase.statusManualOverride) return phase.status;
  if (!phase.start) return "NOT_STARTED";

  const now = today ?? new Date();
  const start = parseISODate(phase.start);
  const end = phase.end ? parseISODate(phase.end) : null;

  if (now < start) return "NOT_STARTED";
  if (end && now > end) return "DONE";
  if (end && now >= start && now <= end) return "IN_PROGRESS";

  // No end date but has start — consider IN_PROGRESS
  return "IN_PROGRESS";
}

// ─── draft.md 4.3: Compute "Fase Aktif" ───

export type ActivePhaseResult =
  | { type: "phase"; phaseKey: PhaseKey }
  | { type: "not_started" }
  | { type: "completed" }
  | { type: "waiting_update" };

export function getActivePhase(project: Project, today?: Date): ActivePhaseResult {
  const now = today ?? new Date();

  for (const key of PHASE_ORDER) {
    const phase = project.timeline[key];
    if (!phase.start || !phase.end) continue;

    const start = parseISODate(phase.start);
    const end = parseISODate(phase.end);

    if (now >= start && now <= end) {
      return { type: "phase", phaseKey: key };
    }
  }

  // No phase matches today — determine why
  const discoveryStart = project.timeline.discovery.start;
  const supportEnd = project.timeline.supportGoLive.end;

  if (discoveryStart && now < parseISODate(discoveryStart)) {
    return { type: "not_started" };
  }

  if (supportEnd && now > parseISODate(supportEnd)) {
    return { type: "completed" };
  }

  // Gap between phases or incomplete timeline
  return { type: "waiting_update" };
}

export function activePhaseLabel(result: ActivePhaseResult): string {
  switch (result.type) {
    case "phase": {
      const labels: Record<PhaseKey, string> = {
        discovery: "Discovery",
        development: "Development",
        testing: "Testing",
        uat: "UAT",
        goLive: "Go Live",
        supportGoLive: "Support Go Live",
      };
      return labels[result.phaseKey];
    }
    case "not_started":
      return "Belum Mulai";
    case "completed":
      return "Selesai";
    case "waiting_update":
      return "Menunggu Update Timeline";
  }
}

// ─── draft.md 6.6: Auto-calculate progress ───

export function calculateAutoProgress(project: Project, today?: Date): number {
  const totalFase = PHASE_ORDER.length; // 6
  let faseSelesai = 0;

  for (const key of PHASE_ORDER) {
    const phase = project.timeline[key];
    const status = derivePhaseStatus(phase, today);
    if (status === "DONE") faseSelesai++;
  }

  return Math.round((faseSelesai / totalFase) * 100);
}

// ─── Effective progress (respects progressMode) ───

export function getEffectiveProgress(project: Project, today?: Date): number {
  if (project.progressMode === "auto") {
    return calculateAutoProgress(project, today);
  }
  return project.progress;
}

// ─── draft.md 6.8: Detect "Berpotensi Delay" ───

export function hasPotentialDelay(phase: PhaseData, today?: Date): boolean {
  if (!phase.end) return false;
  const now = today ?? new Date();
  const end = parseISODate(phase.end);

  // Phase end date has passed but status is still IN_PROGRESS (manual override)
  return now > end && phase.status === "IN_PROGRESS";
}

// ─── Detect gap between consecutive phases ───

export function getPhaseGapDays(
  project: Project,
  phaseKey: PhaseKey,
  _today?: Date
): number | null {
  const idx = PHASE_ORDER.indexOf(phaseKey);
  if (idx <= 0) return null; // first phase has no predecessor

  const prevPhase = project.timeline[PHASE_ORDER[idx - 1]];
  const currentPhase = project.timeline[phaseKey];

  if (!prevPhase.end || !currentPhase.start) return null;

  const prevEnd = parseISODate(prevPhase.end);
  const currentStart = parseISODate(currentPhase.start);
  const gapMs = currentStart.getTime() - prevEnd.getTime();
  const gapDays = Math.round(gapMs / (1000 * 60 * 60 * 24));

  return gapDays > 0 ? gapDays : null;
}

// ─── Unique team member count across all roles ───

export function getUniqueTeamCount(project: Project): number {
  const allIds = new Set<string>();
  for (const ids of Object.values(project.tim)) {
    ids.forEach((id: string) => allIds.add(id));
  }
  return allIds.size;
}

// ─── draft.md 6.8: Does any phase in a project have a potential delay? ───
// Used by the project list page to show a delay indicator on the row.

export function projectHasPotentialDelay(project: Project, today?: Date): boolean {
  return PHASE_ORDER.some((key) => hasPotentialDelay(project.timeline[key], today));
}
