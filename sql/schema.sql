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

CREATE INDEX IF NOT EXISTS idx_player_cities_coordinates
  ON player_cities (x, y);

-- Kalıcı devlet seçimi. Mevcut hesaplarda NULL kalır ve ilk girişte seçim istenir.
ALTER TABLE players ADD COLUMN IF NOT EXISTS faction_id VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_players_faction_id ON players (faction_id);

-- Oyuncunun devletine ait kalıcı ordu mevcudu.
CREATE TABLE IF NOT EXISTS player_army (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  faction_id VARCHAR(20) NOT NULL CHECK (faction_id IN ('selcuk', 'hun', 'gokturk')),
  unit_id VARCHAR(32) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, unit_id)
);

-- Sunucu saatine göre tamamlanan asker eğitimleri.
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

 
-- Şehir başına harita kaynak noktaları ve işçi dağılımı.
CREATE TABLE IF NOT EXISTS city_resource_nodes (
  id BIGSERIAL PRIMARY KEY,
  city_player_id BIGINT NOT NULL REFERENCES player_cities(player_id) ON DELETE CASCADE,
  resource_type VARCHAR(16) NOT NULL CHECK (resource_type IN ('food','wood','stone','iron','gold','horses')),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  workers_assigned INTEGER NOT NULL DEFAULT 0 CHECK (workers_assigned >= 0),
  yield_per_worker_hour NUMERIC(8,3) NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (city_player_id, resource_type)
);
