'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Collapse } from '@/components/ui/Collapse';
import {
  ACCOUNT_VALUES, SHOT_SLOTS, accountOptions, isHypothetical, CHECKLIST_KEYS, CONTEXT_FLAGS, WORKED_TAGS, type WorkedTag, DIRECTIONS, HTF_BIASES, INSTRUMENTS,
  OUTCOMES, PREMIUM_DISCOUNTS, REASONS, SESSIONS, SETUP_TYPES,
  SKIP_REASONS, TRADE_STATUSES, WEAK_TARGET, WEAK_TARGET_WARNING, targetTypeOptions,
  type Account, type ChecklistAnswer, type ChecklistKey, type ContextFlag,
  type Direction, type HtfBias,
  type Instrument, type MistakeTag, type Outcome, type PremiumDiscount, type Regrade,
  type SkipReason, type Reason, type Session, type SetupType, type TargetType,
  type SweepTier, type TradeStatus, type Tri,
} from '@/lib/domain';
import { REGRADE_HINT, regradeOptions } from '@/lib/grade';
import { CURRENT_RUBRIC, GATES_SINCE, MODEL_GATE_MESSAGE, gradeUnder } from '@/lib/rubric';
import { macroWindowFor } from '@/lib/macro';
import { press, spring, springSoft, riseIn } from '@/lib/motion';
import { reasonAccent } from '@/lib/layout';
import { MIN_EXPLANATION, MIN_LESSON, type Trade } from '@/lib/types';

const LAST_ACCOUNT_KEY = 'signature.lastAccount';

