# Signature

A local-only trade journal for an iFVG model on NQ/MNQ. It runs on your machine
in its own window, stores everything on disk, and never talks to a server you
don't control.

It exists to expose **why** you take trades, not just what happened.

## Setup

### 1. Install Node.js (once per machine)

Signature needs **Node 22.13.0 or newer** — that is the first release where
`node:sqlite`, which stores the journal, works without an experimental flag
(22.12 and older cannot load it at all). The current LTS is fine. `npm` comes
bundled with Node — if your terminal says `'npm' is not recognized` or
`command not found`, Node is what's missing.

`npm install` checks this and stops with a clear error on an older Node, rather
than installing an app that cannot open its own database.

Nothing here compiles. Signature stores data with `node:sqlite`, which is built
into Node itself, so there is no C++ toolchain to install and no native module
to rebuild — `npm install` just downloads files.

**Windows** (PowerShell):

```powershell
winget install OpenJS.NodeJS.LTS
```

**macOS**:

```bash
brew install node
```

Or download the LTS installer from <https://nodejs.org>.

> **Close your terminal and open a new one afterwards.** The installer edits
> your `PATH`, and a terminal that was already open keeps the old one — `npm`
> will still look missing until you reopen it.

Check it worked:

```bash
node -v      # v22.13.0 or higher
npm -v
```

### 2. Run Signature

```bash
npm install
npm run desktop      # opens Signature in its own window
```

`npm install` downloads Electron (~230 MB), so the first install takes a few
minutes and needs a working network. Every run after that is offline.

The window runs the app on Electron's own bundled Node, so once installed it
does not depend on your system Node at all. The Node requirement above only
applies to `npm install`, `npm test` and `npm run dev`.

If the window won't open for any reason, `npm run dev` serves the identical app
at <http://localhost:3000> and needs no Electron binary at all.

That's the normal way to run it. The Electron shell starts the local Next.js
server on a free port, waits for it, and loads it into a frameless window — the
server is owned by the window and shuts down with it, so nothing is left
listening.

If you'd rather use a browser tab, `npm run dev` serves the same app at
http://localhost:3000.

The database and screenshot folders are created automatically on first launch.
There is no seed data.

## Download for Windows

