CREATE TABLE IF NOT EXISTS umaykut_v2.player_quest_claims (
  player_id uuid NOT NULL REFERENCES umaykut_v2.players(id) ON DELETE CASCADE,
  quest_id text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, quest_id)
);
CREATE INDEX IF NOT EXISTS player_quest_claims_player_claimed_idx
  ON umaykut_v2.player_quest_claims (player_id, claimed_at DESC);
