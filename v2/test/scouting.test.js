import test from "node:test";
import assert from "node:assert/strict";
import { resolveScoutClash } from "../src/combat.js";

test("larger attacking spy force eliminates defenders and survives by the difference", () => {
  assert.deepEqual(resolveScoutClash({ attackerScouts: 100, defenderScouts: 25 }), {
    attackerScouts: 100, defenderScouts: 25,
    attackerSurvivors: 75, defenderSurvivors: 0,
    attackerLosses: 25, defenderLosses: 25,
    informationGathered: true, outcome: "attacker_success"
  });
});

test("equal spy forces eliminate each other and gather no information", () => {
  const result = resolveScoutClash({ attackerScouts: 50, defenderScouts: 50 });
  assert.equal(result.attackerSurvivors, 0);
  assert.equal(result.defenderSurvivors, 0);
  assert.equal(result.attackerLosses, 50);
  assert.equal(result.defenderLosses, 50);
  assert.equal(result.informationGathered, false);
  assert.equal(result.outcome, "mutual_destruction");
});

test("smaller attacking spy force is eliminated and defenders retain the difference", () => {
  const result = resolveScoutClash({ attackerScouts: 25, defenderScouts: 50 });
  assert.equal(result.attackerSurvivors, 0);
  assert.equal(result.defenderSurvivors, 25);
  assert.equal(result.attackerLosses, 25);
  assert.equal(result.defenderLosses, 25);
  assert.equal(result.informationGathered, false);
});

test("an undefended village returns all attacking spies with intelligence", () => {
  const result = resolveScoutClash({ attackerScouts: 10, defenderScouts: 0 });
  assert.equal(result.attackerSurvivors, 10);
  assert.equal(result.defenderSurvivors, 0);
  assert.equal(result.attackerLosses, 0);
  assert.equal(result.informationGathered, true);
});

test("spy counts must be non-negative integers", () => {
  assert.throws(() => resolveScoutClash({ attackerScouts: -1, defenderScouts: 0 }), /tam sayı/);
  assert.throws(() => resolveScoutClash({ attackerScouts: 1.5, defenderScouts: 0 }), /tam sayı/);
});
