import test from "node:test";
import assert from "node:assert/strict";
import {
  FACTION_BONUSES,
  FACTION_BONUS_BUDGET_PERCENT,
  calculateCharacterStats,
  getFactionBonusBudget
} from "../src/factionBonuses.js";

test("üç devletin de bonus bütçesi tam olarak yüzde 8", () => {
  for (const bonuses of Object.values(FACTION_BONUSES)) {
    assert.equal(getFactionBonusBudget(bonuses), FACTION_BONUS_BUDGET_PERCENT);
  }
});

test("Selçuk bonusu yalnızca temel değerlere uygulanır; seviye ve ekipman sonradan eklenir", () => {
  const baseStats = {
    attack: 100,
    defense: 200,
    maxHp: 1000,
    movementSpeed: 100,
    stamina: 50
  };
  const levelBonuses = {
    attack: 10,
    defense: 5,
    maxHp: 100,
    movementSpeed: 2,
    stamina: 3
  };
  const equipmentBonuses = {
    attack: 25,
    defense: 10,
    maxHp: 50,
    movementSpeed: 5
  };

  const result = calculateCharacterStats({
    factionId: "selcuk",
    baseStats,
    levelBonuses,
    equipmentBonuses
  });

  assert.deepEqual({ ...result.stats }, {
    attack: 138,
    defense: 221,
    maxHp: 1170,
    movementSpeed: 107,
    stamina: 53
  });
  assert.deepEqual(baseStats, {
    attack: 100,
    defense: 200,
    maxHp: 1000,
    movementSpeed: 100,
    stamina: 50
  });
  assert.equal(result.breakdown.factionAdjustedBase.attack, 103);
  assert.equal(result.breakdown.factionAdjustedBase.defense, 206);
});

test("Hun saldırı ve hareket hızı bonuslarını doğru temel değerlere uygular", () => {
  const result = calculateCharacterStats({
    factionId: "hun",
    baseStats: { attack: 200, defense: 100, maxHp: 500, movementSpeed: 120 }
  });

  assert.deepEqual({ ...result.stats }, {
    attack: 210,
    defense: 100,
    maxHp: 500,
    movementSpeed: 123.6
  });
});

test("Göktürk savunma ve maksimum HP bonuslarını doğru uygular", () => {
  const result = calculateCharacterStats({
    factionId: "gokturk",
    baseStats: { attack: 100, defense: 100, maxHp: 500, movementSpeed: 100 }
  });

  assert.deepEqual({ ...result.stats }, {
    attack: 100,
    defense: 105,
    maxHp: 515,
    movementSpeed: 100
  });
});

test("aynı hesaplanmış temel değerler tekrar devlet bonusundan geçirilemez", () => {
  const first = calculateCharacterStats({
    factionId: "selcuk",
    baseStats: { attack: 100, defense: 100, maxHp: 100, movementSpeed: 100 }
  });

  assert.throws(() => calculateCharacterStats({
    factionId: "selcuk",
    baseStats: first.stats
  }), /zaten uygulanmış/);
});

test("geçersiz devlet ve sayısal olmayan değerler reddedilir", () => {
  assert.throws(() => calculateCharacterStats({
    factionId: "unknown",
    baseStats: { attack: 100 }
  }), /Geçerli bir devlet/);

  assert.throws(() => calculateCharacterStats({
    factionId: "hun",
    baseStats: { attack: "100" }
  }), /geçerli bir sayı/);
});
