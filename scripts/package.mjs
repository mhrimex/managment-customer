/**
 * Builds the copy-and-run deployment package (compiled app, no source code).
 *
 *   npm run package                         -> ..\deployment  (next to this project)
 *   npm run package -- "D:\out\portal"      -> custom folder
 *
 * Output:
 *   app\        compiled Next.js server (pages + API), minimal node_modules
 *   runtime\    node.exe (so the host needs no Node.js install)
 *   database\   full-database.sql, sample-data.sql, create-app-login.sql, init-db.js
 *   settings.env, *.cmd, run-server.ps1, service.ps1, README.txt
 *
 * Re-running updates app\, runtime\, database\ and the scripts, but never
 * overwrites an existing settings.env or logs\.
 */
import { spawnSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "..", "deployment"));
const DIST = path.join(ROOT, ".next-standalone");
const PKG = path.join(ROOT, "packaging");

const step = (m) => console.log(`\n==> ${m}`);
const fail = (m) => { console.error(`\nERROR: ${m}`); process.exit(1); };

if (OUT === ROOT || OUT.startsWith(ROOT + path.sep)) fail("Output folder must be outside the project folder.");

// 1. Build ------------------------------------------------------------------
step("Building the standalone production version");
fs.rmSync(DIST, { recursive: true, force: true });
const build = spawnSync("npx", ["next", "build"], {
  cwd: ROOT, stdio: "inherit", shell: true,
  env: { ...process.env, BUILD_STANDALONE: "1", NODE_ENV: "production" },
});
if (build.status !== 0) fail("Build failed");
const standalone = path.join(DIST, "standalone");
if (!fs.existsSync(path.join(standalone, "server.js"))) fail("Standalone output not found");

// 2. Prepare output folder --------------------------------------------------
step(`Writing package to ${OUT}`);
fs.mkdirSync(OUT, { recursive: true });
for (const dir of ["app", "runtime", "database"]) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });

// 3. App: server + static assets + public files -----------------------------
const appDir = path.join(OUT, "app");
fs.cpSync(standalone, appDir, { recursive: true });
fs.cpSync(path.join(DIST, "static"), path.join(appDir, ".next-standalone", "static"), { recursive: true });
fs.cpSync(path.join(ROOT, "public"), path.join(appDir, "public"), { recursive: true });

// Never ship secrets or source: drop .env files and any traced source/config files
let removed = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const inNodeModules = p.includes(`${path.sep}node_modules${path.sep}`);
    if (e.isDirectory()) { walk(p); continue; }
    const isEnv = /^\.env(\..*)?$/.test(e.name);
    const isSource = !inNodeModules && /\.(tsx?|sql|md|mjs)$/.test(e.name) && !p.includes(`${path.sep}.next-standalone${path.sep}`);
    if (isEnv || isSource) { fs.rmSync(p); removed.push(path.relative(OUT, p)); }
  }
};
walk(appDir);
if (removed.length) console.log("  removed from app\\:", removed.join(", "));

// 4. Runtime: this machine's node.exe -----------------------------------------
fs.mkdirSync(path.join(OUT, "runtime"), { recursive: true });
fs.copyFileSync(process.execPath, path.join(OUT, "runtime", "node.exe"));
console.log(`  runtime\\node.exe = Node.js ${process.version}`);

// 5. Database scripts ----------------------------------------------------------
const db = path.join(OUT, "database");
fs.mkdirSync(db, { recursive: true });
fs.copyFileSync(path.join(ROOT, "schema.sql"), path.join(db, "full-database.sql"));
fs.copyFileSync(path.join(ROOT, "seed-sample-data.sql"), path.join(db, "sample-data.sql"));
fs.copyFileSync(path.join(PKG, "create-app-login.sql"), path.join(db, "create-app-login.sql"));
fs.copyFileSync(path.join(ROOT, "scripts", "init-db.js"), path.join(db, "init-db.js"));

// init-db.js needs the SQL Server driver. The app has it compiled into its own
// bundle, so copy mssql + its runtime dependencies next to the script.
const nm = path.join(ROOT, "node_modules");
const needed = new Set();
const collect = (name, fromDir) => {
  // npm may nest a different version under the parent package
  const nested = fromDir && path.join(fromDir, "node_modules", name);
  if (nested && fs.existsSync(nested)) return; // copied together with its parent
  const dir = path.join(nm, name);
  if (needed.has(name) || !fs.existsSync(dir)) return;
  needed.add(name);
  const pj = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  for (const dep of Object.keys({ ...pj.dependencies, ...pj.optionalDependencies })) collect(dep, dir);
};
collect("mssql");
for (const name of needed) {
  fs.cpSync(path.join(nm, name), path.join(db, "node_modules", name), { recursive: true });
}
console.log(`  database\\node_modules: mssql + ${needed.size - 1} dependencies`);

// 6. Launch scripts, README, settings -----------------------------------------
const crlf = (s) => s.replace(/\r?\n/g, "\r\n");
for (const f of ["start.cmd", "setup-database.cmd", "install-service.cmd", "restart-service.cmd",
                 "uninstall-service.cmd", "run-server.ps1", "service.ps1", "setup-database.ps1", "README.txt"]) {
  fs.writeFileSync(path.join(OUT, f), crlf(fs.readFileSync(path.join(PKG, f), "utf8")));
}
const settings = path.join(OUT, "settings.env");
if (fs.existsSync(settings)) console.log("  kept existing settings.env");
else fs.writeFileSync(settings, crlf(fs.readFileSync(path.join(PKG, "settings.env"), "utf8")));

let version = "unknown";
try { version = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim(); } catch {}
fs.writeFileSync(path.join(OUT, "VERSION.txt"), crlf(`Build: ${version}\nDate:  ${new Date().toISOString()}\nNode:  ${process.version}\n`));

// 7. Summary -----------------------------------------------------------------------
const size = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`\nPackage ready: ${OUT}  (${(size(OUT) / 1048576).toFixed(0)} MB)`);
console.log("Next: edit settings.env -> setup-database.cmd -> install-service.cmd (as admin). See README.txt");
