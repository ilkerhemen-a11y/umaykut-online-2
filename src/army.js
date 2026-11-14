import { pool } from "./db.js";
import { getFactionUnits } from "./units.js";

export async function getMyArmy(req, res) {
  const playerResult = await pool.query(
    "SELECT faction_id FROM players WHERE id = $1",
    [req.player.sub]
  );
  const factionId = playerResult.rows[0]?.faction_id;
  if (!factionId) return res.status(409).json({ error: "Önce bir devlet seçmelisin." });

  // Katalogdaki 7 birim, oyuncunun ordusunda başlangıçta sıfır adetle tutulur.
  const units = getFactionUnits(factionId);
  if (!units) return res.status(500).json({ error: "Oyuncu devletinin asker kataloğu bulunamadı." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const unit of units) {
      await client.query(
        `INSERT INTO player_army (player_id, faction_id, unit_id, quantity)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (player_id, unit_id) DO NOTHING`,
        [req.player.sub, factionId, unit.id]
      );
    }
    const result = await client.query(
      `SELECT unit_id, quantity
       FROM player_army
       WHERE player_id = $1 AND faction_id = $2
       ORDER BY unit_id`,
      [req.player.sub, factionId]
    );
    await client.query("COMMIT");
    const quantities = new Map(result.rows.map(row => [row.unit_id, Number(row.quantity)]));
    res.json({
      factionId,
      units: units.map(unit => ({ ...unit, quantity: quantities.get(unit.id) ?? 0 }))
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ordu bilgisi alınamadı:", error);
    res.status(500).json({ error: "Ordu bilgisi yüklenemedi." });
  } finally {
    client.release();
  }
}
