import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * BUILD_TARGET (set by scripts/package.mjs) builds one half of the deployment package:
 *   web - website only. package.mjs moves app/api aside during this build, and
 *         middleware.tsx forwards /api/* to the API server.
 *   api - API only. Pages are compiled but unreachable (middleware returns 404).
 * Unset (npm run dev / build / start): website + API together, as before.
 */
const target = process.env.BUILD_TARGET; // "web" | "api" | undefined

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  devIndicators: false, // Disables the Next.js "N" indicator badge at the bottom
  env: { APP_TARGET: target || "all" },
  ...(target
    ? {
        output: "standalone",
        distDir: `.next-${target}`,
        typescript: { tsconfigPath: "tsconfig.package.json" },
      }
    : {}),
};

export default nextConfig;
