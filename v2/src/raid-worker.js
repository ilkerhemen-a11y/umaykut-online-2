import { resolveBattle } from "./combat.js";
import { getTroopCatalog } from "./army.js";

const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 25;

function parseJson(value, fallback = {}) {
  if (typeof value === "string") return JSON.parse(value || JSON.stringify(fallback));
  return value ?? fallback;
}

function settleWall(stored, now = Date.now()) {
  const source = parseJson(stored, {});
  const level = Number(source.level);
  const validLevel = Number.isSafeInteger(level) && level >= 1 && level <= 10;
  const upgrade = source.upgrade;
  const validUpgrade = validLevel && upgrade &&
    Number(upgrade.targetLevel) === level + 1 && level < 10 &&
    Number.isFinite(Date.parse(upgrade.startedAt)) &&
    Number.isFinite(Date.parse(upgrade.completesAt)) &&
    Date.parse(upgrade.completesAt) > Date.parse(upgrade.startedAt);
  let wall = validLevel
    ? { level, ...(validUpgrade ? { upgrade } : {}) }
    : { level: 1 };
  if (wall.upgrade && Date.parse(wall.upgrade.completesAt) <= now) {
    wall = { level: Number(wall.upgrade.targetLevel) };
  }
  return wall;
}

async function resolveRaid(pool, raidId) {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query("BEGIN");
    inTransaction = true;
    const raidResult = await client.query(
      "SELECT * FROM umaykut_v2.player_raids WHERE id=$1 FOR UPDATE",
      [raidId]
    );
    const raid = raidResult.rows[0];
    if (!raid || raid.status !== "marching" || new Date(raid.arrives_at).getTime() > Date.now()) {
      await client.query("ROLLBACK");
      inTransaction = false;
      return false;
    }

    const ids = [raid.attacker_id, raid.defender_id].sort();
    const states = await client.query(
      `SELECT p.id,p.village_name,s.faction_id,s.resources,s.buildings,s.troops,s.army_upgrades,s.wall,s.protection_expires_at
         FROM umaykut_v2.players p
         JOIN umaykut_v2.player_game_state s ON s.player_id=p.id
        WHERE p.id=ANY($1::uuid[])
        ORDER BY p.id
        FOR UPDATE OF s`,
      [ids]
    );
    if (states.rowCount !== 2) throw new Error("Savaş taraflarının köy verisi bulunamadı.");

    const attacker = states.rows.find(row => row.id === raid.attacker_id);
    const defender = states.rows.find(row => row.id === raid.defender_id);
    if (!attacker || !defender) throw new Error("Savaş tarafları eşleştirilemedi.");

    const attackerTroops = parseJson(raid.troops, {});
    const defenderTroops = parseJson(defender.troops, {});
    const attackerBuildings = parseJson(attacker.buildings, {});
    const defenderBuildings = parseJson(defender.buildings, {});
    const attackerCatalog = getTroopCatalog(attacker.faction_id, attackerBuildings, parseJson(attacker.army_upgrades, {}));
    const defenderCatalog = getTroopCatalog(defender.faction_id, defenderBuildings, parseJson(defender.army_upgrades, {}));
    const wall = settleWall(defender.wall);
    const protectionActive = defender.protection_expires_at && new Date(defender.protection_expires_at).getTime() > Date.now();
    const outcome = protectionActive ? {
      winner: "defender", resultCode: "village_protected",
      outcomeText: "Köy koruması aktif olduğu için saldırı engellendi. Saldıran birlikler kayıp vermeden geri dönüyor.",
      attackPower: Number(raid.attack_power || 0), defensePower: 0,
      wallDefensePercent: 0, damageBeforeWall: 0, damageAfterWall: 0, damagePreventedByWall: 0,
      attackerLosses: {}, attackerLostCount: 0, attackerSurvivors: attackerTroops,
      defenderLosses: {}, defenderLostCount: 0, defenderSurvivors: defenderTroops,
      protectedResources: {}, loot: {}, carryCapacity: 0,
      defenderRemainingResources: parseJson(defender.resources, {})
    } : resolveBattle({
      attackerTroops,
      defenderTroops,
      attackerCatalog,
      defenderCatalog,
      defenderResources: parseJson(defender.resources, {}),
      wallLevel: wall.level
    });
    const report = {
      resolvedAt: new Date().toISOString(),
      villageProtectionBlocked: Boolean(protectionActive),
      attackerVillage: raid.attacker_village,
      defenderVillage: raid.defender_village,
      attackerFactionId: attacker.faction_id,
      defenderFactionId: defender.faction_id,
      winner: outcome.winner,
      resultCode: outcome.resultCode,
      outcomeText: outcome.outcomeText,
      attackerPower: outcome.attackPower,
      defenderPower: outcome.defensePower,
      wallLevel: wall.level,
      wallDefensePercent: outcome.wallDefensePercent,
      damageBeforeWall: outcome.damageBeforeWall,
      damageAfterWall: outcome.damageAfterWall,
      damagePreventedByWall: outcome.damagePreventedByWall,
      attackerLosses: outcome.attackerLosses,
      attackerLostCount: outcome.attackerLostCount,
      attackerSurvivors: outcome.attackerSurvivors,
      defenderLosses: outcome.defenderLosses,
      defenderLostCount: outcome.defenderLostCount,
      defenderSurvivors: outcome.defenderSurvivors,
      shelterProtected: outcome.protectedResources,
      loot: outcome.loot,
      carryCapacity: outcome.carryCapacity,
      attackerUnits: attackerCatalog
        .filter(unit => Number(attackerTroops[unit.id] || 0) > 0)
        .map(unit => ({
          id: unit.id, name: unit.name, icon: unit.icon,
          sent: Number(attackerTroops[unit.id] || 0),
          lost: Number(outcome.attackerLosses[unit.id] || 0),
          survivors: Number(outcome.attackerSurvivors[unit.id] || 0)
        })),
      defenderUnits: defenderCatalog
        .filter(unit => Number(defenderTroops[unit.id] || 0) > 0)
        .map(unit => ({
          id: unit.id, name: unit.name, icon: unit.icon,
          sent: Number(defenderTroops[unit.id] || 0),
          lost: Number(outcome.defenderLosses[unit.id] || 0),
          survivors: Number(outcome.defenderSurvivors[unit.id] || 0)
        }))
    };

    await client.query(
      `UPDATE umaykut_v2.player_game_state
          SET troops=$2::jsonb,resources=$3::jsonb,wall=$4::jsonb,updated_at=NOW()
        WHERE player_id=$1`,
      [
        raid.defender_id,
        JSON.stringify(outcome.defenderSurvivors),
        JSON.stringify(outcome.defenderRemainingResources),
        JSON.stringify(wall)
      ]
    );
    await client.query(
      `UPDATE umaykut_v2.player_raids
          SET status='resolved',battle_report=$2::jsonb,loot=$3::jsonb,
              return_at=NOW()+(arrives_at-departed_at)
        WHERE id=$1`,
      [raid.id, JSON.stringify(report), JSON.stringify(outcome.loot)]
    );
    await client.query("COMMIT");
    inTransaction = false;
    return true;
  } catch (error) {
    if (inTransaction) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    console.error("V2 battle resolution failed", {
      raidId,
      message: String(error.message || "").slice(0, 180)
    });
    return false;
  } finally {
    client.release();
  }
}

