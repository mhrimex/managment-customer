"use client";

import ModalShell, { whenModalHistorySettled } from "@/components/ModalShell";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Ban, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { ItemUsage } from "@/types/usage";

// =====================================================================
// App-wide feedback: toast notifications + promise-based confirm dialog.
// Replaces the browser's blocking alert() / confirm() pop-ups.
// =====================================================================

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FeedbackContextType {
  toast: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showInUse: (usage: ItemUsage) => void;
}

const FeedbackContext = createContext<FeedbackContextType | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}

const TOAST_STYLES: Record<ToastType, { icon: React.ElementType; cls: string }> = {
  success: { icon: CheckCircle2, cls: "border-emerald-500/40 text-emerald-300" },
  error: { icon: XCircle, cls: "border-rose-500/40 text-rose-300" },
  info: { icon: Info, cls: "border-indigo-500/40 text-indigo-300" },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirmBtn = useRef<HTMLButtonElement>(null);
  const idRef = useRef(0);
  const router = useRouter();
  const [inUse, setInUse] = useState<ItemUsage | null>(null);
  const inUseBtn = useRef<HTMLButtonElement>(null);
  const showInUse = useCallback((usage: ItemUsage) => setInUse(usage), []);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), type === "error" ? 6000 : 4000);
    },
    [dismiss]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    setDialog(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  }, []);

  const closeInUse = useCallback(() => setInUse(null), []);

  // Close first: the dialog's history entry must be gone before navigating
  const openUsageItem = useCallback(
    (href: string) => {
      setInUse(null);
      whenModalHistorySettled().then(() => router.push(href));
    },
    [router]
  );

  // Focus lands on the main button (Escape / Back / backdrop are handled by ModalShell)
  useEffect(() => {
    if (dialog) confirmBtn.current?.focus();
  }, [dialog]);
  useEffect(() => {
    if (inUse) inUseBtn.current?.focus();
  }, [inUse]);

  return (
    <FeedbackContext.Provider value={{ toast, confirm, showInUse }}>
      {children}

      {/* Toast stack */}
      <div
        className="fixed z-[70] bottom-4 right-4 left-4 sm:left-auto sm:w-[26rem] flex flex-col gap-3 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const { icon: Icon, cls } = TOAST_STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto animate-in slide-in-from-top-5 flex items-start gap-3 p-4 rounded-2xl bg-slate-900 border shadow-2xl glass-panel ${cls}`}
            >
              <Icon size={22} className="shrink-0 mt-0.5" />
              <p className="flex-1 text-sm font-medium text-slate-100">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* "Can't delete yet" dialog: lists everything that still uses the item */}
      {inUse && (
        <ModalShell onClose={closeInUse} size="lg" zIndex={60} labelledBy="in-use-title">
          <div role="alertdialog" className="flex flex-col min-h-0">
            <div className="flex items-start gap-4 p-5 sm:p-7 pb-4 sm:pb-4 shrink-0">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-400">
                <Ban size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="in-use-title" className="text-xl font-bold text-white [overflow-wrap:anywhere]">
                  Can&apos;t delete {inUse.name}
                </h2>
                <p className="text-sm text-slate-400 mt-1.5">It is still used by the items below. Remove them first, then delete it.</p>
              </div>
            </div>
            <div className="overflow-y-auto overscroll-contain min-h-0 flex-1 px-5 sm:px-7 space-y-5">
              {inUse.groups.map((g) => (
                <section key={g.title}>
                  <h3 className="text-sm font-bold text-slate-100">
                    {g.title} ({g.items.length})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 mb-2">{g.hint}</p>
                  <ul className="rounded-xl border border-slate-700 divide-y divide-slate-800 overflow-hidden">
                    {g.items.map((item, i) => {
                      const text = (
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-100 [overflow-wrap:anywhere]">{item.label}</span>
                          {item.detail && <span className="block text-xs font-mono text-slate-400 [overflow-wrap:anywhere]">{item.detail}</span>}
                        </span>
                      );
                      return (
                        <li key={i}>
                          {item.href ? (
                            <button
                              type="button"
                              onClick={() => openUsageItem(item.href!)}
                              className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-800/60 transition-colors"
                            >
                              {text}
                              <ArrowRight size={16} className="text-slate-500 shrink-0" />
                            </button>
                          ) : (
                            <div className="flex items-center gap-3 px-3.5 py-3">{text}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
            <div className="flex justify-end p-5 sm:p-7 pt-4 sm:pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-7 shrink-0">
              <button
                ref={inUseBtn}
                onClick={closeInUse}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Confirm dialog */}
      {dialog && (
        <ModalShell onClose={() => close(false)} size="sm" zIndex={60} labelledBy="confirm-title">
          <div role="alertdialog" className="overflow-y-auto overscroll-contain min-h-0 p-5 sm:p-7 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-7">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  dialog.danger ? "bg-rose-500/15 text-rose-400" : "bg-indigo-500/15 text-indigo-400"
                }`}
              >
                <AlertTriangle size={24} />
              </div>
              <div className="min-w-0">
                <h2 id="confirm-title" className="text-xl font-bold text-white">
                  {dialog.title}
                </h2>
                {dialog.message && <div className="text-sm text-slate-400 mt-2 leading-relaxed">{dialog.message}</div>}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6 sm:mt-7">
              <button
                onClick={() => close(false)}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold transition-colors"
              >
                {dialog.cancelLabel || "Cancel"}
              </button>
              <button
                ref={confirmBtn}
                onClick={() => close(true)}
                className={`w-full sm:w-auto px-5 py-3 rounded-xl text-white text-sm font-bold transition-colors ${
                  dialog.danger ? "bg-rose-600 hover:bg-rose-500" : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                {dialog.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </FeedbackContext.Provider>
  );
}
