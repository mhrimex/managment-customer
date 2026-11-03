/**
 * Builds the deployment package: three folders, compiled, no source code.
 *
 *   npm run package                         -> ..\deployment  (next to this project)
 *   npm run package -- "D:\out\portal"      -> custom folder
 *
 *   deployment\
 *     database\      full-database.sql (creates everything), sample-data.sql, create-app-login.sql
 *     api\           API server: settings.env, *.cmd, bin\ (compiled), runtime\ (node.exe)
 *     application\   website:    settings.env, *.cmd, bin\ (compiled), runtime\ (node.exe)
 *
 * Re-running replaces bin\ and runtime\ and the scripts, but never overwrites an
 * existing settings.env or logs\.
 */
import { spawnSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "..", "deployment"));
const PKG = path.join(ROOT, "packaging");
const API_SRC = path.join(ROOT, "app", "api");
const API_HIDDEN = path.join(ROOT, ".api-build-hidden");

const step = (m) => console.log(`\n==> ${m}`);
const fail = (m) => { console.error(`\nERROR: ${m}`); process.exit(1); };
const crlf = (s) => s.replace(/\r?\n/g, "\r\n");
const writeText = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, crlf(text)); };

if (OUT === ROOT || OUT.startsWith(ROOT + path.sep)) fail("Output folder must be outside the project folder.");

// A previous run that was killed during the website build may have left app/api moved aside.
if (fs.existsSync(API_HIDDEN) && !fs.existsSync(API_SRC)) {
  fs.renameSync(API_HIDDEN, API_SRC);
  console.log("  restored app/api from an interrupted previous run");
}
if (fs.existsSync(API_HIDDEN)) fail(`${API_HIDDEN} exists next to app/api - check and remove it manually.`);

function nextBuild(target) {
  fs.rmSync(path.join(ROOT, `.next-${target}`), { recursive: true, force: true });
  const r = spawnSync("npx", ["next", "build"], {
    cwd: ROOT, stdio: "inherit", shell: true,
    env: { ...process.env, BUILD_TARGET: target, NODE_ENV: "production" },
  });
  // throw (not process.exit) so the caller's finally can restore app/api
  if (r.status !== 0) throw new Error(`${target} build failed`);
  const standalone = path.join(ROOT, `.next-${target}`, "standalone");
  if (!fs.existsSync(path.join(standalone, "server.js"))) throw new Error(`${target}: standalone output not found`);
  return standalone;
}

/** Copy a standalone build into <part>\bin, without secrets or source files. */
function installBuild(target, partDir, { withPublic }) {
  const dist = path.join(ROOT, `.next-${target}`);
  const bin = path.join(partDir, "bin");
  fs.rmSync(bin, { recursive: true, force: true });
  fs.cpSync(path.join(dist, "standalone"), bin, { recursive: true });
  fs.cpSync(path.join(dist, "static"), path.join(bin, `.next-${target}`, "static"), { recursive: true });
  if (withPublic) fs.cpSync(path.join(ROOT, "public"), path.join(bin, "public"), { recursive: true });

  const removed = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      const inNodeModules = p.includes(`${path.sep}node_modules${path.sep}`);
      const inBuild = p.includes(`${path.sep}.next-${target}${path.sep}`);
      const isEnv = /^\.env(\..*)?$/.test(e.name);
      const isSource = !inNodeModules && !inBuild && /\.(tsx?|sql|md|mjs)$/.test(e.name);
      if (isEnv || isSource) { fs.rmSync(p); removed.push(path.relative(OUT, p)); }
    }
  };
  walk(bin);
  if (removed.length) console.log(`  removed from ${path.basename(partDir)}\\bin: ${removed.join(", ")}`);

  // Delete the build output from the project once copied, so the next build's
  // type check doesn't pick up its generated files.
  fs.rmSync(dist, { recursive: true, force: true });
}

function installRuntime(partDir) {
  const rt = path.join(partDir, "runtime");
  fs.rmSync(rt, { recursive: true, force: true });
  fs.mkdirSync(rt, { recursive: true });
  fs.copyFileSync(process.execPath, path.join(rt, "node.exe"));
}

function installScripts(partDir, { taskName, extra = [] }) {
  const bin = path.join(partDir, "bin");
  for (const f of ["run-server.ps1", "service.ps1"]) {
    writeText(path.join(bin, f), fs.readFileSync(path.join(PKG, "common", f), "utf8"));
  }
  const ps = (file, args = "") =>
    `powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bin\\${file}" ${args}`.trimEnd();
  const cmds = {
    "start.cmd": ["@echo off", "rem Runs it in this window. Close the window to stop it.", 'cd /d "%~dp0"', ps("run-server.ps1", "-Console")],
    "install-service.cmd": ["@echo off", "rem Run as administrator: start automatically with Windows.", ps("service.ps1", `-Action install -Name ${taskName} %*`), "pause"],
    "restart-service.cmd": ["@echo off", "rem Run as administrator: restart (e.g. after editing settings.env).", ps("service.ps1", `-Action restart -Name ${taskName}`), "pause"],
    "uninstall-service.cmd": ["@echo off", "rem Run as administrator: stop and remove the automatic start.", ps("service.ps1", `-Action uninstall -Name ${taskName}`), "pause"],
  };
  for (const [name, lines] of Object.entries(cmds)) writeText(path.join(partDir, name), lines.join("\n") + "\n");
  for (const [name, lines] of extra) writeText(path.join(partDir, name), lines.join("\n") + "\n");
}

