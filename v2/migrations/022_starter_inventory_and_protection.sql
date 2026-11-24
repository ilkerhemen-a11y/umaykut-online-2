ALTER TABLE umaykut_v2.player_game_state
  ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL
  DEFAULT '{"speedup_10m":1,"speedup_30m":1,"speedup_1h":1,"village_protection_24h":1}'::jsonb;

ALTER TABLE umaykut_v2.player_game_state
  ADD COLUMN IF NOT EXISTS protection_expires_at TIMESTAMPTZ;

UPDATE umaykut_v2.player_game_state
SET inventory = COALESCE(inventory, '{"speedup_10m":1,"speedup_30m":1,"speedup_1h":1,"village_protection_24h":1}'::jsonb)
WHERE inventory IS NULL;
