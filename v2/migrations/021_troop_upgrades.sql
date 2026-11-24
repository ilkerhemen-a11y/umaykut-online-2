ALTER TABLE umaykut_v2.player_game_state
  ADD COLUMN IF NOT EXISTS troop_upgrades JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE umaykut_v2.player_game_state
  ADD CONSTRAINT player_game_state_troop_upgrades_object
    CHECK (jsonb_typeof(troop_upgrades) = 'object');
