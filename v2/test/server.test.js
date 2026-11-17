import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";
import { loadConfig } from "../src/config.js";

test("config uses safe defaults", () => {
  const config = loadConfig({});
  assert.equal(config.port, 3001);
  assert.equal(config.version, "2.0.0");
});

test("config rejects invalid port", () => {
  assert.throws(() => loadConfig({ PORT: "70000" }), /PORT/);
});

test("health, readiness and 404 routes respond", async (t) => {
  const server = createServer({ pool: null });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).version, "2.0.0");

  const ready = await fetch(`${base}/ready`);
  assert.equal(ready.status, 503);
  assert.deepEqual(await ready.json(), { status: "not_ready", databaseConfigured: false });

  const missing = await fetch(`${base}/missing`);
  assert.equal(missing.status, 404);
});

test("readiness checks a real database query", async (t) => {
  const pool = { query: async sql => {
    assert.equal(sql, "SELECT 1");
    return { rows: [{ "?column?": 1 }] };
  }};
  const server = createServer({ pool });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ready", databaseConfigured: true });
});

test("readiness reports an unavailable database", async (t) => {
  const server = createServer({ pool: { query: async () => { throw new Error("offline"); } } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "not_ready", databaseConfigured: true });
});
