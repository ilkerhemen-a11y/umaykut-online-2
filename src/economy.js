import { pool } from "./db.js";

const RESOURCE_TYPES = Object.freeze([
  { id: "food", name: "Tahıl", icon: "🌾", yieldPerWorkerHour: 1 },
  { id: "wood", name: "Odun", icon: "🌳", yieldPerWorkerHour: 1 },
  { id: "stone", name: "Taş", icon: "🪨", yieldPerWorkerHour: 1 },
  { id: "iron", name: "Demir", icon: "⛏️", yieldPerWorkerHour: 1 },
  { id: "gold", name: "Altın", icon: "🪙", yieldPerWorkerHour: 0.5 },
  { id: "horses", name: "At", icon: "🐎", yieldPerWorkerHour: 0.25 }
]);
const WORKERS_PER_NODE_PER_CENTER_LEVEL = 300;

async function ensureCityNodes(client, playerId) {
  const city = await client.query(
    "SELECT x, y FROM player_cities WHERE player_id = $1",
    [playerId]
  );
  if (!city.rows[0]) return;
  const offsets = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2]];
  for (let i = 0; i < RESOURCE_TYPES.length; i += 1) {
    const resource = RESOURCE_TYPES[i];
    await client.query(
      `INSERT INTO city_resource_nodes
        (city_player_id, resource_type, x, y, yield_per_worker_hour)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (city_player_id, resource_type) DO NOTHING`,
      [playerId, resource.id, city.rows[0].x + offsets[i][0], city.rows[0].y + offsets[i][1], resource.yieldPerWorkerHour]
    );
  }
}

async function settleProduction(client, playerId) {
  await client.query(
    "SELECT player_id FROM player_cities WHERE player_id = $1 FOR UPDATE",
    [playerId]
  );
  await ensureCityNodes(client, playerId);
  const result = await client.query(
    `SELECT c.level, c.worker_pool, c.wood, c.stone, c.iron, c.food, c.gold, c.horses,
            c.production_remainders, c.last_production_at,
            COALESCE(SUM(n.workers_assigned), 0)::integer AS assigned_workers
       FROM player_cities c
       LEFT JOIN city_resource_nodes n ON n.city_player_id = c.player_id
      WHERE c.player_id = $1
      GROUP BY c.player_id`,
    [playerId]
  );
  const city = result.rows[0];
  if (!city) return null;

  const now = Date.now();
  const elapsedHours = Math.max(0, (now - new Date(city.last_production_at).getTime()) / 3600000);
  const nodes = await client.query(
    "SELECT resource_type, workers_assigned, yield_per_worker_hour FROM city_resource_nodes WHERE city_player_id = $1",
    [playerId]
  );
  const remainders = city.production_remainders || {};
  const updates = {};
  for (const node of nodes.rows) {
    const exact = Number(node.workers_assigned) * Number(node.yield_per_worker_hour) * elapsedHours + Number(remainders[node.resource_type] || 0);
    updates[node.resource_type] = Math.floor(exact);
    remainders[node.resource_type] = exact - updates[node.resource_type];
  }
  await client.query(
    `UPDATE player_cities
        SET food = food + $2, wood = wood + $3, stone = stone + $4,
            iron = iron + $5, gold = gold + $6, horses = horses + $7,
            production_remainders = $8::jsonb, last_production_at = NOW(),
            updated_at = NOW()
      WHERE player_id = $1`,
    [playerId, updates.food || 0, updates.wood || 0, updates.stone || 0,
      updates.iron || 0, updates.gold || 0, updates.horses || 0, JSON.stringify(remainders)]
  );

  const cap = Number(city.level) * WORKERS_PER_NODE_PER_CENTER_LEVEL;
  // Merkez seviyesi düşerse her düğümün sınırını aşan işçiler otomatik boşta kalır.
  await client.query(
    "UPDATE city_resource_nodes SET workers_assigned = LEAST(workers_assigned, $2) WHERE city_player_id = $1",
    [playerId, cap]
  );
  return { level: Number(city.level), workerPool: Number(city.worker_pool) };
}

