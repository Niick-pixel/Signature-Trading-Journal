-- A loss is a negative number.
--
-- P&L and R are stored signed, and until now they were stored exactly as
-- typed — so a loss entered as "120" (the way most people type a loss) was
-- saved as +$120 and counted as a win by every total, balance, calendar
-- square and stat, the Backtest account's included. The form and the API now
-- negate a positive figure on a Loss (lib/domain.ts signForOutcome); this
-- corrects the losses already saved positive, and adds a trigger so nothing
-- else that writes here — a bulk edit that changes the outcome, a quick
-- settle, an import — can store a positive loss again.
--
-- Wins are left as they are: a win can honestly come out a few dollars
-- negative after fees, and the app flags that rather than rewriting it.
--
-- NOTE for the next table-rebuild migration: the two triggers below must be
-- recreated with the table, like the three from 016.

UPDATE trades SET pnl_dollars = -pnl_dollars WHERE outcome = 'Loss' AND pnl_dollars > 0;
UPDATE trades SET r_multiple  = -r_multiple  WHERE outcome = 'Loss' AND r_multiple  > 0;

CREATE TRIGGER trades_loss_negative_insert
AFTER INSERT ON trades FOR EACH ROW
WHEN NEW.outcome = 'Loss' AND (NEW.pnl_dollars > 0 OR NEW.r_multiple > 0)
BEGIN
  UPDATE trades SET
    pnl_dollars = CASE WHEN pnl_dollars > 0 THEN -pnl_dollars ELSE pnl_dollars END,
    r_multiple  = CASE WHEN r_multiple  > 0 THEN -r_multiple  ELSE r_multiple  END
  WHERE id = NEW.id;
END;

CREATE TRIGGER trades_loss_negative_update
AFTER UPDATE OF outcome, pnl_dollars, r_multiple ON trades FOR EACH ROW
WHEN NEW.outcome = 'Loss' AND (NEW.pnl_dollars > 0 OR NEW.r_multiple > 0)
BEGIN
  UPDATE trades SET
    pnl_dollars = CASE WHEN pnl_dollars > 0 THEN -pnl_dollars ELSE pnl_dollars END,
    r_multiple  = CASE WHEN r_multiple  > 0 THEN -r_multiple  ELSE r_multiple  END
  WHERE id = NEW.id;
END;
