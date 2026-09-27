/*
  Where an installed copy keeps the journal. Every branch of the choice, with
  the dialogs stubbed: what is asked, what is remembered, and that nothing is
  ever created somewhere the person did not choose.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loc = require('../electron/data-location.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sig-loc-'));
/** Dialog stubs that answer from a script and record what was asked. */
function script(answers: Array<number | string | null>) {
  const asked: string[] = [];
  const next = () => { if (!answers.length) throw new Error('asked more than expected'); return answers.shift(); };
  return {
    asked,
    ask: async (o: { title: string }) => { asked.push(o.title); return next() as number; },
    pickFolder: async (title: string) => { asked.push(`pick: ${title}`); return next() as string | null; },
  };
}
const journalIn = (dir: string) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'journal.db'), 'x'); return dir; };

test('first run: the suggested folder, remembered', async () => {
  const settings = tmp(); const docs = tmp();
  const s = script([0]);
  const r = await loc.resolveInstalled({ settingsDir: settings, documentsDir: docs, ...s });
  assert.equal(r.dataDir, path.join(docs, 'Signature Journal'));
  assert.equal(loc.readLocation(settings), r.dataDir);
  assert.deepEqual(s.asked, ['Where should Signature keep your journal?']);
});

test('first run: a chosen empty folder is used as it is', async () => {
  const settings = tmp(); const chosen = tmp();
  const r = await loc.resolveInstalled({ settingsDir: settings, documentsDir: tmp(), ...script([1, chosen]) });
  assert.equal(r.dataDir, chosen);
});

test('first run: a busy folder gets a Signature Journal folder inside it', async () => {
  const settings = tmp(); const busy = tmp();
  fs.writeFileSync(path.join(busy, 'taxes.pdf'), 'x');
  const r = await loc.resolveInstalled({ settingsDir: settings, documentsDir: tmp(), ...script([1, busy]) });
  assert.equal(r.dataDir, path.join(busy, 'Signature Journal'));
});

test('first run: an existing journal is used in place — including the portable data folder', async () => {
  const settings = tmp(); const old = tmp();
  journalIn(path.join(old, 'data'));
  const r = await loc.resolveInstalled({ settingsDir: settings, documentsDir: tmp(), ...script([2, old]) });
  assert.equal(r.dataDir, path.join(old, 'data'));
  assert.equal(loc.readLocation(settings), path.join(old, 'data'));
});

test('first run: a folder with no journal is refused, and asked again', async () => {
  const settings = tmp(); const empty = tmp(); const real = journalIn(path.join(tmp(), 'j'));
  const s = script([2, empty, 0, real]);
  const r = await loc.resolveInstalled({ settingsDir: settings, documentsDir: tmp(), ...s });
  assert.equal(r.dataDir, real);
  assert.ok(s.asked.includes('No journal there'));
});

test('first run: cancelling a chooser goes back to the question, never to a default', async () => {
  const settings = tmp(); const docs = tmp();
  const s = script([1, null, 0]);
  const r = await loc.resolveInstalled({ settingsDir: settings, documentsDir: docs, ...s });
  assert.equal(r.dataDir, path.join(docs, 'Signature Journal'));
  assert.equal(s.asked.filter((q) => q === 'Where should Signature keep your journal?').length, 2);
});

test('later runs: the remembered folder, without asking', async () => {
  const settings = tmp(); const dir = journalIn(path.join(tmp(), 'j'));
  loc.writeLocation(settings, dir);
  const s = script([]);
  const r = await loc.resolveInstalled({ settingsDir: settings, documentsDir: tmp(), ...s });
  assert.equal(r.dataDir, dir);
  assert.deepEqual(s.asked, []);
});

test('a remembered folder that has gone is asked about — nothing is created elsewhere', async () => {
  const settings = tmp(); const gone = path.join(tmp(), 'unplugged-drive', 'journal');
  loc.writeLocation(settings, gone);
  // Quit: no folder, nothing created.
  const s = script([2]);
  const r = await loc.resolveInstalled({ settingsDir: settings, documentsDir: tmp(), ...s });
  assert.equal(r.dataDir, null);
  assert.equal(fs.existsSync(gone), false);
  assert.deepEqual(s.asked, ['Your journal folder is not available']);
});

test('…and "Try again" finds it once the drive is back', async () => {
  const settings = tmp(); const gone = path.join(tmp(), 'drive');
  loc.writeLocation(settings, gone);
  let tries = 0;
  const r = await loc.resolveInstalled({
    settingsDir: settings, documentsDir: tmp(), pickFolder: async () => null,
    ask: async () => { tries += 1; journalIn(gone); return 0; },
  });
  assert.equal(r.dataDir, gone);
  assert.equal(tries, 1);
});

test('moving a journal copies everything and leaves the original untouched', () => {
  const from = journalIn(path.join(tmp(), 'old'));
  fs.mkdirSync(path.join(from, 'screenshots', '2026-09'), { recursive: true });
  fs.writeFileSync(path.join(from, 'screenshots', '2026-09', 'a.png'), 'png');
  const to = path.join(tmp(), 'new');
  loc.copyJournal(from, to);
  assert.equal(fs.readFileSync(path.join(to, 'screenshots', '2026-09', 'a.png'), 'utf8'), 'png');
  assert.ok(fs.existsSync(path.join(to, 'journal.db')));
  assert.ok(fs.existsSync(path.join(from, 'journal.db')));
});

test('moving refuses a non-empty target and a target inside the journal', () => {
  const from = journalIn(path.join(tmp(), 'old'));
  const busy = tmp(); fs.writeFileSync(path.join(busy, 'x'), 'x');
  assert.throws(() => loc.copyJournal(from, busy), /must be empty/);
  assert.throws(() => loc.copyJournal(from, path.join(from, 'inside')), /inside the current/);
  assert.throws(() => loc.copyJournal(from, from), /already where/);
});
