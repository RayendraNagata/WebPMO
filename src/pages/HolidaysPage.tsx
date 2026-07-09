import { useState } from "react";
import { CalendarX, Plus, Trash2, ClipboardList } from "lucide-react";
import { useHolidayStore, triggerHolidayRecompute } from "@/store/holidayStore";
import type { Holiday } from "@/types";
import { formatDate } from "@/components/Shared";
import { useToastStore } from "@/store/toastStore";

// ─── Single-add form ───
interface HolidayForm {
  tanggal: string;
  nama: string;
}
const BLANK: HolidayForm = { tanggal: "", nama: "" };

function validateSingle(f: HolidayForm): string | null {
  if (!f.tanggal) return "Date is required.";
  if (!f.nama.trim()) return "Name is required.";
  if (f.nama.trim().length < 2) return "Name must be at least 2 characters.";
  return null;
}

// ─── Bulk-add helpers ───

/**
 * Parse a MM/DD/YY token into ISO YYYY-MM-DD.
 * YY is interpreted as 20YY (e.g. "26" → 2026).
 * Returns null if the token doesn't represent a real calendar date.
 */
function parseMDY(token: string): string | null {
  const cleaned = token.trim();
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day   = parseInt(match[2], 10);
  const year  = 2000 + parseInt(match[3], 10);

  // Basic range checks before constructing a Date
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Use local Date constructor to validate (e.g. Feb 30 rolls over → mismatch)
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null; // rolled over — not a real date
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

interface BulkParseResult {
  valid: string[];          // ISO dates that parsed OK
  invalid: string[];        // original tokens that failed
  duplicates: string[];     // ISO dates already in the holiday list
  toAdd: string[];          // valid minus duplicates — what will actually be added
}

function parseBulkInput(raw: string, existingSet: Set<string>): BulkParseResult {
  const tokens = raw.split(",").map((t) => t.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    const iso = parseMDY(token);
    if (iso) {
      valid.push(iso);
    } else {
      invalid.push(token);
    }
  }

  // Deduplicate within the paste itself, then against existing holidays
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const toAdd: string[] = [];

  for (const iso of valid) {
    if (seen.has(iso)) continue; // duplicate within the paste
    seen.add(iso);
    if (existingSet.has(iso)) {
      duplicates.push(iso);
    } else {
      toAdd.push(iso);
    }
  }

  return { valid, invalid, duplicates, toAdd };
}

// ─── Component ───

export default function HolidaysPage() {
  const holidays    = useHolidayStore((s) => s.holidays);
  const addHoliday  = useHolidayStore((s) => s.addHoliday);
  const removeHoliday = useHolidayStore((s) => s.removeHoliday);

  // ── Single-add state ──
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState<HolidayForm>(BLANK);
  const [formError, setFormError]     = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  // ── Two-step delete ──
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Bulk-add state ──
  const [showBulk, setShowBulk]         = useState(false);
  const [bulkText, setBulkText]         = useState("");
  const [bulkLabel, setBulkLabel]       = useState("");
  const [bulkLabelError, setBulkLabelError] = useState<string | null>(null);
  const [bulkParseError, setBulkParseError] = useState<string | null>(null);
  const [bulkPreview, setBulkPreview]   = useState<BulkParseResult | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Sorted by date ascending
  const sorted = [...holidays].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const existingSet = new Set(holidays.map((h) => h.tanggal));

  // ── Single add ──
  const handleSubmit = async () => {
    const err = validateSingle(form);
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

  // ── Bulk: parse & show preview ──
  const handleBulkPreview = () => {
    setBulkLabelError(null);
    setBulkParseError(null);

    if (!bulkLabel.trim()) {
      setBulkLabelError("Label is required for bulk add.");
      return;
    }
    if (!bulkText.trim()) {
      setBulkParseError("Paste at least one date.");
      return;
    }

    const result = parseBulkInput(bulkText, existingSet);

    if (result.valid.length === 0 && result.invalid.length > 0) {
      setBulkParseError(
        `No valid dates found. Failed entries: ${result.invalid.join(", ")}. ` +
        `Expected format: MM/DD/YY (e.g. 01/01/26).`
      );
      setBulkPreview(null);
      return;
    }

    if (result.invalid.length > 0) {
      setBulkParseError(
        `${result.invalid.length} entr${result.invalid.length === 1 ? "y" : "ies"} could not be parsed and will be skipped: ` +
        result.invalid.join(", ")
      );
    }

    setBulkPreview(result);
  };

  // ── Bulk: confirm & commit ──
  const handleBulkConfirm = async () => {
    if (!bulkPreview || bulkPreview.toAdd.length === 0) return;
    setBulkSubmitting(true);

    const label = bulkLabel.trim();
    for (const iso of bulkPreview.toAdd) {
      addHoliday({ tanggal: iso, nama: label });
    }
    // Single recompute for the whole batch
    await triggerHolidayRecompute();

    const added = bulkPreview.toAdd.length;
    const skipped = bulkPreview.duplicates.length;
    const msg =
      added === 1
        ? `1 holiday added${skipped > 0 ? `, ${skipped} duplicate${skipped > 1 ? "s" : ""} skipped` : ""}`
        : `${added} holidays added${skipped > 0 ? `, ${skipped} duplicate${skipped > 1 ? "s" : ""} skipped` : ""}`;
    useToastStore.getState().addToast(msg);

    // Reset bulk state
    setBulkText("");
    setBulkLabel("");
    setBulkPreview(null);
    setBulkParseError(null);
    setBulkLabelError(null);
    setBulkSubmitting(false);
    setShowBulk(false);
  };

  const handleBulkClose = () => {
    setShowBulk(false);
    setBulkText("");
    setBulkLabel("");
    setBulkPreview(null);
    setBulkParseError(null);
    setBulkLabelError(null);
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => { handleBulkClose(); setShowBulk(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-ink border border-hairline-strong hover:bg-surface transition-colors cursor-pointer"
          >
            <ClipboardList size={15} />
            Bulk Add
          </button>
          <button
            onClick={() => { setForm(BLANK); setFormError(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Holiday
          </button>
        </div>
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

      {/* ── Single Add Modal ── */}
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

      {/* ── Bulk Add Modal ── */}
      {showBulk && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={handleBulkClose}
        >
          <div
            className="bg-canvas rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink mb-1">Bulk Add Holidays</h3>
            <p className="text-sm text-steel mb-5">
              Paste comma-separated dates in <span className="font-mono text-xs bg-surface px-1 py-0.5 rounded">MM/DD/YY</span> format.
              One label is applied to all dates in the batch.
            </p>

            <div className="space-y-4">
              {/* Label input */}
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Label (applied to all dates) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={bulkLabel}
                  onChange={(e) => { setBulkLabel(e.target.value); setBulkLabelError(null); setBulkPreview(null); }}
                  placeholder="e.g. Libur Nasional 2026"
                  autoFocus
                  className="w-full h-11 px-4 border border-hairline-strong rounded-lg text-sm text-ink bg-canvas outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition"
                />
                {bulkLabelError && (
                  <p className="text-xs text-danger mt-1">{bulkLabelError}</p>
                )}
              </div>

              {/* Paste area */}
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Dates <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={4}
                  value={bulkText}
                  onChange={(e) => { setBulkText(e.target.value); setBulkParseError(null); setBulkPreview(null); }}
                  placeholder="01/01/26, 08/17/26, 12/25/26, ..."
                  className="w-full px-4 py-3 border border-hairline-strong rounded-lg text-sm text-ink bg-canvas outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition resize-none font-mono"
                />
                {bulkParseError && (
                  <p className="text-xs text-amber-600 mt-1">{bulkParseError}</p>
                )}
              </div>

              {/* Preview panel */}
              {bulkPreview && (
                <div className={`rounded-lg border p-4 text-sm ${
                  bulkPreview.toAdd.length > 0
                    ? "bg-green-50 border-green-200"
                    : "bg-amber-50 border-amber-200"
                }`}>
                  {bulkPreview.toAdd.length > 0 ? (
                    <p className="font-medium text-green-800">
                      <span className="font-bold">{bulkPreview.toAdd.length}</span> holiday{bulkPreview.toAdd.length !== 1 ? "s" : ""} will be added
                      {bulkPreview.duplicates.length > 0 && (
                        <span className="font-normal text-green-700">
                          {" "}· {bulkPreview.duplicates.length} duplicate{bulkPreview.duplicates.length !== 1 ? "s" : ""} skipped
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="font-medium text-amber-800">
                      No new holidays to add — all {bulkPreview.duplicates.length} date{bulkPreview.duplicates.length !== 1 ? "s" : ""} already exist.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-6">
              {/* Show "Preview" until preview is ready, then "Confirm Add" */}
              {!bulkPreview ? (
                <button
                  type="button"
                  onClick={handleBulkPreview}
                  className="flex-1 bg-primary text-on-primary px-4 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors cursor-pointer"
                >
                  Preview
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBulkConfirm}
                  disabled={bulkSubmitting || bulkPreview.toAdd.length === 0}
                  className="flex-1 bg-primary text-on-primary px-4 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSubmitting ? "Adding…" : `Confirm — Add ${bulkPreview.toAdd.length}`}
                </button>
              )}
              <button
                type="button"
                onClick={handleBulkClose}
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
