import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// BUILD_STANDALONE=1 (set by scripts/package.mjs) builds a self-contained server
// into .next-standalone/ for the copy-and-run deployment package; normal builds
// are unchanged.
const standalone = process.env.BUILD_STANDALONE === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  devIndicators: false, // Disables the Next.js "N" indicator badge at the bottom
  ...(standalone ? { output: "standalone", distDir: ".next-standalone" } : {}),
};

export default nextConfig;
