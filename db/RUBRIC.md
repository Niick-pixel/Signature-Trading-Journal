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
- Editing a trade's checklist answers re-scores it **under its own
  `rubric_version`**, not the current one. Correcting a box ticked by mistake
  changes the grade; a rubric change made since does not.
- A restored backup keeps each trade's `rubric_version`. An export from
  before versions existed is graded under version 1.

## Changing the rubric

1. Add the new version to `RUBRICS` in `lib/rubric.ts`, written out as
   literal numbers. Never derive it from the checklist.
2. Raise `CURRENT_RUBRIC`.
3. Change the weights in `CHECKLIST_PHASES` (`lib/domain.ts`) and the letter
   bands in `gradeLetter` (`lib/grade.ts`) to match.
4. Add a migration that rebuilds the generated columns with the new numbers.
   Leave the stored `*_at_entry` columns alone.
5. Add a section below.

`npm test` fails if the live checklist and the current version disagree, so
step 1 cannot be skipped by accident.

## Version 1 — in force since 2026-09-10

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
