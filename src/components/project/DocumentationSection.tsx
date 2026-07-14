import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import type { ProjectDocumentation } from "@/types";
import { formatDate } from "@/components/Shared";

interface Props {
  documentation: ProjectDocumentation[];
  onUpdate: (docId: string, data: Partial<Pick<ProjectDocumentation, "tanggal" | "link">>) => void;
}

/**
 * §6.12 — Dokumentasi Project
 * Fixed 13-row checklist. User can edit tanggal + link per row.
 * Auto-save per field (no submit button). Clicking the doc name opens
 * the link in a new tab when a valid URL is filled in.
 */
export default function DocumentationSection({ documentation, onUpdate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  // Track which link fields have a URL-format validation error (keyed by doc id)
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});

  const filledCount = documentation.filter((d) => d.tanggal || d.link).length;

  // §6.12 rule 4: link must start with http:// or https:// if filled
  function validateLink(value: string): string {
    if (!value) return "";
    if (!/^https?:\/\//i.test(value)) {
      return "URL must start with http:// or https://";
    }
    return "";
  }

  function handleLinkBlur(doc: ProjectDocumentation, value: string) {
    const error = validateLink(value);
    setLinkErrors((prev) => {
      if (error) return { ...prev, [doc.id]: error };
      const next = { ...prev };
      delete next[doc.id];
      return next;
    });
    // Only save if valid (or empty — clearing a link is always allowed)
    if (!error) {
      onUpdate(doc.id, { link: value || null });
    }
  }

  function handleDateChange(doc: ProjectDocumentation, value: string) {
    onUpdate(doc.id, { tanggal: value || null });
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
            {filledCount}/{documentation.length}
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

// ─── Individual row — isolated state so each field is independently editable ───

interface DocRowProps {
  doc: ProjectDocumentation;
  linkError: string | undefined;
  onDateChange: (doc: ProjectDocumentation, value: string) => void;
  onLinkBlur: (doc: ProjectDocumentation, value: string) => void;
}

function DocRow({ doc, linkError, onDateChange, onLinkBlur }: DocRowProps) {
  // Local state for the link input so the user can type freely before blur
  const [linkDraft, setLinkDraft] = useState(doc.link ?? "");

  // Keep local draft in sync if the parent updates the doc externally
  // (e.g. after a successful save round-trips back)
  const externalLink = doc.link ?? "";
  if (linkDraft !== externalLink && document.activeElement?.id !== `link-${doc.id}`) {
    // Only sync when the field is not focused to avoid clobbering in-progress typing
  }

  const hasLink = !!doc.link && /^https?:\/\//i.test(doc.link);

  return (
    <tr className="border-b border-hairline-soft last:border-0 hover:bg-surface/30 transition-colors">
      {/* No */}
      <td className="px-2 py-2.5 text-xs text-stone font-medium">{doc.nomor}</td>

      {/* Nama Dokumen — clickable when link is valid */}
      <td className="px-2 py-2.5">
        {hasLink ? (
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
          <span className="text-[13px] font-medium text-ink">{doc.nama}</span>
        )}
      </td>

      {/* Tanggal — date picker, auto-save on change */}
      <td className="px-2 py-2.5">
        <div className="flex flex-col gap-0.5">
          <input
            type="date"
            defaultValue={doc.tanggal ?? ""}
            onChange={(e) => onDateChange(doc, e.target.value)}
            className="h-8 px-2 border border-hairline-strong rounded-md text-base text-ink bg-canvas outline-none focus:border-brand-blue transition w-[140px]"
          />
          {doc.tanggal && (
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
            className={`h-8 px-2 border rounded-md text-sm text-ink bg-canvas outline-none transition w-full min-w-[220px]
              ${linkError
                ? "border-danger focus:border-danger"
                : "border-hairline-strong focus:border-brand-blue"
              }`}
          />
          {linkError && (
            <p className="text-[11px] text-danger">{linkError}</p>
          )}
        </div>
      </td>
    </tr>
  );
}
