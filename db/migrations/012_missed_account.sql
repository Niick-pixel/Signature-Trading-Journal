-- A place for the trades I did not take.
--
-- 'Missed' holds the setups I saw, wanted, and then hesitated on or missed —
-- logged as if they had been taken, with the outcome and R they would have had,
-- so the calendar and the stats can say what hesitation actually cost. It is a
-- separate account for the same reason Backtest was: a hypothetical R summed
-- into a real one is a number that describes nothing, so it never joins the
-- real totals (see isHypothetical in lib/domain).
--
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt exactly as
-- 010 left it with one word added to the account list. Nothing references
-- trades by foreign key, so dropping the old table takes nothing with it.
-- cash_events is untouched: there is no depositing into trades that did not
-- happen.

CREATE TABLE trades_rebuilt (
  id                  TEXT    PRIMARY KEY,
  date                TEXT    NOT NULL,
  instrument          TEXT    NOT NULL CHECK (instrument IN ('NQ','MNQ','NAS100','Other')),
  direction           TEXT    NOT NULL CHECK (direction IN ('Long','Short')),
  session             TEXT    NOT NULL CHECK (session IN ('Asia','London','NY AM','NY Lunch','NY PM')),
  macro_time          INTEGER NOT NULL DEFAULT 0 CHECK (macro_time IN (0,1)),
  macro_time_auto     INTEGER NOT NULL DEFAULT 1 CHECK (macro_time_auto IN (0,1)),
  reason              TEXT    NOT NULL CHECK (reason IN (
                        'Rules-based (A+ setup)','Rules-based (B setup)','FOMO','Revenge',
                        'Boredom','Idea / hypothesis','Following the market','Following someone else',
                        'Impatience (early entry)','Hesitation (late entry)','Overleveraged','News reaction')),
  setup_type          TEXT    NOT NULL CHECK (setup_type IN (
                        'iFVG','Double iFVG','iFVG + SMT','MSS + FVG','CISD',
                        'Order Block','Breaker','Unicorn (Breaker + FVG)','Propulsion Block',
                        'Mitigation Block','Rejection Block','Liquidity Void',
                        'Balanced Price Range','Turtle Soup','Silver Bullet','Other')),
  htf_bias            TEXT    NOT NULL CHECK (htf_bias IN ('With bias','Against bias','No bias defined')),
  sweep_before_entry  INTEGER NOT NULL DEFAULT 0 CHECK (sweep_before_entry IN (0,1)),
  singular_gap        INTEGER NOT NULL DEFAULT 0 CHECK (singular_gap IN (0,1)),
  target_unswept      INTEGER NOT NULL DEFAULT 0 CHECK (target_unswept IN (0,1)),
  premium_discount    TEXT    NOT NULL CHECK (premium_discount IN ('Discount','Equilibrium','Premium')),
  target_type         TEXT    NOT NULL CHECK (target_type IN (
                        'Horizontal liquidity pool','Opposing FVG','Data wick','Session high/low',
                        'Diagonal trendline','Other')),
  smt                 INTEGER NOT NULL DEFAULT 0 CHECK (smt IN (0,1)),
  displacement            INTEGER NOT NULL DEFAULT 0 CHECK (displacement            IN (0,1)),
  mss_confirmed           INTEGER NOT NULL DEFAULT 0 CHECK (mss_confirmed           IN (0,1)),
  volume_imbalance        INTEGER NOT NULL DEFAULT 0 CHECK (volume_imbalance        IN (0,1)),
  consequent_encroachment INTEGER NOT NULL DEFAULT 0 CHECK (consequent_encroachment IN (0,1)),
  equal_highs_lows        INTEGER NOT NULL DEFAULT 0 CHECK (equal_highs_lows        IN (0,1)),
  retest_entry            INTEGER NOT NULL DEFAULT 0 CHECK (retest_entry            IN (0,1)),
  news_window             INTEGER NOT NULL DEFAULT 0 CHECK (news_window             IN (0,1)),

  chk_htf_bias         INTEGER          CHECK (chk_htf_bias         IS NULL OR chk_htf_bias         IN (0,1)),  -- 10
  chk_killzone         INTEGER          CHECK (chk_killzone         IS NULL OR chk_killzone         IN (0,1)),  -- 10
  chk_no_news          INTEGER          CHECK (chk_no_news          IS NULL OR chk_no_news          IN (0,1)),  --  5
  chk_sweep            INTEGER          CHECK (chk_sweep            IS NULL OR chk_sweep            IN (0,1)),  -- 20
  chk_displacement_fvg INTEGER          CHECK (chk_displacement_fvg IS NULL OR chk_displacement_fvg IN (0,1)),  -- 15
  chk_targets_clear    INTEGER          CHECK (chk_targets_clear    IS NULL OR chk_targets_clear    IN (0,1)),  -- 15
  chk_clean_path       INTEGER          CHECK (chk_clean_path       IS NULL OR chk_clean_path       IN (0,1)),  --  5
  chk_returned_to_fvg  INTEGER NOT NULL DEFAULT 0 CHECK (chk_returned_to_fvg  IN (0,1)),  --  5
  chk_inversion_close  INTEGER NOT NULL DEFAULT 0 CHECK (chk_inversion_close  IN (0,1)),  -- 15

  -- What the plan's weights actually awarded on this trade...
  checklist_earned INTEGER GENERATED ALWAYS AS (
      COALESCE(chk_htf_bias,0)*10 + COALESCE(chk_killzone,0)*10 + COALESCE(chk_no_news,0)*5 +
      COALESCE(chk_sweep,0)*20 + COALESCE(chk_displacement_fvg,0)*15 +
      COALESCE(chk_targets_clear,0)*15 + COALESCE(chk_clean_path,0)*5 +
      COALESCE(chk_returned_to_fvg,0)*5 + COALESCE(chk_inversion_close,0)*15
  ) STORED,

  -- ...and what was on the table to be awarded. A box marked NULL did not
  -- apply, so its points are not offered and cannot be missed.
  checklist_possible INTEGER GENERATED ALWAYS AS (
      (CASE WHEN chk_htf_bias IS NULL THEN 0 ELSE 10 END) +
      (CASE WHEN chk_killzone IS NULL THEN 0 ELSE 10 END) +
      (CASE WHEN chk_no_news IS NULL THEN 0 ELSE 5 END) +
      (CASE WHEN chk_sweep IS NULL THEN 0 ELSE 20 END) +
      (CASE WHEN chk_displacement_fvg IS NULL THEN 0 ELSE 15 END) +
      (CASE WHEN chk_targets_clear IS NULL THEN 0 ELSE 15 END) +
      (CASE WHEN chk_clean_path IS NULL THEN 0 ELSE 5 END) +
      (CASE WHEN chk_returned_to_fvg IS NULL THEN 0 ELSE 5 END) +
      (CASE WHEN chk_inversion_close IS NULL THEN 0 ELSE 15 END)
  ) STORED,

  -- The score is a PERCENTAGE OF WHAT APPLIED, not a mark out of 100.
  --
  -- Not every session sweeps a major level. Scoring an absent condition as a
  -- failed one capped an otherwise flawless trade at 80 and called it a B, so
  -- the grade was measuring what the market offered rather than what I did. A
  -- trade with no sweep available is now graded out of 80 and can still be an
  -- A. Nothing changes for a trade where every box applied: possible is 100
  -- and the percentage is the old total exactly.
  checklist_score INTEGER GENERATED ALWAYS AS (
    CASE WHEN checklist_possible = 0 THEN 0
         ELSE CAST(ROUND(checklist_earned * 100.0 / checklist_possible) AS INTEGER) END
  ) STORED,

  trigger_fired INTEGER GENERATED ALWAYS AS (
    CASE WHEN chk_returned_to_fvg = 1 AND chk_inversion_close = 1 THEN 1 ELSE 0 END
  ) STORED,

  grade_letter TEXT GENERATED ALWAYS AS (
    CASE
      WHEN checklist_score >= 90 THEN 'A+'
      WHEN checklist_score >= 80 THEN 'A'
      WHEN checklist_score >= 70 THEN 'B'
      WHEN checklist_score >= 50 THEN 'C'
      ELSE 'F'
    END
  ) STORED,

  -- Tri-state on purpose. NULL is "I did not answer", which is the honest
  -- state of every trade until I say otherwise, and is NOT the same as "no".
  followed_rules INTEGER CHECK (followed_rules IS NULL OR followed_rules IN (0,1)),

  regrade     TEXT CHECK (regrade IS NULL OR regrade IN ('A+','A','A-','B+','B','B-','C','F')),
  -- Legacy single tag, kept so nothing written under the old taxonomy is lost.
  mistake_tag TEXT,
  -- A bad trade usually has three. JSON array; the values are validated in
  -- lib/validate.ts against MISTAKE_TAGS, which SQLite cannot do for an array.
  mistake_tags TEXT CHECK (mistake_tags IS NULL OR json_valid(mistake_tags)),

  -- Backtest R and live R must never sum into the same number.
  -- 'Funded' joins the list; 'Backtest (FX Replay)' stays legal but is no
  -- longer offered. Dropping it from the CHECK would make every backtest trade
  -- already on record unwritable, which is the app destroying its own history
  -- to tidy a dropdown.
  account       TEXT NOT NULL DEFAULT 'Live'
                CHECK (account IN ('Backtest (FX Replay)','Demo','Live','Funded','Missed')),
  account_label TEXT,

  -- Optional two-stage logging. 'Settled' is the default because logging a
  -- finished trade in one shot must stay the fast path.
  status TEXT NOT NULL DEFAULT 'Settled' CHECK (status IN ('Planned','Live','Settled')),
  -- The score as it stood before the outcome was known. Stats read this one.
  grade_at_entry INTEGER,
  -- True when the whole trade was logged after the fact, so hindsight-graded
  -- and pre-graded trades can never be pooled.
  graded_post_hoc INTEGER NOT NULL DEFAULT 1 CHECK (graded_post_hoc IN (0,1)),

  entry_price  REAL,
  take_profit  REAL,
  stop_loss    REAL,

  would_have_hit_tp INTEGER CHECK (would_have_hit_tp IS NULL OR would_have_hit_tp IN (0,1)),
  r_left_on_table   REAL,
  skip_reason       TEXT CHECK (skip_reason IS NULL OR skip_reason IN ('Fear','Rule','Distracted','Missed it')),

  contracts           INTEGER,
  -- Risk cannot be negative. It used to be able to, and since P&L is
  -- risk x R, a negative risk turned every loss into a win.
  risk_dollars        REAL    CHECK (risk_dollars IS NULL OR risk_dollars >= 0),
  risk_percent        REAL    CHECK (risk_percent IS NULL OR risk_percent >= 0),
  stop_points         REAL,
  outcome             TEXT    NOT NULL CHECK (outcome IN ('Win','Loss','Breakeven','Scratched','Not taken')),
  r_multiple          REAL,
  explanation         TEXT    NOT NULL CHECK (length(trim(explanation)) >= 80),
  lesson              TEXT,
  screenshot_path     TEXT    NOT NULL,
  position_x          REAL,
  position_y          REAL,
  -- Soft delete. Nothing leaves the journal without a second, deliberate act.
  deleted_at          TEXT,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
, entry_time TEXT, exit_time  TEXT, mae_r      REAL, mfe_r      REAL, mae_points REAL, mfe_points REAL, reached_1r INTEGER CHECK (reached_1r IS NULL OR reached_1r IN (0,1)), confidence_at_entry INTEGER
  CHECK (confidence_at_entry IS NULL OR confidence_at_entry BETWEEN 1 AND 5), would_be_r REAL, playbook_id TEXT, pnl_dollars REAL);

