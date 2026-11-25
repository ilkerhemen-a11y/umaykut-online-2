-- Restore the 1800 starting population and reserve the 1000 limit for resource assignments.
ALTER TABLE umaykut_v2.player_game_state
  ALTER COLUMN worker_pool SET DEFAULT 1800;

UPDATE umaykut_v2.player_game_state
   SET worker_pool = GREATEST(1800, LEAST(2800, COALESCE(worker_pool, 1800)))
 WHERE worker_pool IS DISTINCT FROM GREATEST(1800, LEAST(2800, COALESCE(worker_pool, 1800)));
