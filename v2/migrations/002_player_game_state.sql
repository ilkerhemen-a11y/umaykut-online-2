CREATE TABLE IF NOT EXISTS umaykut_v2.player_game_state (
  player_id UUID PRIMARY KEY REFERENCES umaykut_v2.players(id) ON DELETE CASCADE,
  faction_id VARCHAR(16) CHECK (faction_id IS NULL OR faction_id IN ('hun', 'seljuk', 'gokturk')),
  worker_pool INTEGER NOT NULL DEFAULT 1800 CHECK (worker_pool >= 0),
  worker_assignments JSONB NOT NULL DEFAULT '{"grain":0,"wood":0,"stone":0}'::jsonb
    CHECK (jsonb_typeof(worker_assignments) = 'object'),
  worker_state_initialized BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