INSERT INTO trades_rebuilt (
  id, date, instrument, direction, session, macro_time, macro_time_auto, reason,
  setup_type, htf_bias, sweep_before_entry, singular_gap, target_unswept, premium_discount,
  target_type, smt, displacement, mss_confirmed, volume_imbalance, consequent_encroachment,
  equal_highs_lows, retest_entry, news_window, chk_htf_bias, chk_killzone, chk_no_news,
  chk_sweep, chk_displacement_fvg, chk_targets_clear, chk_clean_path, chk_returned_to_fvg,
  chk_inversion_close, followed_rules, regrade, mistake_tag, mistake_tags, account,
  account_label, status, grade_at_entry, graded_post_hoc, entry_price, take_profit,
  stop_loss, would_have_hit_tp, r_left_on_table, skip_reason, contracts, risk_dollars,
  risk_percent, stop_points, outcome, r_multiple, explanation, lesson, screenshot_path,
  position_x, position_y, deleted_at, created_at, updated_at, entry_time, exit_time, mae_r,
  mfe_r, mae_points, mfe_points, reached_1r, confidence_at_entry, would_be_r, playbook_id,
  pnl_dollars
)
SELECT
  id, date, instrument, direction, session, macro_time, macro_time_auto, reason,
  setup_type, htf_bias, sweep_before_entry, singular_gap, target_unswept, premium_discount,
  target_type, smt, displacement, mss_confirmed, volume_imbalance, consequent_encroachment,
  equal_highs_lows, retest_entry, news_window, chk_htf_bias, chk_killzone, chk_no_news,
  chk_sweep, chk_displacement_fvg, chk_targets_clear, chk_clean_path, chk_returned_to_fvg,
  chk_inversion_close, followed_rules, regrade, mistake_tag, mistake_tags, account,
  account_label, status, grade_at_entry, graded_post_hoc, entry_price, take_profit,
  stop_loss, would_have_hit_tp, r_left_on_table, skip_reason, contracts, risk_dollars,
  risk_percent, stop_points, outcome, r_multiple, explanation, lesson, screenshot_path,
  position_x, position_y, deleted_at, created_at, updated_at, entry_time, exit_time, mae_r,
  mfe_r, mae_points, mfe_points, reached_1r, confidence_at_entry, would_be_r, playbook_id,
  pnl_dollars
FROM trades;

DROP TABLE trades;
ALTER TABLE trades_rebuilt RENAME TO trades;

CREATE INDEX idx_trades_date        ON trades(date DESC);
CREATE INDEX idx_trades_reason      ON trades(reason);
CREATE INDEX idx_trades_outcome     ON trades(outcome);
CREATE INDEX idx_trades_target_type ON trades(target_type);
CREATE INDEX idx_trades_grade       ON trades(checklist_score);
CREATE INDEX idx_trades_account     ON trades(account);
CREATE INDEX idx_trades_status      ON trades(status);
CREATE INDEX idx_trades_deleted     ON trades(deleted_at);
CREATE INDEX idx_trades_playbook    ON trades(playbook_id);

CREATE TRIGGER trades_touch_updated_at
AFTER UPDATE ON trades FOR EACH ROW
BEGIN
  UPDATE trades SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = OLD.id;
END;

-- The same widening for money movements.
