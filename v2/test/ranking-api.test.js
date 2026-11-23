import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";
import { createSessionToken } from "../src/auth.js";

test("authenticated leaderboard returns one overall score and sorted category details", async t => {
  const secret = "ranking-test-session-secret-at-least-32-characters";
  const currentId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const token = createSessionToken(currentId, secret);
  const maxBuildings = {
    "1": { type: "center", level: 10 },
    "2": { type: "barracks", level: 10 },
    "3": { type: "stable", level: 10 },
    "4": { type: "blacksmith", level: 10 },
    "5": { type: "school", level: 10 },
    "6": { type: "lumberyard", level: 10 },
    "7": { type: "temple", level: 10 },
    "8": { type: "market", level: 10 },
    "9": { type: "archery", level: 10 }
  };
  const pool = {
    query: async sql => {
      if (sql.includes("FROM umaykut_v2.player_sessions")) return { rows: [{ ok: true }], rowCount: 1 };
      if (sql.includes("FROM umaykut_v2.players p")) return {
        rows: [
          {
            id: currentId, username: "Bozkurt", village_name: "Gök Yurdu", faction_id: "gokturk",
            buildings: maxBuildings, wall: { level: 10 }, troops: { infantry: 200 }, resources: {
              gold: 20000, wood: 20000, food: 20000, stone: 20000, iron: 20000, horses: 1000
            }, owned_regions: 24
          },
          {
            id: "9f2f3d1a-2d3b-4b5c-9d7e-123456789abc", username: "Alp", village_name: "Alp Yurdu",
            faction_id: "hun", buildings: { "9": { type: "archery", level: 1 } },
            troops: { archer: 1 }, deployed_troops: [{ infantry: 10 }],
            stationed_troops: [{ shield: 3 }], scouting_troops: [{ scout: 2 }],
            resources: {}, owned_regions: 0
          }
        ], rowCount: 2
      };
      throw new Error("Unexpected ranking SQL: " + sql);
    }
  };
  const server = createServer({ pool, sessionSecret: secret });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/game/rankings`, {
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.currentPlayerId, currentId);
  assert.equal(data.rankings[0].username, "Bozkurt");
  assert.equal(data.rankings[0].rank, 1);
  assert.equal(data.rankings[0].buildingDevelopment, 100);
  assert.equal(data.rankings[0].territorialControl, 100);
  assert.equal(data.rankings[0].economy, 100);
  assert.equal(data.rankings[0].overall, 100);
  assert.equal(data.rankings[1].buildingDevelopment, 2);
  assert.equal(data.rankings[1].armyRawStrength, 729.5, "army ranking must include deployed, garrisoned and scouting units");
  assert.equal(data.scoring.weights.economy, 25);
  assert.equal(data.scoring.scales.armyStrength.fullScoreAt, 10000);
  assert.equal(data.scoring.scales.territorialControl.fullScoreAtOwnedRegions, 24);
  assert.equal(data.scoring.scales.buildingDevelopment.buildingCount, 9);
  assert.equal(data.scoring.scales.buildingDevelopment.wallAndShelterCount, 1);
  assert.equal(data.scoring.scales.economy.resourceTargets.horses, 1000);
});

test("leaderboard rejects unauthenticated requests", async t => {
  const pool = { query: async () => ({ rows: [], rowCount: 0 }) };
  const server = createServer({ pool, sessionSecret: "ranking-test-session-secret-at-least-32-characters" });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/game/rankings`);
  assert.equal(response.status, 401);
});
