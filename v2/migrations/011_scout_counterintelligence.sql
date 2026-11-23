ALTER TABLE umaykut_v2.player_scout_missions
  ADD COLUMN IF NOT EXISTS defender_report JSONB
  CHECK (defender_report IS NULL OR jsonb_typeof(defender_report)='object');

CREATE INDEX IF NOT EXISTS player_scout_missions_defender_inbox_idx
  ON umaykut_v2.player_scout_missions(defender_id,departed_at DESC);
