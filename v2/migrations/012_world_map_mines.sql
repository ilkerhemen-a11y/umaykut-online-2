ALTER TABLE umaykut_v2.player_game_state
  ADD COLUMN IF NOT EXISTS world_x DOUBLE PRECISION NOT NULL DEFAULT (5 + random() * 90),
  ADD COLUMN IF NOT EXISTS world_y DOUBLE PRECISION NOT NULL DEFAULT (5 + random() * 90);

ALTER TABLE umaykut_v2.player_game_state
  ADD CONSTRAINT player_game_state_world_x_range CHECK (world_x BETWEEN 0 AND 100),
  ADD CONSTRAINT player_game_state_world_y_range CHECK (world_y BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS umaykut_v2.world_resource_nodes (
  id INTEGER PRIMARY KEY,
  resource_type VARCHAR(16) NOT NULL CHECK (resource_type IN ('iron','stone','gold')),
  world_x DOUBLE PRECISION NOT NULL CHECK (world_x BETWEEN 0 AND 100),
  world_y DOUBLE PRECISION NOT NULL CHECK (world_y BETWEEN 0 AND 100),
  yield_level INTEGER NOT NULL CHECK (yield_level BETWEEN 4 AND 9),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO umaykut_v2.world_resource_nodes(id,resource_type,world_x,world_y,yield_level)
SELECT n,
       CASE n % 3 WHEN 0 THEN 'iron' WHEN 1 THEN 'stone' ELSE 'gold' END,
       4 + random() * 92,
       4 + random() * 92,
       4 + floor(random() * 6)::INTEGER
FROM generate_series(1,96) AS n
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS world_resource_nodes_position_idx
  ON umaykut_v2.world_resource_nodes(world_y,world_x);
