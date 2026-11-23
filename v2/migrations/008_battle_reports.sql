ALTER TABLE umaykut_v2.player_raids
  ADD COLUMN IF NOT EXISTS battle_report JSONB,
  ADD COLUMN IF NOT EXISTS loot JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE umaykut_v2.player_raids
  ADD CONSTRAINT player_raids_battle_report_object
    CHECK (battle_report IS NULL OR jsonb_typeof(battle_report) = 'object'),
  ADD CONSTRAINT player_raids_loot_object
    CHECK (jsonb_typeof(loot) = 'object');
