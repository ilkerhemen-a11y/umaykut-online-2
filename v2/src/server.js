import http from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { resolveBattle } from "./combat.js";
import { createPool } from "./database.js";
import { handleArmyRequest, getTroopCatalog, settleTrainingQueue } from "./army.js";
import {
  bearerToken,
  createSessionToken,
  hashPassword,
  sessionTokenHash,
  validateRegistration,
  verifyPassword,
  verifySessionToken
} from "./auth.js";

const config = loadConfig();
const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "../public");
const assetRoot = resolve(here, "../../public/assets");
const INITIAL_RESOURCES = Object.freeze({gold:1650,wood:6900,food:9350,stone:7480,iron:8040,horses:100});
const INITIAL_BUILDINGS = Object.freeze({
  "1": {type:"center",level:1},
  "2": {type:"barracks",level:1},
  "3": {type:"stable",level:1},
  "4": {type:"blacksmith",level:1},
  "5": {type:"school",level:1},
  "6": {type:"lumberyard",level:1},
  "7": {type:"temple",level:1},
  "8": {type:"market",level:1},
  "9": {type:"warehouse",level:1}
});
function normalizeBuildings(stored, { reset = false } = {}) {
  const source = typeof stored === "string" ? JSON.parse(stored || "{}") : (stored || {});
  const normalized = {};
  for (const [slot, initial] of Object.entries(INITIAL_BUILDINGS)) {
    const saved = source[slot];
    const level = Number(saved?.level);
    const valid = !reset && saved?.type === initial.type &&
      Number.isSafeInteger(level) && level >= 1 && level <= 10;
    const upgrade = saved?.upgrade;
    const validUpgrade = valid && upgrade && Number(upgrade.targetLevel) === level + 1 &&
      level < 10 && Number.isFinite(Date.parse(upgrade.startedAt)) &&
      Number.isFinite(Date.parse(upgrade.completesAt)) &&
      Date.parse(upgrade.completesAt) > Date.parse(upgrade.startedAt);
    normalized[slot] = valid
      ? { type: initial.type, level, ...(validUpgrade ? { upgrade } : {}) }
      : { ...initial };
  }
  return normalized;
}

const WALL_MAX_LEVEL = 10;
const WALL_DEFENSE_PER_LEVEL = 5;
const WALL_SHELTER_PER_RESOURCE_PER_LEVEL = 500;
const WALL_UPGRADE_DURATIONS_MS = Object.freeze({2:5*60*1000,3:15*60*1000,4:30*60*1000,5:60*60*1000,6:2*60*60*1000,7:4*60*60*1000,8:8*60*60*1000,9:12*60*60*1000,10:24*60*60*1000});
function normalizeWall(stored){
 const source=typeof stored==="string"?JSON.parse(stored||"{}"):(stored||{});
 const level=Number(source.level);
 const valid=Number.isSafeInteger(level)&&level>=1&&level<=WALL_MAX_LEVEL;
 const upgrade=source.upgrade;
 const validUpgrade=valid&&upgrade&&Number(upgrade.targetLevel)===level+1&&level<WALL_MAX_LEVEL&&Number.isFinite(Date.parse(upgrade.startedAt))&&Number.isFinite(Date.parse(upgrade.completesAt))&&Date.parse(upgrade.completesAt)>Date.parse(upgrade.startedAt);
 let settled=valid?{level,...(validUpgrade?{upgrade}:{})}:{level:1};
 if(settled.upgrade&&Date.parse(settled.upgrade.completesAt)<=Date.now())settled={level:Number(settled.upgrade.targetLevel)};
 return settled;
}
function wallEffects(level){
 const safeLevel=Math.max(1,Math.min(WALL_MAX_LEVEL,Number(level)||1));
 return {defensePercent:safeLevel*WALL_DEFENSE_PER_LEVEL,shelterCapacity:Object.fromEntries(["gold","wood","food","stone","iron"].map(key=>[key,safeLevel*WALL_SHELTER_PER_RESOURCE_PER_LEVEL]))};
}
function wallUpgradeCost(targetLevel){
 if(!Number.isSafeInteger(targetLevel)||targetLevel<2||targetLevel>WALL_MAX_LEVEL)throw new RangeError("Geçersiz hedef sur seviyesi.");
 const scale=Math.pow(1.65,targetLevel-2);
 return {wood:Math.round(250*scale),stone:Math.round(220*scale),iron:Math.round(90*scale),gold:Math.round(100*scale)};
}
function settleWallUpgrade(wall,now=Date.now()){
 const normalized=normalizeWall(wall);
 if(normalized.upgrade&&Date.parse(normalized.upgrade.completesAt)<=now)return {level:normalized.upgrade.targetLevel};
 return normalized;
}

const BUILDING_UPGRADE_DURATIONS_MS = Object.freeze({
  2: 2 * 60 * 1000, 3: 5 * 60 * 1000, 4: 15 * 60 * 1000,
  5: 30 * 60 * 1000, 6: 60 * 60 * 1000, 7: 2 * 60 * 60 * 1000,
  8: 4 * 60 * 60 * 1000, 9: 8 * 60 * 60 * 1000, 10: 12 * 60 * 60 * 1000
});
function buildingUpgradeCost(targetLevel) {
  if (!Number.isSafeInteger(targetLevel) || targetLevel < 2 || targetLevel > 10) throw new RangeError("Geçersiz hedef bina seviyesi.");
  const multiplier = 2 * Math.pow(1.7, targetLevel - 2);
  return { wood: Math.round(30 * multiplier), stone: Math.round(20 * multiplier), iron: Math.round(5 * multiplier) };
}
function settleCompletedBuildingUpgrades(buildings, now = Date.now()) {
  let changed = false;
  const settled = { ...buildings };
  for (const [slot, building] of Object.entries(settled)) {
    if (!building?.upgrade) continue;
    const completesAt = Date.parse(building.upgrade.completesAt);
    if (Number.isFinite(completesAt) && completesAt <= now) {
      settled[slot] = { type: building.type, level: Number(building.upgrade.targetLevel) };
      changed = true;
    }
  }
  return { buildings: settled, changed };
}

