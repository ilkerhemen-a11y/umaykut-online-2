import test from "node:test";
import assert from "node:assert/strict";
import { settleEconomy, RESOURCE_PRODUCTION_PER_WORKER_HOUR } from "./economy.js";

test("hourly worker production uses the approved base rates", () => {
  const result = settleEconomy({
    resources: { gold: 0, wood: 0, food: 0, stone: 0, iron: 0 },
    workerAssignments: { grain: 2, wood: 3, stone: 4, gold: 5, iron: 6 },
    buildings: { "1": { level: 1 }, "9": { level: 1 } },
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T01:00:00.000Z")
  });
  assert.deepEqual(result.productionPerHour, { gold: 10, wood: 30, food: 24, stone: 24, iron: 24 });
  assert.deepEqual(result.productionApplied, { gold: 10, wood: 30, food: 24, stone: 24, iron: 24 });
});

test("owned resource nodes add their yield bonus to assigned mine workers", () => {
  const result = settleEconomy({
    resources: { wood: 0 },
    workerAssignments: { mine_12: 2 },
    resourceNodes: [{ id: 12, resource_type: "wood", yield_level: 5 }],
    buildings: { "1": { level: 1 }, "9": { level: 1 } },
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T01:00:00.000Z")
  });
  assert.equal(result.productionPerHour.wood, 28);
  assert.equal(result.resources.wood, 28);
});

test("center level increases production and warehouse limits stored resources", () => {
  const result = settleEconomy({
    resources: { wood: 14990 },
    workerAssignments: { wood: 10 },
    buildings: { "1": { level: 3 }, "9": { level: 1 } },
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T01:00:00.000Z")
  });
  assert.equal(result.productionPerHour.wood, 110);
  assert.equal(result.resources.wood, 15000);
  assert.equal(result.storageCapacity, 15000);
});

test("offline accumulation is capped at 72 hours and fractional production is retained", () => {
  const first = settleEconomy({
    resources: { wood: 0 },
    workerAssignments: { wood: 1 },
    buildings: { "1": { level: 1 }, "9": { level: 2 } },
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T00:30:00.000Z")
  });
  assert.equal(first.resources.wood, 5);
  assert.equal(first.remainders.wood, 0);
  const capped = settleEconomy({
    resources: { wood: 0 },
    workerAssignments: { wood: 1 },
    buildings: { "1": { level: 1 }, "9": { level: 2 } },
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-05T00:00:00.000Z")
  });
  assert.equal(capped.resources.wood, 720);
  assert.equal(Date.parse(capped.lastResourceTick), Date.parse("2026-01-04T00:00:00.000Z"));
});
