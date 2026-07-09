import { useState } from "react";
import { CalendarX, Plus, Trash2 } from "lucide-react";
import { useHolidayStore, triggerHolidayRecompute } from "@/store/holidayStore";
import type { Holiday } from "@/types";
import { formatDate } from "@/components/Shared";
import { useToastStore } from "@/store/toastStore";

// ─── Blank form ───
interface HolidayForm {
  tanggal: string;
  nama: string;
}
const BLANK: HolidayForm = { tanggal: "", nama: "" };

function validate(f: HolidayForm): string | null {
  if (!f.tanggal) return "Date is required.";
  if (!f.nama.trim()) return "Name is required.";
  if (f.nama.trim().length < 2) return "Name must be at least 2 characters.";
  return null;
}

export default function HolidaysPage() {
  const holidays = useHolidayStore((s) => s.holidays);
  const addHoliday = useHolidayStore((s) => s.addHoliday);
  const removeHoliday = useHolidayStore((s) => s.removeHoliday);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<HolidayForm>(BLANK);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Two-step delete: null = none, string id = pending confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sorted by date ascending
  const sorted = [...holidays].sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  // ── Add ──
  const handleSubmit = async () => {
    const err = validate(form);
    if (err) { setFormError(err); return; }
    setSubmitting(true);
    addHoliday({ tanggal: form.tanggal, nama: form.nama.trim() });
    await triggerHolidayRecompute();
    useToastStore.getState().addToast(`Holiday "${form.nama.trim()}" added`);
    setForm(BLANK);
    setFormError(null);
    setShowModal(false);
    setSubmitting(false);
  };

  // ── Delete ──
  const handleDelete = async (h: Holiday) => {
    removeHoliday(h.id);
    setDeleteConfirmId(null);
    await triggerHolidayRecompute();
    useToastStore.getState().addToast(`Holiday "${h.nama}" removed`);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink mb-1">Holidays</h1>
          <p className="text-sm text-steel">
            {holidays.length} holiday{holidays.length !== 1 ? "s" : ""} configured ·
            Applies to all working-day calculations across all projects
          </p>
        </div>
        <button
          onClick={() => { setForm(BLANK); setFormError(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Add Holiday
        </button>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="bg-canvas rounded-xl border border-hairline-soft p-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center mb-4">
            <CalendarX size={28} className="text-stone" />
          </div>
          <p className="text-base font-medium text-ink mb-1">No holidays configured</p>
          <p className="text-sm text-steel mb-5 max-w-xs">
            Add national holidays or company holidays to exclude them from working-day calculations.
          </p>
          <button
            onClick={() => { setForm(BLANK); setFormError(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Holiday
          </button>
        </div>
      ) : (
        <div className="bg-canvas rounded-xl border border-hairline-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline-soft bg-surface/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide">Name</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-hairline-soft last:border-0 hover:bg-surface/30 transition-colors"
                >
                  <td className="px-4 py-3 text-steel font-mono text-[13px]">
                    {formatDate(h.tanggal)}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{h.nama}</td>
                  <td className="px-4 py-3 text-right">
                    {deleteConfirmId === h.id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xs text-danger font-medium">Remove?</span>
                        <button
                          onClick={() => handleDelete(h)}
                          className="text-xs font-semibold text-white bg-danger px-2 py-0.5 rounded cursor-pointer hover:bg-red-600 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-xs text-steel hover:text-ink cursor-pointer"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(h.id)}
                        className="p-1.5 rounded-md text-stone hover:text-danger hover:bg-red-50 transition-colors cursor-pointer"
                        title="Remove holiday"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-canvas rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink mb-5">Add Holiday</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  value={form.tanggal}
                  onChange={(e) => { setForm((f) => ({ ...f, tanggal: e.target.value })); setFormError(null); }}
                  autoFocus
                  className="w-full h-11 px-4 border border-hairline-strong rounded-lg text-base text-ink bg-canvas outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={(e) => { setForm((f) => ({ ...f, nama: e.target.value })); setFormError(null); }}
                  placeholder="e.g. Hari Kemerdekaan RI"
                  className="w-full h-11 px-4 border border-hairline-strong rounded-lg text-base text-ink bg-canvas outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition"
                />
              </div>

              {formError && (
                <p className="text-xs text-danger">{formError}</p>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-primary text-on-primary px-4 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors cursor-pointer disabled:opacity-50"
              >
                Add Holiday
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-ink border border-hairline-strong hover:bg-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
