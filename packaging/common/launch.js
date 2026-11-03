/*
 * Entry point started by IIS (web.config -> ASP.NET Core Module V2 -> runtime\node.exe bin\launch.js).
 *
 *  - reads ..\settings.env into the environment
 *  - fills in AUTH_SECRET / ENCRYPTION_SECRET if they are still placeholders (and saves them)
 *  - listens on the port IIS gives it (ASPNETCORE_PORT), on 127.0.0.1 only: IIS is the
 *    public front door, using the site's bindings (http/https, host name, port)
 *  - starts the compiled server (server.js)
 *
 * Problems are written to logs\stdout_*.log (see web.config).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const settingsFile = path.join(root, "settings.env");

function fail(message) {
  console.error(`[startup] ERROR: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(settingsFile)) fail(`settings.env not found in ${root}`);
let text = fs.readFileSync(settingsFile, "utf8");

// Fill in placeholder keys once and save them back
let changed = false;
for (const key of ["AUTH_SECRET", "ENCRYPTION_SECRET"]) {
  const re = new RegExp(`^([ \\t]*${key}[ \\t]*=[ \\t]*)"?(generate-on-first-start|change-me[^"\\r\\n]*)?"?[ \\t]*(?=\\r?$)`, "m");
  if (re.test(text)) {
    const secret = crypto.randomBytes(48).toString("base64url");
    text = text.replace(re, `$1"${secret}"`);
    changed = true;
    console.log(`[startup] generated a new ${key} in settings.env - back up this file`);
  }
}
if (changed) {
  try {
    fs.writeFileSync(settingsFile, text);
  } catch (e) {
    fail(
      `could not save the generated keys to settings.env (${e.code}). Either give the IIS app pool ` +
        `write permission on this folder for the first start, or put your own long random values ` +
        `in AUTH_SECRET and ENCRYPTION_SECRET.`
    );
  }
}

// settings.env -> environment (values set in web.config <environmentVariables> win)
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  const value = m[2].replace(/^["']|["']$/g, "");
  if (value !== "" && process.env[m[1]] === undefined) process.env[m[1]] = value;
}

if ("DATABASE_URL" in process.env && /Password=CHANGE-ME/i.test(process.env.DATABASE_URL)) {
  fail("set DATABASE_URL in settings.env (SQL Server, login and password).");
}

const behindIis = !!(process.env.ASPNETCORE_PORT || process.env.HTTP_PLATFORM_PORT);
process.env.NODE_ENV = "production";
process.env.PORT = process.env.ASPNETCORE_PORT || process.env.HTTP_PLATFORM_PORT || process.env.PORT || "3000";
process.env.HOSTNAME = behindIis ? "127.0.0.1" : process.env.HOST || "0.0.0.0";

console.log(`[startup] ${path.basename(root)} starting on ${process.env.HOSTNAME}:${process.env.PORT}${behindIis ? " (behind IIS)" : ""}`);
require(path.join(__dirname, "server.js"));
