import { useState, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Plus, FolderOpen, Search, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { usePMOStore } from "@/store/pmoStore";
import type { Project, ProjectStatus } from "@/types";
import { DIVISI_SLUG_MAP, DIVISI_LABELS, PROJECT_STATUS_LABELS, PHASE_ORDER, PHASE_LABELS } from "@/types";
import { getActivePhase, activePhaseLabel, getEffectiveProgress, getUniqueTeamCount, projectHasPotentialDelay } from "@/utils/computed";
import { StatusBadge, ProgressBar, formatDate } from "@/components/Shared";
import { useToastStore } from "@/store/toastStore";

// ─── Sort helpers ───
type SortKey = "nama" | "progress" | "targetSelesai";
type SortDir = "asc" | "desc";

export default function ProjectListPage() {
  const { divisi } = useParams<{ divisi: string }>();
  const divisiEnum = divisi ? DIVISI_SLUG_MAP[divisi] : undefined;
  const label = divisiEnum ? DIVISI_LABELS[divisiEnum] : "Unknown";
  const slug = divisi ?? "";

  // Select raw array from store — never filter inside a Zustand selector (new ref = infinite loop)
  const allProjects = usePMOStore((s) => s.projects);

  // Filter by divisi in useMemo (stable reference unless allProjects or divisiEnum changes)
  const projects = useMemo(
    () => (divisiEnum ? allProjects.filter((p) => p.divisi === divisiEnum && !p.isArchived) : []),
    [allProjects, divisiEnum]
  );

  // ── Filter state (resets on navigation, per spec §4.2) ──
  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<ProjectStatus>>(new Set());
  const [activePhaseFilter, setActivePhaseFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // ── Debounced search ──
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    const timer = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(timer);
  }, []);

  // ── Sort toggle ──
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // ── Toggle status filter ──
  const toggleStatusFilter = (status: ProjectStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  // ── Filtered + sorted projects ──
  const filteredProjects = useMemo(() => {
    let list = [...projects];

    // Search (case-insensitive substring)
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((p) => p.nama.toLowerCase().includes(q));
    }

    // Status multi-select filter
    if (statusFilters.size > 0) {
      list = list.filter((p) => statusFilters.has(p.status));
    }

    // Active phase single-select filter
    if (activePhaseFilter) {
      list = list.filter((p) => {
        const result = getActivePhase(p);
        const lbl = activePhaseLabel(result);
        return lbl === activePhaseFilter;
      });
    }

    // Sort
    if (sortKey) {
      list.sort((a, b) => {
        let cmp = 0;
        if (sortKey === "nama") {
          cmp = a.nama.localeCompare(b.nama);
        } else if (sortKey === "progress") {
          cmp = getEffectiveProgress(a) - getEffectiveProgress(b);
        } else if (sortKey === "targetSelesai") {
          const aEnd = a.timeline.supportGoLive.end ?? "";
          const bEnd = b.timeline.supportGoLive.end ?? "";
          cmp = aEnd.localeCompare(bEnd);
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return list;
  }, [projects, debouncedSearch, statusFilters, activePhaseFilter, sortKey, sortDir]);

  // ── Unique active phase labels for filter dropdown ──
  const phaseFilterOptions = useMemo(() => {
    const labels = new Set<string>();
    labels.add("Belum Mulai");
    labels.add("Selesai");
    labels.add("Menunggu Update Timeline");
    for (const key of PHASE_ORDER) {
      labels.add(PHASE_LABELS[key]);
    }
    return Array.from(labels);
  }, []);

  // ── Empty state ──
  if (projects.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-ink mb-1">Projects</h1>
            <p className="text-sm text-steel">{label}</p>
          </div>
          <Link
            to={`/projects/${slug}/new`}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors"
          >
            <Plus size={16} />
            Create New Project
          </Link>
        </div>
        <div className="bg-canvas rounded-xl border border-hairline-soft p-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center mb-4">
            <FolderOpen size={28} className="text-stone" />
          </div>
          <h3 className="text-base font-medium text-ink mb-1">Belum ada project di divisi ini</h3>
          <p className="text-sm text-steel mb-5 max-w-xs">
            Create your first project in {label} to get started.
          </p>
          <Link
            to={`/projects/${slug}/new`}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors"
          >
            <Plus size={16} />
            Create Project
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink mb-1">Projects</h1>
          <p className="text-sm text-steel">{label} &middot; {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          to={`/projects/${slug}/new`}
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors"
        >
          <Plus size={16} />
          Create New Project
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 pl-8 pr-3 bg-surface border border-hairline rounded-lg text-sm text-ink placeholder:text-stone outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/20 w-56 transition"
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <button
            onClick={() => setShowStatusDropdown((v) => !v)}
            className={`h-9 px-3 rounded-full border text-sm font-medium transition flex items-center gap-1.5 ${
              statusFilters.size > 0
                ? "bg-brand-blue/10 text-brand-blue border-brand-blue/30"
                : "bg-canvas text-ink border-hairline-strong hover:bg-surface"
            }`}
          >
            Status{statusFilters.size > 0 ? ` (${statusFilters.size})` : ""}
            <ArrowUpDown size={13} />
          </button>
          {showStatusDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-canvas rounded-lg border border-hairline shadow-lg z-20 w-48 py-1">
              {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={statusFilters.has(s)}
                    onChange={() => toggleStatusFilter(s)}
                    className="rounded accent-brand-blue"
                  />
                  {PROJECT_STATUS_LABELS[s]}
                </label>
              ))}
              {statusFilters.size > 0 && (
                <button
                  onClick={() => setStatusFilters(new Set())}
                  className="w-full text-left px-3 py-1.5 text-xs text-brand-blue font-medium hover:bg-surface"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Active phase filter */}
        <select
          value={activePhaseFilter}
          onChange={(e) => setActivePhaseFilter(e.target.value)}
          className="h-9 px-3 rounded-full border border-hairline-strong bg-canvas text-sm font-medium text-ink outline-none focus:border-brand-blue transition"
        >
          <option value="">All Phases</option>
          {phaseFilterOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-canvas rounded-xl border border-hairline-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline-soft bg-surface/50">
              <ThSort label="Project Name" sortKey="nama" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide">Active Phase</th>
              <ThSort label="Progress" sortKey="progress" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide">Start</th>
              <ThSort label="Target End" sortKey="targetSelesai" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide">Team</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-stone">
                  No projects match your filters.
                </td>
              </tr>
            ) : (
              filteredProjects.map((p) => (
                <ProjectRow key={p.id} project={p} slug={slug} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Table Row ───
function ProjectRow({ project, slug }: { project: Project; slug: string }) {
  const deleteProject = usePMOStore((s) => s.deleteProject);
  const archiveProject = usePMOStore((s) => s.archiveProject);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const activePhase = getActivePhase(project);
  const phaseLbl = activePhaseLabel(activePhase);
  const progress = getEffectiveProgress(project);
  const teamCount = getUniqueTeamCount(project);
  const hasDelay = projectHasPotentialDelay(project);
  const startDate = project.timeline.discovery.start;
  const endDate = project.timeline.supportGoLive.end;

  return (
    <>
      <tr className="border-b border-hairline-soft last:border-0 hover:bg-surface/30 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Link
              to={`/projects/${slug}/${project.id}`}
              className="font-medium text-ink hover:text-brand-blue transition-colors"
            >
              {project.nama}
            </Link>
            {hasDelay && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                title="One or more phases are overdue but still marked In Progress"
              >
                Delay
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3"><StatusBadge status={project.status} /></td>
        <td className="px-4 py-3 text-steel text-[13px]">{phaseLbl}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 min-w-[100px]">
            <ProgressBar value={progress} size="sm" />
            <span className="text-xs font-medium text-steel w-8 text-right">{progress}%</span>
          </div>
        </td>
        <td className="px-4 py-3 text-steel text-[13px]">{formatDate(startDate)}</td>
        <td className="px-4 py-3 text-steel text-[13px]">{formatDate(endDate)}</td>
        <td className="px-4 py-3 text-steel text-[13px]">{teamCount}</td>
        <td className="px-4 py-3 text-right">
          <div className="inline-flex items-center gap-1">
            <Link
              to={`/projects/${slug}/${project.id}/edit`}
              className="p-1.5 rounded-md text-stone hover:text-ink hover:bg-surface transition-colors"
              title="Edit"
            >
              <Pencil size={15} />
            </Link>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-1.5 rounded-md text-stone hover:text-danger hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </td>
      </tr>

      {/* Delete confirmation modal (spec §2: two-step) */}
      {showDeleteModal && (
        <DeleteModal
          project={project}
          onClose={() => setShowDeleteModal(false)}
          onArchive={() => {
            archiveProject(project.id);
            useToastStore.getState().addToast(`Project "${project.nama}" archived`);
            setShowDeleteModal(false);
          }}
          onDelete={() => {
            deleteProject(project.id);
            useToastStore.getState().addToast(`Project "${project.nama}" permanently deleted`);
            setShowDeleteModal(false);
          }}
        />
      )}
    </>
  );
}

// ─── Sortable column header ───
function ThSort({
  label,
  sortKey,
  current,
  dir,
  onToggle,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey | null;
  dir: SortDir;
  onToggle: (k: SortKey) => void;
}) {
  const isActive = current === sortKey;
  return (
    <th className="text-left px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide">
      <button
        onClick={() => onToggle(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-ink transition-colors cursor-pointer ${
          isActive ? "text-ink" : ""
        }`}
      >
        {label}
        <ArrowUpDown size={12} className={isActive ? "text-brand-blue" : "text-stone"} />
        {isActive && (
          <span className="text-[10px] font-bold text-brand-blue">{dir === "asc" ? "↑" : "↓"}</span>
        )}
      </button>
    </th>
  );
}

// ─── Delete / Archive modal (spec §5.2: two options) ───
function DeleteModal({
  project,
  onClose,
  onArchive,
  onDelete,
}: {
  project: Project;
  onClose: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-canvas rounded-2xl shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-ink mb-2">
          {confirmDelete ? "Confirm Permanent Delete" : `Delete "${project.nama}"?`}
        </h3>

        {!confirmDelete ? (
          <>
            <p className="text-sm text-steel mb-6">
              Choose how to remove this project. Archived projects are hidden but can be restored.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onArchive}
                className="w-full px-4 py-2.5 rounded-full text-sm font-medium bg-surface text-ink border border-hairline hover:bg-hairline-soft transition-colors"
              >
                Archive (recommended)
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full px-4 py-2.5 rounded-full text-sm font-medium text-danger hover:bg-red-50 transition-colors"
              >
                Delete Permanently
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 rounded-full text-sm font-medium text-steel hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-danger mb-6 font-medium">
              This action cannot be undone. All project data will be permanently lost.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onDelete}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium bg-danger text-white hover:bg-red-600 transition-colors"
              >
                Yes, Delete Forever
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-ink border border-hairline-strong hover:bg-surface transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
