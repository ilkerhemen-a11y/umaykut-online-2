CREATE TABLE IF NOT EXISTS umaykut_v2.neutral_region_battle_reports (
  id BIGSERIAL PRIMARY KEY,
  region_id INTEGER NOT NULL REFERENCES umaykut_v2.world_neutral_regions(id) ON DELETE CASCADE,
  actor_player_id UUID NOT NULL REFERENCES umaykut_v2.players(id) ON DELETE CASCADE,
  opponent_player_id UUID REFERENCES umaykut_v2.players(id) ON DELETE SET NULL,
  battle_type VARCHAR(24) NOT NULL CHECK (battle_type IN ('guard_challenge','claim_attack','territory_attack')),
  battle_report JSONB NOT NULL CHECK (jsonb_typeof(battle_report) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS neutral_region_battle_reports_actor_idx
  ON umaykut_v2.neutral_region_battle_reports(actor_player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS neutral_region_battle_reports_opponent_idx
  ON umaykut_v2.neutral_region_battle_reports(opponent_player_id, created_at DESC);
