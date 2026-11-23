import test from "node:test";
import assert from "node:assert/strict";
import { calculateBuildingDevelopmentScore } from "../src/ranking.js";

const levelOneVillage = {
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

test("building development score is normalized to 100 at nine level-10 buildings", () => {
  const maxed = Object.fromEntries(Object.entries(levelOneVillage).map(([slot, building]) =>
    [slot, { ...building, level: 10 }]
  ));
  assert.equal(calculateBuildingDevelopmentScore(maxed), 100);
  assert.equal(calculateBuildingDevelopmentScore(levelOneVillage), 10);
});

test("Okçu in slot 9 contributes to building development as a building", () => {
  const withoutArcherBuilding = { ...levelOneVillage };
  delete withoutArcherBuilding["9"];
  assert.equal(
    calculateBuildingDevelopmentScore(levelOneVillage) - calculateBuildingDevelopmentScore(withoutArcherBuilding),
    1.11
  );
});

test("legacy warehouse label in slot 9 is not scored as a valid building", () => {
  const legacy = {
    ...levelOneVillage,
    "9": { type: "warehouse", level: 10 }
  };
  assert.equal(calculateBuildingDevelopmentScore(legacy), 8.89);
});

test("invalid levels and wrong slot types do not inflate the score", () => {
  const invalid = {
    ...levelOneVillage,
    "1": { type: "market", level: 10 },
    "2": { type: "barracks", level: 99 },
    "3": { type: "stable", level: -1 }
  };
  assert.equal(calculateBuildingDevelopmentScore(invalid), 6.67);
  assert.throws(() => calculateBuildingDevelopmentScore([]), /Bina verisi/);
});
