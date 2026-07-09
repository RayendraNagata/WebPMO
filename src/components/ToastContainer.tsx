import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useToastStore } from "@/store/toastStore";

const STYLES = {
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-50 border-red-200 text-red-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
} as const;

const ICONS = {
  success: <CheckCircle size={16} className="text-green-500 flex-shrink-0" />,
  error: <AlertCircle size={16} className="text-red-500 flex-shrink-0" />,
  info: <Info size={16} className="text-blue-500 flex-shrink-0" />,
} as const;

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium animate-slide-in ${STYLES[toast.type]}`}
        >
          {ICONS[toast.type]}
          <span className="flex-1">{toast.message}</span>

          {/* Optional action button (e.g. "Undo") */}
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick();
                removeToast(toast.id);
              }}
              className="ml-1 px-2 py-0.5 rounded-md text-xs font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity cursor-pointer flex-shrink-0"
            >
              {toast.action.label}
            </button>
          )}

          <button
            onClick={() => removeToast(toast.id)}
            className="p-0.5 rounded-full hover:bg-black/5 transition-colors cursor-pointer flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
