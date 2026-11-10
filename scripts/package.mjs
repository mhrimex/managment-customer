/**
 * Builds the deployment package for IIS: three folders, compiled, no source code.
 *
 *   npm run package                         -> ..\deployment  (next to this project)
 *   npm run package -- "D:\out\portal"      -> custom folder
 *
 *   deployment\
 *     database\      full-database.sql (creates everything), sample-data.sql, create-app-login.sql
 *     api\           IIS site: web.config, settings.env, bin\ (compiled), runtime\ (node.exe), logs\
 *     application\   IIS site: web.config, settings.env, bin\ (compiled), runtime\ (node.exe), logs\
 *
 * IIS runs each site through the ASP.NET Core Module V2 (packaging/common/web.config),
 * which starts runtime\node.exe bin\launch.js.
 * Re-running replaces bin\, runtime\ and web.config; never an existing settings.env or logs\.
 */
import { spawnSync, execSync } from "node:child_process";
import crypto from "node:crypto";
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
// Shown in the app: a date and time, e.g. 2026.11.06-1432 (UTC). Same for the API and the website.
const APP_VERSION = new Date().toISOString().slice(0, 16).replace(/-/g, ".").replace("T", "-").replace(":", "");
const writeText = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, crlf(text)); };
const readPkg = (...p) => fs.readFileSync(path.join(PKG, ...p), "utf8");

if (OUT === ROOT || OUT.startsWith(ROOT + path.sep)) fail("Output folder must be outside the project folder.");

// A previous run that was killed during the website build may have left app/api moved aside.
if (fs.existsSync(API_HIDDEN) && !fs.existsSync(API_SRC)) {
  fs.renameSync(API_HIDDEN, API_SRC);
  console.log("  restored app/api from an interrupted previous run");
}
if (fs.existsSync(API_HIDDEN)) fail(`${API_HIDDEN} exists next to app/api - check and remove it manually.`);

function nextBuild(target) {
  // The build downloads the fonts from Google, which now and then fails for a moment: try again
  let r;
  for (let attempt = 1; attempt <= 3; attempt++) {
    fs.rmSync(path.join(ROOT, `.next-${target}`), { recursive: true, force: true });
    r = spawnSync("npx", ["next", "build"], {
      cwd: ROOT, stdio: "inherit", shell: true,
      env: { ...process.env, BUILD_TARGET: target, NODE_ENV: "production", APP_VERSION: APP_VERSION },
    });
    if (r.status === 0) break;
    if (attempt < 3) console.log(`  ${target} build failed, trying again (${attempt + 1} of 3)`);
  }
  // throw (not process.exit) so the caller can restore app/api
  if (r.status !== 0) throw new Error(`${target} build failed`);
  if (!fs.existsSync(path.join(ROOT, `.next-${target}`, "standalone", "server.js"))) {
    throw new Error(`${target}: standalone output not found`);
  }
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

/** web.config + launcher (IIS entry point) + logs folder. Removes files of older package layouts. */
function installIisFiles(partDir, partName) {
  for (const f of ["start.cmd", "install-service.cmd", "restart-service.cmd", "uninstall-service.cmd", "setup-database.cmd"]) {
    fs.rmSync(path.join(partDir, f), { force: true });
  }
  writeText(path.join(partDir, "web.config"), readPkg("common", "web.config").replace("{{PART}}", partName));
  fs.copyFileSync(path.join(PKG, "common", "launch.js"), path.join(partDir, "bin", "launch.js"));
  writeText(
    path.join(partDir, "logs", "README.txt"),
    "IIS writes startup messages here (stdout_*.log).\nThe IIS app pool needs write permission on this folder - see ..\\README.txt\n"
  );
}

function installSettingsAndReadme(partDir, kind) {
  writeText(path.join(partDir, "README.txt"), readPkg(kind, "README.txt"));
  const settings = path.join(partDir, "settings.env");
  if (fs.existsSync(settings)) { console.log(`  ${kind}: kept existing settings.env`); return; }
  // New package: put fresh random keys in now, so IIS never needs write access for them
  const text = readPkg(kind, "settings.env").replace(
    /^(AUTH_SECRET|ENCRYPTION_SECRET)="generate-on-first-start"/gm,
    (_, key) => `${key}="${crypto.randomBytes(48).toString("base64url")}"`
  );
  writeText(settings, text);
}

// ---------------------------------------------------------------------------
step(`Writing package to ${OUT}`);
fs.mkdirSync(OUT, { recursive: true });

// Remove the older single-folder layout (app\, runtime\, top-level scripts) if present.
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
const versionText = `Version: ${APP_VERSION}\nCommit:  ${version}\nDate:    ${new Date().toISOString()}\nNode:    ${process.version}\n`;

// database\ ------------------------------------------------------------------
const dbDir = path.join(OUT, "database");
fs.rmSync(dbDir, { recursive: true, force: true });
fs.mkdirSync(dbDir, { recursive: true });
fs.copyFileSync(path.join(ROOT, "schema.sql"), path.join(dbDir, "full-database.sql"));
fs.copyFileSync(path.join(ROOT, "seed-sample-data.sql"), path.join(dbDir, "sample-data.sql"));
fs.copyFileSync(path.join(PKG, "database", "create-app-login.sql"), path.join(dbDir, "create-app-login.sql"));
writeText(path.join(dbDir, "README.txt"), readPkg("database", "README.txt"));
console.log("  database\\ ready");

// api\ -----------------------------------------------------------------------
const apiDir = path.join(OUT, "api");
step("Building the API");
try { nextBuild("api"); } catch (e) { fail(e.message); }
installBuild("api", apiDir, { withPublic: false }); // also removes .next-api before the website build
installRuntime(apiDir);
installIisFiles(apiDir, "api");
installSettingsAndReadme(apiDir, "api");
writeText(path.join(apiDir, "bin", "VERSION.txt"), versionText);
console.log("  api\\ ready");

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
installIisFiles(appDir, "application");
installSettingsAndReadme(appDir, "application");
writeText(path.join(appDir, "bin", "VERSION.txt"), versionText);
console.log("  application\\ ready");

// ---------------------------------------------------------------------------
const size = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`\nPackage ready: ${OUT}  (${(size(OUT) / 1048576).toFixed(0)} MB)`);
console.log("Install order: database\\README.txt -> api\\README.txt -> application\\README.txt (two IIS sites)");
