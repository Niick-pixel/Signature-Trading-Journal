-- A place to write that is not about one trade.
--
-- The journal already had three writing surfaces and none of them were this.
-- A trade's explanation and lesson are about that trade. The daily review asks
-- structured questions because its answers get plotted against adherence. The
-- weekly review argues with specific entries. What was missing is the thing a
-- paper journal is actually for: an idea half-formed, a summary of a bad week,
-- a note about something noticed on Tuesday that has no trade attached to it
-- yet — writing whose value is that nothing is asking anything of it.
--
-- Pages carry a date so they can line up with the rest of the app, but a date
-- is not a key: several pages on one day is normal, and a page dated last
-- Friday written this Monday is normal too.
--
-- The body is HTML because the editing is WYSIWYG. Nothing untrusted ever
-- reaches it: paste is forced to plain text in the editor, images are added
-- through the app's own screenshot store, and the server sanitises against an
-- allowlist on the way in regardless. See lib/sanitise.ts.

CREATE TABLE journal_pages (
  id         TEXT PRIMARY KEY,
  day        TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  -- Plain text of the body, kept alongside it so search does not have to
  -- strip tags at query time — and so a match can be shown as a readable
  -- snippet rather than as markup.
  plain      TEXT NOT NULL DEFAULT '',
  pinned     INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_journal_day ON journal_pages(day DESC, created_at DESC);

CREATE TRIGGER journal_touch_updated_at
AFTER UPDATE ON journal_pages FOR EACH ROW
BEGIN
  UPDATE journal_pages SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = OLD.id;
END;