const FIXED_BUILDING_TYPES = Object.freeze({
  "1": "center",
  "2": "barracks",
  "3": "stable",
  "4": "blacksmith",
  "5": "school",
  "6": "lumberyard",
  "7": "temple",
  "8": "market",
  "9": "warehouse"
});
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 8192) {
      throw Object.assign(new Error("İstek çok büyük."), { status: 413 });
    }
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw Object.assign(new Error("Geçersiz JSON."), { status: 400 });
  }
}

async function sendStatic(res, root, relative) {
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(root + sep)) {
    return sendJson(res, 400, { error: "Geçersiz dosya yolu." });
  }
  try {
    const data = await readFile(target);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(target).toLowerCase()] || "application/octet-stream",
      "content-length": data.length,
      "x-content-type-options": "nosniff",
      "cache-control": extname(target) === ".html" ? "no-cache" : "public, max-age=300"
    });
    res.end(data);
  } catch {
    return sendJson(res, 404, { error: "Dosya bulunamadı." });
  }
}

export function createServer({ pool = createPool(), sessionSecret = process.env.SESSION_SECRET } = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { status: "ok", app: config.appName, version: config.version });
    }

    if (req.method === "GET" && url.pathname === "/ready") {
      if (!pool) {
        return sendJson(res, 503, { status: "not_ready", databaseConfigured: false });
      }
      try {
        await pool.query("SELECT 1");
        return sendJson(res, 200, { status: "ready", databaseConfigured: true });
      } catch {
        return sendJson(res, 503, { status: "not_ready", databaseConfigured: true });
      }
    }



    if (await handleArmyRequest({ req, res, url, pool, sessionSecret })) return;


    if (url.pathname === "/api/game/players" || url.pathname === "/api/game/attacks" || url.pathname === "/api/game/attack") {
      if (!pool) return sendJson(res,503,{error:"Oyun kayıt servisi henüz yapılandırılmadı."});
      if (!sessionSecret || sessionSecret.length < 32) return sendJson(res,503,{error:"Oturum güvenlik ayarı eksik."});
      const token=bearerToken(req), session=verifySessionToken(token,sessionSecret);
      if(!session)return sendJson(res,401,{error:"Oturum geçersiz veya süresi dolmuş."});
      const valid=await pool.query("SELECT 1 FROM umaykut_v2.player_sessions WHERE player_id=$1 AND token_hash=$2 AND expires_at>NOW()",[session.id,sessionTokenHash(token)]);
      if(!valid.rowCount)return sendJson(res,401,{error:"Oyuncu oturumu bulunamadı."});
      if(req.method==="GET" && url.pathname==="/api/game/players"){
        const result=await pool.query(
          `SELECT p.id,p.username,p.village_name,s.faction_id
           FROM umaykut_v2.players p
           JOIN umaykut_v2.player_game_state s ON s.player_id=p.id
           WHERE p.id<>$1 AND p.village_name IS NOT NULL AND s.faction_id IS NOT NULL
           ORDER BY p.created_at ASC LIMIT 50`,[session.id]);
        return sendJson(res,200,{players:result.rows});
      }
      if(req.method==="GET" && url.pathname==="/api/game/attacks"){
        const due=await pool.query(
          "SELECT id FROM umaykut_v2.player_raids WHERE status='marching' AND arrives_at<=NOW() AND (attacker_id=$1 OR defender_id=$1) ORDER BY arrives_at ASC LIMIT 10",
          [session.id]);
        for(const item of due.rows){
          const client=await pool.connect();let inTx=false;
          try{
            await client.query("BEGIN");inTx=true;
            const raidResult=await client.query("SELECT * FROM umaykut_v2.player_raids WHERE id=$1 FOR UPDATE",[item.id]);
            const raid=raidResult.rows[0];
            if(!raid||raid.status!=="marching"||new Date(raid.arrives_at)>new Date()){
              await client.query("ROLLBACK");inTx=false;continue;
            }
            const ids=[raid.attacker_id,raid.defender_id].sort();
            const states=await client.query(
              `SELECT p.id,p.village_name,s.faction_id,s.resources,s.buildings,s.troops,s.wall
               FROM umaykut_v2.players p JOIN umaykut_v2.player_game_state s ON s.player_id=p.id
               WHERE p.id=ANY($1::uuid[]) ORDER BY p.id FOR UPDATE OF s`,[ids]);
            if(states.rowCount!==2)throw new Error("Savaş taraflarının köy verisi bulunamadı.");
            const attacker=states.rows.find(row=>row.id===raid.attacker_id);
            const defender=states.rows.find(row=>row.id===raid.defender_id);
            const parse=(value,fallback)=>typeof value==="string"?JSON.parse(value||JSON.stringify(fallback)):(value??fallback);
            const attackerTroops=parse(raid.troops,{});
            const defenderTroops=parse(defender.troops,{});
            const attackerBuildings=parse(attacker.buildings,{});
            const defenderBuildings=parse(defender.buildings,{});
            const attackerCatalog=getTroopCatalog(attacker.faction_id,attackerBuildings);
            const defenderCatalog=getTroopCatalog(defender.faction_id,defenderBuildings);
            const wall=settleWallUpgrade(defender.wall||{});
            const outcome=resolveBattle({
              attackerTroops,defenderTroops,attackerCatalog,defenderCatalog,
              defenderResources:parse(defender.resources,{}),wallLevel:wall.level
            });
            const attackerArmy=parse(attacker.troops,{});
            for(const [unitId,count] of Object.entries(outcome.attackerSurvivors))
              attackerArmy[unitId]=Number(attackerArmy[unitId]||0)+count;
            const defenderArmy=outcome.defenderSurvivors;
            const attackerResources=parse(attacker.resources,{});
            for(const [key,count] of Object.entries(outcome.loot))
              attackerResources[key]=Number(attackerResources[key]||0)+count;
            const report={
              resolvedAt:new Date().toISOString(),attackerVillage:raid.attacker_village,defenderVillage:raid.defender_village,
              attackerPower:outcome.attackPower,defenderPower:outcome.defensePower,
              wallLevel:wall.level,wallDefensePercent:outcome.wallDefensePercent,
              damageBeforeWall:outcome.damageBeforeWall,damageAfterWall:outcome.damageAfterWall,
              damagePreventedByWall:outcome.damagePreventedByWall,
              attackerLosses:outcome.attackerLosses,attackerLostCount:outcome.attackerLostCount,
              attackerSurvivors:outcome.attackerSurvivors,
              defenderLosses:outcome.defenderLosses,defenderLostCount:outcome.defenderLostCount,
              defenderSurvivors:outcome.defenderSurvivors,
              shelterProtected:outcome.protectedResources,loot:outcome.loot,carryCapacity:outcome.carryCapacity
            };
            await client.query("UPDATE umaykut_v2.player_game_state SET troops=$2::jsonb,resources=$3::jsonb,updated_at=NOW() WHERE player_id=$1",
              [raid.attacker_id,JSON.stringify(attackerArmy),JSON.stringify(attackerResources)]);
            await client.query("UPDATE umaykut_v2.player_game_state SET troops=$2::jsonb,resources=$3::jsonb,wall=$4::jsonb,updated_at=NOW() WHERE player_id=$1",
              [raid.defender_id,JSON.stringify(defenderArmy),JSON.stringify(outcome.defenderRemainingResources),JSON.stringify(wall)]);
            await client.query("UPDATE umaykut_v2.player_raids SET status='resolved',battle_report=$2::jsonb,loot=$3::jsonb WHERE id=$1",
              [raid.id,JSON.stringify(report),JSON.stringify(outcome.loot)]);
            await client.query("COMMIT");inTx=false;
          }catch(error){
            if(inTx){try{await client.query("ROLLBACK");}catch{}}
            console.error("V2 battle resolution failed",{raidId:item.id,message:String(error.message||"").slice(0,180)});
          }finally{client.release();}
        }
        const result=await pool.query(
          `SELECT r.id,r.attacker_id,r.defender_id,r.attacker_village,r.defender_village,
                  r.troops,r.attack_power,r.departed_at,r.arrives_at,r.status,r.battle_report,r.loot,
                  CASE WHEN r.attacker_id=$1 THEN 'outgoing' ELSE 'incoming' END AS direction
           FROM umaykut_v2.player_raids r
           WHERE (r.attacker_id=$1 OR r.defender_id=$1) AND r.status IN ('marching','resolved')
           ORDER BY r.arrives_at DESC LIMIT 50`,[session.id]);
        return sendJson(res,200,{attacks:result.rows,serverNow:new Date().toISOString()});
      }
      if(req.method!=="POST" || url.pathname!=="/api/game/attack"){
        res.setHeader("allow",url.pathname==="/api/game/attack"?"POST":"GET");
        return sendJson(res,405,{error:"Yöntem desteklenmiyor."});
      }
      try{
        const input=await readJson(req);
        const targetId=String(input.targetPlayerId||"");
        if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId))
          return sendJson(res,400,{error:"Geçerli bir hedef köy seçmelisin."});
        if(targetId===session.id)return sendJson(res,400,{error:"Kendi köyüne saldırı gönderemezsin."});
        if(!input.troops||typeof input.troops!=="object"||Array.isArray(input.troops))
          return sendJson(res,400,{error:"Gönderilecek birlikleri seçmelisin."});
        const client=await pool.connect();let inTx=false;
        try{
          await client.query("BEGIN");inTx=true;
          const ids=[session.id,targetId].sort();
          const result=await client.query(
            `SELECT p.id,p.village_name,s.faction_id,s.resources,s.buildings,s.troops,s.training_queue
             FROM umaykut_v2.players p JOIN umaykut_v2.player_game_state s ON s.player_id=p.id
             WHERE p.id=ANY($1::uuid[]) ORDER BY p.id FOR UPDATE OF s`,[ids]);
          if(result.rowCount!==2){await client.query("ROLLBACK");inTx=false;return sendJson(res,404,{error:"Hedef köy bulunamadı veya henüz kurulmadı."});}
          const attacker=result.rows.find(row=>row.id===session.id),defender=result.rows.find(row=>row.id===targetId);
          if(!attacker?.village_name||!defender?.village_name||!defender.faction_id){
            await client.query("ROLLBACK");inTx=false;return sendJson(res,404,{error:"Hedef köy henüz kurulmadı."});
          }
          const troops=typeof attacker.troops==="string"?JSON.parse(attacker.troops||"{}"):{...(attacker.troops||{})};
          const queue=typeof attacker.training_queue==="string"?JSON.parse(attacker.training_queue||"[]"):(attacker.training_queue||[]);
          const settled=settleTrainingQueue(troops,queue);
          const catalog=getTroopCatalog(attacker.faction_id,typeof attacker.buildings==="string"?JSON.parse(attacker.buildings||"{}"):(attacker.buildings||{}));
          const selected={},unitMap=new Map(catalog.map(unit=>[unit.id,unit]));
          let attackPower=0,slowestSpeed=Infinity,total=0;
          for(const [unitId,raw] of Object.entries(input.troops)){
            const amount=Number(raw),unit=unitMap.get(unitId);
            if(!unit||!Number.isSafeInteger(amount)||amount<0){
              await client.query("ROLLBACK");inTx=false;return sendJson(res,400,{error:"Gönderilen birlik bilgisi geçersiz."});
            }
            if(amount===0)continue;
            const owned=Number(settled.troops[unitId]||0);
            if(amount>owned){
              await client.query("ROLLBACK");inTx=false;return sendJson(res,409,{error:unit.name+" sayısı orduda yeterli değil.",available:owned});
            }
            selected[unitId]=amount;total+=amount;attackPower+=amount*unit.attack;slowestSpeed=Math.min(slowestSpeed,unit.speed);
          }
          if(!total){
            await client.query("ROLLBACK");inTx=false;return sendJson(res,400,{error:"En az bir asker seçmelisin."});
          }
          for(const [unitId,amount] of Object.entries(selected))settled.troops[unitId]-=amount;
          const departedAt=new Date(),marchSeconds=Math.max(60,Math.ceil(3600/Math.max(1,slowestSpeed)));
          const arrivesAt=new Date(departedAt.getTime()+marchSeconds*1000);
          const raid=await client.query(
            `INSERT INTO umaykut_v2.player_raids(attacker_id,defender_id,attacker_village,defender_village,troops,attack_power,departed_at,arrives_at,status)
             VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,'marching') RETURNING id,attacker_village,defender_village,troops,attack_power,departed_at,arrives_at,status`,
            [session.id,targetId,attacker.village_name,defender.village_name,JSON.stringify(selected),attackPower,departedAt.toISOString(),arrivesAt.toISOString()]);
          await client.query(
            "UPDATE umaykut_v2.player_game_state SET troops=$2::jsonb,training_queue=$3::jsonb,updated_at=NOW() WHERE player_id=$1",
            [session.id,JSON.stringify(settled.troops),JSON.stringify(settled.trainingQueue)]);
          await client.query("COMMIT");inTx=false;
          return sendJson(res,201,{success:true,raid:raid.rows[0],marchSeconds,remainingTroops:settled.troops,armyPower:attackPower,serverNow:new Date().toISOString()});
        }catch(error){if(inTx){try{await client.query("ROLLBACK");}catch{}}throw error;}
        finally{client.release();}
      }catch(error){
        console.error("V2 attack launch failed",{code:error.code||"UNKNOWN",message:String(error.message||"").slice(0,180)});
        return sendJson(res,error.status||500,{error:error.status?error.message:"Saldırı emri gönderilemedi."});
      }
    }

    if(url.pathname==="/api/game/wall"){
      if(!pool)return sendJson(res,503,{error:"Oyun kayıt servisi henüz yapılandırılmadı."});
      if(!sessionSecret||sessionSecret.length<32)return sendJson(res,503,{error:"Oturum güvenlik ayarı eksik."});
      if(req.method!=="POST"){res.setHeader("allow","POST");return sendJson(res,405,{error:"Yöntem desteklenmiyor."});}
      const token=bearerToken(req);const session=verifySessionToken(token,sessionSecret);
      if(!session)return sendJson(res,401,{error:"Oturum geçersiz veya süresi dolmuş."});
      try{
        const player=await pool.query("SELECT p.id FROM umaykut_v2.players p JOIN umaykut_v2.player_sessions s ON s.player_id=p.id WHERE p.id=$1 AND s.token_hash=$2 AND s.expires_at>NOW()",[session.id,sessionTokenHash(token)]);
        if(!player.rowCount)return sendJson(res,401,{error:"Oyuncu oturumu bulunamadı."});
        const input=await readJson(req);if(input.action!=="upgrade")return sendJson(res,400,{error:"Geçersiz sur işlemi."});
        const client=await pool.connect();let inTransaction=false;
        try{
          await client.query("BEGIN");inTransaction=true;
          await client.query("INSERT INTO umaykut_v2.player_game_state(player_id) VALUES($1) ON CONFLICT(player_id) DO NOTHING",[session.id]);
          const result=await client.query("SELECT resources,wall FROM umaykut_v2.player_game_state WHERE player_id=$1 FOR UPDATE",[session.id]);
          const row=result.rows[0];const resources=typeof row.resources==="string"?JSON.parse(row.resources):{...row.resources};
          let wall=settleWallUpgrade(row.wall||{});
          if(wall.upgrade){await client.query("ROLLBACK");inTransaction=false;return sendJson(res,409,{error:"Sur zaten yükseltiliyor.",wall,wallEffects:wallEffects(wall.level)});}
          if(wall.level>=WALL_MAX_LEVEL){await client.query("ROLLBACK");inTransaction=false;return sendJson(res,409,{error:"Sur en yüksek seviye olan 10'a ulaştı.",wall,wallEffects:wallEffects(wall.level)});}
          const targetLevel=wall.level+1,cost=wallUpgradeCost(targetLevel);
          const missing=Object.fromEntries(Object.entries(cost).filter(([key,amount])=>Number(resources[key]||0)<amount).map(([key,amount])=>[key,amount-Number(resources[key]||0)]));
          if(Object.keys(missing).length){await client.query("ROLLBACK");inTransaction=false;return sendJson(res,409,{error:"Sur yükseltmesi için yeterli kaynak yok.",missing,cost});}
          for(const [key,amount] of Object.entries(cost))resources[key]=Number(resources[key])-amount;
          const startedAt=new Date(),completesAt=new Date(startedAt.getTime()+WALL_UPGRADE_DURATIONS_MS[targetLevel]);
          wall={level:wall.level,upgrade:{targetLevel,startedAt:startedAt.toISOString(),completesAt:completesAt.toISOString()}};
          await client.query("UPDATE umaykut_v2.player_game_state SET resources=$2::jsonb,wall=$3::jsonb,updated_at=NOW() WHERE player_id=$1",[session.id,JSON.stringify(resources),JSON.stringify(wall)]);
          await client.query("COMMIT");inTransaction=false;
          return sendJson(res,200,{success:true,wall,cost,durationMs:WALL_UPGRADE_DURATIONS_MS[targetLevel],resources,wallEffects:wallEffects(wall.level),serverNow:new Date().toISOString()});
        }catch(error){if(inTransaction){try{await client.query("ROLLBACK");}catch{}}throw error;}finally{client.release();}
      }catch(error){console.error("V2 wall upgrade failed",{code:error.code||"UNKNOWN",message:String(error.message||"Unknown wall error").slice(0,200)});return sendJson(res,error.status||500,{error:error.status?error.message:"Sur yükseltmesi tamamlanamadı."});}
    }

    if (url.pathname === "/api/game/buildings") {
      if (!pool) return sendJson(res, 503, { error: "Oyun kayıt servisi henüz yapılandırılmadı." });
      if (!sessionSecret || sessionSecret.length < 32) {
        return sendJson(res, 503, { error: "Oturum güvenlik ayarı eksik." });
      }
      if (req.method !== "POST") {
        res.setHeader("allow", "POST");
        return sendJson(res, 405, { error: "Yöntem desteklenmiyor." });
      }
      const token = bearerToken(req);
      const session = verifySessionToken(token, sessionSecret);
      if (!session) return sendJson(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." });
      try {
        const playerResult = await pool.query(
          "SELECT p.id FROM umaykut_v2.players p JOIN umaykut_v2.player_sessions s ON s.player_id = p.id WHERE p.id = $1 AND s.token_hash = $2 AND s.expires_at > NOW()",
          [session.id, sessionTokenHash(token)]
        );
        if (!playerResult.rowCount) return sendJson(res, 401, { error: "Oyuncu oturumu bulunamadı." });
        const playerId = playerResult.rows[0].id;
        const input = await readJson(req);
        const slot = Number(input.slot);
        const action = input.action;
        if (!Number.isSafeInteger(slot) || slot < 1 || slot > 9) {
          return sendJson(res, 400, { error: "Geçerli bir bina alanı seçmelisin." });
        }
        if (action !== "upgrade") {
          return sendJson(res, 400, { error: "Bina türleri sabittir; yalnızca mevcut binaları yükseltebilirsin." });
        }
        const fixedType = FIXED_BUILDING_TYPES[String(slot)];

        const client = await pool.connect();
        let inTransaction = false;
        try {
          await client.query("BEGIN");
          inTransaction = true;
          await client.query(
            "INSERT INTO umaykut_v2.player_game_state(player_id) VALUES($1) ON CONFLICT (player_id) DO NOTHING",
            [playerId]
          );
          const currentResult = await client.query(
            "SELECT resources, buildings FROM umaykut_v2.player_game_state WHERE player_id = $1 FOR UPDATE",
            [playerId]
          );
          const row = currentResult.rows[0];
          const resources = typeof row.resources === "string" ? JSON.parse(row.resources) : { ...row.resources };
          const buildings = typeof row.buildings === "string" ? JSON.parse(row.buildings) : { ...row.buildings };
          const key = String(slot);
          const current = buildings[key] || null;
          if (!current) {
            await client.query("ROLLBACK");
            inTransaction = false;
            return sendJson(res, 409, { error: "Bu binanın başlangıç seviyesi bulunamadı. Oyunu yenileyip tekrar dene." });
          }
          const settled = settleCompletedBuildingUpgrades(buildings);
          for (const [buildingSlot, building] of Object.entries(settled.buildings)) buildings[buildingSlot] = building;
          const currentBuilding = buildings[key];
          if (currentBuilding.upgrade) {
            await client.query("ROLLBACK"); inTransaction = false;
            return sendJson(res, 409, { error: "Bu bina zaten yükseltiliyor.", building: currentBuilding, buildings });
          }
          const currentLevel = Number(currentBuilding.level);
          if (!Number.isSafeInteger(currentLevel) || currentLevel < 1) {
            await client.query("ROLLBACK"); inTransaction = false;
            return sendJson(res, 409, { error: "Bina seviyesi geçersiz." });
          }
          if (currentLevel >= 10) {
            await client.query("ROLLBACK"); inTransaction = false;
            return sendJson(res, 409, { error: "Bu bina en yüksek seviye olan 10'a ulaştı." });
          }
          const targetLevel = currentLevel + 1;
          const cost = buildingUpgradeCost(targetLevel);
          const missing = Object.fromEntries(Object.entries(cost)
            .filter(([resource,amount]) => Number(resources[resource] || 0) < amount)
            .map(([resource,amount]) => [resource, amount - Number(resources[resource] || 0)]));
          if (Object.keys(missing).length) {
            await client.query("ROLLBACK"); inTransaction = false;
            return sendJson(res, 409, { error: "Yeterli kaynak yok.", missing, cost });
          }
          for (const [resource,amount] of Object.entries(cost)) resources[resource] = Number(resources[resource]) - amount;
          const startedAt = new Date();
          const completesAt = new Date(startedAt.getTime() + BUILDING_UPGRADE_DURATIONS_MS[targetLevel]);
          const building = { type: fixedType, level: currentLevel,
            upgrade: { targetLevel, startedAt: startedAt.toISOString(), completesAt: completesAt.toISOString() } };
          buildings[key] = building;
          await client.query(
            "UPDATE umaykut_v2.player_game_state SET resources = $2::jsonb, buildings = $3::jsonb, updated_at = NOW() WHERE player_id = $1",
            [playerId, JSON.stringify(resources), JSON.stringify(buildings)]
          );
          await client.query("COMMIT"); inTransaction = false;
          return sendJson(res, 200, { success: true, slot, building, cost, durationMs: BUILDING_UPGRADE_DURATIONS_MS[targetLevel], resources, buildings, serverNow: new Date().toISOString() });
        } catch (error) {
          if (inTransaction) {
            try { await client.query("ROLLBACK"); } catch {}
          }
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error("V2 building operation failed", {
          code: error.code || "UNKNOWN",
          message: String(error.message || "Unknown building operation error").slice(0, 200)
        });
        return sendJson(res, error.status || 500, {
          error: error.status ? error.message : "Bina işlemi tamamlanamadı."
        });
      }
    }

    if (url.pathname === "/api/player/profile") {
      if (!pool) return sendJson(res, 503, { error: "Oyuncu profili servisi henüz yapılandırılmadı." });
      if (!sessionSecret || sessionSecret.length < 32) return sendJson(res, 503, { error: "Oturum güvenlik ayarı eksik." });
      if (!["GET", "PUT"].includes(req.method)) {
        res.setHeader("allow", "GET, PUT");
        return sendJson(res, 405, { error: "Yöntem desteklenmiyor." });
      }
      const token = bearerToken(req);
      const session = verifySessionToken(token, sessionSecret);
      if (!session) return sendJson(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." });
      try {
        await pool.query("ALTER TABLE umaykut_v2.players ADD COLUMN IF NOT EXISTS village_name VARCHAR(32)");
        const validSession = await pool.query(
          "SELECT p.id FROM umaykut_v2.players p JOIN umaykut_v2.player_sessions s ON s.player_id = p.id WHERE p.id = $1 AND s.token_hash = $2 AND s.expires_at > NOW()",
          [session.id, sessionTokenHash(token)]
        );
        if (!validSession.rowCount) return sendJson(res, 401, { error: "Oyuncu oturumu bulunamadı." });
        if (req.method === "GET") {
          const result = await pool.query(
            "SELECT p.village_name, s.faction_id FROM umaykut_v2.players p LEFT JOIN umaykut_v2.player_game_state s ON s.player_id = p.id WHERE p.id = $1",
            [session.id]
          );
          return sendJson(res, 200, {
            villageName: result.rows[0]?.village_name || null,
            factionId: result.rows[0]?.faction_id || null
          });
        }
        const input = await readJson(req);
        const villageName = typeof input.villageName === "string" ? input.villageName.trim() : "";
        const factionId = typeof input.factionId === "string" ? input.factionId : "";
        if (villageName.length < 3 || villageName.length > 32 || !/^[\p{L}\p{N}][\p{L}\p{N} '\u2019-]*$/u.test(villageName)) {
          return sendJson(res, 400, { error: "Köy adı 3–32 karakter olmalı; harf, rakam ve boşluk kullanabilirsin." });
        }
        if (!["hun", "seljuk", "gokturk"].includes(factionId)) {
          return sendJson(res, 400, { error: "Devletini seçmeden yola çıkamazsın." });
        }
        const client = await pool.connect();
        let inTransaction = false;
        let firstSetup = false;
        try {
          await client.query("BEGIN");
          inTransaction = true;
          const existing = await client.query(
            "SELECT village_name, faction_id FROM umaykut_v2.players p LEFT JOIN umaykut_v2.player_game_state s ON s.player_id = p.id WHERE p.id = $1 FOR UPDATE OF p",
            [session.id]
          );
          if (!existing.rowCount) {
            await client.query("ROLLBACK");
            inTransaction = false;
            return sendJson(res, 404, { error: "Oyuncu hesabı bulunamadı." });
          }
          firstSetup = !existing.rows[0].village_name || !existing.rows[0].faction_id;
          await client.query("UPDATE umaykut_v2.players SET village_name = $2 WHERE id = $1", [session.id, villageName]);
          if (firstSetup) {
            // First-time founding also initializes legacy accounts that predate the level-one setup.
            await client.query(
              `INSERT INTO umaykut_v2.player_game_state
                (player_id, faction_id, resources, buildings, worker_assignments, worker_state_initialized)
               VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, TRUE)
               ON CONFLICT (player_id) DO UPDATE SET
                 faction_id = EXCLUDED.faction_id,
                 resources = EXCLUDED.resources,
                 buildings = EXCLUDED.buildings,
                 worker_assignments = EXCLUDED.worker_assignments,
                 worker_state_initialized = TRUE,
                 updated_at = NOW()`,
              [
                session.id, factionId, JSON.stringify(INITIAL_RESOURCES),
                JSON.stringify(INITIAL_BUILDINGS), JSON.stringify({grain:0,wood:0,stone:0})
              ]
            );
          } else {
            await client.query(
              `INSERT INTO umaykut_v2.player_game_state(player_id, faction_id)
               VALUES($1, $2)
               ON CONFLICT (player_id) DO UPDATE SET faction_id = EXCLUDED.faction_id, updated_at = NOW()`,
              [session.id, factionId]
            );
          }
          await client.query("COMMIT");
          inTransaction = false;
        } catch (error) {
          if (inTransaction) {
            try { await client.query("ROLLBACK"); } catch {}
          }
          throw error;
        } finally {
          client.release();
        }
        return sendJson(res, 200, { success: true, villageName, factionId, firstSetup });
      } catch (error) {
        console.error("V2 player profile request failed", {
          code: error.code || "UNKNOWN",
          message: String(error.message || "Unknown profile error").slice(0, 200)
        });
        return sendJson(res, 500, { error: "Köy bilgilerin kaydedilemedi. Tekrar dene." });
      }
    }

    if (url.pathname === "/api/game/state") {
      if (!pool) return sendJson(res, 503, { error: "Oyun kayıt servisi henüz yapılandırılmadı." });
      if (!sessionSecret || sessionSecret.length < 32) {
        return sendJson(res, 503, { error: "Oturum güvenlik ayarı eksik." });
      }
      if (!["GET", "PUT"].includes(req.method)) {
        res.setHeader("allow", "GET, PUT");
        return sendJson(res, 405, { error: "Yöntem desteklenmiyor." });
      }
      const token = bearerToken(req);
      const session = verifySessionToken(token, sessionSecret);
      if (!session) return sendJson(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." });
      try {
        const playerResult = await pool.query(
          "SELECT p.id FROM umaykut_v2.players p JOIN umaykut_v2.player_sessions s ON s.player_id = p.id WHERE p.id = $1 AND s.token_hash = $2 AND s.expires_at > NOW()",
          [session.id, sessionTokenHash(token)]
        );
        if (!playerResult.rowCount) return sendJson(res, 401, { error: "Oyuncu oturumu bulunamadı." });
        const playerId = playerResult.rows[0].id;
        if (req.method === "GET") {
          await pool.query(
            "INSERT INTO umaykut_v2.player_game_state(player_id) VALUES($1) ON CONFLICT (player_id) DO NOTHING",
            [playerId]
          );
          const state = await pool.query(
            `SELECT p.village_name, s.faction_id, s.worker_pool, s.worker_assignments,
                    s.worker_state_initialized, s.resources, s.buildings, s.wall, s.updated_at
             FROM umaykut_v2.players p
             JOIN umaykut_v2.player_game_state s ON s.player_id = p.id
             WHERE p.id = $1`,
            [playerId]
          );
          const row = state.rows[0];
          // A not-yet-founded character always receives a clean level-one village.
          // For established players, repair missing/invalid slots without lowering valid progress.
          const normalized = normalizeBuildings(row.buildings, {
            reset: !row.village_name || !row.faction_id
          });
          const completion = settleCompletedBuildingUpgrades(normalized);
          const buildings = completion.buildings;
          if (completion.changed || JSON.stringify(buildings) !== JSON.stringify(
            typeof row.buildings === "string" ? JSON.parse(row.buildings || "{}") : (row.buildings || {})
          )) {
            await pool.query(
              "UPDATE umaykut_v2.player_game_state SET buildings = $2::jsonb, updated_at = NOW() WHERE player_id = $1",
              [playerId, JSON.stringify(buildings)]
            );
          }
          return sendJson(res, 200, {
            factionId: row.faction_id,
            workerPool: Number(row.worker_pool),
            workerAssignments: row.worker_assignments,
            workerStateInitialized: row.worker_state_initialized,
            resources: row.resources,
            buildings,
            wall: settleWallUpgrade(row.wall||{}),
            wallEffects: wallEffects(settleWallUpgrade(row.wall||{}).level),
            updatedAt: row.updated_at,
            serverNow: new Date().toISOString()
          });
        }
        const input = await readJson(req);
        const allowedFactions = new Set(["hun", "seljuk", "gokturk"]);
        const factionId = input.factionId == null ? null : String(input.factionId);
        if (factionId !== null && !allowedFactions.has(factionId)) {
          return sendJson(res, 400, { error: "Geçerli bir devlet seçmelisin." });
        }
        const source = input.workerAssignments && typeof input.workerAssignments === "object"
          ? input.workerAssignments : {};
        const workerAssignments = { grain: source.grain, wood: source.wood, stone: source.stone };
        const values = Object.values(workerAssignments);
        if (!values.every(value => Number.isSafeInteger(value) && value >= 0) ||
            Object.keys(source).some(key => !["grain", "wood", "stone"].includes(key)) ||
            values.reduce((sum, value) => sum + value, 0) > 1800) {
          return sendJson(res, 400, { error: "İşçi dağılımı geçersiz. Toplam işçi sayısı 1.800'ü aşamaz." });
        }
        const saved = await pool.query(
          `INSERT INTO umaykut_v2.player_game_state(player_id, faction_id, worker_assignments, worker_state_initialized)
           VALUES($1, $2, $3::jsonb, TRUE)
           ON CONFLICT (player_id) DO UPDATE
             SET faction_id = COALESCE(EXCLUDED.faction_id, umaykut_v2.player_game_state.faction_id),
                 worker_assignments = EXCLUDED.worker_assignments,
                 worker_state_initialized = TRUE,
                 updated_at = NOW()
           RETURNING faction_id, worker_pool, worker_assignments, worker_state_initialized, resources, buildings, wall, updated_at`,
          [playerId, factionId, JSON.stringify(workerAssignments)]
        );
        const row = saved.rows[0];
        return sendJson(res, 200, {
          success: true,
          factionId: row.faction_id,
          workerPool: Number(row.worker_pool),
          workerAssignments: row.worker_assignments,
          workerStateInitialized: row.worker_state_initialized,
          resources: row.resources,
          buildings: row.buildings,
          wall: settleWallUpgrade(row.wall||{}),
          wallEffects: wallEffects(settleWallUpgrade(row.wall||{}).level),
          updatedAt: row.updated_at
        });
      } catch (error) {
        console.error("V2 game state request failed", {
          code: error.code || "UNKNOWN",
          message: String(error.message || "Unknown game state error").slice(0, 200)
        });
        return sendJson(res, 500, { error: "Oyun ilerlemesi kaydedilemedi." });
      }
    }

    if (url.pathname.startsWith("/api/auth/")) {
      if (!pool) return sendJson(res, 503, { error: "Hesap servisi henüz yapılandırılmadı." });
      if (!sessionSecret || sessionSecret.length < 32) {
        return sendJson(res, 503, { error: "Oturum güvenlik ayarı eksik." });
      }

      if (req.method === "POST" && url.pathname === "/api/auth/register") {
        try {
          const input = await readJson(req);
          const issue = validateRegistration(input);
          if (issue) return sendJson(res, 400, { error: issue });

          const username = input.username.trim();
          const email = input.email.trim().toLowerCase();
          await pool.query("ALTER TABLE umaykut_v2.players ADD COLUMN IF NOT EXISTS village_name VARCHAR(32)");
          const passwordHash = await hashPassword(input.password);
          const result = await pool.query(
            "INSERT INTO umaykut_v2.players(username, username_normalized, email, email_normalized, password_hash, village_name) VALUES($1, $2, $3, $4, $5, NULL) RETURNING id, username, email, created_at, village_name",
            [username, username.toLowerCase(), email, email.toLowerCase(), passwordHash]
          );
          const player = result.rows[0];
          // Give every newly registered account an independent, explicit level-1 village.
          await pool.query(
            `INSERT INTO umaykut_v2.player_game_state
              (player_id, faction_id, resources, buildings, worker_assignments, worker_state_initialized)
             VALUES ($1, NULL, $2::jsonb, $3::jsonb, $4::jsonb, TRUE)
             ON CONFLICT (player_id) DO UPDATE SET
               faction_id = NULL,
               resources = EXCLUDED.resources,
               buildings = EXCLUDED.buildings,
               worker_assignments = EXCLUDED.worker_assignments,
               worker_state_initialized = TRUE,
               updated_at = NOW()`,
            [
              player.id,
              JSON.stringify(INITIAL_RESOURCES),
              JSON.stringify(INITIAL_BUILDINGS),
              JSON.stringify({grain:0,wood:0,stone:0})
            ]
          );
          const token = createSessionToken(player.id, sessionSecret);
          const session = verifySessionToken(token, sessionSecret);
          await pool.query(
            "INSERT INTO umaykut_v2.player_sessions(player_id, token_hash, expires_at) VALUES($1, $2, to_timestamp($3))",
            [player.id, sessionTokenHash(token), session.expiresAt]
          );
          return sendJson(res, 201, { player, token, tokenType: "Bearer" });
        } catch (error) {
          if (error.code === "23505") {
            return sendJson(res, 409, { error: "Bu oyuncu adı veya e-posta zaten kayıtlı." });
          }
          // Keep diagnostics useful without ever logging passwords, hashes, email addresses, or request bodies.
          console.error("V2 account registration failed", {
            code: error.code || "UNKNOWN",
            constraint: error.constraint || null,
            message: String(error.message || "Unknown registration error").slice(0, 240)
          });
          return sendJson(res, error.status || 500, {
            error: error.status ? error.message : "Kayıt işlemi tamamlanamadı. Sunucu hatası kaydedildi."
          });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/auth/login") {
        try {
          const input = await readJson(req);
          const login = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
          const password = typeof input.password === "string" ? input.password : "";
          if (!login || !password || password.length > 128) {
            return sendJson(res, 400, { error: "E-posta/oyuncu adı ve şifre gerekli." });
          }

          await pool.query("ALTER TABLE umaykut_v2.players ADD COLUMN IF NOT EXISTS village_name VARCHAR(32)");
          const result = await pool.query(
            "SELECT id, username, email, password_hash, village_name FROM umaykut_v2.players WHERE email_normalized = $1 OR username_normalized = $1 LIMIT 1",
            [login]
          );
          const player = result.rows[0];
          if (!player || !await verifyPassword(password, player.password_hash)) {
            return sendJson(res, 401, { error: "Giriş bilgileri hatalı." });
          }

          const token = createSessionToken(player.id, sessionSecret);
          const session = verifySessionToken(token, sessionSecret);
          await pool.query(
            "INSERT INTO umaykut_v2.player_sessions(player_id, token_hash, expires_at) VALUES($1, $2, to_timestamp($3))",
            [player.id, sessionTokenHash(token), session.expiresAt]
          );
          return sendJson(res, 200, {
            player: { id: player.id, username: player.username, email: player.email, village_name: player.village_name },
            token,
            tokenType: "Bearer"
          });
        } catch (error) {
          return sendJson(res, error.status || 500, {
            error: error.status ? error.message : "Giriş işlemi tamamlanamadı."
          });
        }
      }

      if (req.method === "DELETE" && url.pathname === "/api/auth/session") {
        const token = bearerToken(req);
        const session = verifySessionToken(token, sessionSecret);
        if (!session) return sendJson(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." });
        try {
          const result = await pool.query(
            "DELETE FROM umaykut_v2.player_sessions WHERE player_id = $1 AND token_hash = $2 RETURNING id",
            [session.id, sessionTokenHash(token)]
          );
          if (!result.rowCount) return sendJson(res, 401, { error: "Oturum zaten kapatılmış." });
          return sendJson(res, 200, { success: true, message: "Oturum güvenli şekilde kapatıldı." });
        } catch {
          return sendJson(res, 500, { error: "Oturum kapatılamadı. Tekrar dene." });
        }
      }

      if (req.method === "GET" && url.pathname === "/api/auth/me") {
        const token = bearerToken(req);
        const session = verifySessionToken(token, sessionSecret);
        if (!session) return sendJson(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." });

        try {
          await pool.query("ALTER TABLE umaykut_v2.players ADD COLUMN IF NOT EXISTS village_name VARCHAR(32)");
          const result = await pool.query(
            "SELECT p.id, p.username, p.email, p.created_at, p.village_name FROM umaykut_v2.players p JOIN umaykut_v2.player_sessions s ON s.player_id = p.id WHERE p.id = $1 AND s.token_hash = $2 AND s.expires_at > NOW()",
            [session.id, sessionTokenHash(token)]
          );
          if (!result.rowCount) return sendJson(res, 401, { error: "Oyuncu bulunamadı." });
          return sendJson(res, 200, { player: result.rows[0] });
        } catch {
          return sendJson(res, 500, { error: "Oyuncu bilgisi alınamadı." });
        }
      }

      if (!["GET", "POST"].includes(req.method)) {
        res.setHeader("allow", "GET, POST, DELETE");
        return sendJson(res, 405, { error: "Yöntem desteklenmiyor." });
      }
      return sendJson(res, 404, { error: "Kimlik doğrulama uç noktası bulunamadı." });
    }

    if (req.method !== "GET") {
      res.setHeader("allow", "GET");
      return sendJson(res, 405, { error: "Yöntem desteklenmiyor." });
    }

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return sendJson(res, 400, { error: "Geçersiz adres." });
    }

    if (pathname.startsWith("/assets/")) {
      return sendStatic(res, assetRoot, pathname.slice("/assets/".length));
    }
    return sendStatic(res, webRoot, pathname === "/" ? "index.html" : pathname.slice(1));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const pool = createPool();
  const server = createServer({ pool });
  server.listen(config.port, "0.0.0.0", () => {
    process.stdout.write(`Umaykut Online 2 V2 ${config.version} ${config.port} portunda hazır.\n`);
  });
  const shutdown = async () => {
    server.close();
    if (pool) await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
