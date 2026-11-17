const RESOURCE_KEYS = Object.freeze(["gold", "wood", "food", "stone", "iron"]);
const MAX_WALL_LEVEL = 10;
const DEFENSE_PER_LEVEL = 5;
const SHELTER_PER_LEVEL = 500;

function validNonNegativeInteger(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new TypeError(`${name} sıfır veya pozitif tam sayı olmalı.`);
  }
  return number;
}

export function getWallProtection(level) {
  const safeLevel = Number(level);
  if (!Number.isSafeInteger(safeLevel) || safeLevel < 1 || safeLevel > MAX_WALL_LEVEL) {
    throw new RangeError("Sur seviyesi 1 ile 10 arasında olmalı.");
  }
  return {
    defensePercent: Math.min(50, safeLevel * DEFENSE_PER_LEVEL),
    shelterCapacity: Object.fromEntries(
      RESOURCE_KEYS.map(key => [key, safeLevel * SHELTER_PER_LEVEL])
    )
  };
}

/**
 * Resolves the damage that reaches a village after its wall protection.
 * attackPower and defensePower must come from server-owned army state.
 */
export function resolveVillageDamage({ attackPower, defensePower = 0, wallLevel = 1 }) {
  const attack = validNonNegativeInteger(attackPower, "Saldırı gücü");
  const defense = validNonNegativeInteger(defensePower, "Savunma gücü");
  const protection = getWallProtection(wallLevel);
  const damageBeforeWall = Math.max(0, attack - defense);
  const damageAfterWall = Math.floor(
    damageBeforeWall * (100 - protection.defensePercent) / 100
  );
  return {
    damageBeforeWall,
    damageAfterWall,
    damagePreventedByWall: damageBeforeWall - damageAfterWall,
    wallDefensePercent: protection.defensePercent
  };
}

/**
 * Applies shelter protection before calculating stolen resources.
 * requestedLoot must be derived from server-side attacker capacity.
 */
export function resolveProtectedLoot({ defenderResources, requestedLoot, wallLevel = 1 }) {
  if (!defenderResources || typeof defenderResources !== "object" || Array.isArray(defenderResources)) {
    throw new TypeError("Savunmacı kaynakları geçersiz.");
  }
  if (!requestedLoot || typeof requestedLoot !== "object" || Array.isArray(requestedLoot)) {
    throw new TypeError("Yağma talebi geçersiz.");
  }
  const { shelterCapacity } = getWallProtection(wallLevel);
  const protectedResources = {};
  const loot = {};
  const remainingResources = {};
  for (const key of RESOURCE_KEYS) {
    const stock = validNonNegativeInteger(defenderResources[key] ?? 0, `${key} kaynağı`);
    const requested = validNonNegativeInteger(requestedLoot[key] ?? 0, `${key} yağması`);
    const protectedAmount = Math.min(stock, shelterCapacity[key]);
    const exposed = Math.max(0, stock - protectedAmount);
    const stolen = Math.min(exposed, requested);
    protectedResources[key] = protectedAmount;
    loot[key] = stolen;
    remainingResources[key] = stock - stolen;
  }
  return { protectedResources, loot, remainingResources, shelterCapacity };
}
