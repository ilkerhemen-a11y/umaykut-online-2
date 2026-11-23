-- Slot 9 is the Okçu building, not a warehouse.
-- Preserve every existing level and upgrade timer while correcting the legacy type.
ALTER TABLE umaykut_v2.player_game_state
  ALTER COLUMN buildings SET DEFAULT
    '{"1":{"type":"center","level":1},"2":{"type":"barracks","level":1},"3":{"type":"stable","level":1},"4":{"type":"blacksmith","level":1},"5":{"type":"school","level":1},"6":{"type":"lumberyard","level":1},"7":{"type":"temple","level":1},"8":{"type":"market","level":1},"9":{"type":"archery","level":1}}'::jsonb;

UPDATE umaykut_v2.player_game_state
SET buildings = jsonb_set(
  buildings,
  '{9}',
  CASE
    WHEN jsonb_typeof(buildings->'9') = 'object'
      THEN (buildings->'9') || '{"type":"archery"}'::jsonb
    ELSE '{"type":"archery","level":1}'::jsonb
  END,
  TRUE
)
WHERE buildings->'9'->>'type' = 'warehouse'
   OR buildings->'9' IS NULL;
