import { bearerToken, sessionTokenHash, verifySessionToken } from "./auth.js";
import { calculatePlayerRanking, combineTroopStacks, RANKING_WEIGHTS } from "./ranking.js";

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(body));
}
function parse(value, fallback) {
  if (typeof value === "string") return JSON.parse(value || JSON.stringify(fallback));
  return value ?? fallback;
}

export async function handleRankingRequest({ req, res, url, pool, sessionSecret }) {
  if (url.pathname !== "/api/game/rankings") return false;
  if (req.method !== "GET") {
    res.setHeader("allow", "GET");
    json(res, 405, { error: "Yöntem desteklenmiyor." });
    return true;
  }
  if (!pool) { json(res, 503, { error: "Sıralama servisi henüz yapılandırılmadı." }); return true; }
  if (!sessionSecret || sessionSecret.length < 32) {
    json(res, 503, { error: "Oturum güvenlik ayarı eksik." });
    return true;
  }
  const token = bearerToken(req);
  const session = verifySessionToken(token, sessionSecret);
  if (!session) { json(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." }); return true; }
  const valid = await pool.query(
    "SELECT 1 FROM umaykut_v2.player_sessions WHERE player_id=$1 AND token_hash=$2 AND expires_at>NOW()",
    [session.id, sessionTokenHash(token)]
  );
  if (!valid.rowCount) { json(res, 401, { error: "Oyuncu oturumu bulunamadı." }); return true; }

  const result = await pool.query(`
    SELECT p.id, p.username, p.village_name, s.faction_id, s.buildings, s.troops, s.resources,
           COALESCE(regions.owned_regions, 0)::integer AS owned_regions,
           COALESCE(raids.troop_stacks, '[]'::jsonb) AS deployed_troops,
           COALESCE(garrisons.troop_stacks, '[]'::jsonb) AS stationed_troops,
           COALESCE(scouts.troop_stacks, '[]'::jsonb) AS scouting_troops
      FROM umaykut_v2.players p
      JOIN umaykut_v2.player_game_state s ON s.player_id = p.id
      LEFT JOIN (
        SELECT owner_player_id, COUNT(*) AS owned_regions
          FROM umaykut_v2.world_neutral_regions
         WHERE owner_player_id IS NOT NULL
         GROUP BY owner_player_id
      ) regions ON regions.owner_player_id = p.id
      LEFT JOIN (
        SELECT attacker_id,
               jsonb_agg(CASE WHEN status = 'resolved'
                 THEN COALESCE(battle_report->'attackerSurvivors', '{}'::jsonb)
                 ELSE troops END) AS troop_stacks
          FROM umaykut_v2.player_raids
         WHERE status IN ('marching','resolved')
         GROUP BY attacker_id
      ) raids ON raids.attacker_id = p.id
      LEFT JOIN (
        SELECT player_id, jsonb_agg(troops) AS troop_stacks
          FROM (
            SELECT owner_player_id AS player_id, garrison_troops AS troops
              FROM umaykut_v2.world_neutral_regions
             WHERE owner_player_id IS NOT NULL
            UNION ALL
            SELECT claimed_by_player_id AS player_id, garrison_troops AS troops
              FROM umaykut_v2.world_neutral_regions
             WHERE claimed_by_player_id IS NOT NULL AND claim_expires_at > NOW()
          ) regional_troops
         GROUP BY player_id
      ) garrisons ON garrisons.player_id = p.id
      LEFT JOIN (
        SELECT attacker_id,
               jsonb_agg(CASE WHEN status = 'resolved'
                 THEN jsonb_build_object('scout', COALESCE((scout_report->>'attackerSurvivors')::integer, 0))
                 ELSE jsonb_build_object('scout', scout_count) END) AS troop_stacks
          FROM umaykut_v2.player_scout_missions
         WHERE status IN ('marching','resolved')
         GROUP BY attacker_id
      ) scouts ON scouts.attacker_id = p.id
     ORDER BY p.username ASC
  `);

  const rankings = result.rows.map(row => {
    const factionId = row.faction_id || "gokturk";
    const score = calculatePlayerRanking({
      buildings: parse(row.buildings, {}),
      troops: combineTroopStacks(
        parse(row.troops, {}),
        ...parse(row.deployed_troops, []),
        ...parse(row.stationed_troops, []),
        ...parse(row.scouting_troops, [])
      ),
      factionId,
      ownedRegionCount: Number(row.owned_regions || 0),
      resources: parse(row.resources, {})
    });
    return {
      playerId: row.id,
      username: row.username,
      villageName: row.village_name || "Adsız Köy",
      factionId,
      ...score
    };
  }).sort((a, b) =>
    b.overall - a.overall ||
    b.buildingDevelopment - a.buildingDevelopment ||
    b.armyStrength - a.armyStrength ||
    b.territorialControl - a.territorialControl ||
    b.economy - a.economy ||
    a.username.localeCompare(b.username, "tr")
  ).map((item, index) => ({ rank: index + 1, ...item }));

  json(res, 200, {
    rankings,
    currentPlayerId: session.id,
    scoring: {
      weights: RANKING_WEIGHTS,
      scales: {
        buildingDevelopment: { buildingCount: 9, maxLevel: 10 },
        armyStrength: { fullScoreAt: 10000, includesHomeDeployedScoutingAndGarrisonTroops: true },
        territorialControl: { fullScoreAtOwnedRegions: 24, temporaryClaimsCount: false },
        economy: { resourceTargets: { gold: 20000, wood: 20000, food: 20000, stone: 20000, iron: 20000, horses: 1000 }, resourceTypesWeightedEqually: true }
      },
      note: "Tek genel puan, dört alanın eşit ağırlıklı ortalamasıdır. Geçici bölge iddiaları ve depolama kapasitesi puana eklenmez; 9 numaralı bina Okçu olarak değerlendirilir."
    },
    serverNow: new Date().toISOString()
  });
  return true;
}
