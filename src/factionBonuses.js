const FACTION_BONUS_APPLIED = Symbol("umaykut.factionBonusApplied");

export const FACTION_BONUS_BUDGET_PERCENT = 8;

export const FACTION_BONUSES = Object.freeze({
  selcuk: Object.freeze({
    attackPercent: 3,
    defensePercent: 3,
    maxHpPercent: 2,
    movementSpeedPercent: 0
  }),
  hun: Object.freeze({
    attackPercent: 5,
    defensePercent: 0,
    maxHpPercent: 0,
    movementSpeedPercent: 3
  }),
  gokturk: Object.freeze({
    attackPercent: 0,
    defensePercent: 5,
    maxHpPercent: 3,
    movementSpeedPercent: 0
  })
});

const BONUS_FIELD_BY_STAT = Object.freeze({
  attack: "attackPercent",
  defense: "defensePercent",
  maxHp: "maxHpPercent",
  movementSpeed: "movementSpeedPercent"
});

export function getFactionBonusBudget(bonuses) {
  if (!bonuses || typeof bonuses !== "object" || Array.isArray(bonuses)) {
    throw new TypeError("Devlet bonusları geçerli bir nesne olmalı.");
  }
  return Object.values(bonuses).reduce((total, value) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new TypeError("Devlet bonus yüzdeleri sıfır veya pozitif bir sayı olmalı.");
    }
    return total + value;
  }, 0);
}

for (const [factionId, bonuses] of Object.entries(FACTION_BONUSES)) {
  if (getFactionBonusBudget(bonuses) !== FACTION_BONUS_BUDGET_PERCENT) {
    throw new Error(`${factionId} devletinin bonus bütçesi %${FACTION_BONUS_BUDGET_PERCENT} olmalı.`);
  }
}

function validateStatMap(stats, label, allowNegative = false) {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    throw new TypeError(`${label} geçerli bir istatistik nesnesi olmalı.`);
  }
  for (const [key, value] of Object.entries(stats)) {
    if (typeof value !== "number" || !Number.isFinite(value) || (!allowNegative && value < 0)) {
      throw new TypeError(`${label} içindeki ${key} değeri geçerli bir sayı olmalı.`);
    }
  }
}

function roundStat(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Devlet yüzdesini yalnızca ham karakter temel değerlerine uygular.
 * Seviye ve ekipman katkıları, devlet bonusu uygulandıktan sonra sabit değer
 * olarak eklenir; böylece bu katkılar devlet yüzdesiyle tekrar çarpılmaz.
 */
export function calculateCharacterStats({
  factionId,
  baseStats,
  levelBonuses = {},
  equipmentBonuses = {}
}) {
  const factionBonuses = FACTION_BONUSES[factionId];
  if (!factionBonuses) {
    throw new RangeError("Geçerli bir devlet seçilmeden karakter istatistiği hesaplanamaz.");
  }
  if (baseStats?.[FACTION_BONUS_APPLIED]) {
    throw new Error("Devlet bonusu bu temel istatistiklere zaten uygulanmış.");
  }

  validateStatMap(baseStats, "Temel istatistikler");
  validateStatMap(levelBonuses, "Seviye bonusları", true);
  validateStatMap(equipmentBonuses, "Ekipman bonusları", true);

  const factionAdjustedBaseStats = { ...baseStats };
  for (const [stat, bonusField] of Object.entries(BONUS_FIELD_BY_STAT)) {
    if (Object.hasOwn(baseStats, stat)) {
      factionAdjustedBaseStats[stat] = roundStat(
        baseStats[stat] * (1 + factionBonuses[bonusField] / 100)
      );
    }
  }

  const stats = { ...factionAdjustedBaseStats };
  const allStatKeys = new Set([
    ...Object.keys(baseStats),
    ...Object.keys(levelBonuses),
    ...Object.keys(equipmentBonuses)
  ]);
  for (const stat of allStatKeys) {
    stats[stat] = roundStat(
      (factionAdjustedBaseStats[stat] ?? 0) +
      (levelBonuses[stat] ?? 0) +
      (equipmentBonuses[stat] ?? 0)
    );
  }

  Object.defineProperty(stats, FACTION_BONUS_APPLIED, {
    value: factionId,
    enumerable: false
  });

  return Object.freeze({
    factionId,
    bonusBudgetPercent: getFactionBonusBudget(factionBonuses),
    stats: Object.freeze(stats),
    breakdown: Object.freeze({
      base: Object.freeze({ ...baseStats }),
      factionAdjustedBase: Object.freeze({ ...factionAdjustedBaseStats }),
      level: Object.freeze({ ...levelBonuses }),
      equipment: Object.freeze({ ...equipmentBonuses }),
      factionBonuses: factionBonuses
    })
  });
}
