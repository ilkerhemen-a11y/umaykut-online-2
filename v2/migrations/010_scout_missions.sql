CREATE TABLE IF NOT EXISTS umaykut_v2.player_scout_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id UUID NOT NULL REFERENCES umaykut_v2.players(id) ON DELETE CASCADE,
  defender_id UUID NOT NULL REFERENCES umaykut_v2.players(id) ON DELETE CASCADE,
  attacker_village VARCHAR(80) NOT NULL,
  defender_village VARCHAR(80) NOT NULL,
  scout_count INTEGER NOT NULL CHECK (scout_count BETWEEN 1 AND 100),
  departed_at TIMESTAMPTZ NOT NULL,
  arrives_at TIMESTAMPTZ NOT NULL,
  return_at TIMESTAMPTZ,
  status VARCHAR(16) NOT NULL DEFAULT 'marching' CHECK (status IN ('marching','resolved','returned')),
  scout_report JSONB CHECK (scout_report IS NULL OR jsonb_typeof(scout_report)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (attacker_id <> defender_id),
  CHECK (arrives_at > departed_at)
);
CREATE INDEX IF NOT EXISTS player_scout_missions_attacker_idx
  ON umaykut_v2.player_scout_missions(attacker_id,departed_at DESC);
CREATE INDEX IF NOT EXISTS player_scout_missions_due_idx
  ON umaykut_v2.player_scout_missions(attacker_id,arrives_at)
  WHERE status='marching';
CREATE INDEX IF NOT EXISTS player_scout_missions_return_idx
  ON umaykut_v2.player_scout_missions(attacker_id,return_at)
  WHERE status='resolved';
