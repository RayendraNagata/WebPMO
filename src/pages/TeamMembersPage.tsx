import { useState, useMemo } from "react";
import { UserPlus, Pencil, Trash2, Check, X } from "lucide-react";
import { usePMOStore } from "@/store/pmoStore";
import type { TeamMember } from "@/types";
import { useToastStore } from "@/store/toastStore";

// ─── Role options (extensible) ───
const ROLE_OPTIONS = ["Product Manager", "BSM", "BPA", "UI/UX", "DEV", "PQA", "ABAP"];

// ─── Blank form state ───
interface MemberForm {
  nama: string;
  role: string;
  isActive: boolean;
}

const BLANK_FORM: MemberForm = { nama: "", role: "DEV", isActive: true };

function validateForm(f: MemberForm): string | null {
  if (!f.nama.trim()) return "Name is required.";
  if (f.nama.trim().length < 2) return "Name must be at least 2 characters.";
  if (!f.role) return "Role is required.";
  return null;
}

// ─── Page ───
export default function TeamMembersPage() {
  const members = usePMOStore((s) => s.teamMembers);
  const createMember = usePMOStore((s) => s.createMember);
  const updateMember = usePMOStore((s) => s.updateMember);
  const deleteMember = usePMOStore((s) => s.deleteMember);

  // ── Modal state: null = closed, "add" = adding new, string id = editing ──
  const [modal, setModal] = useState<null | "add" | string>(null);
  const [form, setForm] = useState<MemberForm>(BLANK_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Delete confirmation: null = none, string = id pending confirm ──
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Filter ──
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (!showInactive && !m.isActive) return false;
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      return true;
    });
  }, [members, roleFilter, showInactive]);

  // ── Open add modal ──
  const openAdd = () => {
    setForm(BLANK_FORM);
    setFormError(null);
    setModal("add");
  };

  // ── Open edit modal ──
  const openEdit = (m: TeamMember) => {
    setForm({ nama: m.nama, role: m.role, isActive: m.isActive });
    setFormError(null);
    setModal(m.id);
  };

  // ── Submit ──
  const handleSubmit = () => {
    const err = validateForm(form);
    if (err) { setFormError(err); return; }

    if (modal === "add") {
      createMember({ nama: form.nama.trim(), role: form.role, isActive: form.isActive });
      useToastStore.getState().addToast(`Member "${form.nama.trim()}" added`);
    } else if (modal) {
      updateMember(modal, { nama: form.nama.trim(), role: form.role, isActive: form.isActive });
      useToastStore.getState().addToast(`Member "${form.nama.trim()}" updated`);
    }
    setModal(null);
  };

  // ── Toggle active inline (single click, no modal) ──
  const toggleActive = (m: TeamMember) => {
    updateMember(m.id, { isActive: !m.isActive });
    useToastStore.getState().addToast(
      m.isActive ? `${m.nama} set inactive` : `${m.nama} set active`
    );
  };

  // ── Delete (two-step: click → confirm row → confirm) ──
  const handleDeleteConfirm = (id: string) => {
    const m = members.find((x) => x.id === id);
    deleteMember(id);
    setDeleteConfirmId(null);
    useToastStore.getState().addToast(`Member "${m?.nama ?? id}" deleted`);
  };

  const isModalOpen = modal !== null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink mb-1">Team Members</h1>
          <p className="text-sm text-steel">
            {members.filter((m) => m.isActive).length} active ·{" "}
            {members.length} total
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors cursor-pointer"
        >
          <UserPlus size={16} />
          Add Member
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 px-3 rounded-full border border-hairline-strong bg-canvas text-sm font-medium text-ink outline-none focus:border-brand-blue transition cursor-pointer"
        >
          <option value="all">All Roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-steel cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded accent-brand-blue"
          />
          Show inactive
        </label>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-canvas rounded-xl border border-hairline-soft p-16 flex flex-col items-center text-center">
          <p className="text-base font-medium text-ink mb-1">No members found</p>
          <p className="text-sm text-steel">
            {roleFilter !== "all" ? `No ${roleFilter} members match your filters.` : "No team members yet."}
          </p>
        </div>
      ) : (
        <div className="bg-canvas rounded-xl border border-hairline-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline-soft bg-surface/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide w-[100px]">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide w-[100px]">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-steel uppercase tracking-wide w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className={`border-b border-hairline-soft last:border-0 transition-colors ${
                    m.isActive ? "hover:bg-surface/30" : "opacity-50 hover:bg-surface/20"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-ink">{m.nama}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface text-steel border border-hairline">
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {/* Inline active toggle — single click, no modal */}
                    <button
                      type="button"
                      onClick={() => toggleActive(m)}
                      title={m.isActive ? "Click to deactivate" : "Click to activate"}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                        m.isActive
                          ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                          : "bg-surface text-stone border border-hairline hover:bg-hairline-soft"
                      }`}
                    >
                      {m.isActive ? <Check size={11} /> : <X size={11} />}
                      {m.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {deleteConfirmId === m.id ? (
                      /* Step 2: confirm row */
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xs text-danger font-medium">Delete?</span>
                        <button
                          onClick={() => handleDeleteConfirm(m.id)}
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
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="p-1.5 rounded-md text-stone hover:text-ink hover:bg-surface transition-colors cursor-pointer"
                          title="Edit member"
                        >
                          <Pencil size={15} />
                        </button>
                        {/* Step 1: click trash icon */}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(m.id)}
                          className="p-1.5 rounded-md text-stone hover:text-danger hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete member"
                        >
                          <Trash2 size={15} />
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-canvas rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink mb-5">
              {modal === "add" ? "Add Team Member" : "Edit Team Member"}
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={(e) => { setForm((f) => ({ ...f, nama: e.target.value })); setFormError(null); }}
                  placeholder="Full name"
                  autoFocus
                  className="w-full h-11 px-4 border border-hairline-strong rounded-lg text-base text-ink bg-canvas outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Role <span className="text-danger">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={(e) => { setForm((f) => ({ ...f, role: e.target.value })); setFormError(null); }}
                  className="w-full h-11 px-4 border border-hairline-strong rounded-lg text-base text-ink bg-canvas outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition cursor-pointer"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-ink">Active</label>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    form.isActive ? "bg-brand-blue" : "bg-hairline-strong"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      form.isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {formError && (
                <p className="text-xs text-danger">{formError}</p>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 bg-primary text-on-primary px-4 py-2.5 rounded-full text-sm font-medium hover:bg-charcoal transition-colors cursor-pointer"
              >
                {modal === "add" ? "Add Member" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setModal(null)}
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
