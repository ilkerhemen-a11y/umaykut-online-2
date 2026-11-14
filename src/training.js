import { pool } from "./db.js";
import { getFactionUnits } from "./units.js";

const TRAINING_SECONDS = {
  barracks_1: 20,
  archer: 25,
  barracks_5: 35,
  barracks_10: 50,
  stable_1: 35,
  stable_5: 45,
  stable_10: 60
};

async function settleFinishedTraining(client, playerId) {
  const result = await client.query(
    `SELECT id, faction_id, unit_id, quantity
     FROM player_training_queue
     WHERE player_id = $1 AND status = 'training' AND finishes_at <= NOW()
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
    await settleFinishedTraining(client, req.player.sub);
    const result = await client.query(
      `SELECT id, unit_id, quantity, started_at, finishes_at, status
       FROM player_training_queue
       WHERE player_id = $1 AND status = 'training'
       ORDER BY finishes_at ASC LIMIT 1`,
      [req.player.sub]
    );
    await client.query("COMMIT");
    res.json({ activeTraining: result.rows[0] || null });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Eğitim kuyruğu okunamadı:", error);
    res.status(500).json({ error: "Eğitim kuyruğu yüklenemedi." });
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
  const duration = TRAINING_SECONDS[unitId];
  if (!duration) return res.status(400).json({ error: "Geçersiz asker türü." });

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

    await settleFinishedTraining(client, req.player.sub);
    const active = await client.query(
      "SELECT id FROM player_training_queue WHERE player_id = $1 AND status = 'training' FOR UPDATE",
      [req.player.sub]
    );
    if (active.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Önce devam eden asker eğitimini tamamlamalısın." });
    }
    const result = await client.query(
      `INSERT INTO player_training_queue
       (player_id, faction_id, unit_id, quantity, started_at, finishes_at, status)
       VALUES ($1, $2, $3, $4, NOW(), NOW() + ($5 * $4) * INTERVAL '1 second', 'training')
       RETURNING id, unit_id, quantity, started_at, finishes_at, status`,
      [req.player.sub, factionId, unitId, quantity, duration]
    );
    await client.query("COMMIT");
    res.status(201).json({ activeTraining: result.rows[0], secondsPerUnit: duration });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Asker eğitimi başlatılamadı:", error);
    res.status(500).json({ error: "Asker eğitimi başlatılamadı." });
  } finally {
    client.release();
  }
}
