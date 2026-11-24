export const RESOURCE_PRODUCTION_PER_WORKER_HOUR = Object.freeze({
  grain: 12,
  wood: 10,
  stone: 6,
  gold: 2,
  iron: 4
});

const RESOURCE_KEYS = Object.freeze(["gold", "wood", "food", "stone", "iron"]);
const HORSE_STORAGE_KEY = "horses";
const RESOURCE_ALIASES = Object.freeze({ grain: "food" });
const MAX_OFFLINE_HOURS = 72;

function parseObject(value, fallback = {}) {
  if (typeof value === "string") {
    try { return JSON.parse(value || "{}"); } catch { return { ...fallback }; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : { ...fallback };
}

export function settleEconomy({
  resources: storedResources,
  workerAssignments: storedAssignments,
  buildings: storedBuildings,
  resourceNodes = [],
  lastResourceTick,
  productionRemainders: storedRemainders,
  workerPool = 1800,
  storedStorageCapacity = 15000,
  now = Date.now()
}) {
  const resources = parseObject(storedResources);
  const assignments = parseObject(storedAssignments);
  const buildings = parseObject(storedBuildings);
  const remainders = parseObject(storedRemainders);
  const centerLevel = Math.max(1, Math.min(10, Number(buildings["1"]?.level) || 1));
  const templeLevel = Math.max(1, Math.min(10, Number(buildings["7"]?.level) || 1));
  const lumberyardLevel = Math.max(1, Math.min(10, Number(buildings["6"]?.level) || 1));
  const stableLevel = Math.max(1, Math.min(10, Number(buildings["3"]?.level) || 1));
  const horseProductionPerHour = Math.round(Math.min(9, stableLevel) * 1000 / 9);
  const lumberyardMultiplier = 1 + (lumberyardLevel - 1) * 0.05;
  const storageCapacity = Math.max(15000, Math.floor(Number(storedStorageCapacity) || 15000));
  const previousTick = lastResourceTick ? new Date(lastResourceTick).getTime() : now;
  const safePreviousTick = Number.isFinite(previousTick) ? previousTick : now;
  const elapsedMs = Math.max(0, Math.min(now - safePreviousTick, MAX_OFFLINE_HOURS * 3600000));
  const elapsedHours = elapsedMs / 3600000;
  const workerProductionPerHour = templeLevel * 25;
  const exactWorkers = workerProductionPerHour * elapsedHours + Math.max(0, Number(remainders.workers) || 0);
  const newWorkers = Math.floor(exactWorkers);
  remainders.workers = Number((exactWorkers - newWorkers).toFixed(8));
  const settledWorkerPool = Math.max(0, Math.floor(Number(workerPool) || 0)) + newWorkers;
  const lastTick = now;
  const productionPerHour = Object.fromEntries(RESOURCE_KEYS.map(key => [key, 0]));
  productionPerHour[HORSE_STORAGE_KEY] = horseProductionPerHour;
  const nodeById = new Map(resourceNodes.map(node => [String(node.id), node]));

  for (const [workerKey, rawCount] of Object.entries(assignments)) {
    const count = Number(rawCount);
    if (!Number.isSafeInteger(count) || count <= 0) continue;
    let resourceType = workerKey;
    let nodeMultiplier = 1;
    const nodeMatch = /^mine_([1-9]\d*)$/.exec(workerKey);
    if (nodeMatch) {
      const node = nodeById.get(nodeMatch[1]);
      if (!node) continue;
      resourceType = String(node.resource_type);
      nodeMultiplier = 1 + Math.max(0, Math.min(10, Number(node.yield_level) || 1) - 1) * 0.1;
    }
    const resourceKey = RESOURCE_ALIASES[resourceType] || resourceType;
    const rate = RESOURCE_PRODUCTION_PER_WORKER_HOUR[resourceType];
    if (!RESOURCE_KEYS.includes(resourceKey) || !Number.isFinite(rate)) continue;
    const buildingMultiplier = resourceKey === "wood" ? lumberyardMultiplier : 1;
    productionPerHour[resourceKey] += count * rate * nodeMultiplier * buildingMultiplier;
  }

  const centerMultiplier = 1 + (centerLevel - 1) * 0.05;
  const productionBreakdown = [];
  for (const [workerKey, rawCount] of Object.entries(assignments)) {
    const workers = Number(rawCount);
    if (!Number.isSafeInteger(workers) || workers <= 0) continue;
    let resourceType = workerKey;
    let nodeId = null;
    let yieldLevel = 1;
    const nodeMatch = /^mine_([1-9]\d*)$/.exec(workerKey);
    if (nodeMatch) {
      const node = nodeById.get(nodeMatch[1]);
      if (!node) continue;
      resourceType = String(node.resource_type);
      nodeId = nodeMatch[1];
      yieldLevel = Math.max(1, Math.min(10, Number(node.yield_level) || 1));
    }
    const resourceKey = RESOURCE_ALIASES[resourceType] || resourceType;
    const workerBaseRate = RESOURCE_PRODUCTION_PER_WORKER_HOUR[resourceType];
    if (!RESOURCE_KEYS.includes(resourceKey) || !Number.isFinite(workerBaseRate)) continue;
    const nodeMultiplier = 1 + (yieldLevel - 1) * 0.1;
    productionBreakdown.push({
      key: workerKey,
      nodeId,
      resourceType: resourceKey,
      workers,
      yieldLevel,
      workerBaseRate,
      nodeMultiplier: Number(nodeMultiplier.toFixed(2)),
      centerMultiplier: Number(centerMultiplier.toFixed(2)),
      hourlyProduction: Number((workers * workerBaseRate * nodeMultiplier * centerMultiplier * (resourceKey === "wood" ? lumberyardMultiplier : 1)).toFixed(2))
    });
  }

  const productionApplied = {};
  for (const key of RESOURCE_KEYS) {
    const exact = productionPerHour[key] * centerMultiplier * elapsedHours + Math.max(0, Number(remainders[key]) || 0);
    const whole = Math.floor(exact);
    remainders[key] = Number((exact - whole).toFixed(8));
    const before = Math.max(0, Number(resources[key]) || 0);
    const after = Math.min(storageCapacity, before + whole);
    resources[key] = after;
    productionApplied[key] = after - before;
    productionPerHour[key] = Number((productionPerHour[key] * centerMultiplier).toFixed(2));
  }

  return {
    resources,
    remainders,
    productionPerHour,
    productionBreakdown,
    workerPool: settledWorkerPool,
    workerProductionPerHour,
    workersProduced: newWorkers,
    productionApplied,
    storageCapacity,
    lumberyardBonusPercent: (lumberyardLevel - 1) * 5,\n    stableLevel,\n    horseProductionPerHour,
    lastResourceTick: new Date(lastTick).toISOString()
  };
}
