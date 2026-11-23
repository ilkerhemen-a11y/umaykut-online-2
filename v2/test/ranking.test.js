import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateArmyStrength,
  calculateArmyStrengthScore,
  combineTroopStacks,
  calculateBuildingDevelopmentScore,
  calculateEconomyScore,
  calculateOverallRankingScore,
  calculatePlayerRanking,
  calculateTerritorialControlScore
} from "../src/ranking.js";

const village = {
  "1": { type: "center", level: 1 },
  "2": { type: "barracks", level: 1 },
  "3": { type: "stable", level: 1 },
  "4": { type: "blacksmith", level: 1 },
  "5": { type: "school", level: 1 },
  "6": { type: "lumberyard", level: 1 },
  "7": { type: "temple", level: 1 },
  "8": { type: "market", level: 1 },
  "9": { type: "archery", level: 1 }
};

test("building development score is normalized from 0 to 100", () => {
  const maxed = Object.fromEntries(Object.entries(village).map(([slot, building]) =>
    [slot, { ...building, level: 10 }]
  ));
  assert.equal(calculateBuildingDevelopmentScore(maxed), 100);
  assert.equal(calculateBuildingDevelopmentScore(village), 10);
});

test("Okçu slot 9 contributes to development and legacy warehouse data is treated as Okçu", () => {
  const withoutSlotNine = { ...village };
  delete withoutSlotNine["9"];
  assert.equal(
    Math.round((calculateBuildingDevelopmentScore(village) - calculateBuildingDevelopmentScore(withoutSlotNine)) * 100) / 100,
    1.11
  );
  assert.equal(calculateBuildingDevelopmentScore({
    ...village, "9": { type: "warehouse", level: 10 }
  }), 20);
});

test("army strength includes faction-adjusted attack and defensive values", () => {
  const power = calculateArmyStrength({ infantry: 10 }, "gokturk", village);
  assert.ok(power > 0);
  assert.equal(calculateArmyStrengthScore(10000), 100);
  assert.equal(calculateArmyStrengthScore(20000), 100);
  assert.equal(calculateArmyStrengthScore(0), 0);
  assert.equal(calculateArmyStrength({}, "gokturk", village), 0);
});

test("army stacks from home, raids, scouting and regional garrisons are combined", () => {
  assert.deepEqual(combineTroopStacks(
    { infantry: 5, scout: 1 },
    [{ infantry: 3, archer: 2 }],
    [{ shield: 4 }],
    [{ scout: 2 }]
  ), { infantry: 8, scout: 3, archer: 2, shield: 4 });
});

test("territory score counts only the permanent owned-region input and caps at 24", () => {
  assert.equal(calculateTerritorialControlScore(0), 0);
  assert.equal(calculateTerritorialControlScore(12), 50);
  assert.equal(calculateTerritorialControlScore(24), 100);
  assert.equal(calculateTerritorialControlScore(30), 100);
});

test("economy score measures resources and has no building/storage multiplier", () => {
  const fullResources = { gold: 20000, wood: 20000, food: 20000, stone: 20000, iron: 20000, horses: 1000 };
  assert.equal(calculateEconomyScore(fullResources), 100);
  assert.equal(calculateEconomyScore({}), 0);
  assert.equal(calculateEconomyScore({ ...fullResources, horses: 0 }), 83.33);
  assert.equal(calculateEconomyScore({ ...fullResources, wood: 40000 }), 100);
});

test("overall ranking is the equal-weighted average of the four categories", () => {
  assert.equal(calculateOverallRankingScore({
    buildingDevelopment: 100, armyStrength: 80, territorialControl: 60, economy: 40
  }), 70);
  assert.throws(() => calculateOverallRankingScore({
    buildingDevelopment: 101, armyStrength: 80, territorialControl: 60, economy: 40
  }), /0 ile 100/);
});

test("player ranking keeps slot 9 as archery and produces one overall score", () => {
  const result = calculatePlayerRanking({
    buildings: village,
    troops: { archer: 10 },
    factionId: "gokturk",
    ownedRegionCount: 2,
    resources: { gold: 10000 }
  });
  assert.equal(result.buildingDevelopment, 10);
  assert.equal(result.territorialControl, 8.33);
  assert.equal(result.economy, 8.33);
  assert.ok(result.armyStrength > 0);
  assert.equal(result.overall, Math.round((
    result.buildingDevelopment + result.armyStrength +
    result.territorialControl + result.economy
  ) / 4 * 100) / 100);
});
