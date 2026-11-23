import test from "node:test";
import assert from "node:assert/strict";
import { processDueRaids } from "../src/raid-worker.js";

const attackerId = "11111111-1111-4111-8111-111111111111";
const defenderId = "22222222-2222-4222-8222-222222222222";
const buildings = {
  "1": { type: "center", level: 1 },
  "2": { type: "barracks", level: 2 },
  "3": { type: "stable", level: 1 },
  "4": { type: "blacksmith", level: 1 },
  "5": { type: "school", level: 1 },
  "6": { type: "lumberyard", level: 1 },
  "7": { type: "temple", level: 1 },
  "8": { type: "market", level: 1 },
  "9": { type: "archery", level: 1 }
};

function raidPool() {
  const raid = {
    id: "raid-1",
    attacker_id: attackerId,
    defender_id: defenderId,
    attacker_village: "Saldıran",
    defender_village: "Savunan",
    troops: { infantry: 5 },
    departed_at: new Date(Date.now() - 120_000),
    arrives_at: new Date(Date.now() - 60_000),
    return_at: null,
    status: "marching",
    battle_report: null,
    loot: {}
  };
  const states = new Map([
    [attackerId, { id: attackerId, faction_id: "gokturk", buildings, troops: {}, resources: { gold: 100, wood: 100, food: 100, stone: 100, iron: 100 }, wall: { level: 1 } }],
    [defenderId, { id: defenderId, faction_id: "hun", buildings, troops: { infantry: 2 }, resources: { gold: 1000, wood: 1000, food: 1000, stone: 1000, iron: 1000 }, wall: { level: 1 } }]
  ]);
  const pool = {
    query: async (sql, values = []) => {
      if (sql.includes("status='marching'")) {
        return { rows: raid.status === "marching" ? [{ id: raid.id }] : [], rowCount: raid.status === "marching" ? 1 : 0 };
      }
      if (sql.includes("status='resolved'")) {
        return { rows: raid.status === "resolved" && raid.return_at && new Date(raid.return_at) <= new Date() ? [{ id: raid.id }] : [], rowCount: raid.status === "resolved" && raid.return_at && new Date(raid.return_at) <= new Date() ? 1 : 0 };
      }
      throw new Error("Unexpected pool query: " + sql);
    },
    connect: async () => ({
      query: async (sql, values = []) => {
        if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: 0 };
        if (sql.includes("SELECT * FROM umaykut_v2.player_raids")) return { rows: [raid], rowCount: 1 };
        if (sql.includes("SELECT id,attacker_id,battle_report,status,return_at")) return { rows: [raid], rowCount: 1 };
        if (sql.includes("SELECT p.id,p.village_name")) {
          return { rows: [states.get(attackerId), states.get(defenderId)], rowCount: 2 };
        }
        if (sql.includes("SELECT troops,resources FROM umaykut_v2.player_game_state")) {
          const state = states.get(values[0]);
          return { rows: [{ troops: state.troops, resources: state.resources }], rowCount: 1 };
        }
        if (sql.includes("UPDATE umaykut_v2.player_game_state")) {
          const state = states.get(values[0]);
          state.troops = JSON.parse(values[1]);
          if (values[2] !== undefined) state.resources = JSON.parse(values[2]);
          if (values[3] !== undefined) state.wall = JSON.parse(values[3]);
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("SET status='resolved'")) {
          raid.status = "resolved";
          raid.battle_report = JSON.parse(values[1]);
          raid.loot = JSON.parse(values[2]);
          raid.return_at = new Date(Date.now() - 1);
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("SET status='returned'")) {
          raid.status = "returned";
          return { rows: [], rowCount: 1 };
        }
        throw new Error("Unexpected client query: " + sql);
      },
      release() {}
    })
  };
  return { pool, raid, states };
}

test("due raid is resolved and surviving troops plus loot return exactly once", async () => {
  const { pool, raid, states } = raidPool();
  const first = await processDueRaids(pool);
  assert.equal(first.resolved, 1);
  assert.equal(raid.status, "returned");
  assert.ok(raid.battle_report);
  assert.equal(typeof raid.battle_report.winner, "string");
  assert.ok(Array.isArray(raid.battle_report.attackerUnits));
  assert.ok(Array.isArray(raid.battle_report.defenderUnits));
  assert.equal(raid.battle_report.attackerUnits[0].sent, 5);
  assert.equal(raid.battle_report.defenderUnits[0].sent, 2);
  const attackerAfterFirst = structuredClone(states.get(attackerId));
  const second = await processDueRaids(pool);
  assert.deepEqual(second, { resolved: 0, returned: 0 });
  assert.deepEqual(states.get(attackerId), attackerAfterFirst);
});
