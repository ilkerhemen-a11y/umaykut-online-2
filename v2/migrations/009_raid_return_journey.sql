ALTER TABLE umaykut_v2.player_raids
  ADD COLUMN IF NOT EXISTS return_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS player_raids_returning_idx
  ON umaykut_v2.player_raids(attacker_id, return_at)
  WHERE status = 'resolved';
