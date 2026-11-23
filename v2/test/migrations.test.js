import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

test("slot nine migration changes the default to Okçu and preserves legacy progress", async () => {
  const path = fileURLToPath(new URL("../migrations/017_okcu_building_slot.sql", import.meta.url));
  const sql = await readFile(path, "utf8");
  assert.match(sql, /"9":\{"type":"archery","level":1\}/);
  assert.match(sql, /jsonb_set\(/);
  assert.match(sql, /buildings->'9'\) \|\| '\{"type":"archery"\}'::jsonb/);
  assert.match(sql, /WHERE buildings->'9'->>'type' = 'warehouse'/);
});
