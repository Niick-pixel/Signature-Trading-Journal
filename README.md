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

## Portable executable

You don't have to install Node at all if you'd rather just run the app.

Download it here: **[latest release](https://github.com/Niick-pixel/Signature-Trading-Journal/releases/latest)**
— the `.exe` is under *Assets*.

Every push to `main` rebuilds it on a Windows runner and republishes that
release, so the link always points at the current build.

It is a single file. No installer, no admin rights, nothing written to AppData
or the registry — it keeps its journal in a `data/` folder **beside the exe**,
so the whole thing travels on a USB stick if you want it to.

> Windows SmartScreen will warn the first time, because the executable isn't
> code-signed (that needs a paid certificate). *More info → Run anyway.*

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

Everything Signature owns is inside one `data/` folder — `./data` when running
from source, or beside the executable in a portable build:

```
data/
├── journal.db        SQLite database — every trade record
└── screenshots/      chart images, foldered by month
    └── 2026-09/
        └── 2026-09-10-a3f1b2c4.png
```

**Back up `./data` and you have backed up the entire journal.** Screenshots are
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
  columns** computed inside SQLite from the nine checklist answers. They cannot
  be written directly and can never disagree with the answers that produced
  them.

## The checklist

Grading is the plan's own weighted 100-point checklist, in three phases:

| Phase | Item | Points |
|---|---|---|
| 1 — Prep | Higher timeframe bias is clear | 10 |
| | Inside a killzone | 10 |
| | No NFP / FOMC / CPI conflict | 5 |
| 2 — Setup | Clear sweep of a MAJOR level | 20 |
| | Strong FVG after the sweep | 15 |
| | Targets are clear | 15 |
| | Clean path to target | 5 |
| 3 — Trigger | Price returned to the FVG | 5 |
| | Inversion candle CLOSED through the FVG | 15 |

Two rules sit on top of the arithmetic, and both are enforced in the schema
rather than in the form:

- **Phase 3 must fire for an entry to exist.** `trigger_fired` is true only when
  both Phase 3 boxes are ticked. A 90-point setup with no inversion close is a
  setup still forming, and the app says so where you can't miss it.
- **At 70 or more with the trigger fired, taking it is the rule.** Below 70 the
  capture form asks you why you're taking it at all.

Letters fall out of the score: 90+ is A+, 80+ A, 70+ B, 50+ C, below that F.
Those thresholds are the one part of the grading I chose rather than read off
the plan — say the word and they move.

After the close there is a second, harsher pass: `followed_rules`, an honest
`regrade`, and a `mistake_tag`. Stats compares the two, because a pattern of
re-grading below the checklist means the boxes are being ticked to reach a
number rather than because they were true.

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
