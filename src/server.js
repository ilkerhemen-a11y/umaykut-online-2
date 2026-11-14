import "dotenv/config";
import express from "express";
import http from "node:http";
import cors from "cors";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { pool } from "./db.js";
import { register, login, requireAuth } from "./auth.js";
import { getWorld, getMyCity } from "./world.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET en az 32 karakterlik güçlü bir gizli anahtar olmalı.");
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(18) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS player_cities (
      player_id BIGINT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      city_name VARCHAR(32) NOT NULL DEFAULT 'Yeni Yurt',
      x INTEGER NOT NULL DEFAULT 0,
      y INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      wood INTEGER NOT NULL DEFAULT 120,
      stone INTEGER NOT NULL DEFAULT 100,
      iron INTEGER NOT NULL DEFAULT 60,
      food INTEGER NOT NULL DEFAULT 150,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_player_cities_coordinates
      ON player_cities (x, y);
  `);
}

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.CLIENT_ORIGIN || "*";

app.use(cors({ origin: allowedOrigin === "*" ? true : allowedOrigin }));
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", service: "umaykut-online-2", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});
app.post("/api/auth/register", register);
app.post("/api/auth/login", login);
app.get("/api/world", requireAuth, getWorld);
app.get("/api/city/me", requireAuth, getMyCity);

const io = new Server(server, {
  cors: { origin: allowedOrigin === "*" ? true : allowedOrigin }
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Giriş gerekli."));
    socket.player = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Oturum geçersiz."));
  }
});

io.on("connection", socket => {
  socket.join("bozkir-1");
  socket.emit("world:connected", {
    world: "bozkir-1",
    playerId: socket.player.sub,
    username: socket.player.username
  });
});

const port = Number(process.env.PORT || 3000);
ensureSchema()
  .then(() => server.listen(port, () => console.log(`Umaykut Online 2 API ${port} portunda hazır.`)))
  .catch(error => {
    console.error("Veritabanı şeması hazırlanamadı:", error);
    process.exit(1);
  });
