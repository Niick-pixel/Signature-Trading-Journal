'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  accountOptions, CHECKLIST_KEYS, CONTEXT_FLAGS, CONTEXT_GROUPS, DIRECTIONS, HTF_BIASES, INSTRUMENTS,
  OUTCOMES, PREMIUM_DISCOUNTS, REASONS, REGRADES, SESSIONS, SETUP_TYPES,
  SKIP_REASONS, TARGET_TYPES, TRADE_STATUSES,
  type Account, type ChecklistAnswer, type ChecklistKey, type ContextFlag,
  type Direction, type HtfBias,
  type Instrument, type MistakeTag, type Outcome, type PremiumDiscount, type Regrade,
  type SkipReason, type Reason, type Session, type SetupType, type TargetType,
  type TradeStatus, type Tri,
} from '@/lib/domain';
import { checklistEarned, checklistPossible, checklistScore, triggerFired } from '@/lib/grade';
import { macroWindowFor } from '@/lib/macro';
import { press, spring, springSoft, riseIn } from '@/lib/motion';
import { reasonAccent } from '@/lib/layout';
import { MIN_EXPLANATION, MIN_LESSON, type Trade } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Disclosure } from '@/components/ui/Disclosure';
import { Field, Input } from '@/components/ui/Field';
import { GradeBadge } from '@/components/ui/GradeBadge';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { OUTCOME_COLOR } from '@/components/whiteboard/TradeNode';
import { TogglePill } from '@/components/ui/TogglePill';
import { TriState } from '@/components/ui/TriState';
import { TagPicker } from '@/components/ui/TagPicker';
import { Checklist } from './Checklist';
import { clearDraft, readDraft, writeDraft } from '@/lib/draft';
import { ExplanationField } from './ExplanationField';
import { ScreenshotDropzone } from './ScreenshotDropzone';
import { PastLessons } from './PastLessons';
import { dialogIsOpen } from '@/components/ui/Overlay';
import type { PastLesson } from '@/lib/lessons';

