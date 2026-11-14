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
