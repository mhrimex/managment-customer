import type { Config } from "tailwindcss";

/** A colour family read from CSS variables, so Settings can change it while the site runs. */
const dynamicColor = (prefix: string) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [
      shade,
      `rgb(var(--${prefix}-${shade}) / <alpha-value>)`,
    ])
  );

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: dynamicColor("accent"),
        teal: dynamicColor("accent2"),
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
      },
      fontFamily: {
        sans: [
          "var(--app-font, var(--font-inter))",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "var(--app-font, var(--font-display))",
          "Plus Jakarta Sans",
          "var(--font-inter)",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-jetbrains-mono)",
          "'JetBrains Mono'",
          "Consolas",
          "'Fira Code'",
          "monospace",
        ],
      },
      // Root font-size is 17px by default (Settings can change it); values below are relative to it.
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.4rem" }],    // ~15px  (smallest UI text)
        sm: ["0.95rem", { lineHeight: "1.55rem" }],    // ~16px
        base: ["1.05rem", { lineHeight: "1.7rem" }],   // ~18px
        lg: ["1.2rem", { lineHeight: "1.85rem" }],     // ~20px
        xl: ["1.4rem", { lineHeight: "2rem" }],        // ~24px
        "2xl": ["1.75rem", { lineHeight: "2.3rem" }],  // ~30px
        "3xl": ["2.2rem", { lineHeight: "2.7rem" }],   // ~37px
        "4xl": ["2.75rem", { lineHeight: "3.2rem" }],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.08)",
        glow: "0 10px 40px -10px rgba(99, 102, 241, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
