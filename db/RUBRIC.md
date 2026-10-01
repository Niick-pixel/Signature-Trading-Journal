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

## Trial rubrics

A rubric can run **on trial** before it is allowed to count. `TRIAL_RUBRIC`
in `lib/rubric.ts` names it. A trial rubric is graded beside
`CURRENT_RUBRIC` on every read — the capture form, the detail panel, and its
own table in Stats — but it is **never written onto a trade**: every trade is
still graded and frozen under the current rubric. Trying a rule can therefore
never re-grade history, move a live number, or change what the checklist
tells you to do today.

A trial ends one of two ways:

- **Promoted:** the sample is in (`TRIAL_SAMPLE` taken trades on the new path)
  and it pays. Raise `CURRENT_RUBRIC` to it and follow "Changing the rubric"
  above — including the migration that rebuilds the generated columns — then
  set `TRIAL_RUBRIC` to `null` and move its section out of trial.
- **Dropped:** the sample is in and it does not pay. Set `TRIAL_RUBRIC` to
  `null` and record why below. The answers it collected stay on the trades.

## Version 4 — ON TRIAL since 2026-10-01 (not in force)

Rubric 3's gate accepts only a sweep. Dodgy's own setup sheet accepts a
liquidity sweep **or** a delivery from a higher-timeframe FVG — an A either
way — and asks for **both** at A+. His own graded examples agree: the one
delivery-only trade in his published breakdown was a B+, not an A. Rubric 4
tests that path, with three new answers (migration 018):

| Answer | What it is |
| --- | --- |
| `sweep_level` | The swept level, picked from a list: PDH, PDL, PWH, PWL, Asia/London high or low, EQH, EQL, intraday high or low, data wick. |
| `sweep_futures_confirmed` | The sweep also happened on NQ futures, not only on the CFD wick. |
| `htf_delivery` | The HTF array delivered from, picked: timeframe (5m–Daily) and FVG or OB. |

Same items, weights and letter bands as version 3. The sweep tier becomes the
**liquidity event**, still 20 points and still a gate:

| Liquidity event | Points | Ceiling |
| --- | --- | --- |
| Sweep + delivery | 20 | A+ — the only way to an A+ |
| Major sweep, level picked | 20 | A |
| Minor sweep, level picked **and** confirmed on NQ futures | 12 | A |
| Delivery only, picked | 12 | **B** |
| None of the above | 0 | **C** (gate) |

- A sweep with no level picked is no sweep — if none of the listed levels fits, there was no sweep. A MINOR sweep not confirmed on
  futures is no sweep: a two-point CFD wick past a level did not run the stops
  that sit on the exchange.
- The single gap stays a gate, and a Trendline/diagonal target still caps at B.

Promotion test: `TRIAL_SAMPLE` (30) taken delivery-only trades with a positive
average R, and no drag on the sweep trades. Setups skipped under rubric 3 can
be logged in the Missed account with their would-be R: they count towards this
verdict on every account's Stats page (shown as "n taken, m from Missed"), so
the sample fills without risking money, and they still never touch a real
total. Stats shows the running count and verdict.

Nothing is typed: the level and the delivery are picked from fixed lists, so
the trial's tables group cleanly and the prices stay on the chart.

## Version 3 — in force since 2026-09-29

Identical to version 2 — same items, weights, gates and diagonal cap — with
one change: **A+ is 100 and nothing less.** 100% of the points that applied
is A+; 80–99 is A. A 92 with a minor but nameable sweep is a clean A, not an
A+ (under version 2 it was an A+, and trades graded then keep it).

Letters: **A+** = 100 · **A** ≥ 80 · **B** ≥ 70 · **C** ≥ 50 · **F** below 50,
then the caps: model gate → max C, Trendline/diagonal → max B. Migration 016.

## Version 2 — in force on 2026-09-29, before version 3

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
