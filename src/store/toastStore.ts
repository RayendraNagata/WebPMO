import { create } from "zustand";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  action?: ToastAction;
  durationMs: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (
    message: string,
    type?: "success" | "error" | "info",
    options?: { action?: ToastAction; durationMs?: number }
  ) => number;
  removeToast: (id: number) => void;
}

let toastId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (message, type = "success", options = {}) => {
    const id = ++toastId;
    const durationMs = options.durationMs ?? 3500;

    set((state) => ({
      toasts: [
        ...state.toasts,
        { id, message, type, action: options.action, durationMs },
      ],
    }));

    // Auto-dismiss after durationMs
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, durationMs);

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
