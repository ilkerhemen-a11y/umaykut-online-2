import test from "node:test";
import assert from "node:assert/strict";
import { settleEconomy } from "../src/economy.js";

test("stable produces horses progressively and caps at 1,000 per hour from level nine", () => {
  const now = Date.parse("2026-11-24T12:00:00.000Z");
  const run = level => settleEconomy({
    resources: { horses: 0 },
    workerAssignments: {},
    buildings: { "3": { type: "stable", level } },
    lastResourceTick: new Date(now - 3600000).toISOString(),
    productionRemainders: {},
    workerPool: 0,
    now
  });
  const levelOne = run(1);
  assert.equal(levelOne.horseProductionPerHour, 111);
  assert.equal(levelOne.productionPerHour.horses, 111);
  assert.equal(levelOne.resources.horses, 111);
  const levelNine = run(9);
  assert.equal(levelNine.horseProductionPerHour, 1000);
  assert.equal(levelNine.resources.horses, 1000);
  const levelTen = run(10);
  assert.equal(levelTen.horseProductionPerHour, 1000);
  assert.equal(levelTen.resources.horses, 1000);
});
