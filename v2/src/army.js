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
    infantry: { name: "Toygun", icon: "🛡️", attack: 35, infantryDefense: 25, cavalryDefense: 15, speed: 16 },
    archer: { name: "Kemankeş", icon: "🏹", attack: 60, attackDisplay: "30 × 2", infantryDefense: 80, cavalryDefense: 35, speed: 16 },
    shield: { name: "Tarık", icon: "🔱", attack: 20, infantryDefense: 25, cavalryDefense: 90, speed: 14 },
    guard: { name: "Barlas", icon: "⚔️", attack: 120, attackDisplay: "120–130", infantryDefense: 60, cavalryDefense: 90, speed: 24 },
    light_cavalry: { name: "Talakan", icon: "🐎", attack: 95, infantryDefense: 85, cavalryDefense: 60, speed: 50 },
    mounted_archer: { name: "Tunga", icon: "🐴", attack: 65, infantryDefense: 50, cavalryDefense: 110, speed: 32 },
    heavy_cavalry: { name: "Tarkan", icon: "🐴", attack: 150, infantryDefense: 110, cavalryDefense: 80, speed: 40 }
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

export function getTroopCatalog(factionId, buildings = {}) {
  const faction = FACTIONS[factionId] ? factionId : "gokturk";
  return Object.entries(UNIT_BASE).map(([id, base]) => {
    const unique = FACTION_UNITS[faction][id] || {};
    const unit = { ...base, ...unique };
    // V2 persists buildings by fixed numeric slot; also accept type-keyed data for compatibility.
    const buildingState = buildings[base.building] || Object.values(buildings).find(item => item?.type === base.building);
    const level = Number(buildingState?.level || 1);
    const blacksmithState = buildings.blacksmith || Object.values(buildings).find(item => item?.type === "blacksmith");
    const blacksmithLevel = Math.max(1, Math.min(10, Number(blacksmithState?.level) || 1));
    const blacksmithMultiplier = 1 + (blacksmithLevel - 1) * 0.02;
    const attack = Math.round(unit.attack * (faction === "gokturk" && id.includes("archer") ? 1.10 : 1) * blacksmithMultiplier);
    const infantryDefense = Math.round(unit.infantryDefense * (faction === "seljuk" ? 1.10 : 1) * blacksmithMultiplier);
    const speed = Math.round(unit.speed);
    return {
      id, name: unit.name, icon: unit.icon, attackDisplay: unit.attackDisplay || null, building: base.building,
      requiredLevel: base.level, unlocked: level >= base.level,
      buildingLevel: level, attack, infantryDefense,
      cavalryDefense: Math.round(unit.cavalryDefense * blacksmithMultiplier), speed, carry: unit.carry, cost: { ...base.cost },
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
      "SELECT faction_id, resources, buildings, troops, training_queue, worker_pool, worker_assignments FROM umaykut_v2.player_game_state WHERE player_id=$1 FOR UPDATE",
      [session.id]
    );
    const row = result.rows[0];
    const resources = parseJson(row.resources, {});
    const workerPool = Math.max(0, Number(row.worker_pool ?? 1800) || 0);
    const workerAssignments = parseJson(row.worker_assignments, {});
    const assignedWorkers = Object.values(workerAssignments).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    const buildings = parseJson(row.buildings, {});
    let troops = parseJson(row.troops, {});
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
    const catalog = getTroopCatalog(factionId, buildings);

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
      factionId, factionName: FACTIONS[factionId].name, troops,
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
