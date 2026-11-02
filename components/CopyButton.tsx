"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  iconSize?: number;
}

export default function CopyButton({
  text,
  label,
  className = "",
  iconSize = 13,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy "${text}"`}
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs transition-colors group text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 ${className}`}
    >
      {copied ? (
        <Check size={iconSize} className="text-emerald-400 animate-in fade-in zoom-in" />
      ) : (
        <Copy size={iconSize} className="opacity-60 group-hover:opacity-100" />
      )}
      {label && <span>{copied ? "Copied" : label}</span>}
      {copied && !label && <span className="text-[10px] text-emerald-400">Copied</span>}
    </button>
  );
}
