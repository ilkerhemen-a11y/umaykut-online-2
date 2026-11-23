export const RESOURCE_PRODUCTION_PER_WORKER_HOUR = Object.freeze({
  grain: 12,
  wood: 10,
  stone: 6,
  gold: 2,
  iron: 4
});

const RESOURCE_KEYS = Object.freeze(["gold", "wood", "food", "stone", "iron"]);
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
  now = Date.now()
}) {
  const resources = parseObject(storedResources);
  const assignments = parseObject(storedAssignments);
  const buildings = parseObject(storedBuildings);
  const remainders = parseObject(storedRemainders);
  const warehouseLevel = Math.max(1, Math.min(10, Number(buildings["9"]?.level) || 1));
  const centerLevel = Math.max(1, Math.min(10, Number(buildings["1"]?.level) || 1));
  const storageCapacity = 15000 + (warehouseLevel - 1) * 10000;
  const previousTick = lastResourceTick ? new Date(lastResourceTick).getTime() : now;
  const safePreviousTick = Number.isFinite(previousTick) ? previousTick : now;
  const elapsedMs = Math.max(0, Math.min(now - safePreviousTick, MAX_OFFLINE_HOURS * 3600000));
  const elapsedHours = elapsedMs / 3600000;
  const lastTick = now;
  const productionPerHour = Object.fromEntries(RESOURCE_KEYS.map(key => [key, 0]));
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
    productionPerHour[resourceKey] += count * rate * nodeMultiplier;
  }

  const centerMultiplier = 1 + (centerLevel - 1) * 0.05;
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
    productionApplied,
    storageCapacity,
    lastResourceTick: new Date(lastTick).toISOString()
  };
}
