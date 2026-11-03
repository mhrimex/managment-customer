import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppLayoutClient from "@/components/AppLayoutClient";

// Self-hosted at build time by next/font: no layout shift, no runtime Google request.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-display",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Reflection Solutions - Customer Management",
  description:
    "Production-grade software agency management portal for clients, deployed solutions, infrastructure servers, domains, licenses, and support agreements.",
};

// "dark light" tells phone browsers (Samsung Internet dark mode, Chrome "darken
// websites") that the app has its own themes, so they don't force-darken it.
export const viewport: Viewport = {
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jakarta.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // Same rules as components/useTheme.ts: saved choice, default dark,
                // "system" follows the device.
                var pref = localStorage.getItem('reflection_theme') || 'dark';
                var mode = pref === 'system'
                  ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                  : (pref === 'light' ? 'light' : 'dark');
                var root = document.documentElement;
                root.classList.toggle('dark', mode === 'dark');
                root.classList.toggle('light', mode === 'light');
                var meta = document.createElement('meta');
                meta.name = 'theme-color';
                meta.content = mode === 'dark' ? '#090e1a' : '#f8fafc';
                document.head.appendChild(meta);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased selection:bg-indigo-500 selection:text-white">
        <AppLayoutClient>{children}</AppLayoutClient>
      </body>
    </html>
  );
}
