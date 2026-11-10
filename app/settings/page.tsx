"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Info, Palette, RotateCcw, Save, Settings, Type } from "lucide-react";
import { useFeedback } from "@/components/Feedback";
import { useVersionInfo } from "@/components/useVersionInfo";
import {
  Appearance,
  applyAppearance,
  COLOR_PRESETS,
  DEFAULT_APPEARANCE,
  fetchAppearance,
  FONT_OPTIONS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  rememberAppearance,
} from "@/lib/appearance";

const panel = "rounded-2xl bg-slate-900/80 border border-slate-800 glass-panel p-5 sm:p-6";

export default function SettingsPage() {
  const { toast } = useFeedback();
  const version = useVersionInfo();
  const [saved, setSaved] = useState<Appearance | null>(null);
  const [draft, setDraft] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    fetchAppearance().then((look) => {
      if (!look) return setLoadFailed(true);
      setSaved(look);
      setDraft(look);
    });
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.user?.role === "ADMIN"))
      .catch(() => {});
  }, []);

  // Changes show across the whole page while choosing...
  const change = (patch: Partial<Appearance>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    applyAppearance(next);
  };

  // ...and go back if the page is left without saving
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => {
    return () => {
      if (savedRef.current) applyAppearance(savedRef.current);
    };
  }, []);

  const dirty = !!saved && JSON.stringify(saved) !== JSON.stringify(draft);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/appearance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save");
      setSaved(data.data);
      setDraft(data.data);
      applyAppearance(data.data);
      rememberAppearance(data.data);
      toast("Saved. Everyone sees this the next time a page loads.");
    } catch (err: any) {
      toast(err.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const locked = !isAdmin || !saved;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Settings size={30} className="text-indigo-400 shrink-0" /> Settings
        </h1>
        <p className="text-base text-slate-400 mt-2">Font size, colour and font for the whole website, on every device.</p>
      </div>

      {loadFailed && (
        <p className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-300">
          Could not load the saved settings. Make sure the API site is running.
        </p>
      )}
      {!isAdmin && !loadFailed && (
        <p className="p-3 rounded-xl border border-slate-700 text-sm text-slate-300 flex items-center gap-2">
          <Info size={16} className="shrink-0" /> Only an admin can change these settings.
        </p>
      )}

      {/* Font size */}
      <section className={panel}>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
          <Type size={20} className="text-indigo-400" /> Font size
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 shrink-0">A</span>
          <input
            type="range"
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            value={draft.fontSize}
            disabled={locked}
            onChange={(e) => change({ fontSize: Number(e.target.value) })}
            aria-label="Font size"
            className="flex-1 min-w-0 accent-indigo-500 disabled:opacity-50"
          />
          <span className="text-xl font-bold text-slate-200 shrink-0">A</span>
          <span className="w-14 text-right text-sm font-mono text-slate-200 shrink-0">{draft.fontSize}px</span>
        </div>
        <p className="text-xs text-slate-400 mt-3">Text, buttons and spacing all grow together. The default is {DEFAULT_APPEARANCE.fontSize}px.</p>
      </section>

      {/* Colour */}
      <section className={panel}>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
          <Palette size={20} className="text-indigo-400" /> Main colour
        </h2>
        <div className="flex flex-wrap gap-3">
          {COLOR_PRESETS.map((c) => {
            const on = draft.color === c.hex;
            return (
              <button
                key={c.hex}
                type="button"
                disabled={locked}
                onClick={() => change({ color: c.hex })}
                aria-label={c.name}
                aria-pressed={on}
                title={c.name}
                style={{ backgroundColor: c.hex }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 ${
                  on ? "ring-2 ring-offset-2 ring-offset-slate-900 ring-slate-300" : ""
                }`}
              >
                {on && <Check size={20} color="#ffffff" />}
              </button>
            );
          })}
        </div>
        <label className="mt-4 inline-flex items-center gap-3 text-sm text-slate-300">
          <input
            type="color"
            value={draft.color}
            disabled={locked}
            onChange={(e) => change({ color: e.target.value.toLowerCase() })}
            className="w-12 !min-h-0 h-12 p-1 rounded-xl border border-slate-700 cursor-pointer disabled:opacity-50"
          />
          Any other colour <span className="font-mono text-slate-400">{draft.color}</span>
        </label>
        <p className="text-xs text-slate-400 mt-3">
          Used for buttons, links and highlights. Green, amber and red stay as they are, because they mean OK, warning and danger.
        </p>
      </section>

      {/* Font */}
      <section className={panel}>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
          <Type size={20} className="text-indigo-400" /> Font
        </h2>
        <div role="radiogroup" aria-label="Font" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FONT_OPTIONS.map((f) => {
            const on = draft.font === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={locked}
                onClick={() => change({ font: f.id })}
                style={{ fontFamily: f.family }}
                className={`text-left p-3.5 rounded-xl border transition-colors disabled:opacity-60 ${
                  on ? "bg-indigo-500/10 border-indigo-500/40" : "border-slate-700 hover:bg-slate-800/50"
                }`}
              >
                <span className="block text-base font-semibold text-slate-100">{f.label}</span>
                <span className="block text-sm text-slate-400">Cosmea ERP 1234567890{f.id === "cairo" ? " • نظام إدارة" : ""}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Actions */}
      {isAdmin && (
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          {dirty && <span className="text-sm text-amber-400 sm:mr-auto">Not saved yet. This is a preview only you can see.</span>}
          <button
            type="button"
            disabled={locked || saving}
            onClick={() => change({ ...DEFAULT_APPEARANCE })}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold disabled:opacity-50"
          >
            <RotateCcw size={17} /> Back to defaults
          </button>
          <button
            type="button"
            disabled={locked || saving || !dirty}
            onClick={save}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
          >
            <Save size={17} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {/* Version */}
      <section className={panel}>
        <h2 className="text-xl font-bold text-white mb-3">Version</h2>
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Website</dt>
            <dd className="font-mono text-slate-200">{version.website}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">API</dt>
            <dd className="font-mono text-slate-200">{version.api === "older" ? "older build" : version.api ?? "checking..."}</dd>
          </div>
        </dl>
        {version.mismatch && (
          <p className="mt-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm text-amber-300 flex gap-2">
            <AlertTriangle size={17} className="shrink-0 mt-0.5" />
            The website and API are different versions, so some pages may fail. Replace the bin folder in both IIS sites from the same package.
          </p>
        )}
      </section>
    </div>
  );
}
