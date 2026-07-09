import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BarChart3, FolderKanban, AlertTriangle, Calendar, TrendingUp } from "lucide-react";
import { usePMOStore } from "@/store/pmoStore";
import type { Project, Divisi, ProjectStatus } from "@/types";
import { DIVISI_LABELS, PROJECT_STATUS_LABELS, DIVISI_SLUG_MAP } from "@/types";
import { getEffectiveProgress } from "@/utils/computed";
import { StatusBadge, ProgressBar, formatDate } from "@/components/Shared";
import { parseISODate } from "@/utils/taskDates";

const ALL_DIVISI: Divisi[] = ["HOTD1", "HOTD2_FINANCE", "HOTD2_NONFINANCE"];
const ALL_STATUSES: ProjectStatus[] = [
  "NOT_STARTED", "ON_TRACK", "AT_RISK", "DELAYED", "ON_HOLD", "COMPLETED",
];

const STATUS_COLORS: Record<ProjectStatus, string> = {
  NOT_STARTED: "bg-gray-200",
  ON_TRACK: "bg-blue-500",
  AT_RISK: "bg-amber-500",
  DELAYED: "bg-red-500",
  ON_HOLD: "bg-slate-400",
  COMPLETED: "bg-green-500",
};

const DIVISI_SLUG_REVERSE: Record<Divisi, string> = {
  HOTD1: "hotd1",
  HOTD2_FINANCE: "hotd2-finance",
  HOTD2_NONFINANCE: "hotd2-nonfinance",
};