/** `datetime-local` wants 'YYYY-MM-DDTHH:mm' in local time, not an ISO string. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function NewTradeForm({ trade, pastLessons = {} }: {
  trade?: Trade;
  /** The latest lessons per setup type — worked out on the server, see lib/lessons. */
  pastLessons?: Record<string, PastLesson[]>;
}) {
  const editing = Boolean(trade);
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState<Reason | null>(trade?.reason ?? null);
  const [explanation, setExplanation] = useState(trade?.explanation ?? '');

  // One record rather than a useState per flag — there are eleven now, and a
  // new one should cost a line in CONTEXT_GROUPS, not four scattered edits.
  const [context, setContext] = useState<Record<ContextFlag, boolean>>(() =>
    Object.fromEntries(
      CONTEXT_FLAGS.map((f) => [f, trade ? Boolean(trade[f]) : false]),
    ) as Record<ContextFlag, boolean>,
  );
  const setFlag = (flag: ContextFlag, value: boolean) =>
    setContext((prev) => ({ ...prev, [flag]: value }));

  /*
    Tri-state, and `trade[k] ?? null` rather than Boolean(): a box saved as
    "did not apply" has to come back as N/A, not silently as a miss.
  */
  const [checks, setChecks] = useState<Record<ChecklistKey, ChecklistAnswer>>(() =>
    Object.fromEntries(
      CHECKLIST_KEYS.map((k) => [k, trade ? trade[k] ?? null : false]),
    ) as Record<ChecklistKey, ChecklistAnswer>,
  );
  const setCheck = (key: ChecklistKey, value: ChecklistAnswer) =>
    setChecks((prev) => ({ ...prev, [key]: value }));

  // Tri-state, starting unanswered. This used to default to `true`, so every
  // trade ever saved claimed full rule adherence whether or not the question
  // had been looked at. Nothing on this form starts in the affirmative now.
  const [followedRules, setFollowedRules] = useState<Tri>(trade?.followed_rules ?? null);
  const [regrade, setRegrade] = useState<Regrade | null>(trade?.regrade ?? null);
  const [mistakeTags, setMistakeTags] = useState<MistakeTag[]>(trade?.mistake_tags ?? []);
  const [account, setAccount] = useState<Account>(trade?.account ?? 'Live');
  const [accountLabel, setAccountLabel] = useState(trade?.account_label ?? '');
  const [status, setStatus] = useState<TradeStatus>(trade?.status ?? 'Settled');
  const [pnlDollars, setPnlDollars] = useState(trade?.pnl_dollars?.toString() ?? '');
  const [reached1R, setReached1R] = useState<Tri>(trade?.reached_1r ?? null);
  const [confidence, setConfidence] = useState<number | null>(trade?.confidence_at_entry ?? null);
  const [wouldBeR, setWouldBeR] = useState(trade?.would_be_r?.toString() ?? '');
  const [wouldHaveHitTp, setWouldHaveHitTp] = useState<boolean | null>(trade?.would_have_hit_tp ?? null);
  const [rLeftOnTable, setRLeftOnTable] = useState(trade?.r_left_on_table?.toString() ?? '');
  const [skipReason, setSkipReason] = useState<SkipReason | null>(trade?.skip_reason ?? null);

  const [date, setDate] = useState(() => (trade ? toLocalInput(new Date(trade.date)) : toLocalInput(new Date())));
  const [instrument, setInstrument] = useState<Instrument>(trade?.instrument ?? 'NQ');
  const [direction, setDirection] = useState<Direction>(trade?.direction ?? 'Long');
  const [session, setSession] = useState<Session>(trade?.session ?? 'NY AM');
  const [setupType, setSetupType] = useState<SetupType>(trade?.setup_type ?? 'iFVG');
  const [htfBias, setHtfBias] = useState<HtfBias>(trade?.htf_bias ?? 'With bias');
  const [premiumDiscount, setPremiumDiscount] = useState<PremiumDiscount>(trade?.premium_discount ?? 'Discount');
  const [targetType, setTargetType] = useState<TargetType>(trade?.target_type ?? 'Horizontal liquidity pool');
  const [outcome, setOutcome] = useState<Outcome>(trade?.outcome ?? 'Win');
  const [contracts, setContracts] = useState(trade?.contracts?.toString() ?? '');
  const [stopPoints, setStopPoints] = useState(trade?.stop_points?.toString() ?? '');
  const [rMultiple, setRMultiple] = useState(trade?.r_multiple?.toString() ?? '');
  const [lesson, setLesson] = useState(trade?.lesson ?? '');

  /*
    The entry time is still checked against the macro windows, but the answer
    is offered rather than asserted.
    This pill used to arrive pre-ticked whenever the clock happened to be
    inside a window, which put an unasked-for claim on the record — the same
    class of bug as followed_rules defaulting to yes. Nothing on this form
    starts affirmative now; the derived window is shown as a sentence you can
    act on instead.
  */
  const derivedWindow = useMemo(() => macroWindowFor(date), [date]);
  const [macroOverride, setMacroOverride] = useState<boolean | null>(
    trade ? trade.macro_time : null,
  );
  const macroTime = macroOverride ?? false;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    Everything the draft round-trips. The screenshot is deliberately absent:
    an image cannot go in localStorage without bloating it, and re-pasting a
    chart is a second, not a paragraph.
  */
  const draftValues = useMemo(() => ({
    date, instrument, direction, session, reason, setupType, htfBias,
    premiumDiscount, targetType, outcome, explanation, lesson,
    context, checks, followedRules, mistakeTags, account, accountLabel, status,
    contracts, pnlDollars, stopPoints, rMultiple,
    reached1R, confidence, wouldBeR, macroOverride,
  }), [
    date, instrument, direction, session, reason, setupType, htfBias,
    premiumDiscount, targetType, outcome, explanation, lesson,
    context, checks, followedRules, mistakeTags, account, accountLabel, status,
    contracts, pnlDollars, stopPoints, rMultiple,
    reached1R, confidence, wouldBeR, macroOverride,
  ]);

  const [restored, setRestored] = useState(false);

  // The key handler is bound once; the ref keeps it pointed at the current
  // submit rather than a stale closure over the first render's state.
  const submitRef = useRef<(() => void) | null>(null);

  // Only for a new trade: an edit already has the saved values, and restoring
  // a stale draft over them would quietly rewrite a real record.
  useEffect(() => {
    if (editing) return;
    const draft = readDraft();
    if (!draft) return;
    const v = draft.values as Record<string, never>;
    const has = (k: string) => v[k] !== undefined && v[k] !== null;
    if (has('reason')) setReason(v.reason);
    if (has('explanation')) setExplanation(v.explanation);
    if (has('lesson')) setLesson(v.lesson);
    if (has('context')) setContext(v.context);
    if (has('checks')) setChecks(v.checks);
    if (has('date')) setDate(v.date);
    if (has('instrument')) setInstrument(v.instrument);
    if (has('direction')) setDirection(v.direction);
    if (has('session')) setSession(v.session);
    if (has('setupType')) setSetupType(v.setupType);
    if (has('htfBias')) setHtfBias(v.htfBias);
    if (has('premiumDiscount')) setPremiumDiscount(v.premiumDiscount);
    if (has('targetType')) setTargetType(v.targetType);
    if (has('outcome')) setOutcome(v.outcome);
    if (has('followedRules')) setFollowedRules(v.followedRules);
    if (has('mistakeTags')) setMistakeTags(v.mistakeTags);
    if (has('account')) setAccount(v.account);
    if (has('accountLabel')) setAccountLabel(v.accountLabel);
    if (has('status')) setStatus(v.status);
    if (has('contracts')) setContracts(v.contracts);
    if (has('pnlDollars')) setPnlDollars(v.pnlDollars);
    if (has('stopPoints')) setStopPoints(v.stopPoints);
    if (has('rMultiple')) setRMultiple(v.rMultiple);
    if (has('reached1R')) setReached1R(v.reached1R);
    if (has('confidence')) setConfidence(v.confidence);
    if (has('wouldBeR')) setWouldBeR(v.wouldBeR);
    if (has('macroOverride')) setMacroOverride(v.macroOverride);
    // Only claim to have restored something if something was actually written.
    const raw = draft.values as Record<string, unknown>;
    const real = ['explanation', 'lesson', 'reason']
      .some((k) => typeof raw[k] === 'string' && (raw[k] as string).trim().length > 0);
    const tags = raw.mistakeTags;
    setRestored(real || (Array.isArray(tags) && tags.length > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced, so typing an explanation is not one write per keystroke.
  useEffect(() => {
    if (editing) return;
    const id = window.setTimeout(() => writeDraft(draftValues), 800);
    return () => window.clearTimeout(id);
  }, [draftValues, editing]);

  // Escape leaves the form the same way it closes the detail panel. Nothing is
  // saved on the way out — but the draft survives, so nothing is lost either.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      // A dialog open over the form owns Escape; leaving would discard the entry.
      if (e.key === 'Escape' && !typing && !dialogIsOpen()) window.location.href = '/';
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        submitRef.current?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const earned = checklistEarned(checks);
  const possible = checklistPossible(checks);
  const total = checklistScore(checks);
  const fired = triggerFired(checks);
  const planned = status === 'Planned';
  const accent = reason ? reasonAccent(reason) : 'var(--accent)';
  /*
    The minimums apply to what you write, not to what a trade already says.
    An entry logged under the old, shorter floor stays editable at its
    original length; touch the text and the current floor applies from there.
    The same rule the API enforces, so the button never promises a save the
    server will refuse — or refuses one it would have accepted.
  */
  const keptExplanation = editing && explanation.trim() === trade!.explanation.trim();
  const keptLesson = editing && lesson.trim() === (trade!.lesson ?? '').trim();
  const explanationOk = explanation.trim().length >= MIN_EXPLANATION
    || (keptExplanation && explanation.trim().length > 0);
  // A Planned trade has no result to learn from, so it is not asked for one.
  const lessonOk = planned || lesson.trim().length >= MIN_LESSON || keptLesson;
  const canSubmit = (Boolean(file) || editing)
    && Boolean(reason) && explanationOk && lessonOk && !submitting;

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function submit() {
    if (!canSubmit || !reason) return;
    setSubmitting(true);
    setError(null);

    const body = new FormData();
    // On an edit, sending no file means "keep the screenshot you already have".
    if (file) body.append('screenshot', file);
    body.append('trade', JSON.stringify({
      date, instrument, direction, session,
      macro_time: macroTime, macro_time_auto: macroOverride === null,
      reason, setup_type: setupType, htf_bias: htfBias,
      ...context,
      premium_discount: premiumDiscount, target_type: targetType,
      ...checks,
      followed_rules: followedRules,
      regrade,
      // The legacy single tag is carried through untouched so an edit never
      // erases a value written under the old taxonomy.
      mistake_tag: trade?.mistake_tag ?? null,
      mistake_tags: mistakeTags,
      account, account_label: accountLabel.trim() || null,
      status,
      // Freeze the score as it stands now if this is being planned before the
      // outcome is known; a one-shot entry has no pre-outcome grade to keep.
      grade_at_entry: status === 'Planned' ? total : (trade?.grade_at_entry ?? total),
      // True unless this record was opened as a Plan and settled later.
      graded_post_hoc: trade ? trade.graded_post_hoc : status !== 'Planned',
      entry_price: trade?.entry_price ?? null,
      take_profit: trade?.take_profit ?? null,
      stop_loss: trade?.stop_loss ?? null,
      would_have_hit_tp: wouldHaveHitTp,
      r_left_on_table: num(rLeftOnTable),
      skip_reason: skipReason,
      contracts: num(contracts),
      /*
        The number the account actually moved by.

        This was missing from the payload for its entire life: the field was on
        the form, the column was in the schema, the validator accepted it and
        the stats preferred it over risk x R — and every value ever typed into
        it was dropped on the floor between the input and the request. Nothing
        errored, which is why it took a field-by-field round trip to find.
      */
      pnl_dollars: num(pnlDollars),
      /*
        These four are on the screenshot, so the form stopped asking. An edit
        must still carry whatever an older record already holds — dropping them
        here would quietly erase data the form no longer shows.
      */
      risk_dollars: trade?.risk_dollars ?? null,
      risk_percent: trade?.risk_percent ?? null,
      stop_points: num(stopPoints),
      entry_time: trade?.entry_time ?? null,
      exit_time: trade?.exit_time ?? null,
      // Asked for and then removed: the two numbers were a chore to fill in and
      // nothing was read off them. Older records keep whatever they hold.
      mae_r: trade?.mae_r ?? null, mfe_r: trade?.mfe_r ?? null,
      mae_points: null, mfe_points: null,
      reached_1r: reached1R,
      confidence_at_entry: confidence,
      would_be_r: num(wouldBeR),
      playbook_id: null,
      // A plan has no result. Storing one would be inventing a trade.
      outcome: planned ? 'Not taken' : outcome,
      r_multiple: planned ? null : num(rMultiple),
      explanation: explanation.trim(), lesson: lesson.trim() || null,
    }));

    try {
      const res = await fetch(editing ? `/api/trades/${trade!.id}` : '/api/trades', {
        method: editing ? 'PUT' : 'POST',
        body,
      });
      if (!res.ok) {
        // A 500 returns an HTML page, not JSON — falling straight through to a
        // generic message hid the real cause once already.
        const body = await res.text();
        let detail = body.slice(0, 300);
        try {
          detail = JSON.parse(body).error ?? detail;
        } catch { /* not JSON; show the raw beginning of the response */ }
        throw new Error(`${detail} (HTTP ${res.status})`);
      }
      // Saved, so the draft has served its purpose. Leaving it behind would
      // resurrect this trade as a ghost on the next New trade.
      clearDraft();
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the trade.');
      setSubmitting(false);
    }
  }

  // Refs are not written during render; this keeps the key handler pointed at
  // the current submit without re-binding the listener on every keystroke.
  useEffect(() => { submitRef.current = () => { void submit(); }; });

  return (
    <motion.div {...riseIn} transition={spring} className="glass mx-auto rounded-[28px] p-6 sm:p-8 xl:p-10 2xl:p-8">
      <div className="mb-7 flex items-start justify-between gap-4 2xl:mb-5">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold">{editing ? 'Edit trade' : 'New trade'}</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-dim)' }}>
            {editing
              ? 'Paste a new chart to replace the screenshot, or leave it as it is.'
              : 'Name the motive before the data. That is the whole point.'}
          </p>
        </div>

        {/* The board is still behind this card; there was no way back to it
            without saving or using the browser's own history. */}
        <motion.button
          type="button"
          aria-label="Close without saving"
          title="Close without saving (Esc)"
          onClick={() => { window.location.href = '/'; }}
          whileTap={press}
          whileHover={{ scale: 1.06 }}
          transition={spring}
          className="grid size-8 shrink-0 place-items-center rounded-full"
          style={{
            background: 'var(--glass-fill)',
            border: '1px solid var(--glass-stroke)',
            color: 'var(--text-dim)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor"
              strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </motion.button>
      </div>

      {restored && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={spring}
          className="mb-6 flex flex-wrap items-center gap-3 rounded-[14px] px-4 py-2.5 text-[12px]"
          style={{
            background: 'rgb(var(--accent) / 0.10)',
            border: '1px solid rgb(var(--accent) / 0.3)',
            color: 'rgb(var(--accent))',
          }}
        >
          <span>
            Picked up where you left off. These are your unsaved answers, not defaults — the chart
            needs pasting again.
          </span>
          <button
            type="button"
            onClick={() => { clearDraft(); window.location.reload(); }}
            className="ml-auto underline underline-offset-2"
          >
            Start fresh
          </button>
        </motion.div>
      )}

      {/*
        Columns where there is room for them.

        The form had grown to a single tall strip: logging one trade meant four
        or five screens of scrolling, and the checklist — the part that actually
        scores the trade — was always the furthest away. Setup, the writing and
        the checklist are three separate trains of thought, so they sit side by
        side rather than stacked.

        At 1280px each gets its own column. Between 1024 and 1280 there is only
        room for two, so the writing — the tallest of the three by far — takes
      {/*
        Columns of thought, not one tall strip.

        Logging a trade used to mean four or five screens of scrolling, and the
        checklist — the part that actually scores the trade — was always the
        furthest away. The form sorts itself into four trains of thought: what
        the trade WAS, WHEN and on WHAT it happened, what you have to SAY about
        it, and what it SCORES. The old "Details" heap is gone; every field in
        it now lives beside the thing it describes.

        How many of the four get their own column depends on the window:

          under 1024   one column, read top to bottom
          1024-1279    two, filled across — trade | facts, then writing | score
          1280-1899    three: trade and facts stack down the left, the writing
                       and the score take a full-height column each
          1900+        four, one per train of thought

        The last tier is what a 1440p monitor was always going to want. Three
        columns leave a 2560px screen a third empty and still cost a scroll,
        because the checklist is a single ~1000px block that cannot be split —
        it sets the floor for the whole card no matter how the rest is
        arranged. Give it a column of its own alongside three shorter ones and
        the entire capture lands inside one screen.

        The explicit placement at 1280 is doing real work: left to itself the
        grid would put the writing, the facts and the trade across row one and
        drop the score alone on row two beside two empty cells.
      */}
      <div className="grid gap-x-8 gap-y-8 lg:grid-cols-2 lg:gap-y-7 xl:grid-cols-3 xl:gap-y-6 2xl:grid-cols-4">
        {/* A — the trade. */}
        <div className="space-y-7 xl:col-start-1 xl:row-start-1 2xl:col-auto 2xl:row-auto">
        {/* 1 — how it ended. You already know this before you start typing, and
            burying it behind a disclosure made it the last thing recorded. */}
        {/*
          Account first, because it is the one field that must never be wrong:
          backtest R and live R summing into one number would make every other
          figure in the app a lie.
        */}
        <div className="mb-7 grid gap-5 sm:grid-cols-2">
          <Field label="Account" hint="Backtest R and live R never sum into the same number.">
            <Select value={account} onChange={setAccount} options={accountOptions(account)} />
          </Field>
          <Field label="Account label" hint="Optional — which prop firm, which phase.">
            <Input placeholder="—" value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} />
          </Field>
        </div>

        {/*
          Two-stage logging is available, never required. 'Settled' stays the
          default so a finished trade can still be written in one pass.
        */}
        <div className="mb-7">
          <Field
            label="Stage"
            hint="Planned hides the outcome until you settle it, and freezes the grade you gave it before you knew."
          >
            <Segmented value={status} onChange={setStatus} options={TRADE_STATUSES} />
          </Field>
        </div>

        {/* A Planned trade has no outcome yet, so it is not asked for. */}
        <AnimatePresence initial={false}>
          {planned ? (
            <motion.div
              key="planned"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={springSoft}
              className="overflow-hidden"
            >
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                Planned — the outcome is hidden until you settle it. The score you give it now is kept
                as the entry grade, so hindsight cannot quietly rewrite it.
              </p>
              <PastLessons setup={setupType} lessons={pastLessons[setupType] ?? []} inline />
            </motion.div>
          ) : (
            <motion.div
              key="outcome"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={springSoft}
              className="overflow-hidden"
            >
              <Field label="How did it end">
                <Segmented
                  value={outcome}
                  onChange={setOutcome}
                  options={OUTCOMES}
                  accentFor={(o) => OUTCOME_COLOR[o]}
                  labelFor={(o) => (o === 'Not taken' ? 'Passed' : o)}
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2 — the chart. */}
        <div>
        <ScreenshotDropzone
          file={file}
          onFile={setFile}
          existingUrl={trade ? `/api/screenshots/${trade.screenshot_path}` : null}
        />
        </div>

        {/* The passed-setup questions belong here, the moment "Not taken"
            is chosen — not four sections further down. */}
        {/* Only meaningful for a setup you passed on — the plan calls this
            the most important thing in the whole file. */}
        <AnimatePresence>
          {outcome === 'Not taken' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={springSoft}
              className="overflow-hidden"
            >
              <div className="space-y-5 pt-1">
                <Field label="Would it have hit TP?" hint="Go back and check. Guessing defeats the point.">
                  <Segmented
                    value={wouldHaveHitTp === null ? 'Unknown' : wouldHaveHitTp ? 'Yes' : 'No'}
                    onChange={(v) => setWouldHaveHitTp(v === 'Unknown' ? null : v === 'Yes')}
                    options={['Yes', 'No', 'Unknown'] as const}
                    accentFor={(v) => (v === 'Yes' ? 'var(--outcome-win)' : v === 'No' ? 'var(--outcome-loss)' : 'var(--outcome-neutral)')}
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="What it would have paid (R)" hint="Go and check. A guess here is worse than a blank.">
                    <Input type="number" step="0.1" inputMode="decimal" placeholder="—"
                      value={wouldBeR} onChange={(e) => setWouldBeR(e.target.value)} />
                  </Field>
                  <Field label="R left on the table">
                    <Input type="number" step="0.1" inputMode="decimal" placeholder="—"
                      value={rLeftOnTable} onChange={(e) => setRLeftOnTable(e.target.value)} />
                  </Field>
                  <Field label="Real reason" hint="Not the story — the reason.">
                    <Select value={skipReason} onChange={setSkipReason} options={SKIP_REASONS} placeholder="Why really?" />
                  </Field>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* 2 — reason, before anything else. */}
        <Field label="Why did you take it" hint="Answer honestly. Nothing else in this app works if this is wrong.">
          <Select
            value={reason}
            onChange={setReason}
            options={REASONS}
            placeholder="Name your motive…"
            accentFor={(r) => reasonAccent(r as Reason)}
          />
        </Field>
        </div>

        {/* B — when it happened, and on what. Facts about the trade, so they
            sit with the trade rather than in a heap at the bottom. */}
        <div className="space-y-7 xl:col-start-1 xl:row-start-2 2xl:col-auto 2xl:row-auto">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date & time">
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Session">
            <Select value={session} onChange={setSession} options={SESSIONS} />
          </Field>
        </div>

        <div>
          <TogglePill
            checked={macroTime}
            onChange={(next) => setMacroOverride(next === (derivedWindow !== null) ? null : next)}
            label={derivedWindow ? `Macro time (${derivedWindow})` : 'Macro time'}
            accent="var(--accent)"
          />
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
            {derivedWindow
              ? `The entry time falls inside the ${derivedWindow} macro — tick it if that mattered.`
              : 'The entry time is outside both macro windows.'}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Instrument"><Select value={instrument} onChange={setInstrument} options={INSTRUMENTS} /></Field>
          <Field label="Direction"><Select value={direction} onChange={setDirection} options={DIRECTIONS} /></Field>
          <Field label="Setup type"><Select value={setupType} onChange={setSetupType} options={SETUP_TYPES} /></Field>
          <Field label="HTF bias"><Select value={htfBias} onChange={setHtfBias} options={HTF_BIASES} /></Field>
          <Field label="Premium / discount"><Select value={premiumDiscount} onChange={setPremiumDiscount} options={PREMIUM_DISCOUNTS} /></Field>
          <Field label="Target type"><Select value={targetType} onChange={setTargetType} options={TARGET_TYPES} /></Field>
        </div>
        {!planned && (
          <PastLessons setup={setupType} lessons={pastLessons[setupType] ?? []} inline={false} />
        )}

        {/* What it paid. Numbers are facts about the trade, so they sit with
            the rest of the record rather than with the writing — and it keeps
            the writing column under the height the checklist sets. */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="R multiple" hint="Signed, e.g. 2.4 or -1. Leave blank to settle later.">
            <Input type="number" step="0.1" inputMode="decimal" placeholder="—"
              value={rMultiple} onChange={(e) => setRMultiple(e.target.value)} />
          </Field>
          <Field label="Contracts">
            <Input type="number" step="1" min="0" placeholder="—" value={contracts} onChange={(e) => setContracts(e.target.value)} />
          </Field>
          <Field label="P&L ($)" hint="What the account actually did. Signed — a loss is negative.">
            <Input type="number" step="0.01" inputMode="decimal" placeholder="—"
              value={pnlDollars} onChange={(e) => setPnlDollars(e.target.value)} />
          </Field>
          <Field label="Stop (points)" hint="Optional — it is on the screenshot.">
            <Input type="number" step="0.25" min="0" placeholder="—" value={stopPoints} onChange={(e) => setStopPoints(e.target.value)} />
          </Field>
        </div>

        {/*
          Excursion. How far it went against me before it worked, and how
          far in my favour before it turned — the fastest way to learn
          whether the stop is too tight or the target too greedy, which no
          win rate will ever tell me.
        */}
        <TriState
          value={reached1R}
          onChange={setReached1R}
          label="Reached +1R before the stop?"
          hint="If most of your losers did, the problem is management rather than selection."
        />

        {/* Context flags, folded away with a count: a trade that needs none of
            them costs no height at all. */}
        <div className="space-y-2">
          {CONTEXT_GROUPS.map((group) => {
            const on = group.flags.filter((f) => context[f.key]).length;
            return (
              <Disclosure
                key={group.label}
                label={`${group.label}${on ? `  ·  ${on} ticked` : ''}`}
                defaultOpen={on > 0}
              >
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {group.flags.map((flag) => (
                    <TogglePill
                      key={flag.key}
                      checked={context[flag.key]}
                      onChange={(next) => setFlag(flag.key, next)}
                      label={flag.label}
                      hint={flag.hint}
                    />
                  ))}
                </div>
              </Disclosure>
            );
          })}
        </div>
        </div>

        {/* C — the writing, and the reckoning that goes with it. */}
        <div className="space-y-7 xl:col-start-2 xl:row-start-1 xl:row-span-2 2xl:col-auto 2xl:row-auto 2xl:row-span-1">
        {/* 3 — the writing. */}
        <Field label="Explanation">
          <ExplanationField
            value={explanation}
            onChange={setExplanation}
            minChars={MIN_EXPLANATION}
            kept={keptExplanation}
            minRows={8}
            placeholder="What did you see, what did you expect, and what made you click the button?"
          />
        </Field>

        {/*
          3b — the lesson, beside the explanation and just as demanding.
          What happened and what to do about it are two different thoughts, and
          only the second one changes anything. Not asked of a Planned trade:
          there is no outcome to draw a lesson from yet.
        */}
        {!planned && (
          <Field
            label="Lesson"
            hint={`What would you do differently? At least ${MIN_LESSON} characters — a label is not a lesson.`}
          >
            <ExplanationField
              value={lesson}
              onChange={setLesson}
              required
              minChars={MIN_LESSON}
              kept={keptLesson}
              minRows={8}
              placeholder="Next time: the sweep was there but I took it before the candle closed. Wait for the close, even when it looks like it is leaving without me."
            />
          </Field>
        )}


        {/* After the close: the honest part. */}
        <Field label="Honest re-grade" hint="After the close, and allowed to be harsher than before it.">
          <Select value={regrade} onChange={setRegrade} options={REGRADES} placeholder="Not re-graded yet" />
        </Field>

        <Field
          label="What went wrong"
          hint="Pick every one that applies. A bad trade usually has three."
        >
          <TagPicker value={mistakeTags} onChange={setMistakeTags} />
        </Field>

        {/*
          Your own verdict, directly under your own account of what went wrong.

          It sat under the checklist for a while, so the gap between what the
          score says and what you believe about yourself would be impossible to
          miss. On a wide window nothing scrolls any more, so both are on screen
          together wherever they sit — and the checklist block is the one thing
          in this form that cannot be split, so anything else stacked on it sets
          the height of the whole card. This costs nothing and buys the last
          hundred and thirty pixels.
        */}
        <TriState
          value={followedRules}
          onChange={setFollowedRules}
          label="Followed ALL rules"
          hint="Max 2 trades, stop after 2 losses, no revenge, size within 1%. Leave it unset rather than guessing — stats read the checklist, not this answer."
        />
        </div>

        {/* D — the score. */}
        <div className="space-y-7 xl:col-start-3 xl:row-start-1 xl:row-span-2 2xl:col-auto 2xl:row-auto 2xl:row-span-1">
        {/* 5 — the checklist, with the live score. */}
        <div>
          <span className="mb-4 block text-[11px] font-medium uppercase tracking-[0.07em]"
            style={{ color: 'var(--text-faint)' }}>
            Checklist
          </span>

          <div className="mb-6">
            <GradeBadge total={earned} max={possible} size="lg" showPrompt triggerFired={fired} />
          </div>

          <Checklist answers={checks} onChange={setCheck} accent={accent} />

          {/*
            Recorded here, beside the score, because it only measures anything
            if it is set before the outcome is known. Answered afterwards it is
            just the result wearing a different hat.
          */}
          <div className="mt-6">
            <Field label="Confidence at entry" hint="Optional. Only worth anything if you set it before you knew.">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <motion.button
                    key={n}
                    type="button"
                    aria-pressed={confidence === n}
                    onClick={() => setConfidence(confidence === n ? null : n)}
                    whileTap={press}
                    transition={spring}
                    animate={{
                      borderColor: confidence === n ? `rgb(${accent} / 0.6)` : 'var(--glass-stroke)',
                      background: confidence === n ? `rgb(${accent} / 0.12)` : 'var(--glass-fill)',
                    }}
                    className="flex-1 rounded-[12px] border py-2 text-[13px] font-medium"
                    style={{ color: confidence === n ? `rgb(${accent})` : 'var(--text-faint)' }}
                  >
                    {'★'.repeat(n)}
                  </motion.button>
                ))}
              </div>
            </Field>
          </div>

        </div>
        </div>
      </div>


      <div className="mt-9 flex items-center justify-between gap-5 2xl:mt-6">
        <div className="min-w-0 text-[12px]" style={{ color: 'var(--text-faint)' }}>
          <AnimatePresence mode="wait">
            <motion.span
              key={!file && !editing ? 'file' : !reason ? 'reason'
                : !explanationOk ? 'expl' : !lessonOk ? 'lesson' : 'ready'}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={spring} className="block truncate"
            >
              {!file && !editing ? 'A screenshot is required.'
                : !reason ? 'Name your motive to continue.'
                : !explanationOk ? `${MIN_EXPLANATION - explanation.trim().length} more characters of explanation.`
                : !lessonOk ? `${MIN_LESSON - lesson.trim().length} more characters of lesson.`
                : 'Ready.'}
            </motion.span>
          </AnimatePresence>
        </div>

        <Button variant="primary" accent={accent} disabled={!canSubmit} onClick={submit} className="shrink-0">
          {submitting ? 'Saving…' : editing ? 'Save changes' : 'Save trade'}
        </Button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={spring}
            className="mt-4 whitespace-pre-wrap break-words rounded-[14px] p-3 text-[12px] leading-relaxed"
            style={{ color: 'rgb(var(--outcome-loss))', background: 'rgb(var(--outcome-loss) / 0.10)' }}>
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
