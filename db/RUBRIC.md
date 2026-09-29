# Grading rubric versions

Every trade is graded once, under the rubric in force when it was written, and
keeps that grade. The versions live in `lib/rubric.ts`; this file records what
each one was and why it changed.

## How a grade is frozen

- `checklist_score`, `trigger_fired` and `grade_letter` in the schema are
  **generated** columns. They follow whatever the current weights and letter
  bands are, on every read. The app calls them the *live* grade
  (`live_score`, `live_trigger`, `live_letter`) and only the form uses them.
- `rubric_version`, `score_at_entry`, `letter_at_entry` and
  `trigger_fired_at_entry` are **stored**. They are written when the trade is
  created, under the current rubric. Every stat, chart, calendar figure and
  whiteboard badge reads these.
- **The grade at entry is locked once a trade leaves Planned** (since rubric
  2, migration 015). While a trade is Planned it has not been taken, so an
  edit re-grades it — under the current rubric, the one the form shows — and
  the edit that moves it out of Planned is the last one that can. After that
  its answers can still be corrected (the edit log records every change, and
  the form shows what the answers would score now), but `score_at_entry`,
  `letter_at_entry`, `trigger_fired_at_entry`, `rubric_version` and
  `grade_at_entry` never change again. Two triggers in the schema enforce it,
  and stop a trade going back to Planned to reopen it. A trade logged in one
  shot (Settled from the start) is locked from the moment it is written.
- The honest re-grade can only go down: it must be at or below the letter at
  entry. A re-grade already on record from before this rule is kept.
- A restored backup keeps each trade's `rubric_version` and the grade it
  carried. An export from before versions existed is graded under version 1.

## Changing the rubric

1. Add the new version to `RUBRICS` in `lib/rubric.ts`, written out as
   literal numbers. Never derive it from the checklist.
2. Raise `CURRENT_RUBRIC`.
3. Change the weights in `CHECKLIST_PHASES` (`lib/domain.ts`) and the letter
   bands in `gradeLetter` (`lib/grade.ts`) to match. Caps (gates) live on the
   rubric itself, as `caps`.
4. Add a migration that rebuilds the generated columns with the new numbers.
   Leave the stored `*_at_entry` columns alone.
5. Add a section below.

`npm test` fails if the live checklist and the current version disagree, so
step 1 cannot be skipped by accident.

## Version 2 — in force since 2026-09-29

The sweep became a tier, a single clean gap became a checklist item, the
weights were rebalanced (Prep 25, Setup 55, Trigger 20), and two **gates** now
cap the letter whatever the total.

| Phase | Item | Points |
| --- | --- | --- |
| 1 — Prep | Higher timeframe bias is clear | 10 |
| 1 — Prep | Inside a killzone | 10 |
| 1 — Prep | No NFP / FOMC / CPI conflict | 5 |
| 2 — Setup | Clear sweep of a nameable level — **MAJOR** (session high/low, PDH/PDL, weekly/daily EQH/EQL) | 20 |
| 2 — Setup | … **MINOR but nameable** (intraday short-term high/low, equal highs/lows, prior session pool) | 12 |
| 2 — Setup | … **NONE** (a random wiggle, or no sweep at all) | 0 |
| 2 — Setup | Singular gap — ONE clean, unmistakable FVG | 10 |
| 2 — Setup | Strong FVG after the sweep | 10 |
| 2 — Setup | Targets are clear | 10 |
| 2 — Setup | Clean path to target | 5 |
| 3 — Trigger | Price returned to the FVG | 5 |
| 3 — Trigger | Inversion candle CLOSED through the FVG | 15 |

The score is still a percentage of what applied, and the bands are unchanged:
**A+** ≥ 90 · **A** ≥ 80 · **B** ≥ 70 · **C** ≥ 50 · **F** below 50. Then:

- **Model gate:** sweep tier NONE, or singular gap not ticked → the letter is
  capped at **C**. "Gate failed — this is not the model. Max grade C." Neither
  item can be marked N/A: a gate nobody cleared has failed.
- **Diagonal cap:** target type Trendline/diagonal → capped at **B**.
- The trigger fires only when both Phase 3 boxes are ticked, as before.

Target types became named liquidity: EQH/EQL, PDH/PDL, Session high/low, Data
wick (ITH/ITL), Order block, CISD, Trendline/diagonal. "Other" is no longer
offered; it, "Horizontal liquidity pool" and "Opposing FVG" stay valid for the
trades filed under them. "Data wick" and "Diagonal trendline" were renamed.

Migration 015 graded nothing again. Trades from version 1 keep their frozen
grades; their sweep tier was backfilled `major` where the MAJOR box was ticked
and left unrecorded otherwise, and their singular gap kept only an explicit yes.

## Version 1 — in force from 2026-09-10 to 2026-09-29

The score is a percentage of the points that *applied*. A box marked N/A
removes its weight from the denominator; it doesn't count as a miss.

| Phase | Box | Points |
| --- | --- | --- |
| 1 — Prep | Higher timeframe bias is clear | 10 |
| 1 — Prep | Inside a killzone | 10 |
| 1 — Prep | No NFP / FOMC / CPI conflict | 5 |
| 2 — Setup | Clear sweep of a MAJOR level | 20 |
| 2 — Setup | Strong FVG after the sweep | 15 |
| 2 — Setup | Targets are clear | 15 |
| 2 — Setup | Clean path to target | 5 |
| 3 — Trigger | Price returned to the FVG | 5 |
| 3 — Trigger | Inversion candle CLOSED through the FVG | 15 |

Letters: **A+** ≥ 90 · **A** ≥ 80 · **B** ≥ 70 · **C** ≥ 50 · **F** below 50.

The trigger fires only when both Phase 3 boxes are ticked.

Every trade logged before rubric versioning existed (migration 014) was
backfilled as version 1 from its generated values at the time, which were
these.