function installSettingsAndReadme(partDir, kind) {
  writeText(path.join(partDir, "README.txt"), fs.readFileSync(path.join(PKG, kind, "README.txt"), "utf8"));
  const settings = path.join(partDir, "settings.env");
  if (fs.existsSync(settings)) console.log(`  ${kind}: kept existing settings.env`);
  else writeText(settings, fs.readFileSync(path.join(PKG, kind, "settings.env"), "utf8"));
}

/** mssql + its runtime dependencies, for the database setup tool. */
function copyMssql(destNodeModules) {
  const nm = path.join(ROOT, "node_modules");
  const needed = new Set();
  const collect = (name, fromDir) => {
    const nested = fromDir && path.join(fromDir, "node_modules", name);
    if (nested && fs.existsSync(nested)) return; // copied together with its parent
    const dir = path.join(nm, name);
    if (needed.has(name) || !fs.existsSync(dir)) return;
    needed.add(name);
    const pj = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    for (const dep of Object.keys({ ...pj.dependencies, ...pj.optionalDependencies })) collect(dep, dir);
  };
  collect("mssql");
  for (const name of needed) fs.cpSync(path.join(nm, name), path.join(destNodeModules, name), { recursive: true });
  return needed.size;
}

// ---------------------------------------------------------------------------
step(`Writing package to ${OUT}`);
fs.mkdirSync(OUT, { recursive: true });

// Remove the previous single-folder layout (app\, runtime\, top-level scripts) if present.
// A top-level settings.env is only deleted if it is still the unedited template.
for (const old of ["app", "runtime"]) fs.rmSync(path.join(OUT, old), { recursive: true, force: true });
for (const f of ["start.cmd", "setup-database.cmd", "setup-database.ps1", "install-service.cmd", "restart-service.cmd",
                 "uninstall-service.cmd", "run-server.ps1", "service.ps1", "README.txt", "VERSION.txt"]) {
  fs.rmSync(path.join(OUT, f), { force: true });
}
const oldSettings = path.join(OUT, "settings.env");
if (fs.existsSync(oldSettings)) {
  const t = fs.readFileSync(oldSettings, "utf8");
  if (/Password=CHANGE-ME/.test(t) && /generate-on-first-start/.test(t)) fs.rmSync(oldSettings);
  else { fs.renameSync(oldSettings, path.join(OUT, "settings.old.env")); console.log("  moved old settings.env to settings.old.env - copy your values into api\\settings.env"); }
}

let version = "unknown";
try { version = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim(); } catch {}
const versionText = `Build: ${version}\nDate:  ${new Date().toISOString()}\nNode:  ${process.version}\n`;

// database\ ------------------------------------------------------------------
const dbDir = path.join(OUT, "database");
fs.rmSync(dbDir, { recursive: true, force: true });
fs.mkdirSync(dbDir, { recursive: true });
fs.copyFileSync(path.join(ROOT, "schema.sql"), path.join(dbDir, "full-database.sql"));
fs.copyFileSync(path.join(ROOT, "seed-sample-data.sql"), path.join(dbDir, "sample-data.sql"));
fs.copyFileSync(path.join(PKG, "database", "create-app-login.sql"), path.join(dbDir, "create-app-login.sql"));
writeText(path.join(dbDir, "README.txt"), fs.readFileSync(path.join(PKG, "database", "README.txt"), "utf8"));
console.log("  database\\ ready");

// api\ -----------------------------------------------------------------------
const apiDir = path.join(OUT, "api");
step("Building the API");
try { nextBuild("api"); } catch (e) { fail(e.message); }
installBuild("api", apiDir, { withPublic: false }); // also removes .next-api before the website build
installRuntime(apiDir);
installScripts(apiDir, {
  taskName: "ClientPortal-API",
  extra: [["setup-database.cmd", [
    "@echo off",
    "rem Creates/upgrades the database from ..\\database\\full-database.sql using DATABASE_URL in settings.env.",
    "rem   setup-database.cmd           -> empty system",
    "rem   setup-database.cmd -Sample   -> plus demo data",
    'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bin\\setup-database.ps1" %*',
    "echo.",
    "pause",
  ]]],
});
writeText(path.join(apiDir, "bin", "setup-database.ps1"), fs.readFileSync(path.join(PKG, "api", "setup-database.ps1"), "utf8"));
fs.mkdirSync(path.join(apiDir, "bin", "tools"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "scripts", "init-db.js"), path.join(apiDir, "bin", "tools", "init-db.js"));
const deps = copyMssql(path.join(apiDir, "bin", "tools", "node_modules"));
installSettingsAndReadme(apiDir, "api");
writeText(path.join(apiDir, "bin", "VERSION.txt"), versionText);
console.log(`  api\\ ready (database tool: mssql + ${deps - 1} dependencies)`);

// application\ ---------------------------------------------------------------
const appDir = path.join(OUT, "application");
step("Building the website (app/api is moved aside so the website contains no API/database code)");
fs.renameSync(API_SRC, API_HIDDEN);
try {
  nextBuild("web");
} catch (e) {
  fs.renameSync(API_HIDDEN, API_SRC);
  fail(e.message);
}
fs.renameSync(API_HIDDEN, API_SRC);
installBuild("web", appDir, { withPublic: true });
installRuntime(appDir);
installScripts(appDir, { taskName: "ClientPortal-Web" });
installSettingsAndReadme(appDir, "application");
writeText(path.join(appDir, "bin", "VERSION.txt"), versionText);
console.log("  application\\ ready");

// ---------------------------------------------------------------------------
const size = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`\nPackage ready: ${OUT}  (${(size(OUT) / 1048576).toFixed(0)} MB)`);
console.log("Install order: database\\README.txt -> api\\README.txt -> application\\README.txt");
