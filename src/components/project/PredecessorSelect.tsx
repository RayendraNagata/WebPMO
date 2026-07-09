/**
 * PredecessorSelect — multi-select dropdown for task predecessors.
 *
 * Mirrors the RoleSelect pattern in TeamAssignment.tsx:
 *   - Closed: shows removable chips + trigger button (placeholder when empty)
 *   - Open: search input + scrollable checklist with checkbox visuals
 *   - Zero local copy of the selection — reads/writes directly via props
 *
 * Cycle detection and error display live in the parent (TaskRow), keeping this
 * component purely presentational about which IDs are selected.
 *
 * §6.10 Part A: Tasks are grouped by phase in the dropdown, and a warning badge
 * appears when a selected predecessor is from a later phase than the task itself.
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { X, ChevronDown, Search, AlertTriangle } from "lucide-react";
import type { Task, PhaseKey } from "@/types";
import { PHASE_ORDER, PHASE_LABELS } from "@/types";
import { isLaterPhase } from "@/utils/taskDates";

interface Props {
  /** The task that owns this predecessor selector (used to exclude self). */
  taskId: string;
  /** Current predecessorIds — read directly from the task prop, never copied locally. */
  selectedIds: string[];
  /** All tasks in the project (pool to select from, cross-phase). */
  availableTasks: Task[];
  /** The phase this task belongs to (for warning badge logic). */
  taskPhaseKey: PhaseKey;
  /** Called with the NEW full array when the user toggles or removes an entry. */
  onChange: (newIds: string[]) => void;
  /** Cycle / validation error to display below the field (managed by parent). */
  error?: string | null;
}

export default function PredecessorSelect({
  taskId,
  selectedIds,
  availableTasks,
  taskPhaseKey,
  onChange,
  error,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click — same pattern as RoleSelect
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Options: every task in the project except this task itself, grouped by phase
  const optionsByPhase = useMemo(() => {
    const grouped = new Map<PhaseKey, Task[]>();
    for (const key of PHASE_ORDER) {
      grouped.set(key, []);
    }
    for (const t of availableTasks) {
      if (t.id !== taskId) {
        grouped.get(t.phaseKey)!.push(t);
      }
    }
    return grouped;
  }, [availableTasks, taskId]);

  // Filtered options by search (still grouped)
  const filteredByPhase = useMemo(() => {
    if (!search.trim()) return optionsByPhase;
    const q = search.toLowerCase();
    const filtered = new Map<PhaseKey, Task[]>();
    for (const [key, tasks] of optionsByPhase) {
      const matching = tasks.filter((t) => (t.nama || "Unnamed").toLowerCase().includes(q));
      filtered.set(key, matching);
    }
    return filtered;
  }, [optionsByPhase, search]);

  // Resolve selected task details for chip display
  const selectedTasks = useMemo(
    () =>
      selectedIds
        .map((id) => availableTasks.find((t) => t.id === id))
        .filter((t): t is Task => t !== undefined),
    [selectedIds, availableTasks]
  );

  const handleToggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onChange(next);
  };

  const handleRemoveChip = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const openDropdown = () => {
    setIsOpen(true);
    // Focus the search input after the dropdown renders
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div>
      {/* ── Chips for selected predecessors ── */}
      {selectedTasks.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selectedTasks.map((t) => {
            const isLater = isLaterPhase(t.phaseKey, taskPhaseKey);
            return (
              <span
                key={t.id}
                className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium ${
                  isLater
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-brand-blue/10 text-brand-blue"
                }`}
                title={
                  isLater
                    ? `${t.nama || "Unnamed"} (from ${PHASE_LABELS[t.phaseKey]} - later phase)`
                    : t.nama || "Unnamed"
                }
              >
                {t.nama || "Unnamed"}
                {isLater && (
                  <AlertTriangle size={10} className="text-amber-600 flex-shrink-0" />
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveChip(t.id)}
                  className="p-0.5 rounded-full hover:bg-brand-blue/20 transition-colors cursor-pointer"
                  title={`Remove ${t.nama || "this predecessor"}`}
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
          {selectedTasks.length > 1 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] text-stone hover:text-danger transition-colors cursor-pointer self-center ml-0.5"
              title="Clear all predecessors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Dropdown ── */}
      <div ref={dropdownRef} className="relative">
        {/* Trigger button */}
        <button
          type="button"
          onClick={openDropdown}
          className={`h-8 w-full px-2.5 border rounded-md text-xs flex items-center justify-between gap-1 transition-colors cursor-pointer ${
            error
              ? "border-danger bg-red-50 text-danger"
              : isOpen
              ? "border-brand-blue bg-canvas text-ink"
              : "border-hairline-strong bg-canvas text-steel hover:border-brand-blue/60"
          }`}
        >
          <span className="truncate">
            {selectedIds.length === 0
              ? "No predecessor"
              : selectedIds.length === 1
              ? "1 predecessor"
              : `${selectedIds.length} predecessors`}
          </span>
          <ChevronDown
            size={13}
            className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown panel */}
        {isOpen && (
          <div className="absolute top-full left-0 z-30 mt-1 w-56 bg-canvas rounded-lg border border-hairline shadow-lg overflow-hidden">
            {/* Search */}
            <div className="p-1.5 border-b border-hairline-soft">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-stone"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full h-7 pl-6 pr-2 border border-hairline rounded text-xs text-ink bg-canvas outline-none focus:border-brand-blue"
                />
              </div>
            </div>

            {/* Option list — grouped by phase */}
            <div className="overflow-y-auto max-h-44 py-0.5">
              {Array.from(filteredByPhase.entries()).every(([_, tasks]) => tasks.length === 0) ? (
                <p className="px-3 py-2 text-xs text-stone italic">No match</p>
              ) : (
                Array.from(filteredByPhase.entries()).map(([phaseKey, tasks]) => {
                  if (tasks.length === 0) return null;
                  return (
                    <div key={phaseKey}>
                      {/* Phase header */}
                      <div className="px-3 py-1 bg-surface/50 text-[10px] font-semibold text-steel uppercase tracking-wide sticky top-0">
                        {PHASE_LABELS[phaseKey]}
                      </div>
                      {/* Tasks in this phase */}
                      {tasks.map((t) => {
                        const isSelected = selectedIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleToggle(t.id)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-brand-blue/5 text-ink"
                                : "text-ink hover:bg-surface"
                            }`}
                          >
                            {/* Checkbox visual */}
                            <span
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected
                                  ? "bg-brand-blue border-brand-blue"
                                  : "border-hairline-strong bg-canvas"
                              }`}
                            >
                              {isSelected && (
                                <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                                  <path
                                    d="M1 4L3.5 6.5L9 1"
                                    stroke="white"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </span>
                            <span className="flex-1 text-left truncate">
                              {t.nama || "Unnamed"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer: clear all (shown only when something is selected) */}
            {selectedIds.length > 0 && (
              <div className="border-t border-hairline-soft px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => { handleClearAll(); setIsOpen(false); }}
                  className="text-[11px] text-stone hover:text-danger transition-colors cursor-pointer"
                >
                  Clear all predecessors
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-[10px] text-danger mt-1 leading-tight">{error}</p>
      )}
    </div>
  );
}
