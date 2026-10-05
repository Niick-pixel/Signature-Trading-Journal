-- Targets and management: which targets get hit, and what the plan was.
--
-- A win does not say whether the TARGET was hit once partials and break-even
-- are in play, and "which targets actually pull price" can only be answered
-- from my own trades. Five answers, all optional, NULL on every older trade:
--
--   target_hit      The named target was reached before the stop (1/0).
--                   NULL = not recorded — never read as "missed".
--   target_fresh    The target was untouched when the trade was taken (1/0).
--   opposite_taken  The opposite side's liquidity was already taken today (1/0).
--   mgmt_plan       'A' = full position to the final target, BE after the
--                   first internal liquidity breaks. 'B' = half off at the
--                   first internal liquidity, BE, runner to the final target.
--   partial_at      Plan B only: the kind of level the partial came off at
--                   (lib/domain.ts PARTIAL_LEVELS — includes intraday swings
--                   and HTF gaps, which the target list does not).
--
-- Max R reached already exists (mfe_r); the form now lets me type it.
--
-- NOTE for the next table-rebuild migration: these columns were added with
-- ALTER TABLE and must be carried into any rebuilt `trades`.

ALTER TABLE trades ADD COLUMN target_hit INTEGER
  CHECK (target_hit IS NULL OR target_hit IN (0,1));
ALTER TABLE trades ADD COLUMN target_fresh INTEGER
  CHECK (target_fresh IS NULL OR target_fresh IN (0,1));
ALTER TABLE trades ADD COLUMN opposite_taken INTEGER
  CHECK (opposite_taken IS NULL OR opposite_taken IN (0,1));
ALTER TABLE trades ADD COLUMN mgmt_plan TEXT
  CHECK (mgmt_plan IS NULL OR mgmt_plan IN ('A','B'));
ALTER TABLE trades ADD COLUMN partial_at TEXT;
