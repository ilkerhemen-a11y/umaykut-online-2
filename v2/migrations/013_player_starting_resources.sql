ALTER TABLE umaykut_v2.world_resource_nodes
  DROP CONSTRAINT IF EXISTS world_resource_nodes_resource_type_check;
ALTER TABLE umaykut_v2.world_resource_nodes
  ADD CONSTRAINT world_resource_nodes_resource_type_check
  CHECK (resource_type IN ('iron','stone','gold','wood','grain'));
ALTER TABLE umaykut_v2.world_resource_nodes ADD COLUMN IF NOT EXISTS owner_player_id TEXT;
CREATE INDEX IF NOT EXISTS world_resource_nodes_owner_idx ON umaykut_v2.world_resource_nodes(owner_player_id);
CREATE SEQUENCE IF NOT EXISTS umaykut_v2.world_resource_node_id_seq START WITH 1000000 INCREMENT BY 1;
SELECT setval('umaykut_v2.world_resource_node_id_seq',GREATEST(1000000,COALESCE((SELECT MAX(id)+1 FROM umaykut_v2.world_resource_nodes),1000000)),false);
