-- Where the account actually is, and why.
--
-- The journal could tell me my R and, since the P&L started saving, what each
-- trade paid. It could not tell me what is in the account — and "what is in the
-- account" is the only number the broker and I both agree on.
--
-- Storing a balance would be the wrong shape: a stored number drifts from the
-- trades the moment either changes, and then two things in the same app claim
-- to be the truth. So the balance is DERIVED from money movements plus realised
-- P&L, exactly the way the account itself works.
--
-- Three kinds of movement:
--
--   deposit    money in
--   withdrawal money out
--   reconcile  "the broker says it is exactly this, on this date"
--
-- The third is the one that makes this usable rather than theoretically pure.
-- My P&L history is incomplete — every trade logged before the payload bug was
-- fixed has no dollar figure — so deriving from the beginning of time would
-- produce a confident, wrong number. A reconcile is an anchor: the balance is
-- computed forward from the most recent one, and everything before it is the
-- broker's problem rather than the journal's.
--
-- Per account, because backtest dollars and live dollars are not the same
-- dollars and summing them would make this figure a lie like any other.

CREATE TABLE cash_events (
  id         TEXT PRIMARY KEY,
  account    TEXT NOT NULL CHECK (account IN ('Backtest (FX Replay)','Demo','Live')),
  kind       TEXT NOT NULL CHECK (kind IN ('deposit','withdrawal','reconcile')),
  -- A magnitude, never signed: the direction is the kind. A negative deposit
  -- is the same class of bug as the negative risk that turned a loss into a
  -- win back in 005.
  amount     REAL NOT NULL CHECK (amount >= 0),
  date       TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_cash_account ON cash_events(account, date);
