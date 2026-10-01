-- Rubric 4, on trial: the liquidity event.
--
-- Rubric 3's gate only accepts a sweep. Dodgy's own sheet accepts a sweep OR a
-- delivery from a higher-timeframe FVG/OB (A), and asks for both at A+. Rubric
-- 4 grades that — but it runs as a TRIAL beside rubric 3, not in place of it:
-- every trade is still graded and frozen under rubric 3, and the trial grade is
-- worked out from these answers on read (lib/rubric.ts, TRIAL_RUBRIC). Nothing
-- frozen changes and no generated column moves, so no table rebuild is needed.
--
-- Three answers, all optional, all NULL on every trade from before today:
--
--   sweep_level              The swept level, picked from a fixed list (PDH,
--                            Asia low, EQH…; lib/rubric.ts SWEEP_LEVELS). Under
--                            rubric 4 a sweep with no level named is no sweep.
--   sweep_futures_confirmed  The sweep also happened on NQ futures, not just on
--                            the CFD wick. Under rubric 4 a MINOR sweep that is
--                            not confirmed is no sweep. NULL = never checked.
--   htf_delivery             The higher-timeframe array price delivered from,
--                            picked: "5m FVG" … "Daily OB" (HTF_DELIVERIES).
--                            Non-empty means a delivery happened.
--
-- NOTE for the next table-rebuild migration: these three columns were added
-- with ALTER TABLE and must be carried into any rebuilt `trades`.

ALTER TABLE trades ADD COLUMN sweep_level TEXT;
ALTER TABLE trades ADD COLUMN sweep_futures_confirmed INTEGER
  CHECK (sweep_futures_confirmed IS NULL OR sweep_futures_confirmed IN (0,1));
ALTER TABLE trades ADD COLUMN htf_delivery TEXT;
