import {
  bearerToken, sessionTokenHash, verifySessionToken
} from "./auth.js";

const RESOURCES = ["wood", "food", "iron", "gold"];
const UNIT_BASE = {
  scout: { name: "Casus", icon: "🕵️", building: "barracks", level: 2, attack: 8, infantryDefense: 8, cavalryDefense: 6, speed: 12, carry: 0, cost: { wood: 45, food: 35, iron: 10 } },
  infantry: { name: "Piyade", icon: "🪓", building: "barracks", level: 1, attack: 28, infantryDefense: 24, cavalryDefense: 18, speed: 6, carry: 30, cost: { wood: 35, food: 45, iron: 15 } },
  archer: { name: "Okçu", icon: "🏹", building: "barracks", level: 3, attack: 34, infantryDefense: 15, cavalryDefense: 12, speed: 7, carry: 20, cost: { wood: 55, food: 35, iron: 20 } },
  shield: { name: "Kalkanlı", icon: "🛡️", building: "barracks", level: 5, attack: 20, infantryDefense: 42, cavalryDefense: 35, speed: 5, carry: 25, cost: { wood: 30, food: 60, iron: 45 } },
  guard: { name: "Elit Muhafız", icon: "⚔️", building: "barracks", level: 10, attack: 58, infantryDefense: 48, cavalryDefense: 40, speed: 6, carry: 35, cost: { wood: 75, food: 90, iron: 70, gold: 10 } },
  light_cavalry: { name: "Hafif Süvari", icon: "🐎", building: "stable", level: 1, attack: 42, infantryDefense: 18, cavalryDefense: 22, speed: 14, carry: 70, cost: { wood: 45, food: 90, iron: 35 } },
  mounted_archer: { name: "Atlı Okçu", icon: "🎯", building: "stable", level: 5, attack: 48, infantryDefense: 24, cavalryDefense: 20, speed: 16, carry: 55, cost: { wood: 75, food: 100, iron: 30 } },
  heavy_cavalry: { name: "Ağır Süvari", icon: "🐴", building: "stable", level: 10, attack: 76, infantryDefense: 48, cavalryDefense: 55, speed: 9, carry: 90, cost: { wood: 90, food: 130, iron: 100, gold: 15 } }
};
const FACTIONS = {
  gokturk: { name: "Göktürk", bonuses: { archerAttack: 1.10, cavalrySpeed: 1, infantryDefense: 1 } },
  hun: { name: "Hun", bonuses: { archerAttack: 1, cavalrySpeed: 1.15, infantryDefense: 1 } },
  seljuk: { name: "Selçuklu", bonuses: { archerAttack: 1, cavalrySpeed: 1, infantryDefense: 1.10 } }
};
const FACTION_UNITS = {
  gokturk: {
    infantry: { name: "Türk Savaşçısı", icon: "🗡️", attack: 30 },
    archer: { name: "Börü Okçusu", icon: "🏹", attack: 38 },
    shield: { name: "Tigin Kalkanlısı", icon: "🛡️", infantryDefense: 45 },
    guard: { name: "Börü Muhafızı", icon: "⚔️", attack: 62 },
    light_cavalry: { name: "Türk Akıncısı", icon: "🐎", speed: 15 },
    mounted_archer: { name: "Börü Atlı Okçusu", icon: "🎯", attack: 53 },
    heavy_cavalry: { name: "Tigin Süvarisi", icon: "🐴", attack: 80 }
  },
  hun: {
    infantry: { name: "Toygun", icon: "🪓", attack: 35, infantryDefense: 25, cavalryDefense: 15, speed: 16, carry: 30, portrait: "/assets/units/hun/portraits.webp", portraitIndex: 0 },
    archer: { name: "Kemankeş", icon: "🏹", attack: 60, comboAttack: 30, comboHits: 2, infantryDefense: 80, cavalryDefense: 35, speed: 16, carry: 30, portrait: "/assets/units/hun/portraits.webp", portraitIndex: 1 },
    shield: { name: "Tarık", icon: "🛡️", attack: 20, infantryDefense: 25, cavalryDefense: 90, speed: 14, carry: 25, portrait: "/assets/units/hun/portraits.webp", portraitIndex: 2 },
    guard: { name: "Barlas", icon: "⚔️", attack: 120, infantryDefense: 60, cavalryDefense: 90, speed: 24, carry: 80, portrait: "/assets/units/hun/portraits.webp", portraitIndex: 3 },
    light_cavalry: { name: "Tunga", icon: "🐎", attack: 65, infantryDefense: 50, cavalryDefense: 110, speed: 32, carry: 40, portrait: "/assets/units/hun/portraits.webp", portraitIndex: 4 },
    mounted_archer: { name: "Talakan", icon: "🎯", attack: 95, infantryDefense: 85, cavalryDefense: 60, speed: 50, carry: 120, portrait: "/assets/units/hun/portraits.webp", portraitIndex: 5 },
    heavy_cavalry: { name: "Tarkan", icon: "🐴", attack: 150, infantryDefense: 110, cavalryDefense: 80, speed: 40, carry: 60, portrait: "/assets/units/hun/portraits.webp", portraitIndex: 6 }
  },
  seljuk: {
    infantry: { name: "Selçuklu Gulamı", icon: "🗡️", attack: 29, infantryDefense: 27 },
    archer: { name: "Selçuklu Okçusu", icon: "🏹", attack: 33 },
    shield: { name: "Zırhlı Gulam", icon: "🛡️", infantryDefense: 48, cavalryDefense: 39 },
    guard: { name: "Gulam Muhafızı", icon: "⚔️", attack: 60, infantryDefense: 52 },
    light_cavalry: { name: "Hafif Sipahi", icon: "🐎", speed: 13, cavalryDefense: 25 },
    mounted_archer: { name: "Selçuklu Atlı Okçusu", icon: "🎯", attack: 46 },
    heavy_cavalry: { name: "Ağır Sipahi", icon: "🐴", attack: 82, infantryDefense: 52, cavalryDefense: 60 }
  }
};

