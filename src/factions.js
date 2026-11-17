import { pool } from "./db.js";

export const FACTIONS = Object.freeze([
  {
    id: "selcuk",
    name: "Selçuk Devleti",
    image: "/assets/IMG-20261117-WA0581.jpg",
    style: "Dengeli",
    description: "Akıl, düzen ve uyumla hareket eden; saldırı ve savunmayı birlikte geliştiren devlet.",
    motto: "Güç, akıl ve adaletle birleşir.",
    startingRegion: "Selçuk Hanlığı",
    bonuses: { attackPercent: 3, defensePercent: 3, maxHpPercent: 2, movementSpeedPercent: 0 },
    bonusLabels: ["Saldırı +%3", "Savunma +%3", "Maksimum HP +%2"],
    colors: ["#39a6a0", "#d8b45a"],
    emblem: "🦅"
  },
  {
    id: "hun",
    name: "Hun Devleti",
    image: "/assets/IMG-20261117-WA7162.jpg",
    style: "Agresif savaşçı",
    description: "Hızlı hücumları, cesur savaşçıları ve bozkır süvarileriyle tanınan devlet.",
    motto: "Cesaret bozkırda yol açar.",
    startingRegion: "Hun Otağı",
    bonuses: { attackPercent: 5, defensePercent: 0, maxHpPercent: 0, movementSpeedPercent: 3 },
    bonusLabels: ["Saldırı +%5", "Hareket hızı +%3"],
    colors: ["#a83227", "#d39a42"],
    emblem: "🐺"
  },
  {
    id: "gokturk",
    name: "Göktürk Devleti",
    style: "Savunma uzmanı",
    description: "Sağlam savunmaları, dayanıklı savaşçıları ve güçlü yurtlarıyla öne çıkan devlet.",
    motto: "Devlet yaşarsa millet yaşar.",
    startingRegion: "Ötüken",
    bonuses: { attackPercent: 0, defensePercent: 5, maxHpPercent: 3, movementSpeedPercent: 0 },
    bonusLabels: ["Savunma +%5", "Maksimum HP +%3"],
    colors: ["#3979ad", "#b7c6d6"],
    emblem: "🛡️"
  }
]);

export async function getFactions(_req, res) {
  res.json({ factions: FACTIONS });
}

export async function getMyFaction(req, res) {
  const result = await pool.query(
    "SELECT faction_id FROM players WHERE id = $1",
    [req.player.sub]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Oyuncu bulunamadı." });
  const faction = FACTIONS.find(item => item.id === result.rows[0].faction_id) ?? null;
  return res.json({ faction, canSelect: faction === null });
}

export async function selectFaction(req, res) {
  const factionId = req.body?.factionId;
  const faction = FACTIONS.find(item => item.id === factionId);
  if (!faction) {
    return res.status(400).json({ error: "Geçerli bir devlet seçmelisin." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const playerResult = await client.query(
      "SELECT faction_id FROM players WHERE id = $1 FOR UPDATE",
      [req.player.sub]
    );
    if (!playerResult.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Oyuncu bulunamadı." });
    }
    if (playerResult.rows[0].faction_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Devletin zaten seçilmiş. Normal şartlarda devlet değiştirilemez." });
    }

    await client.query(
      "UPDATE players SET faction_id = $1 WHERE id = $2 AND faction_id IS NULL",
      [faction.id, req.player.sub]
    );
    await client.query("COMMIT");
    return res.status(201).json({ faction, message: "Devletin kalıcı olarak kaydedildi." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Devlet seçimi hatası:", error);
    return res.status(500).json({ error: "Devlet seçimi kaydedilemedi." });
  } finally {
    client.release();
  }
}