async function returnRaid(pool, raidId) {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query("BEGIN");
    inTransaction = true;
    const raidResult = await client.query(
      "SELECT id,attacker_id,battle_report,status,return_at FROM umaykut_v2.player_raids WHERE id=$1 FOR UPDATE",
      [raidId]
    );
    const raid = raidResult.rows[0];
    if (!raid || raid.status !== "resolved" || !raid.return_at || new Date(raid.return_at).getTime() > Date.now()) {
      await client.query("ROLLBACK");
      inTransaction = false;
      return false;
    }

    const state = await client.query(
      "SELECT troops,resources FROM umaykut_v2.player_game_state WHERE player_id=$1 FOR UPDATE",
      [raid.attacker_id]
    );
    if (!state.rowCount) throw new Error("Dönen ordunun köy verisi bulunamadı.");
    const report = parseJson(raid.battle_report, {});
    const troops = parseJson(state.rows[0].troops, {});
    const resources = parseJson(state.rows[0].resources, {});
    for (const [unitId, count] of Object.entries(report.attackerSurvivors || {})) {
      troops[unitId] = Number(troops[unitId] || 0) + Number(count || 0);
    }
    for (const [key, count] of Object.entries(report.loot || {})) {
      resources[key] = Number(resources[key] || 0) + Number(count || 0);
    }

    await client.query(
      `UPDATE umaykut_v2.player_game_state
          SET troops=$2::jsonb,resources=$3::jsonb,updated_at=NOW()
        WHERE player_id=$1`,
      [raid.attacker_id, JSON.stringify(troops), JSON.stringify(resources)]
    );
    await client.query(
      "UPDATE umaykut_v2.player_raids SET status='returned' WHERE id=$1",
      [raid.id]
    );
    await client.query("COMMIT");
    inTransaction = false;
    return true;
  } catch (error) {
    if (inTransaction) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    console.error("V2 returning march failed", {
      raidId,
      message: String(error.message || "").slice(0, 180)
    });
    return false;
  } finally {
    client.release();
  }
}

export async function processDueRaids(pool, { playerId = null, limit = BATCH_SIZE } = {}) {
  if (!pool) return { resolved: 0, returned: 0 };
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || BATCH_SIZE));
  const filter = playerId ? " AND (attacker_id=$1 OR defender_id=$1)" : "";
  const params = playerId ? [playerId, safeLimit] : [safeLimit];

  const due = await pool.query(
    `SELECT id
       FROM umaykut_v2.player_raids
      WHERE status='marching' AND arrives_at<=NOW()${filter}
      ORDER BY arrives_at ASC
      LIMIT $${params.length}`,
    params
  );
  let resolved = 0;
  for (const item of due.rows) {
    if (await resolveRaid(pool, item.id)) resolved += 1;
  }

  const returnFilter = playerId ? " AND attacker_id=$1" : "";
  const returnParams = playerId ? [playerId, safeLimit] : [safeLimit];
  const returning = await pool.query(
    `SELECT id
       FROM umaykut_v2.player_raids
      WHERE status='resolved' AND return_at<=NOW()${returnFilter}
      ORDER BY return_at ASC
      LIMIT $${returnParams.length}`,
    returnParams
  );
  let returned = 0;
  for (const item of returning.rows) {
    if (await returnRaid(pool, item.id)) returned += 1;
  }
  return { resolved, returned };
}

export function startRaidWorker(pool, { intervalMs = POLL_INTERVAL_MS } = {}) {
  if (!pool) return { stop() {} };
  let running = false;
  let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const result = await processDueRaids(pool);
      if (result.resolved || result.returned) {
        console.info("V2 raid worker processed marches", result);
      }
    } catch (error) {
      console.error("V2 raid worker tick failed", {
        message: String(error.message || "").slice(0, 180)
      });
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  void tick();
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    }
  };
}
