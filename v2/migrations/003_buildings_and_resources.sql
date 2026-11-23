ALTER TABLE umaykut_v2.player_game_state
  ADD COLUMN IF NOT EXISTS resources JSONB NOT NULL
    DEFAULT '{"gold":1650,"wood":6900,"food":9350,"stone":7480,"iron":8040,"horses":100}'::jsonb,
  ADD COLUMN IF NOT EXISTS buildings JSONB NOT NULL
    DEFAULT '{"1":{"type":"center","level":1}}'::jsonb;

ALTER TABLE umaykut_v2.player_game_state
  ADD CONSTRAINT player_game_state_resources_object
    CHECK (jsonb_typeof(resources) = 'object'),
  ADD CONSTRAINT player_game_state_buildings_object
    CHECK (jsonb_typeof(buildings) = 'object');
