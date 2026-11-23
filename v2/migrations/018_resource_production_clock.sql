ALTER TABLE umaykut_v2.player_game_state
  ADD COLUMN IF NOT EXISTS last_resource_tick TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS production_remainders JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE umaykut_v2.player_game_state
SET last_resource_tick = COALESCE(last_resource_tick, updated_at, NOW()),
    production_remainders = COALESCE(production_remainders, '{}'::jsonb);
