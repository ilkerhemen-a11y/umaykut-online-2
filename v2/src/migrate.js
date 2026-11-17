import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./database.js";

const pool = createPool();
if (!pool) {
  throw new Error("DATABASE_URL tanımlı değil; V2 veritabanı geçişi çalıştırılamadı.");
}

const here = dirname(fileURLToPath(import.meta.url));
const sql = await readFile(resolve(here, "../migrations/001_accounts.sql"), "utf8");
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  process.stdout.write("Umaykut V2 hesap şeması başarıyla hazırlandı.\n");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
