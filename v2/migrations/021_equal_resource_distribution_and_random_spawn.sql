-- Balance the four core world resources without removing or renumbering existing nodes.
-- Existing gold nodes remain a separate bonus resource.
WITH resource_types(resource_type) AS (
  VALUES ('stone'::varchar),('wood'::varchar),('iron'::varchar),('grain'::varchar)
),
counts AS (
  SELECT t.resource_type,COUNT(n.id)::integer AS current_count
  FROM resource_types t
  LEFT JOIN umaykut_v2.world_resource_nodes n
    ON n.resource_type=t.resource_type AND n.owner_player_id IS NULL
  GROUP BY t.resource_type
),
target AS (
  SELECT GREATEST(32,MAX(current_count))::integer AS target_count FROM counts
)
INSERT INTO umaykut_v2.world_resource_nodes
  (resource_type,world_x,world_y,yield_level,owner_player_id)
SELECT c.resource_type,
       4+random()*92,
       4+random()*92,
       4+floor(random()*6)::integer,
       NULL
FROM counts c
CROSS JOIN target t
CROSS JOIN LATERAL generate_series(1,GREATEST(0,t.target_count-c.current_count)) AS missing;

-- Existing personal nodes keep their IDs, yield and worker assignments, but are
-- spread around the village at randomized angles and remain inside the level-1 range.
WITH positions AS (
  SELECT n.id,
         s.world_x+cos(random()*2*pi())*(1.25+random()*0.45) AS next_x,
         s.world_y+sin(random()*2*pi())*(1.25+random()*0.45) AS next_y
  FROM umaykut_v2.world_resource_nodes n
  JOIN umaykut_v2.player_game_state s ON s.player_id::text=n.owner_player_id
  WHERE n.owner_player_id IS NOT NULL
)
UPDATE umaykut_v2.world_resource_nodes n
SET world_x=GREATEST(1,LEAST(99,p.next_x)),
    world_y=GREATEST(1,LEAST(99,p.next_y))
FROM positions p
WHERE n.id=p.id;

-- Fill any missing personal core-resource node for existing accounts.
INSERT INTO umaykut_v2.world_resource_nodes
  (resource_type,world_x,world_y,yield_level,owner_player_id)
SELECT v.resource_type,
       GREATEST(1,LEAST(99,s.world_x+cos(spawn.angle+v.resource_slot*2*pi()/4)*spawn.radius)),
       GREATEST(1,LEAST(99,s.world_y+sin(spawn.angle+v.resource_slot*2*pi()/4)*spawn.radius)),
       5,
       s.player_id::text
FROM umaykut_v2.player_game_state s
CROSS JOIN (VALUES
  ('stone'::varchar,0),('wood'::varchar,1),('iron'::varchar,2),('grain'::varchar,3)
) AS v(resource_type,resource_slot)
CROSS JOIN LATERAL (
  SELECT random()*2*pi() AS angle,1.25+random()*0.45 AS radius
) AS spawn
WHERE NOT EXISTS (
  SELECT 1 FROM umaykut_v2.world_resource_nodes n
  WHERE n.owner_player_id=s.player_id::text AND n.resource_type=v.resource_type
);

