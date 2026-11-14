import { pool } from "./db.js";

const BUILDINGS = Object.freeze({
  center: { name: "Merkez Binası", icon: "🏛️", purpose: "Üretim ve nüfus kapasitesini artırır. 11. seviyeden itibaren Targun bonuslarını açar." },
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
  wall: { name: "Sur", icon: "🧱", purpose: "Şehrinin savunmasını güçlendirir." }
});

async function ensureStartingCenter(client, playerId) {
  await client.query("INSERT INTO city_buildings (city_player_id, building_type, x, y, level) VALUES ($1, 'center', 50, 47, 1) ON CONFLICT (city_player_id, building_type) DO NOTHING", [playerId]);
}

export async function getMyBuildings(req, res) {
  try {
    await pool.query("CREATE TABLE IF NOT EXISTS city_buildings (id BIGSERIAL PRIMARY KEY, city_player_id BIGINT NOT NULL REFERENCES player_cities(player_id) ON DELETE CASCADE, building_type VARCHAR(24) NOT NULL, x NUMERIC(5,2) NOT NULL CHECK (x BETWEEN 3 AND 97), y NUMERIC(5,2) NOT NULL CHECK (y BETWEEN 3 AND 97), level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (city_player_id, building_type))");
    await ensureStartingCenter(pool, req.player.sub);
    const result = await pool.query("SELECT id, building_type, x, y, level FROM city_buildings WHERE city_player_id = $1 ORDER BY CASE WHEN building_type = 'center' THEN 0 ELSE 1 END, id", [req.player.sub]);
    res.json({ buildings: result.rows.map(row => ({ id: Number(row.id), type: row.building_type, name: BUILDINGS[row.building_type]?.name || row.building_type, icon: BUILDINGS[row.building_type]?.icon || "🏘️", x: Number(row.x), y: Number(row.y), level: Number(row.level) })) });
  } catch (error) {
    console.error("Bina yerleşimi alınamadı:", error);
    res.status(500).json({ error: "Bina yerleşimi yüklenemedi." });
  }
}

export async function placeBuilding(req, res) {
  const type = String(req.body?.type || "");
  const x = Number(req.body?.x);
  const y = Number(req.body?.y);
  if (!BUILDINGS[type] || type === "center") return res.status(400).json({ error: "Yerleştirilecek bina türü geçerli değil." });
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 3 || x > 97 || y < 3 || y > 97) return res.status(400).json({ error: "Bina konumu harita sınırları içinde olmalı." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureStartingCenter(client, req.player.sub);
    const existing = await client.query("SELECT building_type FROM city_buildings WHERE city_player_id = $1 AND building_type = $2 FOR UPDATE", [req.player.sub, type]);
    if (existing.rows[0]) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Bu binayı zaten yerleştirdin." }); }
    const nearby = await client.query("SELECT building_type FROM city_buildings WHERE city_player_id = $1 AND POWER(x - $2, 2) + POWER(y - $3, 2) < 100 LIMIT 1", [req.player.sub, x, y]);
    if (nearby.rows[0]) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Bu konum başka bir binaya çok yakın. Biraz daha boş alan seç." }); }
    const result = await client.query("INSERT INTO city_buildings (city_player_id, building_type, x, y, level) VALUES ($1, $2, $3, $4, 1) RETURNING id, building_type, x, y, level", [req.player.sub, type, x, y]);
    await client.query("COMMIT");
    const row = result.rows[0];
    return res.status(201).json({ success: true, building: { id: Number(row.id), type: row.building_type, name: BUILDINGS[type].name, icon: BUILDINGS[type].icon, x: Number(row.x), y: Number(row.y), level: Number(row.level) } });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") return res.status(409).json({ error: "Bu binayı zaten yerleştirdin." });
    console.error("Bina yerleştirme hatası:", error);
    return res.status(500).json({ error: "Bina yerleştirilemedi." });
  } finally { client.release(); }
}