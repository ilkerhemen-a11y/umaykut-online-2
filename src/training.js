import { pool } from "./db.js";
import { getFactionUnits } from "./units.js";

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
    const allowed = getFactionUnits(factionId)?.some(unit => unit.id === unitId);
    if (!allowed) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Bu asker seçtiğin devlete ait değil." });
    }

    await settleLegacyTraining(client, req.player.sub);
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
      message: quantity + " asker anında orduna eklendi."
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Asker eğitimi başlatılamadı:", error);
    res.status(500).json({ error: "Asker eğitimi başlatılamadı." });
  } finally {
    client.release();
  }
}
