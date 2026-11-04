"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastOptions {
  title?: string;
  description?: string;
  message?: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  addToast: (options: ToastOptions) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", title?: string, duration = 4000) => {
      const id = "toast-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const addToast = useCallback(
    ({ title, description, message, type = "info", duration = 4000 }: ToastOptions) => {
      showToast(description || message || "", type, title, duration);
    },
    [showToast]
  );

  const success = useCallback(
    (message: string, title?: string) => showToast(message, "success", title),
    [showToast]
  );
  const error = useCallback(
    (message: string, title?: string) => showToast(message, "error", title, 5000),
    [showToast]
  );
  const info = useCallback(
    (message: string, title?: string) => showToast(message, "info", title),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, addToast, success, error, info }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md ${
                t.type === "success"
                  ? "bg-[#0b1720]/95 border-emerald-500/30 text-emerald-100"
                  : t.type === "error"
                  ? "bg-[#1c0e14]/95 border-red-500/30 text-red-100"
                  : "bg-[#0c1322]/95 border-blue-500/30 text-blue-100"
              }`}
            >
              <span className="shrink-0 mt-0.5">
                {t.type === "success" ? (
                  <CheckCircle2 size={18} className="text-emerald-400" />
                ) : t.type === "error" ? (
                  <AlertCircle size={18} className="text-red-400" />
                ) : (
                  <Info size={18} className="text-blue-400" />
                )}
              </span>

              <div className="flex-1 min-w-0">
                {t.title && <h4 className="text-xs font-bold leading-tight mb-0.5">{t.title}</h4>}
                <p className="text-xs leading-relaxed text-slate-300">{t.message}</p>
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-slate-400 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
