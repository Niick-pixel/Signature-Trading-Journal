-- The chart prep: the deeper morning routine, one row per day.
--
-- The whole prep is one JSON document (see lib/prep.ts, parsePrepData): which
-- steps are marked, the prices typed along the way, the draw on liquidity,
-- the plans. It changes shape as the routine is refined, and a column per
-- field would need a migration for every new mark on the chart.
--
-- started_at is when the first mark was made and is never rewritten — a prep
-- written after the session knows how the session went. completed_at is when
-- it was finished, if it was.

CREATE TABLE session_prep (
  day          TEXT PRIMARY KEY CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  data         TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data)),
  started_at   TEXT,
  completed_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
