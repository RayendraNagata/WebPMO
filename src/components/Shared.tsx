import type { ProjectStatus } from "@/types";
import { PROJECT_STATUS_LABELS } from "@/types";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  NOT_STARTED: "bg-surface text-steel",
  ON_TRACK: "bg-green-50 text-green-700",
  AT_RISK: "bg-amber-50 text-amber-700",
  DELAYED: "bg-red-50 text-red-600",
  ON_HOLD: "bg-slate-100 text-slate-500",
  COMPLETED: "bg-brand-blue/10 text-brand-blue",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

/** Format ISO date → "DD MMM YYYY" per draft.md §2.
 *  Parses bare date strings (YYYY-MM-DD) as local calendar components to
 *  avoid the UTC-midnight shift that `new Date("YYYY-MM-DD")` causes in
 *  positive-offset timezones (e.g. UTC+7 would show the previous day).
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  // Split YYYY-MM-DD directly — never pass bare date strings to new Date()
  const parts = iso.split("T")[0].split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return "—";
  const [y, m, d] = parts;
  return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}

/** Progress bar component */
export function ProgressBar({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className={`w-full ${h} bg-surface rounded-full overflow-hidden`}>
      <div
        className={`${h} bg-brand-blue rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
