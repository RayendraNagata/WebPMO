import { useState } from "react";
import React from "react";
import { Plus } from "lucide-react";
import type { Project, PhaseKey, PhaseStatus } from "@/types";
import { PHASE_ORDER, PHASE_LABELS } from "@/types";
import { derivePhaseStatus, hasPotentialDelay, getPhaseGapDays } from "@/utils/computed";
import { formatDate } from "@/components/Shared";
import { useToastStore } from "@/store/toastStore";
import TaskRow from "./TaskRow";
import type { Task } from "@/types";
import { getAllProjectTasks } from "@/store/pmoStore";

interface Props {
  project: Project;
  onPhaseDateChange: (phaseKey: PhaseKey, field: "start" | "end", value: string) => void;
  onPhaseStatusOverride: (phaseKey: PhaseKey, status: PhaseStatus) => void;
  onResetBaseline: (phaseKey: PhaseKey) => void;
  onAddTask: (phaseKey: PhaseKey) => void;
  onUpdateTask: (phaseKey: PhaseKey, taskId: string, data: Partial<Omit<Task, "id">>) => boolean;
  onRemoveTask: (phaseKey: PhaseKey, taskId: string) => void;
}

export default function TimelineTable({
  project,
  onPhaseDateChange,
  onPhaseStatusOverride,
  onResetBaseline,
  onAddTask,
  onUpdateTask,
  onRemoveTask,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [dateErrors, setDateErrors] = useState<Record<string, string>>({});
  const [resetConfirmKey, setResetConfirmKey] = useState<PhaseKey | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<PhaseKey>>(new Set());

  const handleDateChange = (phaseKey: PhaseKey, field: "start" | "end", value: string) => {
    const phase = project.timeline[phaseKey];

    // Validation (spec §6.8): end cannot be before start
    if (field === "end" && phase.start && value < phase.start) {
      setDateErrors((prev) => ({ ...prev, [`${phaseKey}-end`]: "End date cannot be before start date" }));
      return;
    }
    if (field === "start" && phase.end && value > phase.end) {
      setDateErrors((prev) => ({ ...prev, [`${phaseKey}-start`]: "Start date cannot be after end date" }));
      return;
    }

    // Clear errors
    setDateErrors((prev) => {
      const next = { ...prev };
      delete next[`${phaseKey}-${field}`];
      return next;
    });

    onPhaseDateChange(phaseKey, field, value);
  };

  const handleStatusChange = (phaseKey: PhaseKey, status: PhaseStatus) => {
    onPhaseStatusOverride(phaseKey, status);
  };

  const hasErrors = Object.keys(dateErrors).length > 0;

  return (
    <div className="bg-canvas rounded-xl border border-hairline-soft overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-surface/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <svg className="text-slate" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <h2 className="text-base font-medium text-ink">Timeline SDLC</h2>
          {hasErrors && (
            <span className="text-xs font-medium text-danger bg-red-50 px-2 py-0.5 rounded-full">
              Validation errors
            </span>
          )}
        </div>
        <svg
          className={`text-stone transition-transform ${collapsed ? "" : "rotate-180"}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-6 pb-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline-soft">
                  <th className="text-left px-2 py-2 text-xs font-semibold text-steel uppercase tracking-wide w-[140px]">Phase</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-steel uppercase tracking-wide">Start</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-steel uppercase tracking-wide">End</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-steel uppercase tracking-wide">Baseline</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-steel uppercase tracking-wide w-[150px]">Status</th>
                  <th className="px-2 py-2 w-[80px]" />
                </tr>
              </thead>
              <tbody>
                {PHASE_ORDER.map((key) => {
                  const phase = project.timeline[key];
                  const computedStatus = derivePhaseStatus(phase);
                  const delay = hasPotentialDelay(phase);
                  const gap = getPhaseGapDays(project, key);
                  const startErr = dateErrors[`${key}-start`];
                  const endErr = dateErrors[`${key}-end`];
                  const isExpanded = expandedPhases.has(key);
                  const tasks = phase.tasks ?? [];

                  // Build the phase row
                  const phaseRow = (
                    <tr key={key} className="border-b border-hairline-soft last:border-0">
                      {/* Phase name */}
                      <td className="px-2 py-2.5">
                        <span className="font-medium text-ink text-[13px]">{PHASE_LABELS[key]}</span>
                      </td>

                      {/* Start date picker */}
                      <td className="px-2 py-2.5">
                        <input
                          type="date"
                          value={phase.start ?? ""}
                          onChange={(e) => handleDateChange(key, "start", e.target.value)}
                          className={`h-9 px-2 border rounded-md text-base text-ink bg-canvas outline-none transition w-[150px]
                            ${startErr ? "border-danger" : "border-hairline-strong focus:border-brand-blue"}`}
                        />
                        {startErr && <p className="text-[11px] text-danger mt-0.5">{startErr}</p>}
                      </td>

                      {/* End date picker */}
                      <td className="px-2 py-2.5">
                        <input
                          type="date"
                          value={phase.end ?? ""}
                          onChange={(e) => handleDateChange(key, "end", e.target.value)}
                          className={`h-9 px-2 border rounded-md text-base text-ink bg-canvas outline-none transition w-[150px]
                            ${endErr ? "border-danger" : "border-hairline-strong focus:border-brand-blue"}`}
                        />
                        {endErr && <p className="text-[11px] text-danger mt-0.5">{endErr}</p>}
                      </td>

                      {/* Baseline (read-only) */}
                      <td className="px-2 py-2.5">
                        <div className="text-[12px] text-stone">
                          {phase.baselineStart ? (
                            <span>
                              {formatDate(phase.baselineStart)} → {formatDate(phase.baselineEnd)}
                              {(phase.baselineStart !== phase.start || phase.baselineEnd !== phase.end) && (
                                <span className="ml-1 text-brand-yellow-deep font-medium">⚠</span>
                              )}
                            </span>
                          ) : (
                            <span className="italic">Not set</span>
                          )}
                        </div>
                        {phase.baselineStart && (
                          <div className="mt-0.5">
                            {resetConfirmKey === key ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-amber-600">Are you sure?</span>
                                <button
                                  onClick={() => {
                                    onResetBaseline(key);
                                    setResetConfirmKey(null);
                                    useToastStore.getState().addToast(`Baseline reset for ${PHASE_LABELS[key]}`);
                                  }}
                                  className="text-[10px] font-medium text-white bg-brand-blue px-1.5 py-0.5 rounded cursor-pointer hover:bg-brand-blue-pressed"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setResetConfirmKey(null)}
                                  className="text-[10px] text-steel hover:text-ink cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setResetConfirmKey(key)}
                                className="text-[11px] text-brand-blue hover:underline cursor-pointer"
                                title="Reset baseline to current dates"
                              >
                                Reset baseline
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status with manual override */}
                      <td className="px-2 py-2.5">
                        <div className="flex flex-col gap-1">
                          <select
                            value={phase.status}
                            onChange={(e) => handleStatusChange(key, e.target.value as PhaseStatus)}
                            className={`h-8 px-1.5 border rounded-md text-base outline-none transition cursor-pointer
                              ${phase.statusManualOverride
                                ? "border-amber-300 bg-amber-50 text-amber-800 font-medium"
                                : "border-hairline bg-canvas text-steel"
                              }`}
                          >
                            <option value="NOT_STARTED">Not Started</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="DONE">Done</option>
                          </select>
                          {phase.statusManualOverride && (
                            <span className="text-[10px] text-amber-600 font-medium">Manual override</span>
                          )}
                          {!phase.statusManualOverride && computedStatus !== phase.status && (
                            <span className="text-[10px] text-stone italic">
                              Auto: {computedStatus === "NOT_STARTED" ? "Not Started" : computedStatus === "IN_PROGRESS" ? "In Progress" : "Done"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions + Add Task */}
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1">
                          {delay && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700"
                              title="Phase end date has passed but status is still In Progress"
                            >
                              Delay
                            </span>
                          )}
                          {gap && !delay && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface text-stone"
                              title={`Gap of ${gap} day(s) before this phase`}
                            >
                              +{gap}d
                            </span>
                          )}
                          <button
                            onClick={() => onAddTask(key)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-brand-blue hover:bg-brand-blue/10 transition-colors whitespace-nowrap"
                            title="Add task to this phase"
                          >
                            <Plus size={13} />
                            Add Task
                          </button>
                        </div>
                      </td>
                    </tr>
                  );

                  // If phase has tasks, render with expandable task rows
                  if (tasks.length > 0) {
                    return (
                      <React.Fragment key={`${key}-with-tasks`}>
                        {phaseRow}
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <div className="bg-surface/50">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-hairline-soft">
                                      <th className="text-left px-4 py-1.5 text-[10px] font-semibold text-steel uppercase tracking-wide w-[180px]">Task Name</th>
                                      <th className="text-left px-2 py-1.5 text-[10px] font-semibold text-steel uppercase tracking-wide w-[80px]">Duration</th>
                                      <th className="text-left px-2 py-1.5 text-[10px] font-semibold text-steel uppercase tracking-wide">Predecessors</th>
                                      <th className="text-left px-2 py-1.5 text-[10px] font-semibold text-steel uppercase tracking-wide w-[80px]">Start</th>
                                      <th className="text-left px-2 py-1.5 text-[10px] font-semibold text-steel uppercase tracking-wide w-[80px]">End</th>
                                      <th className="text-left px-2 py-1.5 text-[10px] font-semibold text-steel uppercase tracking-wide w-[120px]">Assignee</th>
                                      <th className="text-left px-2 py-1.5 text-[10px] font-semibold text-steel uppercase tracking-wide w-[100px]">Status</th>
                                      <th className="px-2 py-1.5 w-[40px]" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tasks.map((task) => (
                                      <TaskRow
                                        key={task.id}
                                        task={task}
                                        availableTasks={getAllProjectTasks(project)}
                                        onUpdate={(taskId, data) => onUpdateTask(key, taskId, data)}
                                        onDelete={(taskId) => onRemoveTask(key, taskId)}
                                      />
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={6} className="px-2 py-1">
                            <button
                              onClick={() => {
                                setExpandedPhases((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(key)) {
                                    next.delete(key);
                                  } else {
                                    next.add(key);
                                  }
                                  return next;
                                });
                              }}
                              className="text-[11px] text-brand-blue hover:underline cursor-pointer"
                            >
                              {isExpanded ? "Hide tasks" : `Show ${tasks.length} task(s)`}
                            </button>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  }

                  return phaseRow;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
