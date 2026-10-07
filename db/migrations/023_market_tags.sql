-- What the market did: a second tag list beside "What went wrong".
--
-- "What went wrong" is about my execution. These are about the market — a
-- plan it did not follow, a wick through the stop, a news spike, slippage.
-- Kept apart so Stats can tell process from luck, and like every tag they
-- are notes: nothing here ever marks a trade as a rule break.
--
-- A plain added column (JSON array, like worked_tags). Existing trades read
-- as no market tags; no row is rewritten.
ALTER TABLE trades ADD COLUMN market_tags TEXT CHECK (market_tags IS NULL OR json_valid(market_tags));
