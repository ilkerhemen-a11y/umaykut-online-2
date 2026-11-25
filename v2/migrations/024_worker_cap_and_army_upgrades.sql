ALTER TABLE umaykut_v2.player_game_state
  ADD COLUMN IF NOT EXISTS army_upgrades JSONB NOT NULL
  DEFAULT '{"infantryAttack":0,"infantryDefense":0,"cavalryDefense":0}'::jsonb;

UPDATE umaykut_v2.player_game_state
   SET worker_pool = LEAST(1000, GREATEST(0, COALESCE(worker_pool, 0)))
 WHERE worker_pool IS DISTINCT FROM LEAST(1000, GREATEST(0, COALESCE(worker_pool, 0)));
