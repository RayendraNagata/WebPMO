import { useState, useMemo, useRef, useEffect } from "react";
import { X, ChevronDown, Search } from "lucide-react";
import { usePMOStore } from "@/store/pmoStore";
import type { TeamAssignment as TeamAssignmentType } from "@/types";

interface Props {
  value: TeamAssignmentType;
  onChange: (tim: TeamAssignmentType) => void;
}

const ROLES = ["Product Manager", "BSM", "BPA", "UI/UX", "DEV", "PQA", "ABAP"] as const;

export default function TeamAssignment({ value, onChange }: Props) {
  return (
    <div className="bg-canvas rounded-xl border border-hairline-soft p-6">
      <h3 className="text-sm font-medium text-ink mb-4">Team Assignment</h3>
      <p className="text-xs text-steel mb-4">Assign team members to each role. Optional — you can fill this in later.</p>
      <div className="space-y-4">
        {ROLES.map((role) => (
          <RoleSelect
            key={role}
            role={role}
            selectedIds={value[role] ?? []}
            onChange={(ids) => onChange({ ...value, [role]: ids })}
          />
        ))}
      </div>
    </div>
  );
}

function RoleSelect({
  role,
  selectedIds,
  onChange,
}: {
  role: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
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

  // Available members for this role (active only) — select raw, filter in useMemo
  const allMembers = usePMOStore((s) => s.teamMembers);
  const availableMembers = useMemo(
    () => allMembers.filter((m) => m.role === role && m.isActive),
    [allMembers, role]
  );

  // Filter by search
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return availableMembers;
    const q = search.toLowerCase();
    return availableMembers.filter((m) => m.nama.toLowerCase().includes(q));
  }, [availableMembers, search]);

  // Resolve selected member details
  const selectedMembers = useMemo(
    () => selectedIds.map((id) => allMembers.find((m) => m.id === id)).filter(Boolean),
    [allMembers, selectedIds]
  );

  const handleToggle = (memberId: string) => {
    if (selectedIds.includes(memberId)) {
      onChange(selectedIds.filter((id) => id !== memberId));
    } else {
      onChange([...selectedIds, memberId]);
    }
  };

  const handleRemove = (memberId: string) => {
    onChange(selectedIds.filter((id) => id !== memberId));
  };

  const getWorkload = usePMOStore((s) => s.getMemberWorkload);

  return (
    <div>
      <label className="block text-xs font-semibold text-steel uppercase tracking-wide mb-1.5">
        {role}
      </label>

      {/* Selected chips */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedMembers.map((m) =>
            m ? (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-surface rounded-full text-xs font-medium text-ink"
              >
                {m.nama}
                <button
                  type="button"
                  onClick={() => handleRemove(m.id)}
                  className="p-0.5 rounded-full hover:bg-hairline-soft transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ) : null
          )}
        </div>
      )}

      {/* Dropdown trigger */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => { setIsOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="w-full h-10 px-3 border border-hairline-strong rounded-lg text-sm text-steel bg-canvas flex items-center justify-between hover:border-brand-blue/50 transition-colors cursor-pointer"
        >
          <span className="text-sm">
            {selectedIds.length > 0
              ? `${selectedIds.length} member${selectedIds.length !== 1 ? "s" : ""} selected`
              : "Select members..."}
          </span>
          <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-canvas rounded-lg border border-hairline shadow-lg z-20 max-h-64 overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-hairline-soft">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full h-8 pl-7 pr-2 border border-hairline rounded-md text-sm text-ink bg-canvas outline-none focus:border-brand-blue"
                />
              </div>
            </div>

            {/* Member list */}
            <div className="overflow-y-auto max-h-48 py-1">
              {filteredMembers.length === 0 ? (
                <p className="px-3 py-2 text-xs text-stone italic">No active members for this role</p>
              ) : (
                filteredMembers.map((m) => {
                  const isSelected = selectedIds.includes(m.id);
                  const workload = getWorkload(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleToggle(m.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${
                        isSelected ? "bg-brand-blue/5 text-ink" : "text-ink hover:bg-surface"
                      }`}
                    >
                      {/* Checkbox visual */}
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected
                            ? "bg-brand-blue border-brand-blue"
                            : "border-hairline-strong bg-canvas"
                        }`}
                      >
                        {isSelected && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 text-left">{m.nama}</span>
                      {workload > 0 && (
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            workload >= 3
                              ? "bg-amber-50 text-amber-700"
                              : "bg-surface text-stone"
                          }`}
                          title={`${workload} active project${workload !== 1 ? "s" : ""}`}
                        >
                          {workload} project{workload !== 1 ? "s" : ""}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
