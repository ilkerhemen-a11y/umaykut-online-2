CREATE TABLE IF NOT EXISTS umaykut_v2.player_raids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id UUID NOT NULL REFERENCES umaykut_v2.players(id) ON DELETE CASCADE,
  defender_id UUID NOT NULL REFERENCES umaykut_v2.players(id) ON DELETE CASCADE,
  attacker_village VARCHAR(32) NOT NULL,
  defender_village VARCHAR(32) NOT NULL,
  troops JSONB NOT NULL CHECK (jsonb_typeof(troops) = 'object'),
  attack_power BIGINT NOT NULL CHECK (attack_power > 0),
  departed_at TIMESTAMPTZ NOT NULL,
  arrives_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'marching' CHECK (status IN ('marching','resolved','returned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (attacker_id <> defender_id),
  CHECK (arrives_at > departed_at)
);
CREATE INDEX IF NOT EXISTS player_raids_attacker_status_idx ON umaykut_v2.player_raids(attacker_id,status,arrives_at);
CREATE INDEX IF NOT EXISTS player_raids_defender_status_idx ON umaykut_v2.player_raids(defender_id,status,arrives_at);
