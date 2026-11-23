import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./database.js";

const pool = createPool();
if (!pool) {
  throw new Error("DATABASE_URL tanımlı değil; V2 veritabanı geçişi çalıştırılamadı.");
}

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../migrations");
const files = (await readdir(migrationsDir)).filter(name => name.endsWith(".sql")).sort();
const client = await pool.connect();

try {
  await client.query("CREATE SCHEMA IF NOT EXISTS umaykut_v2");
  await client.query(`
    CREATE TABLE IF NOT EXISTS umaykut_v2.schema_migrations (
      name VARCHAR(160) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const name of files) {
    const applied = await client.query(
      "SELECT 1 FROM umaykut_v2.schema_migrations WHERE name = $1",
      [name]
    );
    if (applied.rowCount) continue;

    const sql = await readFile(resolve(migrationsDir, name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO umaykut_v2.schema_migrations(name) VALUES($1)",
        [name]
      );
      await client.query("COMMIT");
      process.stdout.write(`Umaykut V2 migration tamamlandı: ${name}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  process.stdout.write("Umaykut V2 veritabanı hazır.\n");
} finally {
  client.release();
  await pool.end();
}
