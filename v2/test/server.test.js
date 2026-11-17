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
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).version, "2.0.0");

  const ready = await fetch(`${base}/ready`);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).status, "ready");

  const missing = await fetch(`${base}/missing`);
  assert.equal(missing.status, 404);
});
