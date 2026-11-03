"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * App theme, independent of the phone/PC setting unless the user picks "system".
 * Stored per browser in localStorage("reflection_theme"): "light" | "dark" | "system".
 * Default: dark. The pre-paint script in app/layout.tsx applies the same rules.
 */
export type ThemePref = "light" | "dark" | "system";

const KEY = "reflection_theme";
const EVENT = "reflection-theme-change";
const BAR_COLORS = { dark: "#090e1a", light: "#f8fafc" };

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "dark";
}

function systemIsDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function resolve(pref: ThemePref): "light" | "dark" {
  return pref === "system" ? (systemIsDark() ? "dark" : "light") : pref;
}

function apply(pref: ThemePref) {
  const mode = resolve(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  // phone browser address-bar colour
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = BAR_COLORS[mode];
}

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>("dark");
  const [mode, setMode] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const sync = () => {
      const p = readPref();
      setPrefState(p);
      setMode(resolve(p));
      apply(p);
    };
    sync();
    // keep every switch on the page in step, and follow the phone when "system"
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (readPref() === "system") sync();
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    mq?.addEventListener?.("change", onSystem);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      mq?.removeEventListener?.("change", onSystem);
    };
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {}
    apply(p);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  /** Header button: flip between light and dark (leaves "system" mode). */
  const toggle = useCallback(() => {
    setPref(resolve(readPref()) === "dark" ? "light" : "dark");
  }, [setPref]);

  return { pref, mode, isDark: mode === "dark", setPref, toggle };
}
