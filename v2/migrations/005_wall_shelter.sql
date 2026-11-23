ALTER TABLE umaykut_v2.player_game_state
  ADD COLUMN IF NOT EXISTS wall JSONB NOT NULL DEFAULT '{"level":1}'::jsonb;

ALTER TABLE umaykut_v2.player_game_state
  ADD CONSTRAINT player_game_state_wall_object
  CHECK (jsonb_typeof(wall) = 'object');
