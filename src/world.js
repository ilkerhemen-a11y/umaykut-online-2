import { pool } from "./db.js";

export async function getWorld(_req, res) {
  const result = await pool.query(`
    SELECT p.id, p.username, c.city_name, c.x, c.y, c.level
    FROM players p
    JOIN player_cities c ON c.player_id = p.id
    ORDER BY p.id
    LIMIT 500
  `);
  res.json({ world: "bozkir-1", cities: result.rows });
}

export async function getMyCity(req, res) {
  const result = await pool.query(
    `SELECT city_name, x, y, level, wood, stone, iron, food
     FROM player_cities WHERE player_id = $1`,
    [req.player.sub]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Şehir bulunamadı." });
  res.json({ city: result.rows[0] });
}