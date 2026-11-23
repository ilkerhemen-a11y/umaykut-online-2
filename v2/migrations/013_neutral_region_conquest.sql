-- Neutral villages, temporary garrisons and persistent faction ownership.
CREATE TABLE IF NOT EXISTS umaykut_v2.world_neutral_regions (
  id INTEGER PRIMARY KEY,
  region_name VARCHAR(64) NOT NULL,
  world_x DOUBLE PRECISION NOT NULL CHECK (world_x BETWEEN 0 AND 100),
  world_y DOUBLE PRECISION NOT NULL CHECK (world_y BETWEEN 0 AND 100),
  guard_troops JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_player_id UUID REFERENCES umaykut_v2.players(id) ON DELETE SET NULL,
  owner_faction_id VARCHAR(24) CHECK (owner_faction_id IN ('gokturk','hun','seljuk')),
  claimed_by_player_id UUID REFERENCES umaykut_v2.players(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  garrison_troops JSONB NOT NULL DEFAULT '{}'::jsonb,
  garrison_count INTEGER NOT NULL DEFAULT 0 CHECK (garrison_count BETWEEN 0 AND 100000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((claimed_by_player_id IS NULL AND claimed_at IS NULL AND claim_expires_at IS NULL AND garrison_count = 0)
      OR (claimed_by_player_id IS NOT NULL AND claimed_at IS NOT NULL AND claim_expires_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS world_neutral_regions_position_idx
  ON umaykut_v2.world_neutral_regions(world_y, world_x);
CREATE INDEX IF NOT EXISTS world_neutral_regions_claim_expiry_idx
  ON umaykut_v2.world_neutral_regions(claim_expires_at)
  WHERE claimed_by_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS world_neutral_regions_owner_idx
  ON umaykut_v2.world_neutral_regions(owner_faction_id, owner_player_id);

INSERT INTO umaykut_v2.world_neutral_regions(id, region_name, world_x, world_y, guard_troops)
SELECT n,
       'Tarafsız Köy ' || n,
       7 + random() * 86,
       7 + random() * 86,
       jsonb_build_object('infantry', CASE WHEN n % 5 = 0 THEN 50000 WHEN n % 5 = 1 THEN 5000 WHEN n % 5 = 2 THEN 10000 WHEN n % 5 = 3 THEN 20000 ELSE 35000 END)
FROM generate_series(1,24) AS n
ON CONFLICT (id) DO NOTHING;
