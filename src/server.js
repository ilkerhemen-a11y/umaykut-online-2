import "dotenv/config";
import express from "express";
import http from "node:http";
import cors from "cors";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { pool } from "./db.js";
import { register, login, requireAuth } from "./auth.js";
import { getWorld, getMyCity } from "./world.js";
import { getFactions, getMyFaction, selectFaction } from "./factions.js";
import { getUnitCatalog, getMyUnitCatalog } from "./units.js";
import { getMyArmy } from "./army.js";
import { getMyTraining, startTraining } from "./training.js";
import { getMyEconomy, assignWorkers } from "./economy.js";
import { getMyBuildings, placeBuilding, upgradeBuilding, speedUpBuilding } from "./buildings.js";
import { getMarket, buyMarketItem } from "./market.js";

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
      gold BIGINT NOT NULL DEFAULT 0,
      horses BIGINT NOT NULL DEFAULT 0,
      worker_pool INTEGER NOT NULL DEFAULT 1800,
      production_remainders JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_production_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE player_cities ADD COLUMN IF NOT EXISTS gold BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE player_cities ADD COLUMN IF NOT EXISTS horses BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE player_cities ADD COLUMN IF NOT EXISTS worker_pool INTEGER NOT NULL DEFAULT 1800;
    ALTER TABLE player_cities ADD COLUMN IF NOT EXISTS production_remainders JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE player_cities ADD COLUMN IF NOT EXISTS last_production_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE TABLE IF NOT EXISTS city_buildings (
      id BIGSERIAL PRIMARY KEY,
      city_player_id BIGINT NOT NULL REFERENCES player_cities(player_id) ON DELETE CASCADE,
      building_type VARCHAR(24) NOT NULL,
      x NUMERIC(5,2) NOT NULL CHECK (x BETWEEN 3 AND 97),
      y NUMERIC(5,2) NOT NULL CHECK (y BETWEEN 3 AND 97),
      level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (city_player_id, building_type)
    );
    INSERT INTO city_buildings (city_player_id, building_type, x, y, level)
      SELECT player_id, 'center', 50, 47, 1 FROM player_cities
      ON CONFLICT (city_player_id, building_type) DO NOTHING;
    CREATE TABLE IF NOT EXISTS city_resource_nodes (
      id BIGSERIAL PRIMARY KEY,
      city_player_id BIGINT NOT NULL REFERENCES player_cities(player_id) ON DELETE CASCADE,
      resource_type VARCHAR(16) NOT NULL CHECK (resource_type IN ('food','wood','stone','iron','gold','horses')),
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      level INTEGER NOT NULL DEFAULT 4 CHECK (level BETWEEN 4 AND 9),
      workers_assigned INTEGER NOT NULL DEFAULT 0 CHECK (workers_assigned >= 0),
      yield_per_worker_hour NUMERIC(8,3) NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (city_player_id, resource_type)
    );
    ALTER TABLE city_resource_nodes ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 4;
    ALTER TABLE city_resource_nodes DROP CONSTRAINT IF EXISTS city_resource_nodes_level_check;
    ALTER TABLE city_resource_nodes ADD CONSTRAINT city_resource_nodes_level_check CHECK (level BETWEEN 4 AND 9);
    UPDATE city_resource_nodes
       SET x = 5 + FLOOR(RANDOM() * 91)::integer,
           y = 5 + FLOOR(RANDOM() * 91)::integer,
           level = 4 + FLOOR(RANDOM() * 6)::integer
     WHERE x < 5 OR x > 95 OR y < 5 OR y > 95;
    CREATE INDEX IF NOT EXISTS idx_player_cities_coordinates
      ON player_cities (x, y);
    ALTER TABLE players ADD COLUMN IF NOT EXISTS faction_id VARCHAR(20);
    CREATE INDEX IF NOT EXISTS idx_players_faction_id ON players (faction_id);
    CREATE TABLE IF NOT EXISTS player_training_queue (
      id BIGSERIAL PRIMARY KEY,
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      faction_id VARCHAR(20) NOT NULL CHECK (faction_id IN ('selcuk', 'hun', 'gokturk')),
      unit_id VARCHAR(32) NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100),
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finishes_at TIMESTAMPTZ NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'training' CHECK (status IN ('training', 'completed')),
      completed_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_training_per_player
      ON player_training_queue (player_id) WHERE status = 'training';
    CREATE TABLE IF NOT EXISTS player_army (
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      faction_id VARCHAR(20) NOT NULL CHECK (faction_id IN ('selcuk', 'hun', 'gokturk')),
      unit_id VARCHAR(32) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (player_id, unit_id)
    );
  `);
}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name VARCHAR(120) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    DO $migration$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM app_migrations WHERE name = 'reset-village-to-nine-build-slots-v2') THEN
        DELETE FROM city_buildings WHERE building_type <> 'center';
        INSERT INTO app_migrations (name) VALUES ('reset-village-to-nine-build-slots-v2');
      END IF;
    END;
    $migration$;
  `);

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
app.get("/api/factions", getFactions);
app.get("/api/faction/me", requireAuth, getMyFaction);
app.post("/api/faction/select", requireAuth, selectFaction);
app.get("/api/units", getUnitCatalog);
app.get("/api/units/me", requireAuth, getMyUnitCatalog);
app.get("/api/army/me", requireAuth, getMyArmy);
app.get("/api/training/me", requireAuth, getMyTraining);
app.post("/api/training/start", requireAuth, startTraining);
app.get("/api/world", requireAuth, getWorld);
app.get("/api/city/me", requireAuth, getMyCity);
app.get("/api/buildings/me", requireAuth, getMyBuildings);
app.post("/api/buildings/place", requireAuth, placeBuilding);
app.post("/api/buildings/upgrade", requireAuth, upgradeBuilding);
app.post("/api/buildings/speed-up", requireAuth, speedUpBuilding);
app.get("/api/market/me", requireAuth, getMarket);
app.post("/api/market/buy", requireAuth, buyMarketItem);
app.get("/api/economy/me", requireAuth, getMyEconomy);
app.post("/api/economy/assign", requireAuth, assignWorkers);

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
