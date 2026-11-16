import { pool } from "./db.js";

const MAX_LEVEL = 10;
const MAX_CONCURRENT_UPGRADES = 3;
const BUILDINGS = Object.freeze({
  center: { name: "Merkez Binası", icon: "🏛️", purpose: "Üretim ve nüfus kapasitesini artırır." },
  shelter: { name: "Sığınak", icon: "🏕️", purpose: "Düşman yağmalarına karşı kaynaklarının bir bölümünü korur." },
  temple: { name: "Tapınak", icon: "🛕", purpose: "Şehrinin işçi kapasitesini artırır." },
  school: { name: "Okul", icon: "📚", purpose: "Üretime katkı sağlar, klan kapasitesini ve hâkimiyet alanını artırır." },
  barracks: { name: "Kışla", icon: "🛡️", purpose: "Piyade birliklerinin kilidini açar ve eğitimini sağlar." },
  archery: { name: "Okçu Ocağı", icon: "🏹", purpose: "Okçu birliklerinin kilidini açar ve eğitimini sağlar." },
  stable: { name: "Ahır", icon: "🐎", purpose: "Süvari birliklerinin kilidini açar ve eğitimini sağlar." },
  workshop: { name: "Atölye", icon: "⚒️", purpose: "Kuşatma makinelerinin kilidini açar ve üretimini sağlar." },
  stonemason: { name: "Taşçı", icon: "🪨", purpose: "Haritadaki taş madenlerinden elde edilen verimi artırır." },
  lumberjack: { name: "Keresteci", icon: "🪵", purpose: "Haritadaki odun kaynaklarından elde edilen verimi artırır." },
  blacksmith: { name: "Demirci", icon: "⚒️", purpose: "Haritadaki demir madenlerinden elde edilen verimi artırır." },
  mill: { name: "Değirmen", icon: "🌾", purpose: "Tahıl üretimini destekler." },
  farm: { name: "Tarla", icon: "🌱", purpose: "Tahıl üretimini sağlar." },
  market: { name: "Pazar", icon: "🏪", purpose: "Altın üretimi ve kaynak takası sağlar." },
});
const STARTING_BUILDINGS = Object.freeze([["center",50,53],["market",18,47],["shelter",82,47],["temple",50,24],["school",78,62],["barracks",68,75],["archery",50,80],["stable",32,75],["workshop",22,62],["stonemason",20,35],["lumberjack",36,29],["blacksmith",64,29],["mill",80,35],["farm",50,38]]);
async function ensureBuildingSchema(client = pool) {
  await client.query("CREATE TABLE IF NOT EXISTS city_buildings (id BIGSERIAL PRIMARY KEY, city_player_id BIGINT NOT NULL REFERENCES player_cities(player_id) ON DELETE CASCADE, building_type VARCHAR(24) NOT NULL, x NUMERIC(5,2) NOT NULL CHECK (x BETWEEN 3 AND 97), y NUMERIC(5,2) NOT NULL CHECK (y BETWEEN 3 AND 97), level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10), upgrade_finishes_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (city_player_id, building_type))");
  await client.query("ALTER TABLE city_buildings ADD COLUMN IF NOT EXISTS upgrade_finishes_at TIMESTAMPTZ");
  await client.query("ALTER TABLE city_buildings DROP CONSTRAINT IF EXISTS city_buildings_level_check");
  await client.query("ALTER TABLE city_buildings ADD CONSTRAINT city_buildings_level_check CHECK (level BETWEEN 1 AND 10)");
  await client.query("CREATE TABLE IF NOT EXISTS player_items (player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE, item_code VARCHAR(40) NOT NULL, quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (player_id, item_code))");
  await client.query("INSERT INTO player_items (player_id, item_code, quantity) SELECT id, 'building_speedup_5m', 0 FROM players ON CONFLICT (player_id, item_code) DO NOTHING");
}
async function ensureStartingBuildings(client, playerId) {
  await client.query("DELETE FROM city_buildings WHERE city_player_id = $1 AND building_type = 'wall'", [playerId]);
  for (const [type, x, y] of STARTING_BUILDINGS) {
    await client.query("INSERT INTO city_buildings (city_player_id, building_type, x, y, level) VALUES ($1, $2, $3, $4, 1) ON CONFLICT (city_player_id, building_type) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y", [playerId, type, x, y]);
  }
}
function quoteUpgrade(level) {
  const targetLevel = level + 1;
  return {
    wood: 40 + (targetLevel - 2) * 30,
    stone: 25 + (targetLevel - 2) * 22,
    iron: 10 + (targetLevel - 2) * 14,
    durationSeconds: targetLevel * 45
  };
}
async function completeExpiredUpgrades(client, playerId) {
  await client.query("UPDATE city_buildings SET level = LEAST(10, level + 1), upgrade_finishes_at = NULL WHERE city_player_id = $1 AND upgrade_finishes_at IS NOT NULL AND upgrade_finishes_at <= NOW()", [playerId]);
}
export async function getMyBuildings(req, res) {
  try {
    await ensureBuildingSchema();
    await ensureStartingBuildings(pool, req.player.sub);
    await completeExpiredUpgrades(pool, req.player.sub);
    const activeResult = await pool.query("SELECT COUNT(*)::integer AS active FROM city_buildings WHERE city_player_id = $1 AND upgrade_finishes_at > NOW()", [req.player.sub]);
    const activeUpgradeCount = Number(activeResult.rows[0]?.active || 0);
    const result = await pool.query("SELECT id, building_type, x, y, level, upgrade_finishes_at FROM city_buildings WHERE city_player_id = $1 ORDER BY CASE WHEN building_type = 'center' THEN 0 ELSE 1 END, id", [req.player.sub]);
    const itemResult = await pool.query("SELECT quantity FROM player_items WHERE player_id = $1 AND item_code = 'building_speedup_5m'", [req.player.sub]);
    const buildings = result.rows.map(row => ({
      id: Number(row.id), type: row.building_type, name: BUILDINGS[row.building_type]?.name || row.building_type,
      icon: BUILDINGS[row.building_type]?.icon || "🏘️", x: Number(row.x), y: Number(row.y), level: Number(row.level),
      upgradeFinishesAt: row.upgrade_finishes_at,
      nextUpgrade: Number(row.level) < MAX_LEVEL ? quoteUpgrade(Number(row.level)) : null
    }));
    res.json({ maxLevel: MAX_LEVEL, maxConcurrentUpgrades: MAX_CONCURRENT_UPGRADES, activeUpgradeCount, availableConstructionWorkers: Math.max(0, MAX_CONCURRENT_UPGRADES - activeUpgradeCount), speedupsAvailable: Number(itemResult.rows[0]?.quantity || 0), buildings });
  } catch (error) {
    console.error("Bina yerleşimi alınamadı:", error);
    res.status(500).json({ error: "Başlangıç köyü yüklenemedi." });
  }
}
export async function upgradeBuilding(req, res) {
  const type = String(req.body?.type || "");
  if (!BUILDINGS[type]) return res.status(400).json({ error: "Bina türü geçerli değil." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureBuildingSchema(client);
    await ensureStartingBuildings(client, req.player.sub);
    const city = await client.query("SELECT wood, stone, iron FROM player_cities WHERE player_id = $1 FOR UPDATE", [req.player.sub]);
    await completeExpiredUpgrades(client, req.player.sub);
    const active = await client.query("SELECT COUNT(*)::integer AS count FROM city_buildings WHERE city_player_id = $1 AND upgrade_finishes_at > NOW()", [req.player.sub]);
    if (Number(active.rows[0].count) >= MAX_CONCURRENT_UPGRADES) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Üç inşaat işçisi de çalışıyor. Yeni yükseltme başlatmak için bir ekibin işini bitirmesini bekle.", activeUpgradeCount: 3, maxConcurrentUpgrades: 3 });
    }
    if (!city.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Şehir bulunamadı." }); }
    const result = await client.query("SELECT id, level, upgrade_finishes_at FROM city_buildings WHERE city_player_id = $1 AND building_type = $2 FOR UPDATE", [req.player.sub, type]);
    const building = result.rows[0];
    if (!building) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Bina bulunamadı." }); }
    if (building.upgrade_finishes_at && new Date(building.upgrade_finishes_at).getTime() > Date.now()) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Bu binanın geliştirmesi zaten sürüyor." }); }
    if (Number(building.level) >= MAX_LEVEL) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Bu bina en yüksek seviye olan 10'a ulaştı." }); }
    const cost = quoteUpgrade(Number(building.level));
    const resources = city.rows[0];
    if (Number(resources.wood) < cost.wood || Number(resources.stone) < cost.stone || Number(resources.iron) < cost.iron) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Yeterli malzemen yok. Gerekli: " + cost.wood + " odun, " + cost.stone + " taş, " + cost.iron + " demir." });
    }
    await client.query("UPDATE player_cities SET wood = wood - $2, stone = stone - $3, iron = iron - $4, updated_at = NOW() WHERE player_id = $1", [req.player.sub, cost.wood, cost.stone, cost.iron]);
    const finish = new Date(Date.now() + cost.durationSeconds * 1000);
    await client.query("UPDATE city_buildings SET upgrade_finishes_at = $3 WHERE city_player_id = $1 AND building_type = $2", [req.player.sub, type, finish]);
    await client.query("COMMIT");
    res.json({ success: true, type, targetLevel: Number(building.level) + 1, cost, upgradeFinishesAt: finish.toISOString() });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bina geliştirme hatası:", error);
    res.status(500).json({ error: "Bina geliştirilemedi." });
  } finally { client.release(); }
}
export async function speedUpBuilding(req, res) {
  const type = String(req.body?.type || "");
  if (!BUILDINGS[type]) return res.status(400).json({ error: "Bina türü geçerli değil." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureBuildingSchema(client);
    const item = await client.query("SELECT quantity FROM player_items WHERE player_id = $1 AND item_code = 'building_speedup_5m' FOR UPDATE", [req.player.sub]);
    if (!item.rows[0] || Number(item.rows[0].quantity) < 1) { await client.query("ROLLBACK"); return res.status(400).json({ error: "5 dakikalık hızlandırman yok. Pazar açıldığında bu eşyayı alabileceksin." }); }
    const building = await client.query("SELECT level, upgrade_finishes_at FROM city_buildings WHERE city_player_id = $1 AND building_type = $2 FOR UPDATE", [req.player.sub, type]);
    if (!building.rows[0] || !building.rows[0].upgrade_finishes_at) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Bu binada devam eden bir geliştirme yok." }); }
    await client.query("UPDATE player_items SET quantity = quantity - 1, updated_at = NOW() WHERE player_id = $1 AND item_code = 'building_speedup_5m'", [req.player.sub]);
    await client.query("UPDATE city_buildings SET upgrade_finishes_at = GREATEST(NOW(), upgrade_finishes_at - INTERVAL '5 minutes') WHERE city_player_id = $1 AND building_type = $2", [req.player.sub, type]);
    await completeExpiredUpgrades(client, req.player.sub);
    const updated = await client.query("SELECT level, upgrade_finishes_at FROM city_buildings WHERE city_player_id = $1 AND building_type = $2", [req.player.sub, type]);
    await client.query("COMMIT");
    res.json({ success: true, level: Number(updated.rows[0].level), upgradeFinishesAt: updated.rows[0].upgrade_finishes_at, speedupsLeft: Number(item.rows[0].quantity) - 1 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Hızlandırma hatası:", error);
    res.status(500).json({ error: "Hızlandırma uygulanamadı." });
  } finally { client.release(); }
}

export async function placeBuilding(_req, res) {
  return res.status(410).json({ error: "Yeni köy düzeninde binalar otomatik yerleştirilir; inşa etme sistemi kapalıdır." });
}
