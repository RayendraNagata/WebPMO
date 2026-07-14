import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useState, useCallback } from "react";
import { usePMOStore } from "@/store/pmoStore";
import { DIVISI_SLUG_MAP, DIVISI_LABELS, PHASE_ORDER, PHASE_LABELS } from "@/types";
import type { PhaseKey, PhaseStatus, Task, ProjectDocumentation } from "@/types";
import { getActivePhase, activePhaseLabel, getEffectiveProgress } from "@/utils/computed";
import { StatusBadge, ProgressBar, formatDate } from "@/components/Shared";
import { parseISODate } from "@/utils/taskDates";
import TimelineTable from "@/components/project/TimelineTable";
import ProjectGanttChart from "@/components/project/GanttChart";
import DocumentationSection from "@/components/project/DocumentationSection";
import CascadeModal from "@/components/project/CascadeModal";
import TeamDisplay from "@/components/project/TeamDisplay";
import { useToastStore } from "@/store/toastStore";

export default function ProjectDetailPage() {
  const { divisi, projectId } = useParams<{ divisi: string; projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const slug = divisi ?? "";
  const divisiEnum = divisi ? DIVISI_SLUG_MAP[divisi] : undefined;
  const divisiLabel = divisiEnum ? DIVISI_LABELS[divisiEnum] : "";

  // If the user arrived here via "Manage Timeline & Team" from the edit form,
  // the Back button should return them to the edit form, not the project list.
  const cameFromEdit =
    (location.state as { from?: string } | null)?.from === "edit";
  const backTo = cameFromEdit
    ? `/projects/${slug}/${projectId}/edit`
    : `/projects/${slug}`;
  const backLabel = cameFromEdit ? "Back to Edit" : `Back to ${divisiLabel}`;

  const project = usePMOStore((s) =>
    projectId ? s.projects.find((p) => p.id === projectId) : undefined
  );
  const archiveProject = usePMOStore((s) => s.archiveProject);
  const deleteProject = usePMOStore((s) => s.deleteProject);
  const updatePhase = usePMOStore((s) => s.updatePhase);
  const resetBaseline = usePMOStore((s) => s.resetBaseline);
  const updateDocumentation = usePMOStore((s) => s.updateDocumentation);
  const addTask = usePMOStore((s) => s.addTask);
  const updateTask = usePMOStore((s) => s.updateTask);
  const removeTask = usePMOStore((s) => s.removeTask);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteStep2, setConfirmDeleteStep2] = useState(false);

  // Cascade modal state
  const [cascadeInfo, setCascadeInfo] = useState<{
    phaseKey: PhaseKey;
    phaseName: string;
    shiftDays: number;
    affectedPhases: string[];
    newStart: Date;
    newEnd: Date;
  } | null>(null);

  if (!project) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-semibold text-ink mb-2">Project not found</h2>
        <Link to={`/projects/${slug}`} className="text-sm text-brand-blue hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  const activePhase = getActivePhase(project);
  const phaseLbl = activePhaseLabel(activePhase);
  const progress = getEffectiveProgress(project);

  const handleArchive = () => {
    archiveProject(project.id);
    useToastStore.getState().addToast(`Project "${project.nama}" archived`);
    navigate(`/projects/${slug}`);
  };
  const handleDelete = () => {
    deleteProject(project.id);
    useToastStore.getState().addToast(`Project "${project.nama}" permanently deleted`);
    navigate(`/projects/${slug}`);
  };

  // ─── Phase date change from TimelineTable ───
  const handlePhaseDateChange = useCallback(
    (phaseKey: PhaseKey, field: "start" | "end", value: string) => {
      updatePhase(project.id, phaseKey, { [field]: value });
    },
    [project.id, updatePhase]
  );

  // ─── Phase status manual override from TimelineTable ───
  const handlePhaseStatusOverride = useCallback(
    (phaseKey: PhaseKey, status: PhaseStatus) => {
      updatePhase(project.id, phaseKey, {
        status,
        statusManualOverride: true,
      });
    },
    [project.id, updatePhase]
  );

  // ─── Reset baseline from TimelineTable ───
  const handleResetBaseline = useCallback(
    (phaseKey: PhaseKey) => {
      resetBaseline(project.id, phaseKey);
    },
    [project.id, resetBaseline]
  );

  // ─── Gantt drag: detect cascade overlap, then apply or show modal ───
  const handleGanttDateChange = useCallback(
    (phaseKey: PhaseKey, newStart: Date, newEnd: Date) => {
      const idx = PHASE_ORDER.indexOf(phaseKey);
      const startStr = newStart.toISOString().slice(0, 10);
      const endStr = newEnd.toISOString().slice(0, 10);

      if (idx < PHASE_ORDER.length - 1) {
        const nextKey = PHASE_ORDER[idx + 1];
        const nextPhase = project.timeline[nextKey];

        if (nextPhase.start) {
          const nextStart = parseISODate(nextPhase.start);
          if (newEnd > nextStart) {
            const shiftDays = Math.ceil(
              (newEnd.getTime() - nextStart.getTime()) / (1000 * 60 * 60 * 24)
            );
            const affected: string[] = [];
            for (let i = idx + 1; i < PHASE_ORDER.length; i++) {
              const pk = PHASE_ORDER[i];
              if (project.timeline[pk].start) {
                affected.push(PHASE_LABELS[pk]);
              }
            }
            setCascadeInfo({
              phaseKey,
              phaseName: PHASE_LABELS[phaseKey],
              shiftDays,
              affectedPhases: affected,
              newStart,
              newEnd,
            });
            return;
          }
        }
      }

      updatePhase(project.id, phaseKey, { start: startStr, end: endStr });
    },
    [project.id, project.timeline, updatePhase]
  );

  // ─── Cascade: shift following phases ───
  const handleCascadeShift = useCallback(() => {
    if (!cascadeInfo) return;
    const { phaseKey, newStart, newEnd } = cascadeInfo;
    const idx = PHASE_ORDER.indexOf(phaseKey);
    const startStr = newStart.toISOString().slice(0, 10);
    const endStr = newEnd.toISOString().slice(0, 10);

    updatePhase(project.id, phaseKey, { start: startStr, end: endStr });

    for (let i = idx + 1; i < PHASE_ORDER.length; i++) {
      const pk = PHASE_ORDER[i];
      const phase = project.timeline[pk];
      if (phase.start && phase.end) {
        const shiftedStart = parseISODate(phase.start);
        const shiftedEnd = parseISODate(phase.end);
        shiftedStart.setDate(shiftedStart.getDate() + cascadeInfo.shiftDays);
        shiftedEnd.setDate(shiftedEnd.getDate() + cascadeInfo.shiftDays);
        const pad = (n: number) => String(n).padStart(2, "0");
        const toLocal = (d: Date) =>
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        updatePhase(project.id, pk, {
          start: toLocal(shiftedStart),
          end: toLocal(shiftedEnd),
        });
      }
    }
    setCascadeInfo(null);
  }, [cascadeInfo, project.id, project.timeline, updatePhase]);

  // ─── Cascade: leave manual ───
  const handleCascadeManual = useCallback(() => {
    if (!cascadeInfo) return;
    const { phaseKey, newStart, newEnd } = cascadeInfo;
    updatePhase(project.id, phaseKey, {
      start: newStart.toISOString().slice(0, 10),
      end: newEnd.toISOString().slice(0, 10),
    });
    setCascadeInfo(null);
  }, [cascadeInfo, project.id, updatePhase]);

  // ─── §6.12 Documentation update (auto-save per field) ───
  const handleUpdateDocumentation = useCallback(
    (docId: string, data: Partial<Pick<ProjectDocumentation, "tanggal" | "link">>) => {
      updateDocumentation(project.id, docId, data);
    },
    [project.id, updateDocumentation]
  );

  // ─── Task CRUD ───
  const handleAddTask = useCallback(
    (phaseKey: PhaseKey) => {
      const existingTasks = project.timeline[phaseKey].tasks;
      const newOrder = existingTasks.length > 0 ? Math.max(...existingTasks.map((t) => t.order)) + 1 : 0;
      addTask(project.id, phaseKey, {
        phaseKey,
        nama: "",
        durationMandays: 1,
        predecessorIds: [],
        start: null,
        end: null,
        status: "NOT_STARTED",
        statusManualOverride: false,
        order: newOrder,
      });
      useToastStore.getState().addToast("Task added");
    },
    [project.id, project.timeline, addTask]
  );

  const handleUpdateTask = useCallback(
    (phaseKey: PhaseKey, taskId: string, data: Partial<Omit<Task, "id">>) => {
      const ok = updateTask(project.id, phaseKey, taskId, data);
      if (!ok) {
        useToastStore.getState().addToast("Cannot save: circular dependency detected", "error");
      }
      return ok;
    },
    [project.id, updateTask]
  );

  const handleRemoveTask = useCallback(
    (phaseKey: PhaseKey, taskId: string) => {
      removeTask(project.id, phaseKey, taskId);
      useToastStore.getState().addToast("Task removed");
    },
    [project.id, removeTask]
  );

  return (
    <div>
      {/* Breadcrumb */}
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-steel hover:text-ink mb-6 transition-colors"
      >
        <ArrowLeft size={15} />
        {backLabel}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-ink">{project.nama}</h1>
            <StatusBadge status={project.status} />
          </div>
          {project.deskripsi && (
            <p className="text-sm text-steel max-w-xl">{project.deskripsi}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2.5 rounded-full text-stone border border-hairline hover:text-danger hover:border-danger/30 hover:bg-red-50 transition-colors"
            title="Delete / Archive"
          >
            <Trash2 size={16} />
          </button>
          <Link
            to={`/projects/${slug}/${project.id}/edit`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-ink border border-hairline-strong hover:bg-surface transition-colors"
          >
            <Edit size={15} />
            Edit
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Status Project" value={phaseLbl} />
        <SummaryCard
          label="Progress"
          value={`${progress}%`}
          extra={
            <div className="mt-2">
              <ProgressBar value={progress} size="sm" />
            </div>
          }
        />
        <SummaryCard label="Start Date" value={formatDate(project.timeline.userRequirement.start)} />
        <SummaryCard label="Target End" value={formatDate(project.timeline.projectHandover.end)} />
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {/* Timeline SDLC — interactive input table */}
        <TimelineTable
          project={project}
          onPhaseDateChange={handlePhaseDateChange}
          onPhaseStatusOverride={handlePhaseStatusOverride}
          onResetBaseline={handleResetBaseline}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
          onRemoveTask={handleRemoveTask}
        />

        {/* Gantt Chart — interactive with drag */}
        <ProjectGanttChart
          project={project}
          onDateChange={handleGanttDateChange}
          onAddTask={handleAddTask}
        />

        {/* §6.12 Dokumentasi Project — 13 fixed rows */}
        <DocumentationSection
          documentation={project.documentation}
          onUpdate={handleUpdateDocumentation}
        />

        {/* Team */}
        <TeamDisplay tim={project.tim} />
      </div>

      {/* Delete/Archive Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowDeleteModal(false); setConfirmDeleteStep2(false); }}>
          <div className="bg-canvas rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            {!confirmDeleteStep2 ? (
              <>
                <h3 className="text-lg font-semibold text-ink mb-2">Delete &ldquo;{project.nama}&rdquo;?</h3>
                <p className="text-sm text-steel mb-6">Choose how to remove this project.</p>
                <div className="flex flex-col gap-2">
                  <button onClick={handleArchive} className="w-full px-4 py-2.5 rounded-full text-sm font-medium bg-surface text-ink border border-hairline hover:bg-hairline-soft transition-colors">
                    Archive (recommended)
                  </button>
                  <button onClick={() => setConfirmDeleteStep2(true)} className="w-full px-4 py-2.5 rounded-full text-sm font-medium text-danger hover:bg-red-50 transition-colors">
                    Delete Permanently
                  </button>
                  <button onClick={() => { setShowDeleteModal(false); setConfirmDeleteStep2(false); }} className="w-full px-4 py-2.5 rounded-full text-sm font-medium text-steel transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-ink mb-2">Confirm Permanent Delete</h3>
                <p className="text-sm text-danger mb-6 font-medium">This action cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium bg-danger text-white hover:bg-red-600 transition-colors">
                    Yes, Delete
                  </button>
                  <button onClick={() => { setShowDeleteModal(false); setConfirmDeleteStep2(false); }} className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-ink border border-hairline-strong hover:bg-surface transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cascade dependency modal */}
      {cascadeInfo && (
        <CascadeModal
          phaseName={cascadeInfo.phaseName}
          shiftDays={cascadeInfo.shiftDays}
          affectedPhases={cascadeInfo.affectedPhases}
          onCascadeShift={handleCascadeShift}
          onManualOnly={handleCascadeManual}
        />
      )}
    </div>
  );
}

// ─── Reusable components ───

function SummaryCard({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="bg-canvas rounded-xl border border-hairline-soft p-4">
      <p className="text-xs font-medium text-steel uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-semibold text-ink">{value}</p>
      {extra}
    </div>
  );
}
