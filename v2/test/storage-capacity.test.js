import test from "node:test";
import assert from "node:assert/strict";
import { settleEconomy } from "../src/economy.js";

test("resource and horse stocks grow beyond the former 35,000 storage cap", () => {
  const result = settleEconomy({
    resources: { gold: 33999, wood: 29990, food: 28990, stone: 31990, iron: 32990, horses: 34990 },
    workerAssignments: { gold: 500, wood: 500, grain: 500, stone: 500, iron: 500 },
    buildings: { "3": { level: 9 }, "7": { level: 10 } },
    lastResourceTick: new Date(0).toISOString(),
    workerPool: 2800,
    storedStorageCapacity: 35000,
    now: 3600000
  });
  for (const key of ["gold", "wood", "food", "stone", "iron", "horses"]) {
    assert.ok(result.resources[key] > 35000, key + " should exceed the former storage cap");
  }
  assert.equal(result.storageCapacity, null);
});

test("existing stock above 35,000 is preserved without production", () => {
  const result = settleEconomy({
    resources: { gold: 50000, wood: 40000, food: 36000, stone: 38000, iron: 42000 },
    workerAssignments: {},
    buildings: {},
    now: 1000
  });
  assert.equal(result.resources.gold, 50000);
  assert.equal(result.resources.wood, 40000);
  assert.equal(result.resources.food, 36000);
  assert.equal(result.resources.stone, 38000);
  assert.equal(result.resources.iron, 42000);
});
