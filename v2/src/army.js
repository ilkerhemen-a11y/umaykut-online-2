import {
  bearerToken, sessionTokenHash, verifySessionToken
} from "./auth.js";

const RESOURCES = ["wood", "food", "iron", "gold"];
const UNIT_BASE = {
  infantry: { name: "Piyade", icon: "🪓", building: "barracks", level: 1, attack: 28, infantryDefense: 24, cavalryDefense: 18, speed: 6, carry: 30, seconds: 20, cost: { wood: 35, food: 45, iron: 15 } },
  archer: { name: "Okçu", icon: "🏹", building: "barracks", level: 3, attack: 34, infantryDefense: 15, cavalryDefense: 12, speed: 7, carry: 20, seconds: 25, cost: { wood: 55, food: 35, iron: 20 } },
  shield: { name: "Kalkanlı", icon: "🛡️", building: "barracks", level: 5, attack: 20, infantryDefense: 42, cavalryDefense: 35, speed: 5, carry: 25, seconds: 35, cost: { wood: 30, food: 60, iron: 45 } },
  guard: { name: "Elit Muhafız", icon: "⚔️", building: "barracks", level: 10, attack: 58, infantryDefense: 48, cavalryDefense: 40, speed: 6, carry: 35, seconds: 55, cost: { wood: 75, food: 90, iron: 70, gold: 10 } },
  light_cavalry: { name: "Hafif Süvari", icon: "🐎", building: "stable", level: 1, attack: 42, infantryDefense: 18, cavalryDefense: 22, speed: 14, carry: 70, seconds: 40, cost: { wood: 45, food: 90, iron: 35 } },
  mounted_archer: { name: "Atlı Okçu", icon: "🎯", building: "stable", level: 5, attack: 48, infantryDefense: 24, cavalryDefense: 20, speed: 16, carry: 55, seconds: 50, cost: { wood: 75, food: 100, iron: 30 } },
  heavy_cavalry: { name: "Ağır Süvari", icon: "🐴", building: "stable", level: 10, attack: 76, infantryDefense: 48, cavalryDefense: 55, speed: 9, carry: 90, seconds: 75, cost: { wood: 90, food: 130, iron: 100, gold: 15 } }
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
    infantry: { name: "Hun Savaşçısı", icon: "🪓", attack: 27 },
    archer: { name: "Hun Yaycısı", icon: "🏹", attack: 35 },
    shield: { name: "Hun Kalkanlısı", icon: "🛡️", infantryDefense: 39 },
    guard: { name: "Hun Seçkin Akıncısı", icon: "⚔️", attack: 57 },
    light_cavalry: { name: "Hun Akıncısı", icon: "🐎", speed: 17 },
    mounted_archer: { name: "Hun Atlı Okçusu", icon: "🎯", attack: 50, speed: 18 },
    heavy_cavalry: { name: "Hun Ağır Süvarisi", icon: "🐴", attack: 73, speed: 11 }
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
    const level = Number(buildings[base.building]?.level || 1);
    const attack = Math.round(unit.attack * (faction === "gokturk" && id.includes("archer") ? 1.10 : 1));
    const infantryDefense = Math.round(unit.infantryDefense * (faction === "seljuk" ? 1.10 : 1));
    const speed = Math.round(unit.speed * (faction === "hun" && base.building === "stable" ? 1.15 : 1));
    return {
      id, name: unit.name, icon: unit.icon, building: base.building,
      requiredLevel: base.level, unlocked: level >= base.level,
      buildingLevel: level, attack, infantryDefense,
      cavalryDefense: unit.cavalryDefense, speed, carry: unit.carry,
      secondsPerUnit: base.seconds, cost: { ...base.cost }
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
function armyPower(troops, catalog) {
  const byId = Object.fromEntries(catalog.map(unit => [unit.id, unit]));
  return Object.entries(troops).reduce((sum, [id, count]) => sum + Number(count || 0) * Number(byId[id]?.attack || 0), 0);
}
function settleTraining(troops, queue, now) {
  const remaining = [];
  const completed = [];
  const nextTroops = { ...troops };
  for (const job of queue) {
    if (Date.parse(job.completesAt) <= now) {
      nextTroops[job.unitId] = Number(nextTroops[job.unitId] || 0) + Number(job.amount);
      completed.push(job);
    } else remaining.push(job);
  }
  return { troops: nextTroops, queue: remaining, completed };
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
      "SELECT faction_id, resources, buildings, troops, training_queue FROM umaykut_v2.player_game_state WHERE player_id=$1 FOR UPDATE",
      [session.id]
    );
    const row = result.rows[0];
    const resources = parseJson(row.resources, {});
    const buildings = parseJson(row.buildings, {});
    let troops = parseJson(row.troops, {});
    let queue = parseJson(row.training_queue, []);
    const settled = settleTraining(troops, queue, Date.now());
    troops = settled.troops; queue = settled.queue;
    if (settled.completed.length) {
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
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100) { await client.query("ROLLBACK"); transaction = false; sendJson(res, 400, { error: "Bir seferde 1 ile 100 arasında asker yetiştirebilirsin." }); return true; }
      const cost = Object.fromEntries(Object.entries(unit.cost).map(([key, value]) => [key, value * amount]));
      const missing = Object.fromEntries(Object.entries(cost).filter(([key, value]) => Number(resources[key] || 0) < value).map(([key, value]) => [key, value - Number(resources[key] || 0)]));
      if (Object.keys(missing).length) { await client.query("ROLLBACK"); transaction = false; sendJson(res, 409, { error: "Asker yetiştirmek için yeterli kaynak yok.", missing, cost }); return true; }
      for (const [key, value] of Object.entries(cost)) resources[key] = Number(resources[key] || 0) - value;
      const now = Date.now();
      const lastCompletion = queue.length ? Math.max(now, ...queue.map(job => Date.parse(job.completesAt))) : now;
      const startedAt = new Date(lastCompletion).toISOString();
      const completesAt = new Date(lastCompletion + unit.secondsPerUnit * amount * 1000).toISOString();
      queue.push({ id: randomUUID(), unitId: unit.id, name: unit.name, amount, startedAt, completesAt, secondsPerUnit: unit.secondsPerUnit });
      await client.query("UPDATE umaykut_v2.player_game_state SET resources=$2::jsonb, troops=$3::jsonb, training_queue=$4::jsonb, updated_at=NOW() WHERE player_id=$1",
        [session.id, JSON.stringify(resources), JSON.stringify(troops), JSON.stringify(queue)]);
    }
    await client.query("COMMIT"); transaction = false;
    const latest = await pool.query("SELECT resources FROM umaykut_v2.player_game_state WHERE player_id=$1", [session.id]);
    const finalResources = parseJson(latest.rows[0]?.resources, resources);
    sendJson(res, 200, {
      factionId, factionName: FACTIONS[factionId].name, troops,
      trainingQueue: queue, catalog,
      totalUnits: Object.values(troops).reduce((sum, count) => sum + Number(count || 0), 0),
      armyPower: armyPower(troops, catalog), resources: finalResources,
      completedTraining: settled.completed.length, serverNow: new Date().toISOString()
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
