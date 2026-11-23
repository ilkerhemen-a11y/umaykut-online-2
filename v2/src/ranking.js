import { getTroopCatalog } from "./army.js";

export const RANKING_WEIGHTS = Object.freeze({
  buildings: 30,
  military: 30,
  territory: 25,
  economy: 15
});

const RESOURCE_KEYS = Object.freeze(["gold", "wood", "food", "stone", "iron"]);
const MAX_BUILDING_LEVELS = 90;
const MAX_NEUTRAL_REGIONS = 24;
const BASE_STORAGE_CAPACITY = 15000;

function parseObject(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function clampScore(value) {
  return Math.max(0, Math.min(1000, value));
}

export function calculatePlayerScore(player) {
  const buildings = parseObject(player.buildings);
  const troops = parseObject(player.troops);
  const resources = parseObject(player.resources);
  const factionId = ["gokturk", "hun", "seljuk"].includes(player.faction_id)
    ? player.faction_id
    : "gokturk";

  const buildingLevels = Object.values(buildings).reduce((sum, building) => {
    const level = Number(building?.level);
    return sum + (Number.isSafeInteger(level) ? Math.max(1, Math.min(10, level)) : 0);
  }, 0);
  const buildingScore = clampScore((buildingLevels / MAX_BUILDING_LEVELS) * 1000);

  const catalog = getTroopCatalog(factionId, buildings);
  const attackByUnit = new Map(catalog.map(unit => [unit.id, nonNegativeNumber(unit.attack)]));
  const armyPower = Object.entries(troops).reduce((sum, [unitId, rawCount]) => {
    return sum + nonNegativeNumber(rawCount) * (attackByUnit.get(unitId) || 0);
  }, 0);
  // Diminishing returns prevent very large armies from making every other category irrelevant.
  const militaryScore = clampScore((armyPower / (armyPower + 5000)) * 1000);

  const territoryCount = nonNegativeNumber(player.territory_count);
  const territoryScore = clampScore((Math.min(MAX_NEUTRAL_REGIONS, territoryCount) / MAX_NEUTRAL_REGIONS) * 1000);

  const warehouseLevel = Math.max(1, Math.min(10, Number(buildings["9"]?.level) || 1));
  const storageCapacity = BASE_STORAGE_CAPACITY + (warehouseLevel - 1) * 10000;
  const resourceTotal = RESOURCE_KEYS.reduce((sum, key) => sum + nonNegativeNumber(resources[key]), 0);
  const economyScore = clampScore((resourceTotal / (storageCapacity * RESOURCE_KEYS.length)) * 1000);

  const score = Math.round(
    (buildingScore * RANKING_WEIGHTS.buildings +
      militaryScore * RANKING_WEIGHTS.military +
      territoryScore * RANKING_WEIGHTS.territory +
      economyScore * RANKING_WEIGHTS.economy) / 100
  );

  return {
    score,
    components: {
      buildings: Math.round(buildingScore),
      military: Math.round(militaryScore),
      territory: Math.round(territoryScore),
      economy: Math.round(economyScore)
    }
  };
}

export function rankPlayers(players) {
  return players
    .map(player => ({
      id: String(player.id),
      username: String(player.username || "Oyuncu"),
      villageName: String(player.village_name || "İsimsiz Yurt"),
      factionId: player.faction_id || null,
      createdAt: player.created_at ? new Date(player.created_at).getTime() : 0,
      ...calculatePlayerScore(player)
    }))
    .sort((a, b) =>
      b.score - a.score ||
      a.createdAt - b.createdAt ||
      a.username.localeCompare(b.username, "tr")
    )
    .map((player, index) => ({
      ...player,
      rank: index + 1
    }));
}
