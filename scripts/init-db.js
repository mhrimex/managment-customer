/**
 * Database setup.
 *
 *   npm run db:init           -> create database (if missing) + all tables/indexes/triggers + default users
 *   npm run db:seed-sample    -> also load the optional demo data (seed-sample-data.sql)
 *
 * Reads DATABASE_URL from .env (passed by npm via --env-file=.env).
 * Safe to run again: every statement checks before it creates/inserts.
 */
const sql = require("mssql");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadBatches(file) {
  let text = fs.readFileSync(path.join(ROOT, file), "utf8");
  // CREATE DATABASE / USE are only for SSMS; here we connect to the right database directly.
  text = text.replace(/--\s*@@SSMS-ONLY-BEGIN[\s\S]*?--\s*@@SSMS-ONLY-END/g, "");
  return text
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    // drop batches that contain only comments
    .filter((b) => b.replace(/--.*$/gm, "").trim().length > 0);
}

async function ensureDatabase(config) {
  const dbName = config.database;
  if (!dbName) throw new Error("DATABASE_URL has no Database=... name");
  if (!/^[A-Za-z0-9_\-]+$/.test(dbName)) throw new Error(`Unsupported database name: ${dbName}`);

  let master;
  try {
    master = await new sql.ConnectionPool({ ...config, database: "master" }).connect();
    const r = await master.request().input("n", sql.NVarChar, dbName).query("SELECT DB_ID(@n) AS id");
    if (r.recordset[0].id === null) {
      console.log(`Creating database '${dbName}'...`);
      await master.request().query(`CREATE DATABASE [${dbName}]`);
      console.log(`✓ Database '${dbName}' created.`);
    } else {
      console.log(`✓ Database '${dbName}' already exists.`);
    }
  } catch (err) {
    // The login may not have rights on master; the database might already exist — continue and let the real connect decide.
    console.warn(`  (Could not check/create database via master: ${err.message})`);
  } finally {
    if (master) await master.close();
  }
}

async function runFile(pool, file) {
  const batches = loadBatches(file);
  console.log(`Running ${file} (${batches.length} batches)...`);
  for (let i = 0; i < batches.length; i++) {
    try {
      await pool.request().batch(batches[i]);
    } catch (err) {
      const preview = batches[i].split("\n").find((l) => l.trim() && !l.trim().startsWith("--")) || "";
      console.error(`✗ ${file} batch ${i + 1}/${batches.length} failed: ${err.message}`);
      console.error(`  near: ${preview.trim().slice(0, 120)}`);
      throw err;
    }
  }
  console.log(`✓ ${file} done.`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Add it to .env (see .env.example).");
    process.exit(1);
  }

  const parsed = sql.ConnectionPool.parseConnectionString(connectionString);
  const config = { ...parsed, options: { enableArithAbort: true, ...parsed.options } };
  const withSample = process.argv.includes("--sample");

  console.log(`Server: ${config.server}${config.port ? ":" + config.port : ""}   Database: ${config.database}`);
  await ensureDatabase(config);

  let pool;
  try {
    pool = await new sql.ConnectionPool(config).connect();
    await runFile(pool, "schema.sql");
    if (withSample) await runFile(pool, "seed-sample-data.sql");

    const counts = await pool.request().query(`
      SELECT (SELECT COUNT(*) FROM clients) AS clients, (SELECT COUNT(*) FROM solutions) AS solutions,
             (SELECT COUNT(*) FROM servers) AS servers, (SELECT COUNT(*) FROM client_deployments) AS deployments,
             (SELECT COUNT(*) FROM users) AS users`);
    console.log("Current rows:", counts.recordset[0]);
    console.log("✓ Database is ready.");
  } catch (err) {
    console.error("Database setup failed:", err.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close();
  }
}

main();
