import { pool } from "./db.js";

const ITEMS = Object.freeze([
  { code: "building_speedup_5m", name: "İnşaat Fermanı", icon: "⏩", description: "Devam eden bir bina yükseltmesini 5 dakika hızlandırır.", price: 150 },
  { code: "wood_bundle", name: "Odun Kervanı", icon: "🪵", description: "100 birim odun hazinene eklenir.", price: 80 },
  { code: "stone_bundle", name: "Taş Kervanı", icon: "🪨", description: "100 birim taş hazinene eklenir.", price: 100 },
  { code: "iron_bundle", name: "Demir Kervanı", icon: "⚒️", description: "50 birim demir hazinene eklenir.", price: 120 },
  { code: "mixed_bundle", name: "Usta Yapı Paketi", icon: "📦", description: "100 odun, 75 taş ve 40 demir içerir.", price: 260 }
]);
const itemMap = new Map(ITEMS.map(item => [item.code, item]));
export async function getMarket(req, res) {
  try {
    await pool.query("INSERT INTO player_items (player_id, item_code, quantity) VALUES ($1, 'building_speedup_5m', 0) ON CONFLICT (player_id, item_code) DO NOTHING", [req.player.sub]);
    const [city, inventory] = await Promise.all([
      pool.query("SELECT gold FROM player_cities WHERE player_id = $1", [req.player.sub]),
      pool.query("SELECT quantity FROM player_items WHERE player_id = $1 AND item_code = 'building_speedup_5m'", [req.player.sub])
    ]);
    if (!city.rows[0]) return res.status(404).json({ error: "Şehir bulunamadı." });
    res.json({ gold: Number(city.rows[0].gold), speedupsAvailable: Number(inventory.rows[0]?.quantity || 0), items: ITEMS });
  } catch (error) { console.error("Pazar yüklenemedi:", error); res.status(500).json({ error: "Pazar şu anda açılamıyor." }); }
}
export async function buyMarketItem(req, res) {
  const item = itemMap.get(String(req.body?.code || ""));
  if (!item) return res.status(400).json({ error: "Geçersiz pazar ürünü." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const city = await client.query("SELECT gold FROM player_cities WHERE player_id = $1 FOR UPDATE", [req.player.sub]);
    if (!city.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Şehir bulunamadı." }); }
    if (Number(city.rows[0].gold) < item.price) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Bu alışveriş için yeterli altının yok. Gerekli: " + item.price + " altın." }); }
    await client.query("UPDATE player_cities SET gold = gold - $2, updated_at = NOW() WHERE player_id = $1", [req.player.sub, item.price]);
    if (item.code === "building_speedup_5m") {
      await client.query("INSERT INTO player_items (player_id, item_code, quantity) VALUES ($1, $2, 1) ON CONFLICT (player_id, item_code) DO UPDATE SET quantity = player_items.quantity + 1, updated_at = NOW()", [req.player.sub, item.code]);
    } else {
      const grants = { wood_bundle: { wood: 100 }, stone_bundle: { stone: 100 }, iron_bundle: { iron: 50 }, mixed_bundle: { wood: 100, stone: 75, iron: 40 } }[item.code];
      const keys = Object.keys(grants);
      const assignments = keys.map((key, index) => key + " = " + key + " + $" + (index + 2)).join(", ");
      await client.query("UPDATE player_cities SET " + assignments + ", updated_at = NOW() WHERE player_id = $1", [req.player.sub, ...keys.map(key => grants[key])]);
    }
    await client.query("COMMIT");
    res.json({ success: true, message: item.code === "building_speedup_5m" ? "5 dakikalık hızlandırma envanterine eklendi." : item.name + " teslim edildi." });
  } catch (error) { await client.query("ROLLBACK"); console.error("Pazar satın alma hatası:", error); res.status(500).json({ error: "Alışveriş tamamlanamadı." }); }
  finally { client.release(); }
}
