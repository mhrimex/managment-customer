/**
 * Site-wide look: font size, main colour and font. Pure code, used by the API and the browser.
 *
 * - Font size: everything is rem-based, so it is the root font size (--app-font-size).
 * - Colour: Tailwind's indigo and teal classes read --accent-* / --accent2-* (tailwind.config.ts),
 *   so changing those variables recolours every button, link and highlight.
 *   Green, red and amber are left alone: they mean success, danger and warning.
 * - Font: next/font bundles each option at build time (app/layout.tsx); --app-font selects one.
 */
export interface Appearance {
  fontSize: number;
  color: string;
  font: string;
}

export const DEFAULT_APPEARANCE: Appearance = { fontSize: 17, color: "#4f46e5", font: "inter" };
export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 22;

export const FONT_OPTIONS: { id: string; label: string; family: string }[] = [
  { id: "inter", label: "Inter (default)", family: "var(--font-inter)" },
  { id: "roboto", label: "Roboto", family: "var(--font-roboto)" },
  { id: "open-sans", label: "Open Sans", family: "var(--font-open-sans)" },
  { id: "poppins", label: "Poppins", family: "var(--font-poppins)" },
  { id: "nunito", label: "Nunito", family: "var(--font-nunito)" },
  { id: "cairo", label: "Cairo (Arabic + English)", family: "var(--font-cairo)" },
  { id: "system", label: "This device's font", family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
];

export const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Green", hex: "#16a34a" },
  { name: "Purple", hex: "#9333ea" },
  { name: "Pink", hex: "#db2777" },
  { name: "Red", hex: "#dc2626" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Slate", hex: "#475569" },
];

/** Anything invalid (old data, hand-edited storage) falls back to the default. */
export function normalizeAppearance(input: unknown): Appearance {
  const v = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const size = Number(v.fontSize);
  return {
    fontSize: Number.isFinite(size) ? Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(size))) : DEFAULT_APPEARANCE.fontSize,
    color: typeof v.color === "string" && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color.toLowerCase() : DEFAULT_APPEARANCE.color,
    font: FONT_OPTIONS.some((f) => f.id === v.font) ? (v.font as string) : DEFAULT_APPEARANCE.font,
  };
}

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((ln - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))) * 255);
  };
  return [f(0), f(8), f(4)];
}

/** WCAG contrast of a colour against white text. */
function contrastWithWhite(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

/**
 * Tailwind-style shades from one colour. Shade 600 (buttons) is exactly the colour chosen when
 * white text is readable on it; a very light colour (e.g. yellow) is darkened until it is.
 */
export function buildPalette(hex: string): Record<number, Rgb> {
  const base = hexToRgb(hex);
  const [h, s, baseL] = rgbToHsl(base);
  const shade = (l: number, minContrast = 0): Rgb => {
    let light = Math.max(l, 4);
    let rgb = hslToRgb(h, s, light);
    while (contrastWithWhite(rgb) < minContrast && light > 5) {
      light -= 1;
      rgb = hslToRgb(h, s, light);
    }
    return rgb;
  };
  const main = contrastWithWhite(base) >= 4.5 ? base : shade(baseL, 4.5);
  const mainL = rgbToHsl(main)[2];
  return {
    50: shade(97),
    100: shade(93),
    200: shade(86),
    300: shade(77),
    400: shade(68),
    500: shade(Math.max(mainL + 8, 45), 3),
    600: main,
    700: shade(Math.min(mainL - 7, 40), 6),
    800: shade(Math.min(mainL - 13, 32)),
    900: shade(Math.min(mainL - 18, 26)),
    950: shade(Math.min(mainL - 24, 16)),
  };
}

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/** CSS variables for a look. Defaults produce no variable, so globals.css stays in charge. */
export function appearanceVars(a: Appearance): Record<string, string> {
  const vars: Record<string, string> = {};
  if (a.fontSize !== DEFAULT_APPEARANCE.fontSize) vars["--app-font-size"] = `${a.fontSize}px`;
  if (a.color !== DEFAULT_APPEARANCE.color) {
    const palette = buildPalette(a.color);
    for (const n of SHADES) {
      const triple = palette[n].join(" ");
      vars[`--accent-${n}`] = triple;
      vars[`--accent2-${n}`] = triple;
    }
  }
  if (a.font !== DEFAULT_APPEARANCE.font) {
    const font = FONT_OPTIONS.find((f) => f.id === a.font);
    if (font) vars["--app-font"] = font.family;
  }
  return vars;
}

// ----- browser only -----

const STORAGE_KEY = "reflection_appearance";
let applied: string[] = [];

/** Change the whole site right away (also used for the live preview on the Settings page). */
export function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  const vars = appearanceVars(a);
  // first call on a page: also clear what the pre-paint script set
  const stale = applied.length ? applied : Array.from(root.style).filter((name) => /^--(app-|accent)/.test(name));
  stale.forEach((name) => root.style.removeProperty(name));
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
  applied = Object.keys(vars);
}

/** Remember the variables so the script in app/layout.tsx can apply them before the first paint. */
export function rememberAppearance(a: Appearance) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearanceVars(a)));
  } catch {
    // private window or blocked storage: the look still loads from the API, just a moment later
  }
}

export async function fetchAppearance(): Promise<Appearance | null> {
  try {
    const res = await fetch("/api/appearance", { cache: "no-store" });
    const data = await res.json();
    return res.ok && data.success ? normalizeAppearance(data.data) : null;
  } catch {
    return null;
  }
}
