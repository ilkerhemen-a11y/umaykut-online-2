const MAX_BUILDING_LEVEL = 10;
const FIXED_BUILDING_TYPES = Object.freeze({
  "1": "center",
  "2": "barracks",
  "3": "stable",
  "4": "blacksmith",
  "5": "school",
  "6": "lumberyard",
  "7": "temple",
  "8": "market",
  "9": "archery"
});

/**
 * Returns a 0-100 building-development score.
 * Each of the nine fixed village buildings contributes equally; a level-10
 * village receives 100. Slot 9 is always the archery building (Okçu), never
 * a warehouse or storage building.
 */
export function calculateBuildingDevelopmentScore(buildings = {}) {
  if (!buildings || typeof buildings !== "object" || Array.isArray(buildings)) {
    throw new TypeError("Bina verisi geçersiz.");
  }

  let totalLevels = 0;
  for (const [slot, expectedType] of Object.entries(FIXED_BUILDING_TYPES)) {
    const building = buildings[slot];
    if (!building || building.type !== expectedType) continue;
    const level = Number(building.level);
    if (!Number.isSafeInteger(level) || level < 1 || level > MAX_BUILDING_LEVEL) continue;
    totalLevels += level;
  }

  return Math.round((totalLevels / (Object.keys(FIXED_BUILDING_TYPES).length * MAX_BUILDING_LEVEL)) * 10000) / 100;
}
