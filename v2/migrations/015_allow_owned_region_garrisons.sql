ALTER TABLE umaykut_v2.world_neutral_regions
  DROP CONSTRAINT IF EXISTS world_neutral_regions_check;
ALTER TABLE umaykut_v2.world_neutral_regions
  ADD CONSTRAINT world_neutral_regions_claim_state_check
  CHECK (
    (claimed_by_player_id IS NULL AND claimed_at IS NULL AND claim_expires_at IS NULL)
    OR
    (claimed_by_player_id IS NOT NULL AND claimed_at IS NOT NULL AND claim_expires_at IS NOT NULL)
  );
