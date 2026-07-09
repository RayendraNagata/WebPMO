import { useState, useRef } from "react";
import type { Milestone } from "@/types";
import { formatDate } from "@/components/Shared";
import { useToastStore } from "@/store/toastStore";

interface Props {
  milestones: Milestone[];
  onAdd: (nama: string, tanggal: string) => void;
  onUpdate: (id: string, data: { nama?: string; tanggal?: string }) => void;
  onRemove: (id: string) => void;
}

export default function MilestoneSection({ milestones, onAdd, onUpdate, onRemove }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [tanggal, setTanggal] = useState("");

  // ── Pending delete state (spec §6.7: undo toast, no modal) ──
  // Milestones whose delete is pending (hidden in UI, timer running).
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  // Timer refs keyed by milestone id so we can cancel them on undo.
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleRemove = (milestone: Milestone) => {
    // Hide immediately
    setPendingDeleteIds((prev) => new Set([...prev, milestone.id]));

    // Schedule finalization after 5 seconds
    const timer = setTimeout(() => {
      onRemove(milestone.id);
      setPendingDeleteIds((prev) => {
        const next = new Set(prev);
        next.delete(milestone.id);
        return next;
      });
      deleteTimers.current.delete(milestone.id);
    }, 5000);

    deleteTimers.current.set(milestone.id, timer);

    // Show toast with Undo action
    useToastStore.getState().addToast(
      `Milestone "${milestone.nama}" removed`,
      "info",
      {
        durationMs: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            // Cancel the pending delete
            const t = deleteTimers.current.get(milestone.id);
            if (t) {
              clearTimeout(t);
              deleteTimers.current.delete(milestone.id);
            }
            setPendingDeleteIds((prev) => {
              const next = new Set(prev);
              next.delete(milestone.id);
              return next;
            });
          },
        },
      }
    );
  };

  const handleAdd = () => {
    if (!nama.trim() || !tanggal) return;
    onAdd(nama.trim(), tanggal);
    setNama("");
    setTanggal("");
    setShowForm(false);
  };

  const handleEdit = (id: string) => {
    if (!nama.trim() || !tanggal) return;
    onUpdate(id, { nama: nama.trim(), tanggal });
    setEditingId(null);
    setNama("");
    setTanggal("");
  };

  const startEdit = (m: Milestone) => {
    setEditingId(m.id);
    setNama(m.nama);
    setTanggal(m.tanggal);
  };

  // Visible milestones: exclude those pending deletion
  const visibleMilestones = milestones.filter((m) => !pendingDeleteIds.has(m.id));

  return (
    <div className="bg-canvas rounded-xl border border-hairline-soft p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <svg className="text-slate" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          <h2 className="text-base font-medium text-ink">Milestones</h2>
          {/* Count reflects visible milestones */}
          <span className="text-xs text-stone bg-surface px-2 py-0.5 rounded-full">
            {visibleMilestones.length}
          </span>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setNama(""); setTanggal(""); }}
            className="text-sm font-medium text-brand-blue hover:underline cursor-pointer"
          >
            + Add Milestone
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {(showForm || editingId) && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-surface rounded-lg">
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Milestone name"
            className="flex-1 h-8 px-3 border border-hairline-strong rounded-md text-sm text-ink bg-canvas outline-none focus:border-brand-blue"
          />
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="h-9 px-2 border border-hairline-strong rounded-md text-base text-ink bg-canvas outline-none focus:border-brand-blue"
          />
          <button
            onClick={editingId ? () => handleEdit(editingId) : handleAdd}
            disabled={!nama.trim() || !tanggal}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-on-primary hover:bg-charcoal transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            {editingId ? "Save" : "Add"}
          </button>
          <button
            onClick={() => { setShowForm(false); setEditingId(null); setNama(""); setTanggal(""); }}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-steel hover:text-ink transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Milestone list */}
      {visibleMilestones.length === 0 && !showForm ? (
        <p className="text-sm text-stone">No milestones yet.</p>
      ) : (
        <div className="space-y-1.5">
          {visibleMilestones.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface/50 transition-colors group"
            >
              <div className="w-2.5 h-2.5 rotate-45 bg-brand-yellow flex-shrink-0" />
              {editingId === m.id ? (
                <span className="text-sm text-steel italic flex-1">Editing...</span>
              ) : (
                <>
                  <span className="text-sm font-medium text-ink flex-1">{m.nama}</span>
                  <span className="text-xs text-steel">{formatDate(m.tanggal)}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={() => startEdit(m)}
                      className="text-xs text-brand-blue hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRemove(m)}
                      className="text-xs text-danger hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
