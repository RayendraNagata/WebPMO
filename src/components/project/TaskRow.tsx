import { useState, useMemo } from "react";
import { Trash2 } from "lucide-react";
import type { Task, TaskStatus } from "@/types";
import { wouldCreateCycle } from "@/utils/taskDates";
import { formatDate } from "@/components/Shared";
import { usePMOStore } from "@/store/pmoStore";
import PredecessorSelect from "./PredecessorSelect";

interface Props {
  task: Task;
  availableTasks: Task[];
  onUpdate: (taskId: string, data: Partial<Omit<Task, "id">>) => boolean;
  onDelete: (taskId: string) => void;
}

export default function TaskRow({ task, availableTasks, onUpdate, onDelete }: Props) {
  // Cycle-detection error — shown inline below the predecessor field
  const [cycleError, setCycleError] = useState<string | null>(null);
  // Two-step delete: false = idle, true = awaiting confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);

  const allMembers = usePMOStore((s) => s.teamMembers);
  const activeMembers = useMemo(
    () => allMembers.filter((m) => m.isActive),
    [allMembers]
  );

  // ── Field handlers ──

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(task.id, { nama: e.target.value });
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onUpdate(task.id, { durationMandays: isNaN(value) ? 0 : value });
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(task.id, { start: e.target.value || null });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate(task.id, {
      status: e.target.value as TaskStatus,
      statusManualOverride: true,
    });
  };

  const handleAssigneeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate(task.id, { assigneeId: e.target.value || undefined });
  };

  // ── Predecessor change — called by PredecessorSelect with the NEW full array ──
  const handlePredecessorChange = (newIds: string[]) => {
    if (wouldCreateCycle(availableTasks, task.id, newIds)) {
      setCycleError("Circular dependency — this would create a cycle.");
      return;
    }
    setCycleError(null);
    const ok = onUpdate(task.id, { predecessorIds: newIds });
    if (!ok) {
      setCycleError("Circular dependency — this would create a cycle.");
    }
  };

  const hasPredecessors = task.predecessorIds.length > 0;

  return (
    <tr className="border-b border-hairline-soft bg-surface/30">

      {/* Task name */}
      <td className="px-2 py-2">
        <input
          type="text"
          value={task.nama}
          onChange={handleNameChange}
          className="h-8 px-2 border border-hairline-strong rounded-md text-sm text-ink bg-canvas outline-none focus:border-brand-blue w-full"
          placeholder="Task name"
        />
      </td>

      {/* Duration */}
      <td className="px-2 py-2">
        <input
          type="number"
          value={task.durationMandays}
          onChange={handleDurationChange}
          min="0"
          step="0.5"
          className="h-8 px-2 border border-hairline-strong rounded-md text-sm text-ink bg-canvas outline-none focus:border-brand-blue w-[80px]"
          placeholder="Days"
        />
      </td>

      {/* Predecessors */}
      <td className="px-2 py-2 min-w-[160px]">
        <PredecessorSelect
          taskId={task.id}
          selectedIds={task.predecessorIds}
          availableTasks={availableTasks}
          taskPhaseKey={task.phaseKey}
          onChange={handlePredecessorChange}
          error={cycleError}
        />
      </td>

      {/* Start — editable only when no predecessors (computed otherwise) */}
      <td className="px-2 py-2">
        {hasPredecessors ? (
          <span className="text-xs text-ink">
            {task.start ? formatDate(task.start) : "TBD"}
          </span>
        ) : (
          <input
            type="date"
            value={task.start ?? ""}
            onChange={handleStartChange}
            className="h-8 px-1.5 border border-hairline-strong rounded-md text-xs text-ink bg-canvas outline-none focus:border-brand-blue w-[130px]"
          />
        )}
      </td>

      {/* End — always computed, read-only */}
      <td className="px-2 py-2">
        <span className="text-xs text-ink">
          {task.end ? formatDate(task.end) : "TBD"}
        </span>
      </td>

      {/* Assignee */}
      <td className="px-2 py-2">
        <select
          value={task.assigneeId ?? ""}
          onChange={handleAssigneeChange}
          className="h-8 px-1.5 border border-hairline-strong rounded-md text-xs text-ink bg-canvas outline-none focus:border-brand-blue w-[120px]"
        >
          <option value="">— None —</option>
          {activeMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nama}
            </option>
          ))}
        </select>
      </td>

      {/* Status */}
      <td className="px-2 py-2">
        <select
          value={task.status}
          onChange={handleStatusChange}
          className={`h-8 px-1.5 border rounded-md text-xs outline-none transition cursor-pointer ${
            task.statusManualOverride
              ? "border-amber-300 bg-amber-50 text-amber-800 font-medium"
              : "border-hairline bg-canvas text-steel"
          }`}
        >
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="DONE">Done</option>
        </select>
      </td>

      {/* Delete — two-step inline confirm (spec §2: no single-click destructive actions) */}
      <td className="px-2 py-2 text-center">
        {confirmDelete ? (
          /* Step 2: confirm inline */
          <span className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="text-[10px] font-semibold text-white bg-danger px-1.5 py-0.5 rounded cursor-pointer hover:bg-red-600 transition-colors"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-[10px] text-steel hover:text-ink cursor-pointer"
            >
              No
            </button>
          </span>
        ) : (
          /* Step 1: trash icon */
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded text-stone hover:text-danger hover:bg-red-50 transition-colors"
            title="Delete task"
          >
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}
