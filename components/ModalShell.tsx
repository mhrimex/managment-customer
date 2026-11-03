"use client";

import React, { useEffect, useId, useRef } from "react";

/**
 * Shared frame for every popup / form dialog.
 *
 * Closes on:  ✕ button (rendered by the caller via <ModalCloseButton/>), tap on the dark
 *             backdrop, Escape key, and the phone's Back button / back gesture.
 * Phone:      slides up from the bottom, full width, max 92% of the screen height;
 *             the body scrolls inside, header and footer stay visible.
 * Desktop:    centered card.
 *
 * Only the top-most open dialog reacts (e.g. a confirm box opened over a form).
 */

type Entry = { id: string; close: () => void; canClose: () => boolean; popped: boolean };
const stack: Entry[] = [];
let ignorePops = 0;
let listening = false;
let settledWaiters: Array<() => void> = [];

function flushWaiters() {
  const w = settledWaiters;
  settledWaiters = [];
  w.forEach((fn) => fn());
}

/**
 * Resolve once a just-closed dialog has removed its history entry. Await this before
 * navigating (router.push) right after closing a dialog, otherwise the pending
 * "back" would undo the navigation.
 */
export async function whenModalHistorySettled(): Promise<void> {
  // Let React commit the close first (the unmount is what schedules history.back()).
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  if (ignorePops === 0) return;
  await new Promise<void>((resolve) => {
    settledWaiters.push(resolve);
    setTimeout(resolve, 400); // safety net
  });
}

function onPopState() {
  if (ignorePops > 0) {
    ignorePops--;
    if (ignorePops === 0) flushWaiters();
    return;
  }
  const top = stack[stack.length - 1];
  if (!top) return;
  if (!top.canClose()) {
    // busy (saving): put the history entry back and stay open
    window.history.pushState({ ...(window.history.state || {}), __modal: top.id }, "");
    return;
  }
  top.popped = true;
  top.close();
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  const top = stack[stack.length - 1];
  if (top && top.canClose()) {
    e.stopPropagation();
    top.close();
  }
}

function ensureListeners() {
  if (listening || typeof window === "undefined") return;
  window.addEventListener("popstate", onPopState);
  window.addEventListener("keydown", onKeyDown, true);
  listening = true;
}

let savedBodyOverflow = "";

/**
 * Makes any overlay (dialog, side menu) behave like a native mobile sheet while mounted:
 * Escape and the phone's Back button close it, and the page behind can't scroll.
 * Returns a `tryClose()` that respects `busy`.
 */
export function useDismissable(onClose: () => void, busy = false): () => void {
  const id = useId();
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    ensureListeners();
    const entry: Entry = {
      id,
      close: () => onCloseRef.current(),
      canClose: () => !busyRef.current,
      popped: false,
    };
    if (stack.length === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    stack.push(entry);

    // A history entry so the phone's Back button closes the overlay instead of leaving the page.
    window.history.pushState({ ...(window.history.state || {}), __modal: id }, "");

    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) document.body.style.overflow = savedBodyOverflow;
      // Closed by ✕ / backdrop / Escape / save: remove our history entry, but only if it is
      // still the current one (not after the app navigated to another page).
      if (!entry.popped && window.history.state?.__modal === id) {
        ignorePops++;
        window.history.back();
      }
    };
  }, [id]);

  return () => {
    if (!busyRef.current) onCloseRef.current();
  };
}

const SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-xl",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-3xl",
} as const;

export default function ModalShell({
  onClose,
  busy = false,
  size = "md",
  labelledBy,
  zIndex = 50,
  position = "center",
  className = "",
  children,
}: {
  onClose: () => void;
  /** while true, the dialog can't be dismissed (e.g. during save) */
  busy?: boolean;
  size?: keyof typeof SIZES;
  labelledBy?: string;
  zIndex?: number;
  /** "top" keeps a search-style dialog near the top on desktop */
  position?: "center" | "top";
  className?: string;
  children: React.ReactNode;
}) {
  const tryClose = useDismissable(onClose, busy);
  const downOnBackdrop = useRef(false);

  return (
    <div
      className={`fixed inset-0 flex justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 items-end ${
        position === "top" ? "sm:items-start sm:pt-24" : "sm:items-center"
      } sm:p-4`}
      style={{ zIndex }}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // only when both press and release happen on the backdrop (not a text-selection drag)
        if (e.target === e.currentTarget && downOnBackdrop.current) tryClose();
        downOnBackdrop.current = false;
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`modal-panel relative w-full ${SIZES[size]} flex flex-col min-h-0 max-h-[92dvh] sm:max-h-[90vh] bg-slate-900 border border-slate-800 border-b-0 sm:border-b rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden glass-panel ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* drag-handle look on phones */}
        <div className="sm:hidden flex justify-center pt-2.5 -mb-1 shrink-0" aria-hidden="true">
          <span className="h-1.5 w-11 rounded-full bg-slate-700" />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Large, touch-friendly ✕ button for dialog headers. */
export function ModalCloseButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Close"
      title="Close"
      className="shrink-0 -mr-2 inline-flex items-center justify-center w-11 h-11 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors disabled:opacity-40"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
