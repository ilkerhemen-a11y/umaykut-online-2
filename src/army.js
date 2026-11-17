import { pool } from "./db.js";
import { getFactionUnits } from "./units.js";
import { FACTIONS } from "./factions.js";

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
    const armyUnits = units.map(unit => ({
      ...unit,
      quantity: quantities.get(unit.id) ?? 0,
      totalCarryCapacity: unit.stats.carryCapacity * (quantities.get(unit.id) ?? 0)
    }));
    const totals = armyUnits.reduce((total, unit) => {
      const count = unit.quantity;
      total.totalUnits += count;
      total.baseAttack += unit.stats.attack * count;
      total.baseInfantryDefense += unit.stats.infantryDefense * count;
      total.baseCavalryDefense += unit.stats.cavalryDefense * count;
      total.totalCarryCapacity += unit.totalCarryCapacity;
      return total;
    }, { totalUnits: 0, baseAttack: 0, baseInfantryDefense: 0, baseCavalryDefense: 0, totalCarryCapacity: 0 });
    const bonuses = FACTIONS.find(item => item.id === factionId)?.bonuses || {};
    const totalAttack = Math.floor(totals.baseAttack * (1 + Number(bonuses.attackPercent || 0) / 100));
    const totalInfantryDefense = Math.floor(totals.baseInfantryDefense * (1 + Number(bonuses.defensePercent || 0) / 100));
    const totalCavalryDefense = Math.floor(totals.baseCavalryDefense * (1 + Number(bonuses.defensePercent || 0) / 100));
    const totalPower = totalAttack + totalInfantryDefense + totalCavalryDefense;
    res.json({
      factionId,
      factionBonuses: bonuses,
      totalUnits: totals.totalUnits,
      totalAttack,
      totalInfantryDefense,
      totalCavalryDefense,
      totalPower,
      totalCarryCapacity: totals.totalCarryCapacity,
      units: armyUnits
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ordu bilgisi alınamadı:", error);
    res.status(500).json({ error: "Ordu bilgisi yüklenemedi." });
  } finally {
    client.release();
  }
}