/** The questions that start with an answer already in them. */
const DEFAULTED = [
  'outcome', 'session', 'instrument', 'direction', 'setupType', 'htfBias', 'premiumDiscount', 'targetType',
  'sweepTier',
] as const;
type DefaultedField = (typeof DEFAULTED)[number];
const DEFAULTED_LABEL: Record<DefaultedField, string> = {
  outcome: 'How it ended', session: 'Session', instrument: 'Instrument', direction: 'Direction',
  setupType: 'Setup type', htfBias: 'HTF bias', premiumDiscount: 'Premium / discount', targetType: 'Target type',
  sweepTier: 'Sweep',
};
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
import { TrialLiquidity } from './TrialLiquidity';
import { clearDraft, readDraft, writeDraft } from '@/lib/draft';
import { ExplanationField } from './ExplanationField';
import { ScreenshotDropzone } from './ScreenshotDropzone';
import { ShotSlots, type SlotFiles } from './ShotSlots';
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
  // Editing replaces the one stored chart; a new trade fills labelled slots.
  const [file, setFile] = useState<File | null>(null);
  const [slots, setSlots] = useState<SlotFiles>({});

  /*
    Answers that start on a default. Each one's label stays lit until an
    option is picked — the default itself counts — so a pre-filled "Win" or
    "With bias" is never saved without being looked at. An edit starts with
    everything confirmed: those answers were given when the trade was logged.
  */
  const [confirmed, setConfirmed] = useState<DefaultedField[]>(() => (trade ? [...DEFAULTED] : []));
  const confirm = (field: DefaultedField) =>
    setConfirmed((prev) => (prev.includes(field) ? prev : [...prev, field]));
  const pending = (field: DefaultedField) => !confirmed.includes(field);
  const firstSlot = SHOT_SLOTS.find((s) => slots[s]) ?? null;
  const chart = trade ? file : (firstSlot ? slots[firstSlot]! : null);
  const [reason, setReason] = useState<Reason | null>(trade?.reason ?? null);
  const [explanation, setExplanation] = useState(trade?.explanation ?? '');

  // One record rather than a useState per flag — there are eleven now, and a
  // new one should cost a line in CONTEXT_GROUPS, not four scattered edits.
  const [context, setContext] = useState<Record<ContextFlag, boolean>>(() =>
    Object.fromEntries(
      CONTEXT_FLAGS.map((f) => [f, trade ? Boolean(trade[f]) : false]),
    ) as Record<ContextFlag, boolean>,
  );

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
  /*
    Starts on NONE, the answer that claims nothing — and lit, like every other
    default, until one is picked. An old trade that never answered it opens
    with nothing picked rather than a guess.
  */
  const [sweepTier, setSweepTier] = useState<SweepTier | null>(trade ? trade.sweep_tier : 'none');
  /*
    Rubric 4 (trial): the liquidity event, named. Empty and unset by default —
    nothing here claims a level or a confirmation nobody picked.
  */
  const [sweepLevel, setSweepLevel] = useState(trade?.sweep_level ?? '');
  const [futuresConfirmed, setFuturesConfirmed] = useState<Tri>(trade?.sweep_futures_confirmed ?? null);
  const [htfDelivery, setHtfDelivery] = useState(trade?.htf_delivery ?? '');

  // Tri-state, starting unanswered. This used to default to `true`, so every
  // trade ever saved claimed full rule adherence whether or not the question
  // had been looked at. Nothing on this form starts in the affirmative now.
  const [followedRules, setFollowedRules] = useState<Tri>(trade?.followed_rules ?? null);
  const [regrade, setRegrade] = useState<Regrade | null>(trade?.regrade ?? null);
  const [mistakeTags, setMistakeTags] = useState<MistakeTag[]>(trade?.mistake_tags ?? []);
  const [workedTags, setWorkedTags] = useState<WorkedTag[]>(trade?.worked_tags ?? []);
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
  const [targetType, setTargetType] = useState<TargetType>(trade?.target_type ?? 'EQH/EQL');
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
  /*
    Read-only now. Macro time is a fact about the entry time, so it is shown
    as one, derived from the date field — not a pill that could be ticked
    into saying something the clock did not. Change the time to change it.
  */
  const macroTime = derivedWindow !== null;

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
    context, checks, sweepTier, sweepLevel, futuresConfirmed, htfDelivery, followedRules, mistakeTags, workedTags, account, accountLabel, status,
    contracts, pnlDollars, stopPoints, rMultiple,
    reached1R, confidence, wouldBeR, confirmed,
  }), [
    date, instrument, direction, session, reason, setupType, htfBias,
    premiumDiscount, targetType, outcome, explanation, lesson,
    context, checks, sweepTier, sweepLevel, futuresConfirmed, htfDelivery, followedRules, mistakeTags, workedTags, account, accountLabel, status,
    contracts, pnlDollars, stopPoints, rMultiple,
    reached1R, confidence, wouldBeR, confirmed,
  ]);

  const [restored, setRestored] = useState(false);

  // The key handler is bound once; the ref keeps it pointed at the current
  // submit rather than a stale closure over the first render's state.
  const submitRef = useRef<(() => void) | null>(null);

  // Only for a new trade: an edit already has the saved values, and restoring
  // a stale draft over them would quietly rewrite a real record.
  useEffect(() => {
    if (editing) return;
    // A new trade starts on the account you logged the last one to — the
    // same account nine times out of ten, and a wrong default is how a live
    // trade ends up in the demo totals.
    try {
      const last = window.localStorage.getItem(LAST_ACCOUNT_KEY);
      if (last && (ACCOUNT_VALUES as readonly string[]).includes(last)) setAccount(last as Account);
    } catch { /* storage unavailable: keep the default */ }
    const draft = readDraft();
    if (!draft) return;
    const v = draft.values as Record<string, never>;
    const has = (k: string) => v[k] !== undefined && v[k] !== null;
    if (has('reason')) setReason(v.reason);
    if (has('explanation')) setExplanation(v.explanation);
    if (has('lesson')) setLesson(v.lesson);
    if (has('context')) setContext(v.context);
    if (has('checks')) setChecks(v.checks);
    if (has('sweepTier')) setSweepTier(v.sweepTier);
    if (has('sweepLevel')) setSweepLevel(v.sweepLevel);
    if (has('futuresConfirmed')) setFuturesConfirmed(v.futuresConfirmed);
    if (has('htfDelivery')) setHtfDelivery(v.htfDelivery);
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
    if (has('workedTags')) setWorkedTags(v.workedTags);
    if (has('confirmed')) setConfirmed(v.confirmed);
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
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S' || e.key === 'Enter')) {
        e.preventDefault();
        submitRef.current?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /*
    The grade these answers get under the current rubric, gates and all. On a
    trade that has left Planned it is only the LIVE grade: the grade at entry
    is locked (see db/trades.ts) and is what the badge shows.
  */
  const live = gradeUnder(CURRENT_RUBRIC, { ...checks, sweep_tier: sweepTier, target_type: targetType });
  const locked = editing && trade!.status !== 'Planned';
  const entryLetter = locked ? trade!.grade_letter : live.letter;
  const modelGate = live.caps.some((c) => c.id === 'model') && (!locked || trade!.rubric_version >= GATES_SINCE);
  const diagonalCap = !modelGate && live.caps.some((c) => c.id === 'diagonal') && (!locked || trade!.rubric_version >= GATES_SINCE);
  // Reviews can only be harsher: the picker offers the entry letter and below.
  const regradeChoices = useMemo(() => {
    const allowed = regradeOptions(entryLetter);
    // A re-grade from before this rule stays on the record, and in the picker.
    const kept = trade?.regrade && !allowed.includes(trade.regrade) ? [trade.regrade] : [];
    return [...kept, ...allowed];
  }, [entryLetter, trade?.regrade]);
  // An answer changed and the entry grade fell below the re-grade already picked.
  useEffect(() => {
    if (regrade && !regradeChoices.includes(regrade)) setRegrade(null);
  }, [regrade, regradeChoices]);
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
  // Planned trades hide the outcome, so it is not waiting on an answer.
  const unconfirmed = DEFAULTED.filter((f) => pending(f) && !(f === 'outcome' && planned));
  const canSubmit = (Boolean(chart) || editing)
    && Boolean(reason) && explanationOk && lessonOk && !submitting;

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  /**
   * Save. `quick` is "Log it fast": whatever is written, past the minimums and
   * with or without a chart, marked quick_log so stats can leave it out. It
   * still needs a reason — one click, and the one thing the journal is for.
   */
  async function submit(quick = false) {
    if (quick ? (!reason || submitting) : (!canSubmit || !reason)) return;
    setSubmitting(true);
    setError(null);

    const body = new FormData();
    // On an edit, sending no file means "keep the screenshot you already have".
    if (chart) body.append('screenshot', chart);
    // A new trade's first filled slot is its chart; every image keeps its label.
    if (!editing && firstSlot) {
      body.append('screenshot_slot', firstSlot);
      for (const s of SHOT_SLOTS) {
        if (s === firstSlot || !slots[s]) continue;
        body.append('shots', slots[s]!);
        body.append('shot_slots', s);
      }
    }
    body.append('trade', JSON.stringify({
      date, instrument, direction, session,
      macro_time: macroTime, macro_time_auto: true,
      reason, setup_type: setupType, htf_bias: htfBias,
      ...context,
      premium_discount: premiumDiscount, target_type: targetType,
      ...checks,
      sweep_tier: sweepTier,
      // Rubric 4 (trial). A level typed for a sweep that was then changed to
      // NONE is dropped rather than kept as a level nothing was swept at.
      sweep_level: sweepTier === 'major' || sweepTier === 'minor' ? sweepLevel.trim() || null : null,
      sweep_futures_confirmed: sweepTier === 'major' || sweepTier === 'minor' ? futuresConfirmed : null,
      htf_delivery: htfDelivery.trim() || null,
      // Rubric 1's box. The server derives it from the tier when there is one;
      // an old trade that never answered the tier keeps what it had.
      chk_sweep: trade?.chk_sweep ?? null,
      followed_rules: followedRules,
      regrade,
      // The legacy single tag is carried through untouched so an edit never
      // erases a value written under the old taxonomy.
      mistake_tag: trade?.mistake_tag ?? null,
      mistake_tags: mistakeTags,
      worked_tags: workedTags,
      account, account_label: accountLabel.trim() || null,
      status,
      // The server's to set: it is the frozen score, locked once the trade
      // leaves Planned. Sent only so an older server still gets a value.
      grade_at_entry: trade?.grade_at_entry ?? live.score,
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
      quick_log: quick,
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
      try { window.localStorage.setItem(LAST_ACCOUNT_KEY, account); } catch { /* fine */ }
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
    <motion.div {...riseIn} transition={spring} className="glass mx-auto rounded-[calc(28px*var(--rk))] p-6 sm:p-8 xl:p-10 2xl:p-8">
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
          className="mb-6 flex flex-wrap items-center gap-3 rounded-[calc(14px*var(--rk))] px-4 py-2.5 text-[12px]"
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
          <Field
            label="Account"
            hint={isHypothetical(account)
              // Missed is not Passed: Passed is a setup you chose not to take,
              // which is often the right call. Missed is one you wanted and
              // did not take — and its outcome is the price of that.
              ? 'Missed: a setup you hesitated on or missed. Log it as if you had taken it — the outcome and R it would have had. It never joins a real total.'
              : 'Backtest R and live R never sum into the same number.'}
          >
            <Select value={account} onChange={setAccount} options={accountOptions(account)} />
          </Field>
          <Field label="Account label" hint="Optional — which prop firm, which phase.">
            <Input placeholder="—" value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} />
          </Field>
          {/* A missed trade's most useful fact is why it was missed — the
              hesitation patterns on Stats split by exactly this. */}
          {isHypothetical(account) && outcome !== 'Not taken' && (
            <Field label="Why you didn't take it" hint="Fear, a rule, not at the screen, or it simply went without you." className="sm:col-span-2">
              <Select value={skipReason} onChange={setSkipReason} options={SKIP_REASONS} placeholder="Why really?" />
            </Field>
          )}
        </div>

        {/*
          Two-stage logging is available, never required. 'Settled' stays the
          default so a finished trade can still be written in one pass.
        */}
        <div className="mb-7">
          <Field
            label="Stage"
            hint={locked
              ? 'This trade has left Planned, so its grade at entry is locked — it cannot go back.'
              : 'Planned hides the outcome until you settle it. The grade stays open while it is Planned and locks the moment it leaves.'}
           group>
            <Segmented value={status} onChange={setStatus}
              options={locked ? TRADE_STATUSES.filter((st) => st !== 'Planned') : TRADE_STATUSES} />
          </Field>
        </div>

        {/* A Planned trade has no outcome yet, so it is not asked for. */}
        <AnimatePresence initial={false}>
          {planned ? (
            <Collapse key="planned">
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                Planned — the outcome is hidden until you settle it. The score you give it now is kept
                as the entry grade, so hindsight cannot quietly rewrite it.
              </p>
              <PastLessons setup={setupType} lessons={pastLessons[setupType] ?? []} inline />
            </Collapse>
          ) : (
            <Collapse key="outcome">
              <Field label="How did it end" pending={pending('outcome')} group>
                <Segmented
                  value={outcome}
                  onChange={(o) => { setOutcome(o); confirm('outcome'); }}
                  options={OUTCOMES}
                  accentFor={(o) => OUTCOME_COLOR[o]}
                  labelFor={(o) => (o === 'Not taken' ? 'Passed' : o)}
                />
              </Field>
            </Collapse>
          )}
        </AnimatePresence>

        {/* 2 — the chart. */}
        <div>
        {editing ? (
          <ScreenshotDropzone
            file={file}
            onFile={setFile}
            existingUrl={trade!.screenshot_path ? `/api/screenshots/${trade!.screenshot_path}` : null}
          />
        ) : (
          <ShotSlots files={slots} onChange={setSlots} />
        )}
        </div>

        {/* The passed-setup questions belong here, the moment "Not taken"
            is chosen — not four sections further down. */}
        {/* Only meaningful for a setup you passed on — the plan calls this
            the most important thing in the whole file. */}
        <AnimatePresence>
          {outcome === 'Not taken' && (
            <Collapse key="not-taken">
              <div className="space-y-5 pt-1">
                <Field label="Would it have hit TP?" hint="Go back and check. Guessing defeats the point." group>
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
            </Collapse>
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
          <Field label="Session" pending={pending('session')}>
            <Select value={session} onChange={(v) => { setSession(v); confirm('session'); }} options={SESSIONS} />
          </Field>
        </div>

        <div data-macro={derivedWindow ? 'inside' : 'outside'} className="flex items-center gap-2 text-[11.5px]"
          title="Derived from the date and time above — change the time to change this">
          <span className="rounded-full border px-2.5 py-1 font-medium"
            style={{
              borderColor: derivedWindow ? 'rgb(var(--accent) / 0.45)' : 'var(--glass-stroke)',
              color: derivedWindow ? 'rgb(var(--accent))' : 'var(--text-faint)',
            }}>
            {derivedWindow ? `Inside the ${derivedWindow} macro` : 'Outside the macro windows'}
          </span>
          <span style={{ color: 'var(--text-faint)' }}>from the entry time</span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Instrument" pending={pending('instrument')}><Select value={instrument} onChange={(v) => { setInstrument(v); confirm('instrument'); }} options={INSTRUMENTS} /></Field>
          <Field label="Direction" pending={pending('direction')}><Select value={direction} onChange={(v) => { setDirection(v); confirm('direction'); }} options={DIRECTIONS} /></Field>
          <Field label="Setup type" pending={pending('setupType')}><Select value={setupType} onChange={(v) => { setSetupType(v); confirm('setupType'); }} options={SETUP_TYPES} /></Field>
          <Field label="HTF bias" pending={pending('htfBias')}><Select value={htfBias} onChange={(v) => { setHtfBias(v); confirm('htfBias'); }} options={HTF_BIASES} /></Field>
          <Field label="Premium / discount" pending={pending('premiumDiscount')}><Select value={premiumDiscount} onChange={(v) => { setPremiumDiscount(v); confirm('premiumDiscount'); }} options={PREMIUM_DISCOUNTS} /></Field>
          <Field label="Target type" pending={pending('targetType')}>
            <Select value={targetType} onChange={(v) => { setTargetType(v); confirm('targetType'); }}
              options={targetTypeOptions(trade?.target_type ?? null)} />
            {/* Said where the choice is made, not only where the grade is. */}
            <AnimatePresence initial={false}>
              {targetType === WEAK_TARGET && (
                <Collapse key="weak-target" data-target-warning>
                  <p className="pt-1.5 text-[11px] font-medium leading-snug" style={{ color: 'rgb(var(--amber))' }}>
                    {WEAK_TARGET_WARNING} Max grade B.
                  </p>
                </Collapse>
              )}
            </AnimatePresence>
          </Field>
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

        {/*
          What worked, where "The setup" used to be. The post-mortem had only a
          mistakes half, which teaches what to avoid and nothing about what to
          repeat — and a loss traded well looks exactly like a loss traded
          badly until this is filled in.
        */}
        <Field label="What worked" hint="Pick every one that applies — on losers too. A good trade can lose." group>
          <TagPicker value={workedTags} onChange={setWorkedTags} options={WORKED_TAGS} tone="win" />
        </Field>

        {/* The context pills are retired (see CONTEXT_GROUPS); an edit still
            carries whatever an older trade answered, through `context`. */}
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
        <Field label="Honest re-grade" hint={`Graded ${entryLetter} at entry${locked ? ' (locked)' : ''}. ${REGRADE_HINT}`}>
          <div data-regrade-options={regradeChoices.join(' ')}>
            <Select value={regrade} onChange={setRegrade} options={regradeChoices} placeholder="Not re-graded yet" />
          </div>
        </Field>

        <Field
          label="What went wrong"
          hint="Pick every one that applies. A bad trade usually has three."
          group
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

          <div className="mb-6 space-y-3">
            {locked ? (
              /*
                The grade the trade was taken on, not the one these answers
                would get now. The live grade is still shown when they differ,
                so a correction is visible without rewriting history.
              */
              <div data-grade-locked={trade!.grade_letter}>
                <GradeBadge total={trade!.checklist_score} max={100} size="lg" showPrompt
                  triggerFired={trade!.trigger_fired} letter={trade!.grade_letter} />
                <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                  Grade at entry, locked when this trade left Planned
                  {trade!.rubric_version < CURRENT_RUBRIC ? ` (rubric ${trade!.rubric_version})` : ''}. Changing the
                  boxes is recorded in its history but cannot change it.
                  {(live.letter !== trade!.grade_letter || live.score !== trade!.checklist_score) && (
                    <span data-live-grade className="block" style={{ color: 'var(--text-dim)' }}>
                      These answers now: {live.letter} · {live.score}%.
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <GradeBadge total={live.earned} max={live.possible} size="lg" showPrompt
                triggerFired={live.trigger} letter={live.letter} />
            )}
            {/* The gates outrank the total: said in red, above the boxes that caused it. */}
            <AnimatePresence initial={false}>
              {modelGate && (
                <motion.div key="gate" data-gate-banner role="alert"
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={springSoft}
                  className="rounded-[calc(12px*var(--rk))] border px-3 py-2 text-[12.5px] font-semibold leading-snug"
                  style={{
                    color: 'rgb(var(--outcome-loss))', borderColor: 'rgb(var(--outcome-loss) / 0.45)',
                    background: 'rgb(var(--outcome-loss) / 0.10)',
                  }}>
                  {MODEL_GATE_MESSAGE}
                </motion.div>
              )}
              {diagonalCap && (
                <motion.p key="diag" data-diagonal-cap initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-[11.5px] font-medium leading-snug" style={{ color: 'rgb(var(--amber))' }}>
                  Trendline/diagonal target — max grade B.
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <Checklist answers={checks} onChange={setCheck} accent={accent}
            sweepTier={sweepTier} onSweepTier={(t) => { setSweepTier(t); confirm('sweepTier'); }}
            sweepPending={pending('sweepTier')} />

          <TrialLiquidity accent={accent}
            answers={{
              ...checks, sweep_tier: sweepTier, target_type: targetType,
              sweep_level: sweepLevel, sweep_futures_confirmed: futuresConfirmed, htf_delivery: htfDelivery,
            }}
            sweepTier={sweepTier}
            sweepLevel={sweepLevel} onSweepLevel={setSweepLevel}
            futuresConfirmed={futuresConfirmed} onFuturesConfirmed={setFuturesConfirmed}
            htfDelivery={htfDelivery} onHtfDelivery={setHtfDelivery} />

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
                    className="flex-1 rounded-[calc(12px*var(--rk))] border py-2 text-[13px] font-medium"
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
              key={!chart && !editing ? 'file' : !reason ? 'reason'
                : !explanationOk ? 'expl' : !lessonOk ? 'lesson' : 'ready'}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={spring} className="block truncate"
            >
              {!chart && !editing ? 'A screenshot is required.'
                : !reason ? 'Name your motive to continue.'
                : !explanationOk ? `${MIN_EXPLANATION - explanation.trim().length} more characters of explanation.`
                : !lessonOk ? `${MIN_LESSON - lesson.trim().length} more characters of lesson.`
                : unconfirmed.length
                  ? `Ready. Still on the default: ${unconfirmed.map((f) => DEFAULTED_LABEL[f]).join(', ')}.`
                  : 'Ready.'}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 items-center gap-4">
        {/*
          The escape hatch. Shown whenever the full entry is not ready yet, so a
          bad day never ends with no record at all.
        */}
        {!canSubmit && !submitting && !editing && (
          <button
            type="button"
            data-quick-log
            onClick={() => void submit(true)}
            disabled={!reason}
            title={reason
              ? 'Saves what is written now, without the minimums or a chart. Marked as a quick log; finish it later from the trade.'
              : 'Name why you took it first — that one field is still needed.'}
            className="shrink-0 text-[12px] font-medium underline underline-offset-4 disabled:opacity-40"
            style={{ color: 'var(--text-dim)' }}
          >
            Log it fast
          </button>
        )}
        <Button variant="primary" accent={accent} disabled={!canSubmit} onClick={() => void submit()} className="shrink-0">
          {submitting ? 'Saving…' : editing ? 'Save changes' : 'Save trade'}
        </Button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={spring}
            className="mt-4 whitespace-pre-wrap break-words rounded-[calc(14px*var(--rk))] p-3 text-[12px] leading-relaxed"
            style={{ color: 'rgb(var(--outcome-loss))', background: 'rgb(var(--outcome-loss) / 0.10)' }}>
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
