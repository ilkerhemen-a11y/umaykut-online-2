import { pool } from "./db.js";
import { getFactionUnits, getUnitTrainingCost } from "./units.js";

// Eski sürümde sırada bekleyen eğitimleri yeni anlık sisteme geçerken tamamla.
async function settleLegacyTraining(client, playerId) {
  const result = await client.query(
    `SELECT id, faction_id, unit_id, quantity
     FROM player_training_queue
     WHERE player_id = $1 AND status = 'training'
     FOR UPDATE`,
    [playerId]
  );
  for (const job of result.rows) {
    await client.query(
      `INSERT INTO player_army (player_id, faction_id, unit_id, quantity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, unit_id)
       DO UPDATE SET quantity = player_army.quantity + EXCLUDED.quantity,
                     updated_at = NOW()`,
      [playerId, job.faction_id, job.unit_id, job.quantity]
    );
    await client.query(
      "UPDATE player_training_queue SET status = 'completed', completed_at = NOW() WHERE id = $1",
      [job.id]
    );
  }
}

export async function getMyTraining(req, res) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await settleLegacyTraining(client, req.player.sub);
    await client.query("COMMIT");
    res.json({ activeTraining: null, instantTraining: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Eğitim durumu okunamadı:", error);
    res.status(500).json({ error: "Eğitim durumu yüklenemedi." });
  } finally {
    client.release();
  }
}

export async function startTraining(req, res) {
  const unitId = String(req.body?.unitId || "");
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return res.status(400).json({ error: "Bir seferde 1–100 asker eğitebilirsin." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const player = await client.query(
      "SELECT faction_id FROM players WHERE id = $1 FOR UPDATE",
      [req.player.sub]
    );
    const factionId = player.rows[0]?.faction_id;
    if (!factionId) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Önce bir devlet seçmelisin." });
    }
    const unit = getFactionUnits(factionId)?.find(item => item.id === unitId);
    if (!unit) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Bu asker seçtiğin devlete ait değil." });
    }

    await settleLegacyTraining(client, req.player.sub);
    const buildingType = unit.unitType === "siege" ? "workshop" : unit.building === "Ahır" ? "stable" : "barracks";
    const building = await client.query(
      "SELECT level FROM city_buildings WHERE city_player_id = $1 AND building_type = $2 FOR UPDATE",
      [req.player.sub, buildingType]
    );
    const buildingLevel = Number(building.rows[0]?.level || 0);
    if (buildingLevel < unit.level) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: unit.building + " binasını en az " + unit.level + ". seviyeye yükseltmelisin." });
    }

    const cost = getUnitTrainingCost(unitId, quantity);
    const city = await client.query(
      "SELECT wood, stone, iron, food, gold, horses FROM player_cities WHERE player_id = $1 FOR UPDATE",
      [req.player.sub]
    );
    if (!city.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Şehir bulunamadı." });
    }
    const resources = city.rows[0];
    const missing = Object.entries(cost).filter(([key, amount]) => Number(resources[key] || 0) < amount);
    if (missing.length) {
      await client.query("ROLLBACK");
      const labels = { wood: "odun", stone: "taş", iron: "demir", food: "tahıl", gold: "altın", horses: "at" };
      const needed = Object.entries(cost).filter(([, amount]) => amount > 0).map(([key, amount]) => amount.toLocaleString("tr-TR") + " " + labels[key]).join(", ");
      return res.status(400).json({ error: "Yeterli kaynağın yok. Gerekli: " + needed + "." });
    }
    await client.query(
      `UPDATE player_cities SET wood = wood - $2, stone = stone - $3, iron = iron - $4,
        food = food - $5, gold = gold - $6, horses = horses - $7, updated_at = NOW()
       WHERE player_id = $1`,
      [req.player.sub, cost.wood, cost.stone, cost.iron, cost.food, cost.gold, cost.horses]
    );
    const result = await client.query(
      `INSERT INTO player_army (player_id, faction_id, unit_id, quantity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, unit_id)
       DO UPDATE SET quantity = player_army.quantity + EXCLUDED.quantity,
                     updated_at = NOW()
       RETURNING unit_id, quantity`,
      [req.player.sub, factionId, unitId, quantity]
    );

    await client.query("COMMIT");
    res.status(201).json({
      instantTraining: true,
      trained: result.rows[0],
      spent: cost,
      message: quantity + " asker anında orduna eklendi. Kaynakların düşüldü."
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Asker eğitimi başlatılamadı:", error);
    res.status(500).json({ error: "Asker eğitimi başlatılamadı." });
  } finally {
    client.release();
  }
}
