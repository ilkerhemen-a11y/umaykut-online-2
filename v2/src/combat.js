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

function troopTotals(troops) {
  return Object.values(troops || {}).reduce((sum, value) => sum + validNonNegativeInteger(value, "Asker sayısı"), 0);
}
function troopPower(troops, catalog, mode, opposingTroops = {}, opposingCatalog = []) {
  const units = new Map(catalog.map(unit => [unit.id, unit]));
  if (mode === "attack") {
    return Object.entries(troops || {}).reduce((sum, [id, count]) => {
      const unit = units.get(id);
      return sum + (unit ? validNonNegativeInteger(count, "Asker sayısı") * Number(unit.attack || 0) : 0);
    }, 0);
  }
  const opposingUnits = new Map(opposingCatalog.map(unit => [unit.id, unit]));
  let infantry = 0, cavalry = 0;
  for (const [id, count] of Object.entries(opposingTroops || {})) {
    const unit = opposingUnits.get(id);
    if (!unit) continue;
    const amount = validNonNegativeInteger(count, "Saldıran asker sayısı");
    if (unit.building === "stable") cavalry += amount;
    else infantry += amount;
  }
  const totalOpposing = infantry + cavalry;
  const infantryShare = totalOpposing ? infantry / totalOpposing : 0.5;
  const cavalryShare = totalOpposing ? cavalry / totalOpposing : 0.5;
  // Weighted infantry/cavalry defense can be fractional; battle power is an integer game stat.
  return Math.round(Object.entries(troops || {}).reduce((sum, [id, count]) => {
    const unit = units.get(id);
    if (!unit) return sum;
    const effectiveDefense = Number(unit.infantryDefense || 0) * infantryShare +
      Number(unit.cavalryDefense || 0) * cavalryShare;
    return sum + validNonNegativeInteger(count, "Asker sayısı") * effectiveDefense;
  }, 0));
}
function splitLosses(troops, lossCount) {
  const entries = Object.entries(troops || {});
  const total = troopTotals(troops);
  let remainingLoss = Math.min(total, lossCount);
  const result = {};
  for (let i = 0; i < entries.length; i++) {
    const [id, raw] = entries[i];
    const count = validNonNegativeInteger(raw, "Asker sayısı");
    const loss = i === entries.length - 1
      ? Math.min(count, remainingLoss)
      : Math.min(count, Math.floor(lossCount * count / Math.max(1, total)));
    result[id] = loss;
    remainingLoss -= loss;
  }
  // Distribute rounding remainder without ever exceeding a unit stack.
  for (const [id, raw] of entries) {
    if (remainingLoss <= 0) break;
    const extra = Math.min(raw - result[id], remainingLoss);
    result[id] += extra;
    remainingLoss -= extra;
  }
  const survivors = Object.fromEntries(entries.map(([id, count]) => [id, count - result[id]]).filter(([, count]) => count > 0));
  return { losses: result, survivors, totalLosses: Object.values(result).reduce((sum, n) => sum + n, 0) };
}
export function resolveBattle({ attackerTroops, defenderTroops, attackerCatalog, defenderCatalog, defenderResources, wallLevel = 1 }) {
  const attackPower = troopPower(attackerTroops, attackerCatalog, "attack");
  const defensePower = troopPower(defenderTroops, defenderCatalog, "defense", attackerTroops, attackerCatalog);
  const wall = resolveVillageDamage({ attackPower, defensePower, wallLevel });
  const attackerCount = troopTotals(attackerTroops);
  const defenderCount = troopTotals(defenderTroops);
  const attackerLossCount = attackPower + defensePower === 0 ? 0 :
    Math.min(attackerCount, Math.floor(attackerCount * Math.min(0.9, defensePower / (attackPower + defensePower) * 0.65)));
  const defenderLossCount = wall.damageAfterWall + defensePower === 0 ? 0 :
    Math.min(defenderCount, Math.floor(defenderCount * Math.min(0.9, wall.damageAfterWall / (wall.damageAfterWall + defensePower) * 0.85)));
  const attacker = splitLosses(attackerTroops, attackerLossCount);
  const defender = splitLosses(defenderTroops, defenderLossCount);
  const attackerUnits = new Map(attackerCatalog.map(unit => [unit.id, unit]));
  const carryCapacity = Object.entries(attacker.survivors).reduce((sum, [id, count]) =>
    sum + count * Number(attackerUnits.get(id)?.carry || 0), 0);
  const perResourceRequest = Math.floor(carryCapacity / RESOURCE_KEYS.length);
  const requestedLoot = Object.fromEntries(RESOURCE_KEYS.map(key => [key, perResourceRequest]));
  const protectedLoot = resolveProtectedLoot({ defenderResources, requestedLoot, wallLevel });
  const winner = wall.damageAfterWall > 0 && attacker.totalLosses < attackerCount ? "attacker" : "defender";
  const resultCode = winner === "attacker" ? "victory" : "defense";
  return {
    winner, resultCode,
    outcomeText: winner === "attacker" ? "Saldıran taraf kazandı" : "Savunan taraf köyünü korudu",
    attackPower, defensePower, ...wall,
    attackerLosses: attacker.losses, attackerSurvivors: attacker.survivors, attackerLostCount: attacker.totalLosses,
    defenderLosses: defender.losses, defenderSurvivors: defender.survivors, defenderLostCount: defender.totalLosses,
    carryCapacity, loot: protectedLoot.loot, protectedResources: protectedLoot.protectedResources,
    defenderRemainingResources: protectedLoot.remainingResources
  };
}

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


/**
 * Scout-vs-scout resolution. No other troop type, wall, or random roll can
 * kill scouts: the smaller force is eliminated and the difference survives.
 */
export function resolveScoutClash({ attackerScouts, defenderScouts }) {
  const attackers = validNonNegativeInteger(attackerScouts, "Saldıran casus sayısı");
  const defenders = validNonNegativeInteger(defenderScouts, "Savunan casus sayısı");
  const attackerSurvivors = Math.max(0, attackers - defenders);
  const defenderSurvivors = Math.max(0, defenders - attackers);
  const attackerLosses = attackers > defenders ? 0 : attackers;
  const defenderLosses = defenders > attackers ? attackers : defenders;
  const informationGathered = attackers > defenders;
  return {
    attackerScouts: attackers,
    defenderScouts: defenders,
    attackerSurvivors,
    defenderSurvivors,
    attackerLosses,
    defenderLosses,
    informationGathered,
    outcome: attackers === defenders
      ? "mutual_destruction"
      : attackers > defenders
        ? "attacker_success"
        : "defender_success"
  };
}
