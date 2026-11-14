import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";

const usernamePattern = /^[a-zA-Z0-9_]{3,18}$/;

export async function register(req, res) {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || !usernamePattern.test(username)) {
    return res.status(400).json({ error: "Oyuncu adı 3-18 karakter olmalı; harf, rakam ve _ kullanılabilir." });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: "Şifre 8-72 karakter arasında olmalı." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await client.query(
      "INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username, passwordHash]
    );
    const player = result.rows[0];
    await client.query(
      "INSERT INTO player_cities (player_id, city_name) VALUES ($1, $2)",
      [player.id, player.username + 'in Yurdu']
    );
    await client.query("COMMIT");
    return res.status(201).json({ player: { id: player.id, username: player.username } });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") return res.status(409).json({ error: "Bu oyuncu adı zaten kullanılıyor." });
    console.error("Kayıt hatası:", error);
    return res.status(500).json({ error: "Hesap oluşturulamadı." });
  } finally {
    client.release();
  }
}

export async function login(req, res) {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Oyuncu adı ve şifre gerekli." });
  }
  const result = await pool.query(
    "SELECT id, username, password_hash FROM players WHERE username = $1",
    [username]
  );
  const player = result.rows[0];
  if (!player || !(await bcrypt.compare(password, player.password_hash))) {
    return res.status(401).json({ error: "Oyuncu adı veya şifre hatalı." });
  }
  const token = jwt.sign(
    { sub: String(player.id), username: player.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  return res.json({ token, player: { id: player.id, username: player.username } });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Giriş gerekli." });
  try {
    req.player = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Oturum geçersiz veya süresi dolmuş." });
  }
}