export async function getMyEconomy(req, res) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const state = await settleProduction(client, req.player.sub);
    if (!state) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Şehir bulunamadı." });
    }
    const cityResult = await client.query(
      `SELECT level, worker_pool, wood, stone, iron, food, gold, horses,
              COALESCE(SUM(n.workers_assigned), 0)::integer AS assigned_workers
         FROM player_cities c
         LEFT JOIN city_resource_nodes n ON n.city_player_id = c.player_id
        WHERE c.player_id = $1
        GROUP BY c.player_id`,
      [req.player.sub]
    );
    const nodesResult = await client.query(
      `SELECT id, resource_type, x, y, workers_assigned, yield_per_worker_hour
         FROM city_resource_nodes WHERE city_player_id = $1 ORDER BY id`,
      [req.player.sub]
    );
    const city = cityResult.rows[0];
    const assigned = Number(city.assigned_workers);
    const centerLevel = Number(city.level);
    const resources = Object.fromEntries(["food", "wood", "stone", "iron", "gold", "horses"].map(key => [key, Number(city[key])]));
    const nodes = nodesResult.rows.map(node => {
      const type = RESOURCE_TYPES.find(item => item.id === node.resource_type);
      return {
        id: Number(node.id), resourceType: node.resource_type, name: type.name, icon: type.icon,
        x: Number(node.x), y: Number(node.y), workersAssigned: Number(node.workers_assigned),
        maxWorkers: centerLevel * WORKERS_PER_NODE_PER_CENTER_LEVEL,
        yieldPerWorkerHour: Number(node.yield_per_worker_hour)
      };
    });
    await client.query("COMMIT");
    res.json({
      workerPool: Number(city.worker_pool),
      assignedWorkers: assigned,
      availableWorkers: Math.max(0, Number(city.worker_pool) - assigned),
      centerLevel,
      maxWorkersPerNode: centerLevel * WORKERS_PER_NODE_PER_CENTER_LEVEL,
      resources,
      nodes
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ekonomi verisi alınamadı:", error);
    res.status(500).json({ error: "İşçi ve kaynak bilgileri alınamadı." });
  } finally {
    client.release();
  }
}

export async function assignWorkers(req, res) {
  const nodeId = Number(req.body?.nodeId);
  const workers = Number(req.body?.workers);
  if (!Number.isSafeInteger(nodeId) || nodeId < 1 || !Number.isSafeInteger(workers) || workers < 0 || workers > 1000000) {
    return res.status(400).json({ error: "Kaynak düğümü ve işçi sayısı geçerli olmalı." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const state = await settleProduction(client, req.player.sub);
    if (!state) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Şehir bulunamadı." });
    }
    const cityResult = await client.query(
      "SELECT level FROM player_cities WHERE player_id = $1 FOR UPDATE",
      [req.player.sub]
    );
    const nodeResult = await client.query(
      "SELECT id, resource_type, workers_assigned FROM city_resource_nodes WHERE id = $1 AND city_player_id = $2 FOR UPDATE",
      [nodeId, req.player.sub]
    );
    if (!nodeResult.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Bu kaynak noktası şehrine ait değil." });
    }
    const current = Number(nodeResult.rows[0].workers_assigned);
    const delta = workers - current;
    const cap = Number(cityResult.rows[0].level) * WORKERS_PER_NODE_PER_CENTER_LEVEL;
    if (workers > cap) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Merkez seviyesi için bu noktaya en fazla ${cap} işçi atanabilir.` });
    }
    const totals = await client.query(
      "SELECT COALESCE(SUM(workers_assigned), 0)::integer AS assigned FROM city_resource_nodes WHERE city_player_id = $1",
      [req.player.sub]
    );
    const poolResult = await client.query("SELECT worker_pool FROM player_cities WHERE player_id = $1", [req.player.sub]);
    const available = Number(poolResult.rows[0].worker_pool) - Number(totals.rows[0].assigned);
    if (delta > available) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Yeterli boşta işçi yok. Kullanılabilir işçi: ${available}.` });
    }
    await client.query(
      "UPDATE city_resource_nodes SET workers_assigned = $1, updated_at = NOW() WHERE id = $2",
      [workers, nodeId]
    );
    await client.query("COMMIT");
    return res.json({ success: true, message: "İşçi dağılımı kaydedildi." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("İşçi atama hatası:", error);
    return res.status(500).json({ error: "İşçi dağılımı kaydedilemedi." });
  } finally {
    client.release();
  }
}
