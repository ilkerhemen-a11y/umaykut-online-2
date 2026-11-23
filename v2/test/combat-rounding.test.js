import test from "node:test";
import assert from "node:assert/strict";
import { resolveBattle } from "../src/combat.js";

test("karma piyade-atlı savunma gücünü tam sayıya yuvarlar", () => {
  const result = resolveBattle({
    attackerTroops: { infantry: 1, cavalry: 2 },
    defenderTroops: { guard: 1 },
    attackerCatalog: [
      { id: "infantry", building: "barracks", attack: 10, carry: 0 },
      { id: "cavalry", building: "stable", attack: 10, carry: 0 }
    ],
    defenderCatalog: [
      { id: "guard", building: "barracks", infantryDefense: 8, cavalryDefense: 3, carry: 0 }
    ],
    defenderResources: { gold: 1000, wood: 1000, food: 1000, stone: 1000, iron: 1000 },
    wallLevel: 1
  });

  assert.equal(result.defensePower, 5);
  assert.equal(Number.isSafeInteger(result.defensePower), true);
});
