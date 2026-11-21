ALTER TABLE umaykut_v2.world_neutral_regions
  ADD COLUMN IF NOT EXISTS claimed_faction_id VARCHAR(24)
  CHECK (claimed_faction_id IS NULL OR claimed_faction_id IN ('gokturk','hun','seljuk'));
CREATE INDEX IF NOT EXISTS world_neutral_regions_claimed_faction_idx
  ON umaykut_v2.world_neutral_regions(claimed_faction_id)
  WHERE claimed_faction_id IS NOT NULL;
