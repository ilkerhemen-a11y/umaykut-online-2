ALTER TABLE umaykut_v2.player_game_state
  ALTER COLUMN buildings SET DEFAULT
    '{"1":{"type":"center","level":1},"2":{"type":"barracks","level":1},"3":{"type":"stable","level":1},"4":{"type":"blacksmith","level":1},"5":{"type":"school","level":1},"6":{"type":"lumberyard","level":1},"7":{"type":"temple","level":1},"8":{"type":"market","level":1},"9":{"type":"warehouse","level":1}}'::jsonb;

-- Keep every player's current building levels, fill missing slots at level 1,
-- and normalize the building type to its permanent village position.
UPDATE umaykut_v2.player_game_state
SET buildings = jsonb_build_object(
  '1', jsonb_build_object('type','center','level',GREATEST(1,LEAST(10,COALESCE((buildings->'1'->>'level')::integer,1)))),
  '2', jsonb_build_object('type','barracks','level',GREATEST(1,LEAST(10,COALESCE((buildings->'2'->>'level')::integer,1)))),
  '3', jsonb_build_object('type','stable','level',GREATEST(1,LEAST(10,COALESCE((buildings->'3'->>'level')::integer,1)))),
  '4', jsonb_build_object('type','blacksmith','level',GREATEST(1,LEAST(10,COALESCE((buildings->'4'->>'level')::integer,1)))),
  '5', jsonb_build_object('type','school','level',GREATEST(1,LEAST(10,COALESCE((buildings->'5'->>'level')::integer,1)))),
  '6', jsonb_build_object('type','lumberyard','level',GREATEST(1,LEAST(10,COALESCE((buildings->'6'->>'level')::integer,1)))),
  '7', jsonb_build_object('type','temple','level',GREATEST(1,LEAST(10,COALESCE((buildings->'7'->>'level')::integer,1)))),
  '8', jsonb_build_object('type','market','level',GREATEST(1,LEAST(10,COALESCE((buildings->'8'->>'level')::integer,1)))),
  '9', jsonb_build_object('type','warehouse','level',GREATEST(1,LEAST(10,COALESCE((buildings->'9'->>'level')::integer,1))))
);
