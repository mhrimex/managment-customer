import React from "react";

/**
 * Visual identity for a client company: shows the company logo when a URL is
 * provided, otherwise a colored monogram derived deterministically from the name.
 */
const PALETTES = [
  "from-indigo-500 to-violet-500",
  "from-emerald-500 to-teal-500",
  "from-sky-500 to-cyan-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-500",
  "from-lime-500 to-emerald-500",
  "from-blue-500 to-indigo-500",
];

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getInitials(name?: string | null) {
  if (!name) return "?";
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const SIZES = {
  sm: "w-9 h-9 text-sm rounded-lg",
  md: "w-12 h-12 text-base rounded-xl",
  lg: "w-16 h-16 text-xl rounded-2xl",
  xl: "w-20 h-20 text-2xl rounded-2xl",
} as const;

interface CompanyAvatarProps {
  name?: string | null;
  logoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export default function CompanyAvatar({
  name,
  logoUrl,
  size = "md",
  className = "",
}: CompanyAvatarProps) {
  const base = `${SIZES[size]} shrink-0 flex items-center justify-center overflow-hidden shadow-md ring-1 ring-white/10 ${className}`;

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={`${name ?? "Company"} logo`} className={`${base} object-cover bg-white`} />
    );
  }

  const palette = PALETTES[hash(name || "") % PALETTES.length];
  return (
    <div
      className={`${base} bg-gradient-to-br ${palette} text-white font-display font-extrabold tracking-tight select-none`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}
