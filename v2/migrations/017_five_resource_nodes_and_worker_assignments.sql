-- Expand world mine nodes to all five production resources and support per-player starter nodes.
ALTER TABLE umaykut_v2.world_resource_nodes
  ADD COLUMN IF NOT EXISTS owner_player_id TEXT;

CREATE SEQUENCE IF NOT EXISTS umaykut_v2.world_resource_node_id_seq;
SELECT setval(
  'umaykut_v2.world_resource_node_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM umaykut_v2.world_resource_nodes), 0) + 1, 1),
  FALSE
);
ALTER TABLE umaykut_v2.world_resource_nodes
  ALTER COLUMN id SET DEFAULT nextval('umaykut_v2.world_resource_node_id_seq');
ALTER SEQUENCE umaykut_v2.world_resource_node_id_seq
  OWNED BY umaykut_v2.world_resource_nodes.id;

ALTER TABLE umaykut_v2.world_resource_nodes
  DROP CONSTRAINT IF EXISTS world_resource_nodes_resource_type_check;
ALTER TABLE umaykut_v2.world_resource_nodes
  ADD CONSTRAINT world_resource_nodes_resource_type_check
  CHECK (resource_type IN ('iron','stone','gold','wood','grain'));

CREATE INDEX IF NOT EXISTS world_resource_nodes_owner_idx
  ON umaykut_v2.world_resource_nodes(owner_player_id);

-- Keep existing world nodes stable; each player receives a nearby five-resource set on map load.
