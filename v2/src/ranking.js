import { getTroopCatalog } from "./army.js";

export const RANKING_WEIGHTS = Object.freeze({
  buildingDevelopment: 25,
  armyStrength: 25,
  territorialControl: 25,
  economy: 25
});
const MAX_BUILDING_LEVEL = 10;
const FIXED_BUILDING_TYPES = Object.freeze({
  "1": "center", "2": "barracks", "3": "stable", "4": "blacksmith",
  "5": "school", "6": "lumberyard", "7": "temple", "8": "market", "9": "archery"
});
const ECONOMY_TARGETS = Object.freeze({
  gold: 20000, wood: 20000, food: 20000, stone: 20000, iron: 20000, horses: 1000
});
const MAX_ARMY_STRENGTH = 10000;
const MAX_OWNED_REGIONS = 24;

function safeCount(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

/** Nine fixed buildings, each contributing equally to a 0-100 score. */
export function calculateBuildingDevelopmentScore(buildings = {}) {
  if (!buildings || typeof buildings !== "object" || Array.isArray(buildings)) {
    throw new TypeError("Bina verisi geçersiz.");
  }
  let totalLevels = 0;
  for (const [slot, expectedType] of Object.entries(FIXED_BUILDING_TYPES)) {
    const building = buildings[slot];
    const legacyOkcu = slot === "9" && building?.type === "warehouse";
    if (!building || (building.type !== expectedType && !legacyOkcu)) continue;
    const level = Number(building.level);
    if (Number.isSafeInteger(level) && level >= 1 && level <= MAX_BUILDING_LEVEL) totalLevels += level;
  }
  return Math.round(totalLevels / 90 * 10000) / 100;
}

/** Military strength uses each unit's faction-adjusted attack and average defense. */
export function calculateArmyStrength(troops = {}, factionId = "gokturk", buildings = {}) {
  if (!troops || typeof troops !== "object" || Array.isArray(troops)) {
    throw new TypeError("Asker verisi geçersiz.");
  }
  const catalog = getTroopCatalog(factionId, buildings);
  const units = new Map(catalog.map(unit => [unit.id, unit]));
  return Object.entries(troops).reduce((total, [id, rawCount]) => {
    const count = safeCount(rawCount);
    const unit = units.get(id);
    if (!unit || !count) return total;
    const defense = (Number(unit.infantryDefense || 0) + Number(unit.cavalryDefense || 0)) / 2;
    return total + count * (Number(unit.attack || 0) + defense);
  }, 0);
}

export function calculateArmyStrengthScore(strength) {
  const amount = Number(strength);
  const safeStrength = Number.isFinite(amount) && amount > 0 ? amount : 0;
  return Math.round(Math.min(100, safeStrength / MAX_ARMY_STRENGTH * 100) * 100) / 100;
}

/** Only permanently conquered regions count; temporary four-hour claims do not. */
export function calculateTerritorialControlScore(ownedRegionCount) {
  return Math.round(Math.min(100, safeCount(ownedRegionCount) / MAX_OWNED_REGIONS * 100) * 100) / 100;
}

/**
 * Measures current resource reserves against transparent reference targets.
 * No warehouse/storage bonus is applied: slot 9 is the Okçu building.
 */
export function calculateEconomyScore(resources = {}) {
  if (!resources || typeof resources !== "object" || Array.isArray(resources)) {
    throw new TypeError("Kaynak verisi geçersiz.");
  }
  const total = Object.entries(ECONOMY_TARGETS).reduce((sum, [key, target]) => {
    const amount = Math.max(0, Number(resources[key] || 0));
    return sum + (Number.isFinite(amount) ? Math.min(target, amount) / target : 0);
  }, 0);
  return Math.round(total / Object.keys(ECONOMY_TARGETS).length * 10000) / 100;
}

export function calculateOverallRankingScore(scores) {
  const values = [
    scores.buildingDevelopment,
    scores.armyStrength,
    scores.territorialControl,
    scores.economy
  ];
  if (!values.every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
    throw new TypeError("Sıralama bileşen puanları 0 ile 100 arasında olmalı.");
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / 4 * 100) / 100;
}

/** Merge home, marching, scouting and regional garrison troop stacks. */
export function combineTroopStacks(...stacks) {
  const combined = {};
  for (const stack of stacks.flat()) {
    if (!stack || typeof stack !== "object" || Array.isArray(stack)) continue;
    for (const [id, rawCount] of Object.entries(stack)) {
      const count = safeCount(rawCount);
      if (count) combined[id] = (combined[id] || 0) + count;
    }
  }
  return combined;
}

export function calculatePlayerRanking({ buildings, troops, factionId, ownedRegionCount, resources }) {
  const armyStrength = calculateArmyStrength(troops, factionId, buildings);
  const scores = {
    buildingDevelopment: calculateBuildingDevelopmentScore(buildings),
    armyStrength: calculateArmyStrengthScore(armyStrength),
    territorialControl: calculateTerritorialControlScore(ownedRegionCount),
    economy: calculateEconomyScore(resources)
  };
  return {
    ...scores,
    armyRawStrength: armyStrength,
    ownedRegions: safeCount(ownedRegionCount),
    overall: calculateOverallRankingScore(scores)
  };
}
