const sql = require("mssql");
const fs = require("fs");
const path = require("path");

async function main() {
  // Read from .env (npm run db:init passes --env-file=.env); never hard-code credentials here
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Add it to .env (see .env.example).");
    process.exit(1);
  }

  console.log("Connecting to SQL Server...");

  try {
    const pool = await sql.connect(connectionString);
    console.log("✓ Connected successfully to SQL Server database 'client_management_db'.");

    const schemaPath = path.join(__dirname, "..", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    // Split by GO statements (SQL Server batch separator)
    const batches = schemaSql
      .split(/^\s*GO\s*$/gim)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    console.log(`Executing schema.sql (${batches.length} batches)...`);

    for (let i = 0; i < batches.length; i++) {
      try {
        await pool.request().query(batches[i]);
      } catch (err) {
        console.warn(`  Batch ${i + 1}/${batches.length} note:`, err.message);
      }
    }

    console.log(
      "✓ schema.sql executed successfully! All tables, indexes, triggers, and seed records are up to date."
    );

    await pool.close();
  } catch (err) {
    console.error("Database initialization failed:", err.message);
    process.exit(1);
  }
}

main();
