import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Info, ExternalLink } from "lucide-react";
import { usePMOStore } from "@/store/pmoStore";
import type { ProjectStatus, TeamAssignment } from "@/types";
import { DIVISI_SLUG_MAP, DIVISI_LABELS, PROJECT_STATUS_LABELS, createBlankProject } from "@/types";
import { calculateAutoProgress } from "@/utils/computed";
import TeamAssignmentComponent from "@/components/project/TeamAssignment";
import { useToastStore } from "@/store/toastStore";

// ─── Validation ───
interface FormErrors {
  nama?: string;
  deskripsi?: string;
}

function validate(nama: string, deskripsi: string): FormErrors {
  const errors: FormErrors = {};
  if (!nama.trim()) errors.nama = "Project name is required";
  else if (nama.trim().length < 3) errors.nama = "Minimum 3 characters";
  else if (nama.length > 100) errors.nama = "Maximum 100 characters";
  if (deskripsi.length > 500) errors.deskripsi = "Maximum 500 characters";
  return errors;
}

export default function ProjectFormPage() {
  const { divisi, projectId } = useParams<{ divisi: string; projectId: string }>();
  const navigate = useNavigate();
  const isEdit = !!projectId && projectId !== "new";
  const showManageTimelineTeam = isEdit;

  const divisiEnum = divisi ? DIVISI_SLUG_MAP[divisi] : undefined;
  const divisiLabel = divisiEnum ? DIVISI_LABELS[divisiEnum] : "";
  const slug = divisi ?? "";

  const getProjectById = usePMOStore((s) => s.getProjectById);
  const createProject = usePMOStore((s) => s.createProject);
  const updateProject = usePMOStore((s) => s.updateProject);

  const existingProject = isEdit ? getProjectById(projectId!) : undefined;

  // ── Form state ──
  const [nama, setNama] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("NOT_STARTED");
  const [progress, setProgress] = useState(0);
  const [progressMode, setProgressMode] = useState<"manual" | "auto">("manual");
  const [tim, setTim] = useState<TeamAssignment>({ BPA: [], DEV: [], PQA: [] });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showProgressConfirm, setShowProgressConfirm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteStep2, setConfirmDeleteStep2] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // ── Pre-fill on edit ──
  useEffect(() => {
    if (existingProject) {
      setNama(existingProject.nama);
      setDeskripsi(existingProject.deskripsi);
      setStatus(existingProject.status);
      setProgress(existingProject.progress);
      setProgressMode(existingProject.progressMode);
      setTim({ ...existingProject.tim });
    }
  }, [existingProject]);

  // ── Track dirty state ──
  const initialValues = useMemo(() => {
    if (existingProject) {
      return {
        nama: existingProject.nama,
        deskripsi: existingProject.deskripsi,
        status: existingProject.status,
        progress: existingProject.progress,
        progressMode: existingProject.progressMode,
        tim: existingProject.tim,
      };
    }
    return {
      nama: "",
      deskripsi: "",
      status: "NOT_STARTED" as ProjectStatus,
      progress: 0,
      progressMode: "manual" as const,
      tim: { BPA: [], DEV: [], PQA: [] } as TeamAssignment,
    };
  }, [existingProject]);

  useEffect(() => {
    const dirty =
      nama !== initialValues.nama ||
      deskripsi !== initialValues.deskripsi ||
      status !== initialValues.status ||
      progress !== initialValues.progress ||
      progressMode !== initialValues.progressMode ||
      JSON.stringify(tim) !== JSON.stringify(initialValues.tim);
    setIsDirty(dirty);
  }, [nama, deskripsi, status, progress, progressMode, tim, initialValues]);

  // ── Validate on change ──
  useEffect(() => {
    setErrors(validate(nama, deskripsi));
  }, [nama, deskripsi]);

  // ── Handlers ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(nama, deskripsi);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    if (isEdit && existingProject) {
      updateProject(existingProject.id, {
        nama: nama.trim(),
        deskripsi: deskripsi.trim(),
        status,
        progress: progressMode === "auto" ? existingProject.progress : progress,
        progressMode,
        tim,
      });
      useToastStore.getState().addToast(`Project "${nama.trim()}" updated successfully`);
      navigate(`/projects/${slug}`);
    } else if (divisiEnum) {
      const blank = createBlankProject(divisiEnum);
      const newProject = createProject({
        ...blank,
        nama: nama.trim(),
        deskripsi: deskripsi.trim(),
        status,
        progress: progressMode === "auto" ? 0 : progress,
        progressMode,
        tim,
      });
      useToastStore.getState().addToast(`Project "${nama.trim()}" created successfully`);
      navigate(`/projects/${slug}/${newProject.id}`);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setPendingNavigation(null);
      setShowCancelModal(true);
    } else {
      navigate(-1);
    }
  };

  const handleNavigateToDetail = () => {
    if (!projectId) return;
    const target = `/projects/${slug}/${projectId}`;
    if (isDirty) {
      setPendingNavigation(target);
      setShowCancelModal(true);
    } else {
      navigate(target);
    }
  };

  const handleDiscardConfirm = () => {
    if (pendingNavigation) {
      navigate(pendingNavigation);
    } else {
      navigate(-1);
    }
    setShowCancelModal(false);
    setPendingNavigation(null);
  };

  const handleProgressModeToggle = () => {
    if (progressMode === "manual") {
      setShowProgressConfirm(true);
    } else {
      setProgressMode("manual");
    }
  };

  const confirmSwitchToAuto = () => {
    setProgressMode("auto");
    setShowProgressConfirm(false);
  };

  const handleDelete = () => {
    if (existingProject) {
      usePMOStore.getState().deleteProject(existingProject.id);
      useToastStore.getState().addToast(`Project "${existingProject.nama}" permanently deleted`);
      navigate(`/projects/${slug}`);
    }
  };

  const handleArchive = () => {
    if (existingProject) {
      usePMOStore.getState().archiveProject(existingProject.id);
      useToastStore.getState().addToast(`Project "${existingProject.nama}" archived`);
      navigate(`/projects/${slug}`);
    }
  };

  // ── 404 for invalid edit ──
  if (isEdit && !existingProject) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-semibold text-ink mb-2">Project not found</h2>
        <Link to={`/projects/${slug}`} className="text-sm text-brand-blue hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="max-w-2xl">
      <button
        onClick={handleCancel}
        className="inline-flex items-center gap-1.5 text-sm text-steel hover:text-ink mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft size={15} />
        Back to {divisiLabel}
      </button>

      <h1 className="text-2xl font-semibold text-ink mb-1">
        {isEdit ? "Edit Project" : "Create New Project"}
      </h1>
      <p className="text-sm text-steel mb-8">
        Division: <span className="font-medium text-ink">{divisiLabel}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main fields card */}
        <div className="bg-canvas rounded-xl border border-hairline-soft p-6 space-y-5">
          {/* Nama */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Project Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Enter project name"
              maxLength={100}
              className={`w-full h-11 px-4 border rounded-lg text-base text-ink bg-canvas outline-none transition
                ${errors.nama ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/20" : "border-hairline-strong focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"}`}
            />
            {errors.nama && <p className="text-xs text-danger mt-1">{errors.nama}</p>}
            <p className="text-xs text-stone mt-1">{nama.length}/100</p>
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Description</label>
            <textarea
              rows={3}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Brief description (optional)"
              maxLength={500}
              className={`w-full px-4 py-3 border rounded-lg text-base text-ink bg-canvas outline-none transition resize-none
                ${errors.deskripsi ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/20" : "border-hairline-strong focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"}`}
            />
            {errors.deskripsi && <p className="text-xs text-danger mt-1">{errors.deskripsi}</p>}
            <p className="text-xs text-stone mt-1">{500 - deskripsi.length} characters remaining</p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Status <span className="text-danger">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full h-11 px-4 border border-hairline-strong rounded-lg text-base text-ink bg-canvas focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition"
            >
              {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Progress Mode Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-ink">Progress</label>
              <button
                type="button"
                onClick={handleProgressModeToggle}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  progressMode === "auto"
                    ? "bg-brand-blue/10 text-brand-blue border-brand-blue/30"
                    : "bg-surface text-steel border-hairline"
                }`}
              >
                {progressMode === "auto" ? "Auto-calculated" : "Manual"}
              </button>
            </div>

            {progressMode === "manual" ? (
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-24 h-11 px-4 border border-hairline-strong rounded-lg text-base text-ink bg-canvas focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition"
                />
                <span className="text-sm text-steel">%</span>
                <div className="flex-1">
                  <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-brand-blue rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-ink">
                  {isEdit && existingProject
                    ? `${calculateAutoProgress(existingProject)}%`
                    : "0%"}
                </span>
                <span className="flex items-center gap-1 text-xs text-stone">
                  <Info size={12} />
                  Calculated automatically from completed phases
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline SDLC — placeholder with link to detail in edit mode */}
        <div className="bg-canvas rounded-xl border border-hairline-soft p-6">
          <h3 className="text-sm font-medium text-ink mb-2">Timeline SDLC</h3>
          <p className="text-sm text-stone">
            Timeline input will be available on the project detail page.
          </p>
          {showManageTimelineTeam && (
            <button
              type="button"
              onClick={handleNavigateToDetail}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 transition-colors cursor-pointer"
            >
              Manage Timeline & Team
              <ExternalLink size={14} />
            </button>
          )}
        </div>

        {/* Team Assignment */}
        <TeamAssignmentComponent value={tim} onChange={setTim} />

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={hasErrors || !nama.trim()}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors disabled:bg-hairline disabled:text-muted disabled:cursor-not-allowed"
          >
            {isEdit ? "Save Changes" : "Create Project"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-2.5 rounded-full text-sm font-medium text-ink border border-hairline-strong hover:bg-surface transition-colors"
          >
            Cancel
          </button>

          {isEdit && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="ml-auto px-4 py-2.5 rounded-full text-sm font-medium text-danger border border-danger/30 hover:bg-red-50 transition-colors"
            >
              Delete / Archive
            </button>
          )}
        </div>
      </form>

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowCancelModal(false); setPendingNavigation(null); }}>
          <div className="bg-canvas rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-2">Discard changes?</h3>
            <p className="text-sm text-steel mb-6">You have unsaved changes. Are you sure you want to leave?</p>
            <div className="flex gap-2">
              <button
                onClick={handleDiscardConfirm}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium bg-danger text-white hover:bg-red-600 transition-colors"
              >
                Yes, Discard
              </button>
              <button
                onClick={() => { setShowCancelModal(false); setPendingNavigation(null); }}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-ink border border-hairline-strong hover:bg-surface transition-colors"
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress mode confirmation */}
      {showProgressConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowProgressConfirm(false)}>
          <div className="bg-canvas rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-2">Switch to auto progress?</h3>
            <p className="text-sm text-steel mb-6">
              Progress will be calculated automatically from completed phases. Your manual input will be ignored.
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmSwitchToAuto}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium bg-primary text-on-primary hover:bg-charcoal transition-colors"
              >
                Switch to Auto
              </button>
              <button
                onClick={() => setShowProgressConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-ink border border-hairline-strong hover:bg-surface transition-colors"
              >
                Keep Manual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete/Archive modal (two-step, spec §5.2) */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowDeleteModal(false); setConfirmDeleteStep2(false); }}>
          <div className="bg-canvas rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            {!confirmDeleteStep2 ? (
              <>
                <h3 className="text-lg font-semibold text-ink mb-2">Delete "{existingProject?.nama}"?</h3>
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
                <p className="text-sm text-danger mb-6 font-medium">This action cannot be undone. All project data will be permanently lost.</p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium bg-danger text-white hover:bg-red-600 transition-colors">
                    Yes, Delete Forever
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
    </div>
  );
}
