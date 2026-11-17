ALTER TABLE umaykut_v2.player_game_state
  ADD COLUMN IF NOT EXISTS troops JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS training_queue JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE umaykut_v2.player_game_state
  ADD CONSTRAINT player_game_state_troops_object
    CHECK (jsonb_typeof(troops) = 'object'),
  ADD CONSTRAINT player_game_state_training_queue_array
    CHECK (jsonb_typeof(training_queue) = 'array');
