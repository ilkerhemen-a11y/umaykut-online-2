import { pool } from "./db.js";

// İstatistik sırası: saldırı, piyadelere karşı savunma, atlılara karşı savunma, hareket hızı, yağma taşıma kapasitesi.
const columns = [
  { id: "barracks_1", building: "Kışla", level: 1, role: "Piyade" },
  { id: "archer", building: "Kışla", level: 1, role: "Okçu" },
  { id: "barracks_5", building: "Kışla", level: 5, role: "Kalkanlı" },
  { id: "barracks_10", building: "Kışla", level: 10, role: "Elit muhafız" },
  { id: "stable_1", building: "Ahır", level: 1, role: "Hafif süvari" },
  { id: "stable_5", building: "Ahır", level: 5, role: "Atlı okçu" },
  { id: "stable_10", building: "Ahır", level: 10, role: "Ağır süvari" },
  { id: "mancinik", building: "Kuşatma", level: 1, role: "Mancınık", unitType: "siege" },
  { id: "topcu", building: "Kuşatma", level: 1, role: "Topçu", unitType: "siege" }
];

const raw = {
  gokturk: [
    [20,30,15,18,30], [25,100,30,20,30], [10,20,150,16,60],
    [100,80,40,25,60], [40,140,50,30,40], [110,50,50,40,100], [150,110,110,30,60],
    [180,100,100,8,0], [260,120,120,5,0]
  ],
  selcuk: [
    [15,20,10,22,30], [25,90,15,22,30], [40,20,90,18,40],
    [115,55,55,25,50], [20,50,140,30,40], [60,120,20,45,80], [160,90,90,35,90],
    [190,90,110,8,0], [270,110,130,5,0]
  ],
  hun: [
    [25,25,25,24,60], [30,80,15,24,40], [30,30,90,20,40],
    [130,50,70,27,80], [50,50,110,40,40], [120,110,20,50,120], [190,70,70,40,100],
    [210,80,90,9,0], [290,100,110,6,0]
  ]
};

const factionNames = { selcuk: "Selçuk Devleti", hun: "Hun Devleti", gokturk: "Göktürk Devleti" };
const trainingCosts = {
  barracks_1: { wood: 12, food: 18, iron: 4, stone: 0, gold: 0, horses: 0 },
  archer: { wood: 16, food: 18, iron: 7, stone: 0, gold: 1, horses: 0 },
  barracks_5: { wood: 28, food: 25, iron: 16, stone: 8, gold: 3, horses: 0 },
  barracks_10: { wood: 48, food: 38, iron: 30, stone: 18, gold: 8, horses: 0 },
  stable_1: { wood: 24, food: 25, iron: 8, stone: 0, gold: 3, horses: 1 },
  stable_5: { wood: 38, food: 34, iron: 18, stone: 8, gold: 6, horses: 2 },
  stable_10: { wood: 58, food: 48, iron: 32, stone: 16, gold: 12, horses: 3 },
  mancinik: { wood: 100, food: 30, iron: 55, stone: 90, gold: 20, horses: 0 },
  topcu: { wood: 130, food: 40, iron: 75, stone: 110, gold: 30, horses: 0 }
};
export function getUnitTrainingCost(unitId, quantity = 1) {
  const base = trainingCosts[unitId];
  if (!base) return null;
  return Object.fromEntries(Object.entries(base).map(([resource, amount]) => [resource, amount * quantity]));
}

export function getFactionUnits(factionId) {
  const values = raw[factionId];
  if (!values) return null;
  return values.map((stats, index) => ({
    ...columns[index],
    trainingCost: { ...trainingCosts[columns[index].id] },
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
      trainingCost: { ...trainingCosts[columns[index].id] },
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
