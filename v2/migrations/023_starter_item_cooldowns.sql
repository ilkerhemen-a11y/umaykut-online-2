ALTER TABLE umaykut_v2.player_game_state
  ADD COLUMN IF NOT EXISTS item_cooldowns JSONB NOT NULL DEFAULT '{}'::jsonb;