const TROOP_UPGRADE_MAX_LEVEL = 10;
const TROOP_UPGRADE_BONUS_PER_LEVEL = 0.05;
const TROOP_UPGRADE_STATS = new Set(["attack", "infantryDefense", "cavalryDefense"]);
export function normalizeTroopUpgrades(value = {}) {
  const source = typeof value === "string" ? parseJson(value, {}) : (value || {});
  const result = {};
  for (const [unitId, levels] of Object.entries(source)) {
    if (!/^(scout|infantry|archer|shield|guard|light_cavalry|mounted_archer|heavy_cavalry)$/.test(unitId)) continue;
    const safe = {};
    for (const stat of TROOP_UPGRADE_STATS) {
      const level = Number(levels?.[stat] || 0);
      if (Number.isSafeInteger(level) && level >= 0 && level <= TROOP_UPGRADE_MAX_LEVEL) safe[stat] = level;
    }
    if (Object.keys(safe).length) result[unitId] = safe;
  }
  return result;
}
export function getTroopUpgradeCost(stat, currentLevel) {
  if (!TROOP_UPGRADE_STATS.has(stat)) throw new RangeError("Geçersiz asker geliştirmesi.");
  const level = Number(currentLevel);
  if (!Number.isSafeInteger(level) || level < 0 || level >= TROOP_UPGRADE_MAX_LEVEL) {
    throw new RangeError("Bu asker özelliği en yüksek geliştirme seviyesinde.");
  }
  const scale = Math.pow(1.5, level);
  const base = stat === "attack"
    ? { gold: 100, iron: 80, wood: 40 }
    : { gold: 80, iron: 100, wood: 40 };
  return Object.fromEntries(Object.entries(base).map(([key, amount]) => [key, Math.ceil(amount * scale)]));
}
export function getTroopCatalog(factionId, buildings = {}, troopUpgrades = {}) {
  const faction = FACTIONS[factionId] ? factionId : "gokturk";
  const upgrades = normalizeTroopUpgrades(troopUpgrades);
  return Object.entries(UNIT_BASE).map(([id, base]) => {
    const unique = FACTION_UNITS[faction][id] || {};
    const unit = { ...base, ...unique };
    // V2 persists buildings by fixed numeric slot; also accept type-keyed data for compatibility.
    const buildingState = buildings[base.building] || Object.values(buildings).find(item => item?.type === base.building);
    const level = Number(buildingState?.level || 1);
    const blacksmithState = buildings.blacksmith || Object.values(buildings).find(item => item?.type === "blacksmith");
    const blacksmithLevel = Math.max(1, Math.min(10, Number(blacksmithState?.level) || 1));
    const blacksmithMultiplier = 1 + (blacksmithLevel - 1) * 0.02;
    const unitUpgrade = upgrades[id] || {};
    const attackUpgradeLevel = unitUpgrade.attack || 0;
    const infantryUpgradeLevel = unitUpgrade.infantryDefense || 0;
    const cavalryUpgradeLevel = unitUpgrade.cavalryDefense || 0;
    const attackMultiplier = 1 + attackUpgradeLevel * TROOP_UPGRADE_BONUS_PER_LEVEL;
    const attack = Math.round(unit.attack * attackMultiplier * (faction === "gokturk" && id.includes("archer") ? 1.10 : 1) * blacksmithMultiplier);
    const infantryDefense = Math.round(unit.infantryDefense * (1 + infantryUpgradeLevel * TROOP_UPGRADE_BONUS_PER_LEVEL) * (faction === "seljuk" ? 1.10 : 1) * blacksmithMultiplier);
    const cavalryDefense = Math.round(unit.cavalryDefense * (1 + cavalryUpgradeLevel * TROOP_UPGRADE_BONUS_PER_LEVEL) * blacksmithMultiplier);
    const comboAttack = unit.comboAttack ? Math.round(unit.comboAttack * attackMultiplier * (faction === "gokturk" && id.includes("archer") ? 1.10 : 1) * blacksmithMultiplier) : undefined;
    const speed = Math.round(unit.speed * (faction === "hun" && base.building === "stable" && !unit.portrait ? 1.15 : 1));
    return {
      id, name: unit.name, icon: unit.icon, portrait: unit.portrait, portraitIndex: unit.portraitIndex, building: base.building,
      requiredLevel: base.level, unlocked: level >= base.level,
      buildingLevel: level, attack, ...(comboAttack ? { comboAttack, comboHits: unit.comboHits } : {}), infantryDefense,
      cavalryDefense, speed, carry: unit.carry, cost: { ...base.cost },
      upgradeLevels: { attack: attackUpgradeLevel, infantryDefense: infantryUpgradeLevel, cavalryDefense: cavalryUpgradeLevel },
      upgradeCosts: {
        attack: attackUpgradeLevel < TROOP_UPGRADE_MAX_LEVEL ? getTroopUpgradeCost("attack", attackUpgradeLevel) : null,
        infantryDefense: infantryUpgradeLevel < TROOP_UPGRADE_MAX_LEVEL ? getTroopUpgradeCost("infantryDefense", infantryUpgradeLevel) : null,
        cavalryDefense: cavalryUpgradeLevel < TROOP_UPGRADE_MAX_LEVEL ? getTroopUpgradeCost("cavalryDefense", cavalryUpgradeLevel) : null
      },
      blacksmithLevel, blacksmithBonusPercent: (blacksmithLevel - 1) * 2
    };
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
function parseJson(value, fallback) {
  if (typeof value === "string") return JSON.parse(value || JSON.stringify(fallback));
  return value ?? fallback;
}
export function settleTrainingQueue(troops, queue, now = Date.now()) {
  // Training time is disabled: any legacy queued units join the army immediately.
  const nextTroops = { ...troops };
  let changed = false;
  for (const job of queue) {
    const amount = Number(job.amount || 0);
    if (typeof job.unitId === "string" && Number.isSafeInteger(amount) && amount > 0) {
      nextTroops[job.unitId] = Number(nextTroops[job.unitId] || 0) + amount;
    }
    changed = true;
  }
  return { troops: nextTroops, trainingQueue: [], changed };
}
function armyPower(troops, catalog) {
  const byId = Object.fromEntries(catalog.map(unit => [unit.id, unit]));
  return Object.entries(troops).reduce((sum, [id, count]) => sum + Number(count || 0) * Number(byId[id]?.attack || 0), 0);
}
export async function handleArmyRequest({ req, res, url, pool, sessionSecret }) {
  if (!url.pathname.startsWith("/api/game/army")) return false;
  if (!pool) { sendJson(res, 503, { error: "Oyun kayıt servisi henüz yapılandırılmadı." }); return true; }
  if (!sessionSecret || sessionSecret.length < 32) { sendJson(res, 503, { error: "Oturum güvenlik ayarı eksik." }); return true; }
  if (!["GET", "POST"].includes(req.method)) { res.setHeader("allow", "GET, POST"); sendJson(res, 405, { error: "Yöntem desteklenmiyor." }); return true; }
  const token = bearerToken(req);
  const session = verifySessionToken(token, sessionSecret);
  if (!session) { sendJson(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." }); return true; }
  const valid = await pool.query(
    "SELECT p.id FROM umaykut_v2.players p JOIN umaykut_v2.player_sessions s ON s.player_id=p.id WHERE p.id=$1 AND s.token_hash=$2 AND s.expires_at>NOW()",
    [session.id, sessionTokenHash(token)]
  );
  if (!valid.rowCount) { sendJson(res, 401, { error: "Oyuncu oturumu bulunamadı." }); return true; }

  const client = await pool.connect();
  let transaction = false;
  try {
    await client.query("BEGIN"); transaction = true;
    await client.query("INSERT INTO umaykut_v2.player_game_state(player_id) VALUES($1) ON CONFLICT(player_id) DO NOTHING", [session.id]);
    const result = await client.query(
      "SELECT faction_id, resources, buildings, troops, training_queue, troop_upgrades, worker_pool, worker_assignments FROM umaykut_v2.player_game_state WHERE player_id=$1 FOR UPDATE",
      [session.id]
    );
    const row = result.rows[0];
    const resources = parseJson(row.resources, {});
    const workerPool = Math.max(0, Number(row.worker_pool ?? 1800) || 0);
    const workerAssignments = parseJson(row.worker_assignments, {});
    const assignedWorkers = Object.values(workerAssignments).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    const buildings = parseJson(row.buildings, {});
    let troops = parseJson(row.troops, {});
    let troopUpgrades = normalizeTroopUpgrades(row.troop_upgrades);
    const storedQueue = parseJson(row.training_queue, []);
    const settledQueue = settleTrainingQueue(troops, storedQueue);
    troops = settledQueue.troops;
    let idleWorkers = Math.max(0, workerPool - assignedWorkers - Object.values(troops).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0));
    let queue = settledQueue.trainingQueue;
    if (settledQueue.changed) {
      await client.query("UPDATE umaykut_v2.player_game_state SET troops=$2::jsonb, training_queue=$3::jsonb WHERE player_id=$1",
        [session.id, JSON.stringify(troops), JSON.stringify(queue)]);
    }
    const factionId = FACTIONS[row.faction_id] ? row.faction_id : "gokturk";
    let catalog = getTroopCatalog(factionId, buildings, troopUpgrades);

    if (req.method === "POST" && url.pathname === "/api/game/army/upgrade") {
      let body = "";
      for await (const chunk of req) { body += chunk; if (body.length > 8192) throw new Error("İstek çok büyük."); }
      const input = JSON.parse(body || "{}");
      const unit = catalog.find(item => item.id === input.unitId);
      const stat = input.stat;
      if (!unit) { await client.query("ROLLBACK"); transaction = false; sendJson(res, 400, { error: "Geçersiz asker türü." }); return true; }
      if (!TROOP_UPGRADE_STATS.has(stat)) { await client.query("ROLLBACK"); transaction = false; sendJson(res, 400, { error: "Geçersiz geliştirme türü." }); return true; }
      const currentLevel = Number(unit.upgradeLevels?.[stat] || 0);
      if (currentLevel >= TROOP_UPGRADE_MAX_LEVEL) { await client.query("ROLLBACK"); transaction = false; sendJson(res, 409, { error: "Bu özellik en yüksek geliştirme seviyesinde." }); return true; }
      const cost = getTroopUpgradeCost(stat, currentLevel);
      const missing = Object.fromEntries(Object.entries(cost).filter(([key, value]) => Number(resources[key] || 0) < value).map(([key, value]) => [key, value - Number(resources[key] || 0)]));
      if (Object.keys(missing).length) { await client.query("ROLLBACK"); transaction = false; sendJson(res, 409, { error: "Geliştirme için yeterli kaynak yok.", missing, cost }); return true; }
      for (const [key, value] of Object.entries(cost)) resources[key] = Number(resources[key] || 0) - value;
      troopUpgrades[unit.id] = { ...(troopUpgrades[unit.id] || {}), [stat]: currentLevel + 1 };
      catalog = getTroopCatalog(factionId, buildings, troopUpgrades);
      await client.query("UPDATE umaykut_v2.player_game_state SET resources=$2::jsonb, troop_upgrades=$3::jsonb, updated_at=NOW() WHERE player_id=$1",
        [session.id, JSON.stringify(resources), JSON.stringify(troopUpgrades)]);
    }
    if (req.method === "POST" && url.pathname === "/api/game/army/recruit") {
      let body = "";
      for await (const chunk of req) { body += chunk; if (body.length > 8192) throw new Error("İstek çok büyük."); }
      const input = JSON.parse(body || "{}");
      const unit = catalog.find(item => item.id === input.unitId);
      const amount = Number(input.amount);
      if (!unit) { await client.query("ROLLBACK"); transaction = false; sendJson(res, 400, { error: "Geçersiz asker türü." }); return true; }
      if (!unit.unlocked) { await client.query("ROLLBACK"); transaction = false; sendJson(res, 409, { error: unit.name + " için " + (unit.building === "barracks" ? "Kışla" : "Ahır") + " seviyesi " + unit.requiredLevel + " olmalı." }); return true; }
      if (!Number.isSafeInteger(amount) || amount < 1) { await client.query("ROLLBACK"); transaction = false; sendJson(res, 400, { error: "Yetiştirilecek asker sayısı en az 1 olmalıdır.", idleWorkers }); return true; }
      if (amount > idleWorkers) { await client.query("ROLLBACK"); transaction = false; sendJson(res, 409, { error: "Boşta yalnızca " + idleWorkers + " işçin var. Daha fazla asker yetiştiremezsin.", idleWorkers }); return true; }
      const cost = Object.fromEntries(Object.entries(unit.cost).map(([key, value]) => [key, value * amount]));
      const missing = Object.fromEntries(Object.entries(cost).filter(([key, value]) => Number(resources[key] || 0) < value).map(([key, value]) => [key, value - Number(resources[key] || 0)]));
      if (Object.keys(missing).length) { await client.query("ROLLBACK"); transaction = false; sendJson(res, 409, { error: "Asker yetiştirmek için yeterli kaynak yok.", missing, cost }); return true; }
      for (const [key, value] of Object.entries(cost)) resources[key] = Number(resources[key] || 0) - value;
      troops[unit.id] = Number(troops[unit.id] || 0) + amount;
      idleWorkers = Math.max(0, workerPool - assignedWorkers - Object.values(troops).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0));
      queue = [];
      await client.query("UPDATE umaykut_v2.player_game_state SET resources=$2::jsonb, training_queue=$3::jsonb, troops=$4::jsonb, updated_at=NOW() WHERE player_id=$1",
        [session.id, JSON.stringify(resources), JSON.stringify(queue), JSON.stringify(troops)]);
    }
    await client.query("COMMIT"); transaction = false;
    const latest = await pool.query("SELECT resources FROM umaykut_v2.player_game_state WHERE player_id=$1", [session.id]);
    const finalResources = parseJson(latest.rows[0]?.resources, resources);
    sendJson(res, 200, {
      factionId, factionName: FACTIONS[factionId].name, troops, troopUpgrades,
      workerPool, assignedWorkers, idleWorkers,
      trainingQueue: queue.map(job => ({ ...job, name: catalog.find(unit => unit.id === job.unitId)?.name || job.unitId })), catalog,
      totalUnits: Object.values(troops).reduce((sum, count) => sum + Number(count || 0), 0),
      armyPower: armyPower(troops, catalog), resources: finalResources,
      serverNow: new Date().toISOString()
    });
    return true;
  } catch (error) {
    if (transaction) { try { await client.query("ROLLBACK"); } catch {} }
    console.error("V2 army request failed", { message: String(error.message || "unknown").slice(0, 180) });
    sendJson(res, error.status || 400, { error: error.status ? error.message : "Ordu işlemi tamamlanamadı." });
    return true;
  } finally {
    client.release();
  }
}
