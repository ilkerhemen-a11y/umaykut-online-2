import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { createSessionToken } from "../src/auth.js";

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

test("game state is returned only to a valid V2 player session", async (t) => {
  const secret = "test-session-secret-with-at-least-32-characters";
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const token = createSessionToken(playerId, secret);
  const pool = {
    query: async (sql) => {
      if (sql.includes("SELECT p.id FROM umaykut_v2.players")) {
        return { rows: [{ id: playerId }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO umaykut_v2.player_game_state")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SELECT faction_id, worker_pool, worker_assignments")) {
        return { rows: [{
          faction_id: "gokturk",
          worker_pool: 1800,
          worker_assignments: { grain: 20, wood: 30, stone: 10 },
          worker_state_initialized: true,
          updated_at: "2026-11-17T12:00:00.000Z"
        }], rowCount: 1 };
      }
      throw new Error("Unexpected SQL in game-state test.");
    }
  };
  const server = createServer({ pool, sessionSecret: secret });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/game/state`, {
    headers: { Authorization: "Bearer " + token }
  });
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(state.factionId, "gokturk");
  assert.equal(state.workerPool, 1800);
  assert.deepEqual(state.workerAssignments, { grain: 20, wood: 30, stone: 10 });
});

test("game state rejects worker assignments above the starting pool", async (t) => {
  const secret = "test-session-secret-with-at-least-32-characters";
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const token = createSessionToken(playerId, secret);
  const pool = {
    query: async (sql) => {
      if (sql.includes("SELECT p.id FROM umaykut_v2.players")) {
        return { rows: [{ id: playerId }], rowCount: 1 };
      }
      throw new Error("Invalid worker payload should not write to the database.");
    }
  };
  const server = createServer({ pool, sessionSecret: secret });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/game/state`, {
    method: "PUT",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      factionId: "gokturk",
      workerAssignments: { grain: 1000, wood: 1000, stone: 0 }
    })
  });
  assert.equal(response.status, 400);
});