export default function DashboardPage() {
  // Select raw projects — filter in useMemo (avoids Zustand infinite loop)
  const allProjects = usePMOStore((s) => s.projects);

  const projects = useMemo(
    () => allProjects.filter((p) => !p.isArchived),
    [allProjects]
  );

  // ─── 8.1 Aggregations ───

  const total = projects.length;

  const perDivision = useMemo(() => {
    const map: Record<Divisi, Project[]> = { HOTD1: [], HOTD2_FINANCE: [], HOTD2_NONFINANCE: [] };
    for (const p of projects) map[p.divisi].push(p);
    return map;
  }, [projects]);

  const statusDistribution = useMemo(() => {
    const map: Record<ProjectStatus, number> = {
      NOT_STARTED: 0, ON_TRACK: 0, AT_RISK: 0, DELAYED: 0, ON_HOLD: 0, COMPLETED: 0,
    };
    for (const p of projects) map[p.status]++;
    return map;
  }, [projects]);

  const avgProgress = useMemo(() => {
    if (projects.length === 0) return 0;
    const sum = projects.reduce((acc, p) => acc + getEffectiveProgress(p), 0);
    return Math.round(sum / projects.length);
  }, [projects]);

  const avgProgressPerDivision = useMemo(() => {
    const result: Record<Divisi, number> = { HOTD1: 0, HOTD2_FINANCE: 0, HOTD2_NONFINANCE: 0 };
    for (const div of ALL_DIVISI) {
      const divProjects = perDivision[div];
      if (divProjects.length === 0) continue;
      const sum = divProjects.reduce((acc, p) => acc + getEffectiveProgress(p), 0);
      result[div] = Math.round(sum / divProjects.length);
    }
    return result;
  }, [perDivision]);

  const needsAttention = useMemo(() => {
    return projects
      .filter((p) => p.status === "AT_RISK" || p.status === "DELAYED")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [projects]);

  const needsAttentionCount = needsAttention.length;

  // Go-Live this month
  const goLiveThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return projects.filter((p) => {
      const goLive = p.timeline.goLive;
      if (!goLive.start || !goLive.end) return false;
      const start = parseISODate(goLive.start);
      const end = parseISODate(goLive.end);
      // goLive phase is active this month: start <= end of month AND end >= start of month
      return start <= monthEnd && end >= monthStart;
    });
  }, [projects]);

  const maxStatusCount = Math.max(...Object.values(statusDistribution), 1);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Dashboard</h1>
      <p className="text-sm text-steel mb-8">Overview of all projects across divisions</p>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard icon={<FolderKanban size={20} />} label="Total Projects" value={String(total)} color="brand-blue" />
        <StatCard icon={<TrendingUp size={20} />} label="Avg Progress" value={`${avgProgress}%`} color="brand-teal" />
        <StatCard icon={<AlertTriangle size={20} />} label="At Risk / Delayed" value={String(needsAttentionCount)} color="warning" />
        <StatCard icon={<Calendar size={20} />} label="Go-Live This Month" value={String(goLiveThisMonth.length)} color="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ─── Division Breakdown ─── */}
        <div className="bg-canvas rounded-xl border border-hairline-soft p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <BarChart3 size={18} className="text-slate" />
            <h2 className="text-base font-medium text-ink">Projects by Division</h2>
          </div>
          <div className="space-y-4">
            {ALL_DIVISI.map((div) => {
              const count = perDivision[div].length;
              const avg = avgProgressPerDivision[div];
              const slug = DIVISI_SLUG_REVERSE[div];
              return (
                <Link
                  key={div}
                  to={`/projects/${slug}`}
                  className="flex items-center gap-4 p-3 -mx-3 rounded-lg hover:bg-surface/50 transition-colors"
                >
                  <div className="w-10 h-10 bg-brand-blue/10 rounded-lg flex items-center justify-center text-sm font-bold text-brand-blue">
                    {count}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{DIVISI_LABELS[div]}</p>
                    <p className="text-xs text-steel">{count} project{count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">{avg}%</p>
                    <p className="text-[10px] text-steel">avg progress</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ─── Status Distribution (CSS bar chart) ─── */}
        <div className="bg-canvas rounded-xl border border-hairline-soft p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <BarChart3 size={18} className="text-slate" />
            <h2 className="text-base font-medium text-ink">Status Distribution</h2>
          </div>
          <div className="space-y-3">
            {ALL_STATUSES.map((status) => {
              const count = statusDistribution[status];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const barWidth = maxStatusCount > 0 ? (count / maxStatusCount) * 100 : 0;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-steel w-24 text-right flex-shrink-0">
                    {PROJECT_STATUS_LABELS[status]}
                  </span>
                  <div className="flex-1 h-6 bg-surface rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${STATUS_COLORS[status]}`}
                      style={{ width: `${barWidth}%`, minWidth: count > 0 ? "8px" : "0" }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-ink w-8 text-right">{count}</span>
                  <span className="text-[10px] text-stone w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ─── Needs Attention ─── */}
        <div className="bg-canvas rounded-xl border border-hairline-soft p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={18} className="text-amber-500" />
              <h2 className="text-base font-medium text-ink">Needs Attention</h2>
              {needsAttentionCount > 0 && (
                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                  {needsAttentionCount}
                </span>
              )}
            </div>
          </div>
          {needsAttention.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="text-green-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p className="text-sm text-steel">All projects are on track!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {needsAttention.slice(0, 10).map((p) => {
                const slug = DIVISI_SLUG_REVERSE[p.divisi];
                const progress = getEffectiveProgress(p);
                return (
                  <Link
                    key={p.id}
                    to={`/projects/${slug}/${p.id}`}
                    className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-surface/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-ink truncate">{p.nama}</p>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-xs text-steel">{DIVISI_LABELS[p.divisi]} &middot; Updated {formatDate(p.updatedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16">
                        <ProgressBar value={progress} size="sm" />
                      </div>
                      <span className="text-xs font-semibold text-steel w-8 text-right">{progress}%</span>
                    </div>
                  </Link>
                );
              })}
              {needsAttention.length > 10 && (
                <p className="text-xs text-brand-blue font-medium text-center pt-2">
                  + {needsAttention.length - 10} more
                </p>
              )}
            </div>
          )}
        </div>

        {/* ─── Go-Live This Month Timeline ─── */}
        <div className="bg-canvas rounded-xl border border-hairline-soft p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <Calendar size={18} className="text-green-500" />
            <h2 className="text-base font-medium text-ink">
              Go-Live This Month
            </h2>
            <span className="text-xs text-steel bg-surface px-2 py-0.5 rounded-full">
              {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
            </span>
          </div>
          {goLiveThisMonth.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Calendar size={24} className="text-stone" />
              </div>
              <p className="text-sm text-steel mb-1">No go-live events this month</p>
              <p className="text-xs text-stone">Projects with an active Go Live phase will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {goLiveThisMonth.map((p) => {
                const slug = DIVISI_SLUG_REVERSE[p.divisi];
                return (
                  <Link
                    key={p.id}
                    to={`/projects/${slug}/${p.id}`}
                    className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-surface/50 transition-colors"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{p.nama}</p>
                      <p className="text-xs text-steel">{DIVISI_LABELS[p.divisi]}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-ink">
                        {formatDate(p.timeline.goLive.start)} → {formatDate(p.timeline.goLive.end)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Progress per Division ─── */}
      <div className="bg-canvas rounded-xl border border-hairline-soft p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <TrendingUp size={18} className="text-slate" />
          <h2 className="text-base font-medium text-ink">Average Progress by Division</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ALL_DIVISI.map((div) => {
            const avg = avgProgressPerDivision[div];
            const count = perDivision[div].length;
            return (
              <div key={div} className="p-4 bg-surface/50 rounded-lg">
                <p className="text-xs font-semibold text-steel uppercase tracking-wide mb-2">
                  {DIVISI_LABELS[div]}
                </p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-semibold text-ink">{avg}</span>
                  <span className="text-sm text-steel mb-0.5">%</span>
                </div>
                <ProgressBar value={avg} size="md" />
                <p className="text-[10px] text-stone mt-2">{count} project{count !== 1 ? "s" : ""}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Stat Card ───

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    "brand-blue": "bg-blue-50 text-brand-blue",
    "brand-teal": "bg-teal-50 text-brand-teal",
    warning: "bg-amber-50 text-warning",
    success: "bg-green-50 text-success",
  };

  return (
    <div className="bg-canvas rounded-xl border border-hairline-soft p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color] ?? "bg-surface text-slate"}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-steel uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-semibold text-ink tracking-tight">{value}</p>
    </div>
  );
}
