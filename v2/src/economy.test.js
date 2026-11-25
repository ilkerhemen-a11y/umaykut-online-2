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
  assert.deepEqual(result.productionPerHour, { gold: 10, wood: 30, food: 24, stone: 24, iron: 24, horses: 111 });
  assert.deepEqual(result.productionApplied, { gold: 10, wood: 30, food: 24, stone: 24, iron: 24, horses: 111 });
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

test("center level increases production without limiting stored resources", () => {
  const result = settleEconomy({
    resources: { wood: 14990 },
    workerAssignments: { wood: 10 },
    buildings: { "1": { level: 3 }, "9": { level: 1 } },
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T01:00:00.000Z")
  });
  assert.equal(result.productionPerHour.wood, 110);
  assert.equal(result.resources.wood, 15100);
  assert.equal(result.storageCapacity, null);
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
  assert.equal(Date.parse(capped.lastResourceTick), Date.parse("2026-01-05T00:00:00.000Z"));
});

test("production breakdown exposes worker, node-yield and center bonuses used by hourly totals", () => {
  const result = settleEconomy({
    resources: { wood: 0 },
    workerAssignments: { mine_12: 2 },
    resourceNodes: [{ id: 12, resource_type: "wood", yield_level: 5 }],
    buildings: { "1": { level: 3 }, "9": { level: 1 } },
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T01:00:00.000Z")
  });
  assert.deepEqual(result.productionBreakdown, [{
    key: "mine_12", nodeId: "12", resourceType: "wood", workers: 2,
    yieldLevel: 5, workerBaseRate: 10, nodeMultiplier: 1.4,
    centerMultiplier: 1.1, hourlyProduction: 30.8
  }]);
  assert.equal(result.productionPerHour.wood, 30.8);
});

test("temple produces 100 workers per hour per level without a total cap", () => {
  for (let level = 1; level <= 10; level += 1) {
    const result = settleEconomy({
      resources: {}, workerAssignments: {},
      buildings: { "1": { level: 1 }, "7": { level }, "9": { level: 1 } },
      workerPool: 1800,
      lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
      now: Date.parse("2026-01-01T01:00:00.000Z")
    });
    assert.equal(result.workerProductionPerHour, level * 100);
    assert.equal(result.workerPool, 1800 + level * 100);
  }
  const offline = settleEconomy({
    resources: {}, workerAssignments: {}, buildings: { "7": { level: 10 } },
    workerPool: 2700, lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T02:30:00.000Z")
  });
  assert.equal(offline.workerPool, 5200);
  assert.equal(offline.workersProduced, 2500);
});

test("worker production retains fractional accrual between state checks", () => {
  const result = settleEconomy({
    resources: {}, workerAssignments: {}, buildings: { "7": { level: 1 } },
    workerPool: 1800, productionRemainders: { workers: 0 },
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T00:30:00.000Z")
  });
  assert.equal(result.workerPool, 1825);
  assert.equal(result.remainders.workers, 0);
});
test("temple worker production accrues for the full 72-hour offline window", () => {
  const result = settleEconomy({
    resources: {}, workerAssignments: {}, buildings: { "7": { level: 10 } },
    workerPool: 1800,
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-04T00:00:00.000Z")
  });
  assert.equal(result.workerProductionPerHour, 1000);
  assert.equal(result.workersProduced, 72000);
  assert.equal(result.workerPool, 73800);
});

test("each resource source can receive up to 1000 workers within the shared population", () => {
  const result = settleEconomy({
    resources: {}, workerAssignments: { wood: 800, gold: 300, food: 200 },
    buildings: { "1": { level: 1 }, "7": { level: 1 } },
    workerPool: 1800, troopPopulation: 250,
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T00:00:00.000Z")
  });
  assert.deepEqual(result.workerAssignments, { wood: 800, gold: 300, food: 200 });
  assert.equal(Object.values(result.workerAssignments).reduce((sum, count) => sum + count, 0), 1300);
  assert.equal(result.workerPool - 250 - 1300, 250);
});


test("new villages start with 1800 workers and temple growth is unlimited", () => {
  const initial = settleEconomy({
    resources: {}, workerAssignments: {}, buildings: { "7": { level: 1 } },
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T00:00:00.000Z")
  });
  assert.equal(initial.workerPool, 1800);
  const grown = settleEconomy({
    resources: {}, workerAssignments: {}, buildings: { "7": { level: 10 } },
    workerPool: 2700,
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T01:00:00.000Z")
  });
  assert.equal(grown.workerPool, 3700);
});

test("each individual resource source is capped at 1000 workers", () => {
  const result = settleEconomy({
    resources: {}, workerAssignments: { wood: 1200, gold: 1000, food: 200 },
    buildings: { "7": { level: 1 } }, workerPool: 2800,
    lastResourceTick: new Date("2026-01-01T00:00:00.000Z"),
    now: Date.parse("2026-01-01T00:00:00.000Z")
  });
  assert.deepEqual(result.workerAssignments, { wood: 1000, gold: 1000, food: 200 });
  assert.equal(Object.values(result.workerAssignments).reduce((sum, count) => sum + count, 0), 2200);
  assert.equal(result.workerPool, 2800);
});
