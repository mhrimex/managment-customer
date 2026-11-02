"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  X, 
  Building2, 
  Layers, 
  Server as ServerIcon, 
  Boxes, 
  ExternalLink,
  ArrowRight,
  Command
} from "lucide-react";
import { AutocompleteSearchResult } from "@/types";

interface GlobalSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearchOverlay({
  isOpen,
  onClose,
}: GlobalSearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AutocompleteSearchResult>({
    clients: [],
    deployments: [],
    servers: [],
    solutions: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults({ clients: [], deployments: [], servers: [], solutions: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ clients: [], deployments: [], servers: [], solutions: [] });
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (data.success) {
          setResults(data.data);
        }
      } catch (err) {
        console.error("Autocomplete search error:", err);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle keyboard shortcut Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalResults =
    results.clients.length +
    results.deployments.length +
    results.servers.length +
    results.solutions.length;

  const handleSelect = (url: string) => {
    router.push(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl bg-slate-900 border-2 border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden glass-panel flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-5 py-4 border-b border-slate-800 gap-3.5 bg-slate-950/70">
          <Search size={22} className="text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, deployments, domains, IPs, servers, or solutions..."
            className="w-full bg-transparent text-white placeholder-slate-400 text-lg font-medium focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X size={18} />
            </button>
          )}
          <span className="text-xs font-mono font-bold bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
            ESC
          </span>
        </div>

        {/* Results Area */}
        <div className="overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="text-center py-10 text-base font-semibold text-slate-300 flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Searching infrastructure database...
            </div>
          )}

          {!loading && query && totalResults === 0 && (
            <div className="text-center py-12">
              <p className="text-white text-base font-bold">No matches found for &ldquo;{query}&rdquo;</p>
              <p className="text-slate-300 text-sm mt-1.5">
                Try searching for client company names, domains, IP addresses, or solution categories.
              </p>
            </div>
          )}

          {!query && (
            <div className="py-4 px-1 space-y-3">
              <div className="font-bold text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
                <Command size={14} className="text-indigo-400" />
                <span>Quick Directory Navigation</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleSelect("/deployments")}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/80 hover:bg-indigo-600/15 border border-slate-700/80 hover:border-indigo-500/40 text-left text-white group transition-all"
                >
                  <span className="flex items-center gap-3 font-semibold text-sm">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                      <Layers size={18} />
                    </div>
                    All Deployments
                  </span>
                  <ArrowRight size={16} className="text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => handleSelect("/clients")}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/80 hover:bg-emerald-600/15 border border-slate-700/80 hover:border-emerald-500/40 text-left text-white group transition-all"
                >
                  <span className="flex items-center gap-3 font-semibold text-sm">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <Building2 size={18} />
                    </div>
                    Client Directory
                  </span>
                  <ArrowRight size={16} className="text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => handleSelect("/servers")}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/80 hover:bg-sky-600/15 border border-slate-700/80 hover:border-sky-500/40 text-left text-white group transition-all"
                >
                  <span className="flex items-center gap-3 font-semibold text-sm">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center">
                      <ServerIcon size={18} />
                    </div>
                    Infrastructure Servers
                  </span>
                  <ArrowRight size={16} className="text-slate-400 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => handleSelect("/solutions")}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/80 hover:bg-amber-600/15 border border-slate-700/80 hover:border-amber-500/40 text-left text-white group transition-all"
                >
                  <span className="flex items-center gap-3 font-semibold text-sm">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                      <Boxes size={18} />
                    </div>
                    Solutions Catalog
                  </span>
                  <ArrowRight size={16} className="text-slate-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </div>
          )}

          {/* Clients matches */}
          {results.clients.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider px-2 mb-2 flex items-center gap-2">
                <Building2 size={15} className="text-emerald-400" />
                <span>Clients ({results.clients.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.clients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(`/clients/${c.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/90 text-left group transition-colors border border-transparent hover:border-slate-700/80"
                  >
                    <div>
                      <div className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {c.title}
                      </div>
                      <div className="text-xs text-slate-300 font-mono mt-0.5">{c.subtitle}</div>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deployments matches */}
          {results.deployments.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider px-2 mb-2 flex items-center gap-2">
                <Layers size={15} className="text-indigo-400" />
                <span>Deployments & Domains ({results.deployments.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.deployments.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleSelect(`/clients/${d.clientId}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/90 text-left group transition-colors border border-transparent hover:border-slate-700/80"
                  >
                    <div>
                      <div className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                        <span>{d.title}</span>
                        <ExternalLink size={14} className="text-slate-400" />
                      </div>
                      <div className="text-xs text-slate-300 font-mono mt-0.5">{d.subtitle}</div>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Servers matches */}
          {results.servers.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider px-2 mb-2 flex items-center gap-2">
                <ServerIcon size={15} className="text-sky-400" />
                <span>Servers & Infrastructure ({results.servers.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.servers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelect("/servers")}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/90 text-left group transition-colors border border-transparent hover:border-slate-700/80"
                  >
                    <div>
                      <div className="text-base font-bold text-white group-hover:text-sky-400 transition-colors">
                        {s.title}
                      </div>
                      <div className="text-xs text-slate-300 font-mono mt-0.5">{s.subtitle}</div>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Solutions matches */}
          {results.solutions.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider px-2 mb-2 flex items-center gap-2">
                <Boxes size={15} className="text-amber-400" />
                <span>Solutions Catalog ({results.solutions.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.solutions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelect(`/deployments?category=${s.title}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/90 text-left group transition-colors border border-transparent hover:border-slate-700/80"
                  >
                    <div>
                      <div className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                        {s.title}
                      </div>
                      <div className="text-xs text-slate-300 font-mono mt-0.5">{s.subtitle}</div>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-0.5 rounded bg-slate-800 text-white font-bold border border-slate-700 font-mono">Enter</kbd>
              <span>to select</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-0.5 rounded bg-slate-800 text-white font-bold border border-slate-700 font-mono">Esc</kbd>
              <span>to exit</span>
            </span>
          </div>
          <span className="font-semibold text-slate-400">Reflection Solutions Engine</span>
        </div>
      </div>
    </div>
  );
}
