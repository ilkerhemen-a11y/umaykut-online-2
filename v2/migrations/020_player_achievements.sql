CREATE TABLE IF NOT EXISTS umaykut_v2.player_achievement_unlocks (
  player_id uuid NOT NULL REFERENCES umaykut_v2.players(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS player_achievement_unlocks_player_unlocked_idx
  ON umaykut_v2.player_achievement_unlocks (player_id, unlocked_at DESC);
