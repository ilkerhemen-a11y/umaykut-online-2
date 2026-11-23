import { bearerToken, sessionTokenHash, verifySessionToken } from "./auth.js";
import { calculatePlayerRanking } from "./ranking.js";

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

  const result = await pool.query(
    `SELECT p.id, p.username, p.village_name, s.faction_id, s.buildings, s.troops, s.resources,
            COALESCE(regions.owned_regions, 0)::integer AS owned_regions
       FROM umaykut_v2.players p
       JOIN umaykut_v2.player_game_state s ON s.player_id = p.id
       LEFT JOIN (
         SELECT owner_player_id, COUNT(*) AS owned_regions
           FROM umaykut_v2.world_neutral_regions
          WHERE owner_player_id IS NOT NULL
          GROUP BY owner_player_id
       ) regions ON regions.owner_player_id = p.id
      ORDER BY p.username ASC`
  );
  const rankings = result.rows.map(row => {
    const factionId = row.faction_id || "gokturk";
    const score = calculatePlayerRanking({
      buildings: parse(row.buildings, {}),
      troops: parse(row.troops, {}),
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
      weights: { buildingDevelopment: 25, armyStrength: 25, territorialControl: 25, economy: 25 },
      note: "Tek genel puan, dört alanın eşit ağırlıklı ortalamasıdır. Geçici bölge iddiaları ve depolama kapasitesi puana eklenmez."
    },
    serverNow: new Date().toISOString()
  });
  return true;
}
