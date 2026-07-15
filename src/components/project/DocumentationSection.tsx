import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import type { ProjectDocumentation, DocStatus } from "@/types";
import { formatDate } from "@/components/Shared";

interface Props {
  documentation: ProjectDocumentation[];
  onUpdate: (
    docId: string,
    data: Partial<Pick<ProjectDocumentation, "tanggal" | "link" | "status">>
  ) => void;
}

// ─── Status badge config ───
const DOC_STATUS_CONFIG: Record<
  DocStatus,
  { label: string; className: string }
> = {
  NOT_YET:     { label: "Not Yet",     className: "bg-surface text-stone border border-hairline-strong" },
  COMPLETED:   { label: "Completed",   className: "bg-green-100 text-green-700 border border-green-200" },
  NOT_NEEDED:  { label: "Not Needed",  className: "bg-stone/10 text-stone border border-hairline-soft" },
};

/**
 * §6.12 — Dokumentasi Project
 * Fixed 13-row checklist. User can edit tanggal, link, and status per row.
 * Auto-save per field. Doc name is clickable when a valid URL is filled in.
 * NOT_NEEDED rows are visually de-emphasised with muted/strikethrough style.
 */
export default function DocumentationSection({ documentation, onUpdate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});

  // Header counter: items marked COMPLETED
  const completedCount = documentation.filter((d) => d.status === "COMPLETED").length;

  function validateLink(value: string): string {
    if (!value) return "";
    return /^https?:\/\//i.test(value) ? "" : "URL must start with http:// or https://";
  }

  function handleLinkBlur(doc: ProjectDocumentation, value: string) {
    const error = validateLink(value);
    setLinkErrors((prev) => {
      if (error) return { ...prev, [doc.id]: error };
      const next = { ...prev };
      delete next[doc.id];
      return next;
    });
    if (!error) {
      onUpdate(doc.id, { link: value || null });
    }
  }

  function handleDateChange(doc: ProjectDocumentation, value: string) {
    onUpdate(doc.id, { tanggal: value || null });
  }

  function handleStatusChange(doc: ProjectDocumentation, value: DocStatus) {
    onUpdate(doc.id, { status: value });
  }

  return (
    <div className="bg-canvas rounded-xl border border-hairline-soft overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-surface/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <FileText size={18} className="text-slate" />
          <h2 className="text-base font-medium text-ink">Dokumentasi Project</h2>
          <span className="text-xs text-stone bg-surface px-2 py-0.5 rounded-full">
            {completedCount}/{documentation.length} completed
          </span>
        </div>
        <svg
          className={`text-stone transition-transform ${collapsed ? "" : "rotate-180"}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
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
                  <th className="text-left px-2 py-2 text-xs font-semibold text-steel uppercase tracking-wide w-8">No</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-steel uppercase tracking-wide w-44">Nama Dokumen</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-steel uppercase tracking-wide w-36">Status</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-steel uppercase tracking-wide w-40">Tanggal</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-steel uppercase tracking-wide">Link</th>
                </tr>
              </thead>
              <tbody>
                {documentation.map((doc) => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    linkError={linkErrors[doc.id]}
                    onDateChange={handleDateChange}
                    onLinkBlur={handleLinkBlur}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Individual row ───

interface DocRowProps {
  doc: ProjectDocumentation;
  linkError: string | undefined;
  onDateChange: (doc: ProjectDocumentation, value: string) => void;
  onLinkBlur: (doc: ProjectDocumentation, value: string) => void;
  onStatusChange: (doc: ProjectDocumentation, value: DocStatus) => void;
}

function DocRow({ doc, linkError, onDateChange, onLinkBlur, onStatusChange }: DocRowProps) {
  const [linkDraft, setLinkDraft] = useState(doc.link ?? "");
  const hasLink = !!doc.link && /^https?:\/\//i.test(doc.link);
  const isNotNeeded = doc.status === "NOT_NEEDED";

  return (
    <tr
      className={`border-b border-hairline-soft last:border-0 transition-colors ${
        isNotNeeded ? "opacity-50" : "hover:bg-surface/30"
      }`}
    >
      {/* No */}
      <td className="px-2 py-2.5 text-xs text-stone font-medium">{doc.nomor}</td>

      {/* Nama Dokumen — clickable when link is valid, strikethrough when NOT_NEEDED */}
      <td className="px-2 py-2.5">
        {hasLink && !isNotNeeded ? (
          <a
            href={doc.link!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-blue hover:underline"
          >
            {doc.nama}
            <ExternalLink size={11} className="flex-shrink-0" />
          </a>
        ) : (
          <span
            className={`text-[13px] font-medium ${
              isNotNeeded ? "line-through text-stone" : "text-ink"
            }`}
          >
            {doc.nama}
          </span>
        )}
      </td>

      {/* Status — select dropdown, auto-save on change */}
      <td className="px-2 py-2.5">
        <div className="relative">
          <select
            value={doc.status}
            onChange={(e) => onStatusChange(doc, e.target.value as DocStatus)}
            className={`h-7 pl-2 pr-6 text-xs font-medium rounded-full border appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-brand-blue/20 transition ${
              DOC_STATUS_CONFIG[doc.status].className
            }`}
          >
            <option value="NOT_YET">Not Yet</option>
            <option value="COMPLETED">Completed</option>
            <option value="NOT_NEEDED">Not Needed</option>
          </select>
          {/* Custom chevron */}
          <svg
            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-current opacity-60"
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </td>

      {/* Tanggal — date picker, auto-save on change */}
      <td className="px-2 py-2.5">
        <div className="flex flex-col gap-0.5">
          <input
            type="date"
            defaultValue={doc.tanggal ?? ""}
            onChange={(e) => onDateChange(doc, e.target.value)}
            disabled={isNotNeeded}
            className={`h-8 px-2 border border-hairline-strong rounded-md text-base bg-canvas outline-none focus:border-brand-blue transition w-[140px] ${
              isNotNeeded ? "opacity-40 cursor-not-allowed text-stone" : "text-ink"
            }`}
          />
          {doc.tanggal && !isNotNeeded && (
            <span className="text-[10px] text-stone">{formatDate(doc.tanggal)}</span>
          )}
        </div>
      </td>

      {/* Link — text input, validated + saved on blur */}
      <td className="px-2 py-2.5">
        <div className="flex flex-col gap-0.5">
          <input
            id={`link-${doc.id}`}
            type="url"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onBlur={(e) => onLinkBlur(doc, e.target.value)}
            placeholder="https://..."
            disabled={isNotNeeded}
            className={`h-8 px-2 border rounded-md text-sm bg-canvas outline-none transition w-full min-w-[220px] ${
              isNotNeeded
                ? "opacity-40 cursor-not-allowed text-stone border-hairline-strong"
                : linkError
                  ? "text-ink border-danger focus:border-danger"
                  : "text-ink border-hairline-strong focus:border-brand-blue"
            }`}
          />
          {linkError && !isNotNeeded && (
            <p className="text-[11px] text-danger">{linkError}</p>
          )}
        </div>
      </td>
    </tr>
  );
}
