import test from "node:test";
import assert from "node:assert/strict";
import { calculatePlayerScore, rankPlayers, RANKING_WEIGHTS } from "../src/ranking.js";

const baseBuildings = Object.fromEntries([
  ["1", "center"], ["2", "barracks"], ["3", "stable"],
  ["4", "blacksmith"], ["5", "school"], ["6", "lumberyard"],
  ["7", "temple"], ["8", "market"], ["9", "warehouse"]
].map(([slot, type]) => [slot, { type, level: 1 }]));

function player(overrides = {}) {
  return {
    id: "player-1",
    username: "Bozkurt",
    village_name: "Ötüken",
    faction_id: "gokturk",
    created_at: "2026-01-01T00:00:00.000Z",
    buildings: baseBuildings,
    troops: {},
    resources: { gold: 0, wood: 0, food: 0, stone: 0, iron: 0 },
    territory_count: 0,
    ...overrides
  };
}

test("overall ranking weights are the approved single-score distribution", () => {
  assert.deepEqual(RANKING_WEIGHTS, {
    buildings: 30,
    military: 30,
    territory: 25,
    economy: 15
  });
  assert.equal(Object.values(RANKING_WEIGHTS).reduce((sum, value) => sum + value, 0), 100);
});

test("building development increases the overall score", () => {
  const basic = calculatePlayerScore(player());
  const advancedBuildings = Object.fromEntries(Object.entries(baseBuildings).map(([slot, building]) => [
    slot, { ...building, level: 5 }
  ]));
  const advanced = calculatePlayerScore(player({ buildings: advancedBuildings }));
  assert.ok(advanced.score > basic.score);
  assert.ok(advanced.components.buildings > basic.components.buildings);
});

test("army strength and permanent territory ownership increase the score", () => {
  const basic = calculatePlayerScore(player());
  const stronger = calculatePlayerScore(player({
    troops: { infantry: 100 },
    territory_count: 4
  }));
  assert.ok(stronger.score > basic.score);
  assert.ok(stronger.components.military > basic.components.military);
  assert.ok(stronger.components.territory > basic.components.territory);
});

test("resource reserves increase economic and total score without exceeding component bounds", () => {
  const empty = calculatePlayerScore(player());
  const stocked = calculatePlayerScore(player({
    resources: { gold: 15000, wood: 15000, food: 15000, stone: 15000, iron: 15000 }
  }));
  assert.ok(stocked.score > empty.score);
  assert.equal(stocked.components.economy, 1000);
  for (const value of Object.values(stocked.components)) {
    assert.ok(value >= 0 && value <= 1000);
  }
});

test("ranking sorts by score and uses account creation time as a stable tie-breaker", () => {
  const ranked = rankPlayers([
    player({ id: "newer", username: "Yeni", created_at: "2026-02-01T00:00:00.000Z" }),
    player({ id: "strong", username: "Güçlü", troops: { infantry: 1000 } }),
    player({ id: "older", username: "Eski", created_at: "2025-12-01T00:00:00.000Z" })
  ]);
  assert.equal(ranked[0].id, "strong");
  assert.equal(ranked[1].id, "older");
  assert.equal(ranked[2].id, "newer");
  assert.deepEqual(ranked.map(item => item.rank), [1, 2, 3]);
});

test("invalid or missing JSON values cannot create negative or non-finite points", () => {
  const result = calculatePlayerScore(player({
    buildings: null,
    troops: { infantry: -100, archer: "not-a-number" },
    resources: { gold: -100, wood: "NaN" },
    territory_count: -2
  }));
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.score >= 0);
  assert.deepEqual(result.components, {
    buildings: 0,
    military: 0,
    territory: 0,
    economy: 0
  });
});
