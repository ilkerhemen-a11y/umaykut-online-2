import { pool } from "./db.js";
import {
  FACTION_BONUSES,
  FACTION_BONUS_BUDGET_PERCENT,
  getFactionBonusBudget
} from "./factionBonuses.js";

export const FACTIONS = Object.freeze([
  {
    id: "selcuk",
    name: "Selçuk Devleti",
    style: "Dengeli",
    description: "Akıl, düzen ve uyumla hareket eden; saldırı ve savunmayı birlikte geliştiren devlet.",
    motto: "Güç, akıl ve adaletle birleşir.",
    startingCity: "Selçuk Hanlığı",
    startingRegion: "Selçuk Hanlığı",
    bonuses: FACTION_BONUSES.selcuk,
    bonusBudgetPercent: getFactionBonusBudget(FACTION_BONUSES.selcuk),
    bonusBudgetLimitPercent: FACTION_BONUS_BUDGET_PERCENT,
    bonusLabels: ["Saldırı +%3", "Savunma +%3", "Maksimum HP +%2"],
    colors: ["#39a6a0", "#d8b45a"],
    emblem: "🦅"
  },
  {
    id: "hun",
    name: "Hun Devleti",
    style: "Agresif savaşçı",
    description: "Hızlı hücumları, cesur savaşçıları ve bozkır süvarileriyle tanınan devlet.",
    motto: "Cesaret bozkırda yol açar.",
    startingCity: "Hun Otağı",
    startingRegion: "Hun Otağı",
    bonuses: FACTION_BONUSES.hun,
    bonusBudgetPercent: getFactionBonusBudget(FACTION_BONUSES.hun),
    bonusBudgetLimitPercent: FACTION_BONUS_BUDGET_PERCENT,
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
    startingCity: "Ötüken",
    startingRegion: "Ötüken",
    bonuses: FACTION_BONUSES.gokturk,
    bonusBudgetPercent: getFactionBonusBudget(FACTION_BONUSES.gokturk),
    bonusBudgetLimitPercent: FACTION_BONUS_BUDGET_PERCENT,
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
    const cityUpdate = await client.query(
      "UPDATE player_cities SET city_name = $1, updated_at = NOW() WHERE player_id = $2",
      [faction.startingCity, req.player.sub]
    );
    if (cityUpdate.rowCount !== 1) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Devlet seçimi için başlangıç şehri bulunamadı." });
    }

    await client.query("COMMIT");
    return res.status(201).json({ faction, message: "Devletin ve başlangıç şehrin kalıcı olarak kaydedildi." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Devlet seçimi hatası:", error);
    return res.status(500).json({ error: "Devlet seçimi kaydedilemedi." });
  } finally {
    client.release();
  }
}