You don't have to install Node at all if you'd rather just run the app.
Download it here: **[latest release](https://github.com/Niick-pixel/Signature-Trading-Journal/releases/latest)**
(the files are under *Assets*). Every push to `main` builds a new numbered
release, `v0.2.<build>`, on a Windows runner.

| File | What it is | Updates itself |
| --- | --- | --- |
| `Signature-Setup-0.2.N.exe` | **The installer — use this one.** Per-user, no admin rights, Start menu and desktop shortcuts. | **Yes** |
| `Signature-portable-0.2.N.exe` | A single file that runs from anywhere, journal beside it. | No |
| `Signature-0.2.N-windows.zip` | The same app unpacked, for people who don't want either. | No |

> Windows SmartScreen will warn the first time, because the executables aren't
> code-signed (that needs a paid certificate). *More info → Run anyway.*

### The installer

The first time it opens, it asks where your journal should live:

- **Use the suggested folder** — `Documents\Signature Journal`.
- **Choose a folder…** — anywhere you back up (a synced folder, a second drive).
  An empty folder is used as it is; a folder with other things in it gets a
  `Signature Journal` folder inside it.
- **Open an existing journal…** — point at a folder holding `journal.db`. For
  the old portable version, pick its `data` folder (or the folder with
  `Signature.exe` in it — it finds `data` itself). The journal is used where it
  is; nothing is copied.

The choice is saved in `%APPDATA%\Signature\location.json`, never inside the
program folder, because an update replaces the program folder. If the folder
is missing when Signature starts (an unplugged drive), it says so and offers
*Try again*, *Choose another folder…* or *Quit*. It never silently starts an
empty journal somewhere else.

**Settings → Your journal lives here → Move journal…** copies the whole folder somewhere new and
restarts on the copy. The old folder is left exactly as it was until you
delete it. Pointing it at a folder that already holds a journal switches to
that journal instead.

### Updates

The installed app checks this repository's GitHub releases 8 seconds after it
opens and every 4 hours after that. That is the only network request Signature
makes, and it sends nothing about your journal. A newer version downloads in
the background. When it's ready, an **Update ready · 0.2.N — restart** chip
appears in the title bar. Click it to restart into the new version now, or
ignore it and the update installs when you close Signature.

Settings → Updates shows the version you're running and has **Check now** and
a **Check automatically** switch. Each download is checked against the sha512
in the release's `latest.yml` before it is installed. Every run writes a line
to `update.log` in the journal folder.

Before any database migration runs, Signature copies the journal to
`backups/journal-<day>-before-<migration>.db`. An update that changes the
schema always leaves the pre-update journal behind.

### The portable build

A single file with no installer and nothing written to the registry. It keeps
its journal in a `data/` folder **beside the exe**, so the whole thing travels
on a USB stick. It cannot update itself: download the new one and put it where
the old one was.

It shows a splash while it starts, because a portable executable is really a
self-extracting archive: the first thing it does is unpack ~450 MB into a temp
folder, which takes a few seconds during which Windows shows nothing at all.

**`portable.unpackDirName` is set to `true` on purpose, and it matters.** Left
unset, electron-builder bakes one fixed folder name into the executable and
every launch extracts into *that same folder* — after running `RMDir /r` on it
first. Close the app and reopen it, or double-click twice because nothing
seemed to happen, and the second launch deletes the files the first one is
still running from. Turbopack loads its chunks lazily, per route, so the app
starts, migrations run, and then every screen you open dies on a chunk that no
longer exists. Setting it to `true` gives each launch its own extraction
directory, which is the only thing that actually prevents this. (`false` does
not do what it sounds like — electron-builder treats it the same as unset.)

To build one yourself on a Windows machine: `npm run desktop:build`.

## Where your data lives

Everything Signature owns is inside one journal folder: `./data` when running
from source, the folder you chose for the installed app, or `data/` beside the
executable in a portable build:

```
data/
├── journal.db        SQLite database — every trade record
└── screenshots/      chart images, foldered by month
    └── 2026-09/
        └── 2026-09-10-a3f1b2c4.png
```

**Back up that folder and you have backed up the entire journal.** Screenshots are
ordinary image files referenced by relative path from the database — no image
bytes are ever written into SQLite, so the `.db` stays small and the images stay
openable in any viewer.

`./data` is gitignored. Your trades never leave your machine.

## Capturing a trade

The fastest path is to copy a chart in TradingView and press **⌘V / Ctrl+V**
anywhere on the New Trade page. Drag-and-drop and click-to-browse work too.

Field order is deliberate: screenshot, then **reason**, then explanation. You
name your motive before there is any data on screen to rationalise with. Submit
stays disabled until there is an image, a reason, and 80 characters of
explanation.

## Before the session: the check-in

One window (title bar, **M**, or **P** to go straight to the chart), two halves:

**Morning** — four questions in thirty seconds: sleep, state of mind, bias, news,
and the most trades you will take.

**Chart** — ten short steps before New York, each a few marks to tick as you
draw them on the chart and a few answers to tap. Nothing is typed: the levels
belong on the chart, not retyped into the app.

1. Higher timeframe — daily and 4H trend, premium or discount
2. Previous day and week — which of PDH, PDL, PWH, PWL are already taken
3. Equal highs and lows — where the clean resting liquidity is
4. Important gaps — which kinds are on the chart, where the nearest unfilled one is
5. Resistance and support — is price at one, or between
6. Liquidity from the order-book heatmap (the link is in Settings) — which side is heavier, are the walls holding
7. Draw on liquidity — up or down, the first target, how clear it is
8. The plan — longs, shorts, both or no trade, and which sweep to wait for
9. News and timing — first entry and done-by time
10. Commit — only the model, stop after two losses, loss limit set, step away

The overnight session highs and lows are not a step — a TradingView script
draws them already. Every step can be skipped; nothing waits on it. When it was
started is recorded, because a plan made after the open knows how the open went.

## Talking it through with Claude

- **Calendar → Review {month} with Claude** — the month's numbers, rules,
  mornings, chart preps and every trade, as one Markdown document (or a zip
  with the charts).
- **Journal → Discuss the journal with Claude** — your pages (last 30 days,
  90 days, or everything), each on its day with the morning, the chart prep,
  the trades and their lessons, and a note on what to look for: recurring
  themes, where the writing and the trading disagree.

Both are downloads to attach to a new chat. Nothing leaves the machine on its
own.

## Appearance

Signature opens in **light mode** and stays there — it does not follow your OS
setting. The sun/moon button in the title bar switches to dark, and that choice
is remembered per machine.

## Scripts

| Command | What it does |
|---|---|
| `npm run desktop` | Open Signature in its own window (the normal way to run it) |
| `npm run dev` | Serve the same app in a browser tab instead |
| `npm run migrate` | Apply pending migrations without launching the app |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run desktop:build` | Package a distributable app with electron-builder |

Migrations in `db/migrations/` run automatically on launch, in filename order,
each in its own transaction. Applied ones are recorded in `schema_migrations`.

## How the data is protected

The database enforces the model rather than trusting the app:

- Every enum is a `CHECK` constraint, so an invalid `reason` or `outcome` cannot
  be written by any code path.
- The 80-character minimum on `explanation` is a constraint, not just form
  validation.
- `checklist_score`, `trigger_fired` and `grade_letter` are **generated
  columns** computed inside SQLite from the checklist answers, gates included. They cannot
  be written directly and can never disagree with the answers that produced
  them.

## The checklist

Grading is the plan's own weighted 100-point checklist, in three phases —
rubric 3, since 2026-09-29 (every version is recorded in
[`db/RUBRIC.md`](db/RUBRIC.md), and no trade is ever re-graded by a later one):

| Phase | Item | Points |
|---|---|---|
| 1 — Prep (25) | Higher timeframe bias is clear | 10 |
| | Inside a killzone | 10 |
| | No NFP / FOMC / CPI conflict | 5 |
| 2 — Setup (55) | Clear sweep of a nameable level — MAJOR 20 · MINOR but nameable 12 · NONE 0 | up to 20 |
| | Singular gap — ONE clean, unmistakable FVG | 10 |
| | Strong FVG after the sweep | 10 |
| | Targets are clear | 10 |
| | Clean path to target | 5 |
| 3 — Trigger (20) | Price returned to the FVG | 5 |
| | Inversion candle CLOSED through the FVG | 15 |

Letters fall out of the score: **A+ is 100 — a perfect trade, nothing less** — then 80+ A, 70+ B, 50+ C, below that F.
Then the rules on top of the arithmetic, all mirrored in the schema's
generated columns:

- **Gates.** A sweep of NONE, or anything but one clean gap, is not the model:
  the grade is capped at **C** whatever the total, and the form says so in red.
  Neither can be marked N/A.
- **Diagonal targets cap at B.** Diagonals are subjective and move every candle.
- **Phase 3 must fire for an entry to exist.** `trigger_fired` is true only when
  both Phase 3 boxes are ticked. A 90-point setup with no inversion close is a
  setup still forming, and the app says so where you can't miss it.
- **At 70 or more with the trigger fired, taking it is the rule.** Below 70 the
  capture form asks you why you're taking it at all.

**The grade at entry is permanent.** It can change while a trade is Planned;
the moment it leaves Planned it is locked, by the app and by triggers in the
database, and the trade cannot go back to Planned to reopen it. Answers can
still be corrected — the history records it — but the grade the trade was
taken on stays.

After the close there is a second, harsher pass: an honest `regrade`, which
**can only be equal to or lower than the grade at entry** ("Reviews can only
be harsher. If a C setup won, it was still a C setup."), `followed_rules`, and
the mistake tags. **Stats → Does the model hold?** splits count, win rate and
total R by sweep tier, singular gap, target type, account and grade at entry,
so the gates can be checked against real results as they accumulate.

## A note on "Not taken"

Trades you passed on are journalled and clustered like any other, but they never
touch R or win rate — you didn't risk money, so it can't have made or lost any.
They're reported separately as a `passed` count. Average grade *does* include
them, because a passed A+ setup is still evidence about how you grade.

A skipped setup can also record what skipping it cost: whether it would have hit
TP, the R left on the table, and the real reason (Fear, Rule, Distracted, Missed
it). The Stats page totals that separately — a setup you talked yourself out of
is a real loss that never reaches the P&L, which is exactly why it goes
unexamined.

## Stack

Next.js (App Router) + TypeScript · SQLite via `node:sqlite` (built into Node —
no native addon) · Tailwind CSS · Framer Motion · @xyflow/react · Electron.
No auth, no cloud, no telemetry (Next's own anonymous telemetry is disabled
too). One user.
