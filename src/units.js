import { pool } from "./db.js";

// İstatistik sırası: saldırı, piyadelere karşı savunma, atlılara karşı savunma, hareket hızı, yağma taşıma kapasitesi.
// Son değer altın değildir; askerin yağmaya çıktığında taşıyabileceği toplam ganimet miktarıdır.
const columns = [
  { id: "barracks_1", building: "Kışla", level: 1, role: "Piyade" },
  { id: "archer", building: "Kışla", level: 1, role: "Okçu" },
  { id: "barracks_5", building: "Kışla", level: 5, role: "Kalkanlı" },
  { id: "barracks_10", building: "Kışla", level: 10, role: "Elit muhafız" },
  { id: "stable_1", building: "Ahır", level: 1, role: "Hafif süvari" },
  { id: "stable_5", building: "Ahır", level: 5, role: "Atlı okçu" },
  { id: "stable_10", building: "Ahır", level: 10, role: "Ağır süvari" }
];

const raw = {
  gokturk: [
    [20,30,15,18,30], [25,100,30,20,30], [10,20,150,16,60],
    [100,80,40,25,60], [40,140,50,30,40], [110,50,50,40,100], [150,110,110,30,60]
  ],
  selcuk: [
    [15,20,10,22,30], [25,90,15,22,30], [40,20,90,18,40],
    [115,55,55,25,50], [20,50,140,30,40], [60,120,20,45,80], [160,90,90,35,90]
  ],
  hun: [
    [25,25,25,24,60], [30,80,15,24,40], [30,30,90,20,40],
    [130,50,70,27,80], [50,50,110,40,40], [120,110,20,50,120], [190,70,70,40,100]
  ]
};

const factionNames = { selcuk: "Selçuk Devleti", hun: "Hun Devleti", gokturk: "Göktürk Devleti" };

export function getFactionUnits(factionId) {
  const values = raw[factionId];
  if (!values) return null;
  return values.map((stats, index) => ({
    ...columns[index],
    stats: {
      attack: stats[0],
      infantryDefense: stats[1],
      cavalryDefense: stats[2],
      movementSpeed: stats[3],
      carryCapacity: stats[4]
    }
  }));
}

export function getUnitCatalog(_req, res) {
  const units = Object.entries(raw).flatMap(([factionId, values]) =>
    values.map((stats, index) => ({
      ...columns[index],
      id: columns[index].id,
      factionId,
      factionName: factionNames[factionId],
      stats: {
        attack: stats[0],
        infantryDefense: stats[1],
        cavalryDefense: stats[2],
        movementSpeed: stats[3],
        carryCapacity: stats[4]
      }
    }))
  );
  res.json({
    statLabels: {
      attack: "Saldırı",
      infantryDefense: "Piyadelere karşı savunma",
      cavalryDefense: "Atlılara karşı savunma",
      movementSpeed: "Hareket hızı",
      carryCapacity: "Yağma taşıma kapasitesi"
    },
    columns,
    units
  });
}

export async function getMyUnitCatalog(req, res) {
  const result = await pool.query("SELECT faction_id FROM players WHERE id = $1", [req.player.sub]);
  const factionId = result.rows[0]?.faction_id;
  if (!factionId) return res.status(409).json({ error: "Önce bir devlet seçmelisin." });
  const units = getFactionUnits(factionId);
  if (!units) return res.status(500).json({ error: "Oyuncu devletinin asker kataloğu bulunamadı." });
  res.json({
    factionId,
    factionName: factionNames[factionId],
    statLabels: {
      attack: "Saldırı",
      infantryDefense: "Piyadelere karşı savunma",
      cavalryDefense: "Atlılara karşı savunma",
      movementSpeed: "Hareket hızı",
      carryCapacity: "Yağma taşıma kapasitesi"
    },
    units
  });
}
