interface Props {
  phaseName: string;
  shiftDays: number;
  affectedPhases: string[];
  onCascadeShift: () => void;
  onManualOnly: () => void;
}

export default function CascadeModal({
  phaseName,
  shiftDays,
  affectedPhases,
  onCascadeShift,
  onManualOnly,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-canvas rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-ink mb-2">Phase Overlap Detected</h3>
        <p className="text-sm text-steel mb-4">
          &ldquo;{phaseName}&rdquo; now overlaps with the previous phase by{" "}
          <strong className="text-ink">{Math.abs(shiftDays)} day{Math.abs(shiftDays) !== 1 ? "s" : ""}</strong>.
        </p>

        {affectedPhases.length > 0 && (
          <div className="bg-surface rounded-lg p-3 mb-5">
            <p className="text-xs font-semibold text-steel uppercase tracking-wide mb-1">
              Affected phases:
            </p>
            <ul className="text-sm text-ink space-y-0.5">
              {affectedPhases.map((name) => (
                <li key={name} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-brand-blue rounded-full" />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={onCascadeShift}
            className="w-full px-4 py-2.5 rounded-full text-sm font-medium bg-primary text-on-primary hover:bg-charcoal transition-colors"
          >
            Shift following phases
          </button>
          <button
            onClick={onManualOnly}
            className="w-full px-4 py-2.5 rounded-full text-sm font-medium text-ink border border-hairline-strong hover:bg-surface transition-colors"
          >
            Leave it, I&apos;ll adjust manually
          </button>
        </div>
      </div>
    </div>
  );
}
