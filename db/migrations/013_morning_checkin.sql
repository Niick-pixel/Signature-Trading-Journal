-- The morning check-in: four questions answered before the session, in the
-- same row as the daily review they belong to.
--
-- Sleep, state of mind and the bias already had columns — the check-in writes
-- those. What the review never asked is which way the bias points (the text
-- field says why, not which way), whether there is news on the calendar, and
-- whether any of it was written BEFORE trading. That last one is the point:
-- a morning filled in at night, knowing how the day went, is a different
-- answer, so the moment of the check-in is recorded and never rewritten.
--
-- Plain ADD COLUMNs: nothing existing changes, every old row reads NULL, and
-- NULL means "not asked", never "no".

ALTER TABLE daily_reviews ADD COLUMN bias_direction TEXT
  CHECK (bias_direction IS NULL OR bias_direction IN ('Bullish','Bearish','Neutral'));
ALTER TABLE daily_reviews ADD COLUMN news TEXT
  CHECK (news IS NULL OR news IN ('None','Medium','High'));
ALTER TABLE daily_reviews ADD COLUMN news_note TEXT;
ALTER TABLE daily_reviews ADD COLUMN checked_in_at TEXT;
