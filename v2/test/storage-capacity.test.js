import test from "node:test";
import assert from "node:assert/strict";
import { settleEconomy } from "../src/economy.js";

test("Okçu does not add storage capacity while migrated legacy capacity is preserved", () => {
  const base = {
    resources: { gold: 20000, wood: 0, food: 0, stone: 0, iron: 0 },
    workerAssignments: {},
    buildings: { "9": { type: "archery", level: 10 } },
    now: 1000
  };
  const migrated = settleEconomy({ ...base, storedStorageCapacity: 45000 });
  const fresh = settleEconomy({ ...base, storedStorageCapacity: 15000 });
  assert.equal(migrated.storageCapacity, 45000);
  assert.equal(fresh.storageCapacity, 15000);
  assert.equal(migrated.resources.gold, 20000);
});
