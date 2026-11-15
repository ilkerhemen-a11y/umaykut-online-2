import { ensureCityNodes } from "./economy.js";
import { pool } from "./db.js";

export async function getWorld(req, res) {
  const result = await pool.query(`
    SELECT p.id, p.username, c.city_name, c.x, c.y, c.level
    FROM players p
    JOIN player_cities c ON c.player_id = p.id
    ORDER BY p.id
    LIMIT 500
  `);
  for (const city of result.rows) await ensureCityNodes(pool, city.id);
  await ensureCityNodes(pool, req.player.sub);
  const resources = await pool.query(`
    SELECT n.id, n.city_player_id AS player_id, n.resource_type, n.x, n.y, n.level
    FROM city_resource_nodes n
    WHERE n.city_player_id = $1
    ORDER BY n.id
  `, [req.player.sub]);
  res.json({ world: "bozkir-1", cities: result.rows, resources: resources.rows });
}

export async function getMyCity(req, res) {
  const result = await pool.query(
    `SELECT city_name, x, y, level, wood, stone, iron, food, gold, horses, worker_pool
     FROM player_cities WHERE player_id = $1`,
    [req.player.sub]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Şehir bulunamadı." });
  res.json({ city: result.rows[0] });
}