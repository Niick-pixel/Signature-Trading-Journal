'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { localDay } from '@/lib/day';
import { press, spring, springSoft } from '@/lib/motion';
import {
  CARRY_STEPS, DRAW_DIRECTIONS, EMPTY_PREP, PD_ZONES, PREP_STEPS, ladder, levelLabel, prepProgress,
  type PrepData, type PrepLevel, type PrepStep, type SessionPrep as Prep,
} from '@/lib/prep';
import type { DailyReview } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Choice } from '@/components/ui/Choice';
import { Input } from '@/components/ui/Field';
import { usePreferences } from '@/components/shell/PreferencesProvider';

export const PREP_SAVED = 'signature:prep';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const newId = () => Math.random().toString(36).slice(2, 10);
const num = (v: string): number | null => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Minutes until 09:30 in New York, today — negative once the session has opened. */
function minutesToOpen(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return 9 * 60 + 30 - (h * 60 + m);
}
function openLine(mins: number): string {
  if (mins > 0) return `New York opens in ${mins >= 60 ? `${Math.floor(mins / 60)}h ` : ''}${mins % 60}m`;
  if (mins > -150) return 'New York is open — this prep is late, and that is worth knowing';
  return 'After the New York session';
}

/**
 * The chart prep, a step at a time.
 *
 * Left, the steps — jump to any. Centre, the one being done: what to mark on
 * the chart, ticked as each goes on, and the prices that make the day's map.
 * Right, that map: every level in one ladder. Saved as it goes; nothing is
 * required and every step can be skipped.
 */
export function SessionPrep() {
  const [day] = useState(() => localDay());
  const [data, setData] = useState<PrepData | null>(null);
  const [meta, setMeta] = useState<Pick<Prep, 'started_at' | 'completed_at'>>({ started_at: null, completed_at: null });
  const [previous, setPrevious] = useState<Prep | null>(null);
  const [review, setReview] = useState<DailyReview | null>(null);
  const [at, setAt] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [mins, setMins] = useState(() => minutesToOpen());
  const touched = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => setMins(minutesToOpen()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    fetch(`/api/prep?day=${day}`).then((r) => r.json()).then((res: { prep: Prep | null; previous: Prep | null; review: DailyReview | null }) => {
      const d = res.prep?.data ?? structuredClone(EMPTY_PREP);
      // What the check-in already said, so it is not asked twice.
      if (!res.prep && res.review) {
        d.htf.bias = res.review.bias_direction ?? null;
        d.commit.maxTrades = res.review.trades_planned ?? null;
      }
      setData(d);
      setMeta({ started_at: res.prep?.started_at ?? null, completed_at: res.prep?.completed_at ?? null });
      setPrevious(res.previous);
      setReview(res.review);
      const first = PREP_STEPS.findIndex((s) => !d.steps[s.id]);
      setAt(first === -1 ? PREP_STEPS.length - 1 : first);
      setFinished(Boolean(res.prep?.completed_at));
    }).catch(() => setData(structuredClone(EMPTY_PREP)));
  }, [day]);

  const save = useCallback(async (next: PrepData, complete = false) => {
    setSaveState('saving');
    const res = await fetch('/api/prep', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, data: next, complete }),
    }).catch(() => null);
    if (!res?.ok) { setSaveState('idle'); return; }
    const saved = await res.json() as Prep;
    setMeta({ started_at: saved.started_at, completed_at: saved.completed_at });
    setSaveState('saved');
    window.dispatchEvent(new CustomEvent(PREP_SAVED, { detail: saved }));
  }, [day]);

  // Saved a beat after the last change, so typing a price is not a request per key.
  useEffect(() => {
    if (!data || !touched.current) return;
    const t = window.setTimeout(() => void save(data), 600);
    return () => window.clearTimeout(t);
  }, [data, save]);

  const change = useCallback((fn: (d: PrepData) => PrepData) => {
    touched.current = true;
    setData((d) => (d ? fn(structuredClone(d)) : d));
  }, []);

  if (!data) {
    return <div className="grid h-64 place-items-center text-[12px]" style={{ color: 'var(--text-faint)' }}>Opening the prep…</div>;
  }

  const step = PREP_STEPS[at];
  const progress = prepProgress(data);

  const mark = (state: 'done' | 'skipped') => {
    const next = structuredClone(data);
    next.steps[step.id] = state;
    touched.current = true;
    setData(next);
    const after = PREP_STEPS.findIndex((s, i) => i > at && !next.steps[s.id]);
    const any = PREP_STEPS.findIndex((s) => !next.steps[s.id]);
    if (after !== -1) setAt(after);
    else if (any !== -1) setAt(any);
    else { setFinished(true); void save(next, true); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[15.5rem_minmax(0,1fr)_19rem]">
      {/* ------------------------------------------------------------ steps */}
      <aside className="glass h-fit rounded-[calc(22px*var(--rk))] p-4" data-prep-rail>
        <h1 className="text-[17px] font-semibold tracking-tight">Chart prep</h1>
        <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
          {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p data-open-countdown className="mt-1 text-[11px] font-medium"
          style={{ color: mins > 0 ? 'rgb(var(--accent))' : 'rgb(var(--amber))' }}>
          {openLine(mins)}
        </p>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--glass-fill-strong)' }}>
          <motion.div className="h-full rounded-full" style={{ background: 'rgb(var(--accent))' }}
            initial={false} animate={{ width: `${(progress.answered / progress.total) * 100}%` }} transition={springSoft} />
        </div>
        <p className="mt-1.5 text-[10.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {progress.done} marked{progress.answered > progress.done ? ` · ${progress.answered - progress.done} skipped` : ''} · {progress.total} steps
          {saveState === 'saving' ? ' · saving…' : saveState === 'saved' ? ' · saved' : ''}
        </p>

        <ol className="mt-3 space-y-0.5">
          {PREP_STEPS.map((s, i) => {
            const state = data.steps[s.id];
            const here = i === at && !finished;
            return (
              <li key={s.id}>
                <button type="button" data-prep-step={s.id} data-state={state ?? 'open'}
                  onClick={() => { setFinished(false); setAt(i); }}
                  className="relative flex w-full items-center gap-2.5 rounded-[calc(11px*var(--rk))] px-2 py-1.5 text-left text-[12px]">
                  {here && (
                    <motion.span layoutId="prep-here" transition={springSoft}
                      className="absolute inset-0 rounded-[calc(11px*var(--rk))]"
                      style={{ background: 'rgb(var(--accent) / 0.12)', boxShadow: 'inset 0 0 0 1px rgb(var(--accent) / 0.35)' }} />
                  )}
                  <span className="relative grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold tabular-nums"
                    style={{
                      background: state === 'done' ? 'rgb(var(--outcome-win) / 0.16)' : 'var(--glass-fill-strong)',
                      color: state === 'done' ? 'rgb(var(--outcome-win))' : 'var(--text-faint)',
                    }}>
                    {state === 'done' ? '✓' : state === 'skipped' ? '–' : i + 1}
                  </span>
                  <span className="relative truncate"
                    style={{
                      color: here ? 'rgb(var(--accent))' : state ? 'var(--text-faint)' : 'var(--text-dim)',
                      textDecoration: state === 'skipped' ? 'line-through' : undefined,
                    }}>
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {progress.answered === progress.total && !finished && (
          <Button className="mt-3 w-full" variant="primary" onClick={() => { setFinished(true); void save(data, true); }}>
            See the day&rsquo;s plan
          </Button>
        )}
      </aside>

      {/* ------------------------------------------------------------ the step */}
      <section className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          {finished ? (
            <motion.div key="ready" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={springSoft}>
              <Ready data={data} startedAt={meta.started_at} onReview={() => { setFinished(false); setAt(0); }} />
            </motion.div>
          ) : (
            <motion.div key={step.id} data-prep-current={step.id}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10, transition: { duration: 0.12 } }} transition={springSoft}
              className="glass rounded-[calc(24px*var(--rk))] p-6 sm:p-8">
              <StepView step={step} index={at} data={data} change={change} previous={previous} review={review}
                onBack={at > 0 ? () => setAt(at - 1) : undefined}
                onSkip={() => mark('skipped')} onDone={() => mark('done')} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ------------------------------------------------------------ the map */}
      <aside className="h-fit lg:sticky lg:top-4">
        <DayMap data={data} />
      </aside>
    </div>
  );
}

function StepView({ step, index, data, change, previous, review, onBack, onSkip, onDone }: {
  step: PrepStep; index: number; data: PrepData; change: (fn: (d: PrepData) => PrepData) => void;
  previous: Prep | null; review: DailyReview | null;
  onBack?: () => void; onSkip: () => void; onDone: () => void;
}) {
  const { prefs } = usePreferences();
  const ticks = data.ticks[step.id] ?? [];
  const all = ticks.length === step.marks.length;
  const toggle = (i: number) => change((d) => {
    const cur = new Set(d.ticks[step.id] ?? []);
    if (cur.has(i)) cur.delete(i); else cur.add(i);
    d.ticks[step.id] = [...cur].sort();
    return d;
  });

  return (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
        Step {index + 1} of {PREP_STEPS.length}{step.frames ? ` · ${step.frames}` : ''}
      </p>
      <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight">{step.title}</h2>
      <p className="mt-1.5 max-w-[46rem] text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>{step.why}</p>

      {step.heatmap && prefs.heatmapUrl && (
        <a href={prefs.heatmapUrl} target="_blank" rel="noreferrer" data-heatmap-link
          className="mt-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium"
          style={{ borderColor: 'rgb(var(--accent) / 0.45)', background: 'rgb(var(--accent) / 0.1)', color: 'rgb(var(--accent))' }}>
          Open the heatmap
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M4 2h6v6M10 2L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}

      {/* What to mark — ticked as each goes on the chart. */}
      <div className="mt-5">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.07em]" style={{ color: 'var(--text-faint)' }}>On your chart</p>
        <div className="space-y-1.5">
          {step.marks.map((m, i) => {
            const on = ticks.includes(i);
            return (
              <motion.button key={i} type="button" role="checkbox" aria-checked={on} data-mark={i}
                onClick={() => toggle(i)} whileTap={press}
                initial={{ opacity: 0, y: 6 }} animate={{
                  opacity: 1, y: 0,
                  borderColor: on ? 'rgb(var(--outcome-win) / 0.45)' : 'var(--glass-stroke)',
                  background: on ? 'rgb(var(--outcome-win) / 0.08)' : 'var(--glass-fill)',
                }}
                transition={{ ...spring, delay: i * 0.04 }}
                className="flex w-full items-start gap-3 rounded-[calc(13px*var(--rk))] border px-3.5 py-2.5 text-left">
                <span className="mt-0.5 grid size-[17px] shrink-0 place-items-center rounded-[calc(5px*var(--rk))]"
                  style={{ background: on ? 'rgb(var(--outcome-win) / 0.2)' : 'var(--glass-fill-strong)' }}>
                  <motion.svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden
                    style={{ color: 'rgb(var(--outcome-win))' }}
                    animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={spring}>
                    <path d="M1 4.6L4 7.5L10 1.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </motion.svg>
                </span>
                <span className="text-[13px] leading-snug" style={{ color: on ? 'var(--text-dim)' : 'var(--text)' }}>{m}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <StepInput step={step} data={data} change={change} previous={previous} review={review} />
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-2">
        {onBack && <Button onClick={onBack}>Back</Button>}
        <div className="ml-auto flex gap-2">
          <Button onClick={onSkip} title="Leave this one out today — it shows as skipped">Skip</Button>
          <Button variant="primary" data-prep-next onClick={onDone}>
            {index === PREP_STEPS.length - 1 ? 'Finish the prep' : all ? 'Marked — next' : 'Marked on my chart — next'}
          </Button>
        </div>
      </div>
    </>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.07em]" style={{ color: 'var(--text-faint)' }}>{children}</span>
);

function PriceInput({ value, onChange, label, placeholder = 'price' }: {
  value: number | null; onChange: (v: number | null) => void; label: string; placeholder?: string;
}) {
  // Kept as typed, so "30,8" mid-entry is not snapped back to a number.
  const [raw, setRaw] = useState(value == null ? '' : String(value));
  useEffect(() => { if (num(raw) !== value) setRaw(value == null ? '' : String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Input type="number" step="0.25" inputMode="decimal" placeholder={placeholder} aria-label={label}
      value={raw} onChange={(e) => { setRaw(e.target.value); onChange(num(e.target.value)); }} />
  );
}

function Area({ value, onChange, label, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; label: string; placeholder: string; rows?: number;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} aria-label={label} placeholder={placeholder}
      className="w-full resize-y rounded-[calc(14px*var(--rk))] border px-3.5 py-2.5 text-[13px] leading-relaxed outline-none"
      style={{ borderColor: 'var(--glass-stroke)', background: 'var(--glass-fill)', color: 'var(--text)' }} />
  );
}

function StepInput({ step, data, change, previous, review }: {
  step: PrepStep; data: PrepData; change: (fn: (d: PrepData) => PrepData) => void;
  previous: Prep | null; review: DailyReview | null;
}) {
  switch (step.input) {
    case 'bias':
      return (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label>Daily and 4H point</Label>
            <Choice name="Higher timeframe bias" value={data.htf.bias}
              onChange={(v) => change((d) => { d.htf.bias = v; return d; })}
              options={['Bullish', 'Bearish', 'Neutral'] as const}
              accentFor={(b) => (b === 'Bullish' ? 'var(--outcome-win)' : b === 'Bearish' ? 'var(--outcome-loss)' : 'var(--accent)')} />
          </div>
          <div>
            <Label>Price is in</Label>
            <Choice name="Premium or discount" value={data.htf.zone}
              onChange={(v) => change((d) => { d.htf.zone = v; return d; })} options={PD_ZONES} />
          </div>
          <div>
            <Label>Price now</Label>
            <PriceInput label="Price now" value={data.htf.priceNow}
              onChange={(v) => change((d) => { d.htf.priceNow = v; return d; })} />
            <span className="mt-1 block text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
              Splits the map into above and below.
            </span>
          </div>
          <div>
            <Label>In a line</Label>
            <Input placeholder="Daily into the weekly FVG, 4H still bullish…" aria-label="Higher timeframe note"
              value={data.htf.note} onChange={(e) => { const v = e.target.value; change((d) => { d.htf.note = v; return d; }); }} />
          </div>
        </div>
      );

    case 'fixed':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {step.fixed!.map((kind) => {
            const lv = data.levels.find((l) => l.step === step.id && l.kind === kind);
            const set = (patch: Partial<PrepLevel>) => change((d) => {
              const i = d.levels.findIndex((l) => l.step === step.id && l.kind === kind);
              if (i === -1) d.levels.push({ id: newId(), step: step.id, kind, price: null, price2: null, note: '', taken: false, ...patch });
              else d.levels[i] = { ...d.levels[i], ...patch };
              return d;
            });
            return (
              <div key={kind} data-fixed={kind}>
                <Label>{kind}</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1"><PriceInput label={kind} value={lv?.price ?? null} onChange={(price) => set({ price })} /></div>
                  <button type="button" aria-pressed={lv?.taken ?? false} onClick={() => set({ taken: !(lv?.taken ?? false) })}
                    title="Already run before the session"
                    className="shrink-0 rounded-full border px-2.5 py-1.5 text-[11px] font-medium"
                    style={{
                      borderColor: lv?.taken ? 'rgb(var(--amber) / 0.5)' : 'var(--glass-stroke)',
                      background: lv?.taken ? 'rgb(var(--amber) / 0.12)' : 'transparent',
                      color: lv?.taken ? 'rgb(var(--amber))' : 'var(--text-faint)',
                    }}>
                    {lv?.taken ? 'Taken' : 'Untouched'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      );

    case 'list':
      return <LevelList step={step} data={data} change={change} previous={previous} />;

    case 'draw': {
      const choices = ladder(data).filter((l) => !l.taken);
      return (
        <div className="space-y-5">
          <div>
            <Label>Price draws</Label>
            <Choice name="Draw on liquidity" value={data.draw.direction}
              onChange={(v) => change((d) => { d.draw.direction = v; return d; })} options={DRAW_DIRECTIONS}
              accentFor={(v) => (v === 'Up' ? 'var(--outcome-win)' : v === 'Down' ? 'var(--outcome-loss)' : 'var(--accent)')} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Target</Label>
              <PriceInput label="Target" value={data.draw.target} onChange={(v) => change((d) => { d.draw.target = v; return d; })} />
            </div>
            <div>
              <Label>Wrong if price reaches</Label>
              <PriceInput label="Invalidation" value={data.draw.invalidation} onChange={(v) => change((d) => { d.draw.invalidation = v; return d; })} />
            </div>
          </div>
          {choices.length > 0 && (
            <div>
              <Label>Or pick from what you marked</Label>
              <div className="flex flex-wrap gap-1.5">
                {choices.map((l) => (
                  <motion.button key={l.id} type="button" whileTap={press} data-pick-level={l.kind}
                    onClick={() => change((d) => { d.draw.target = l.price; return d; })}
                    className="rounded-full border px-2.5 py-1 text-[11px] tabular-nums"
                    style={{
                      borderColor: data.draw.target === l.price ? 'rgb(var(--accent) / 0.55)' : 'var(--glass-stroke)',
                      background: data.draw.target === l.price ? 'rgb(var(--accent) / 0.12)' : 'var(--glass-fill)',
                      color: data.draw.target === l.price ? 'rgb(var(--accent))' : 'var(--text-dim)',
                    }}>
                    {l.kind} {fmt(l.price!)}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          <Input placeholder="Why that pool first…" aria-label="Draw note" value={data.draw.note}
            onChange={(e) => { const v = e.target.value; change((d) => { d.draw.note = v; return d; }); }} />
        </div>
      );
    }

    case 'plans':
      return (
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <Label>If long</Label>
            <Area label="Long plan" value={data.plans.long} rows={5}
              onChange={(v) => change((d) => { d.plans.long = v; return d; })}
              placeholder="Sweep of the Asia low into the 1H FVG, 5m iFVG closes back up, target the London high…" />
          </div>
          <div>
            <Label>If short</Label>
            <Area label="Short plan" value={data.plans.short} rows={5}
              onChange={(v) => change((d) => { d.plans.short = v; return d; })}
              placeholder="Run of the EQH at 30,906, bearish iFVG on the 5m, target the PDL…" />
          </div>
        </div>
      );

    case 'timing':
      return (
        <div className="space-y-3">
          <p className="rounded-[calc(12px*var(--rk))] px-3.5 py-2.5 text-[12.5px]"
            style={{ background: 'var(--glass-fill)', color: 'var(--text-dim)' }}>
            {review?.news
              ? <>Your check-in said: <strong>{review.news === 'None' ? 'nothing major' : `${review.news.toLowerCase()} news`}</strong>{review.news_note ? ` — ${review.news_note}` : ''}.</>
              : 'The morning check-in has not said anything about news today.'}
          </p>
          <Area label="Timing note" value={data.timing.note} rows={2}
            onChange={(v) => change((d) => { d.timing.note = v; return d; })}
            placeholder="CPI 8:30 — nothing before 8:45. Out by 11:30." />
        </div>
      );

    case 'commit':
      return (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label>Most trades today</Label>
            <PriceInput label="Most trades today" placeholder="—" value={data.commit.maxTrades}
              onChange={(v) => change((d) => { d.commit.maxTrades = v == null ? null : Math.max(0, Math.round(v)); return d; })} />
          </div>
          <div>
            <Label>Stop for the day at a loss of ($)</Label>
            <PriceInput label="Daily loss limit" placeholder="—" value={data.commit.maxLoss}
              onChange={(v) => change((d) => { d.commit.maxLoss = v == null ? null : Math.abs(v); return d; })} />
          </div>
        </div>
      );
  }
}

/** Rows of levels for a list step, with yesterday's carried forward on request. */
function LevelList({ step, data, change, previous }: {
  step: PrepStep; data: PrepData; change: (fn: (d: PrepData) => PrepData) => void; previous: Prep | null;
}) {
  const rows = data.levels.filter((l) => l.step === step.id);
  const same = (a: PrepLevel, b: PrepLevel) => a.kind === b.kind && a.price === b.price && a.price2 === b.price2;
  const carry = CARRY_STEPS.includes(step.id) && previous
    ? previous.data.levels.filter((l) => l.step === step.id && l.price != null && !l.taken && !rows.some((r) => same(r, l)))
    : [];
  const add = (kind = step.kinds![0]) => change((d) => {
    d.levels.push({ id: newId(), step: step.id, kind, price: null, price2: null, note: '', taken: false });
    return d;
  });
  const set = (id: string, patch: Partial<PrepLevel>) => change((d) => {
    const i = d.levels.findIndex((l) => l.id === id);
    if (i !== -1) d.levels[i] = { ...d.levels[i], ...patch };
    return d;
  });
  const remove = (id: string) => change((d) => { d.levels = d.levels.filter((l) => l.id !== id); return d; });

  return (
    <div>
      <Label>The levels, as you mark them</Label>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {rows.map((l) => (
            <motion.div key={l.id} layout data-level-row={l.kind}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12, transition: { duration: 0.12 } }}
              transition={springSoft}
              className="flex flex-wrap items-center gap-2 rounded-[calc(14px*var(--rk))] border p-2"
              style={{ borderColor: 'var(--glass-stroke)' }}>
              <div className="flex flex-wrap gap-1">
                {step.kinds!.map((k) => (
                  <button key={k} type="button" aria-pressed={l.kind === k} onClick={() => set(l.id, { kind: k })}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      background: l.kind === k ? 'rgb(var(--accent) / 0.14)' : 'transparent',
                      color: l.kind === k ? 'rgb(var(--accent))' : 'var(--text-faint)',
                      boxShadow: l.kind === k ? 'inset 0 0 0 1px rgb(var(--accent) / 0.4)' : 'none',
                    }}>
                    {k}
                  </button>
                ))}
              </div>
              <div className="w-28"><PriceInput label={step.range ? 'From' : 'Price'} placeholder={step.range ? 'from' : 'price'}
                value={l.price} onChange={(price) => set(l.id, { price })} /></div>
              {step.range && (
                <div className="w-28"><PriceInput label="To" placeholder="to" value={l.price2} onChange={(price2) => set(l.id, { price2 })} /></div>
              )}
              <div className="min-w-[9rem] flex-1">
                <Input placeholder="note — 1H, untested, thick band…" aria-label="Level note" value={l.note}
                  onChange={(e) => set(l.id, { note: e.target.value })} />
              </div>
              <button type="button" aria-label="Remove this level" onClick={() => remove(l.id)}
                className="grid size-7 shrink-0 place-items-center rounded-full text-[13px]" style={{ color: 'var(--text-faint)' }}>
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={() => add()} data-add-level>Add a level</Button>
        {carry.length > 0 && (
          <Button data-carry-levels
            title={carry.map((l) => `${l.kind} ${fmt(l.price!)}${l.price2 != null ? `–${fmt(l.price2)}` : ''}`).join(', ')}
            onClick={() => change((d) => {
              for (const l of carry) d.levels.push({ ...l, id: newId(), note: l.note || `from ${previous!.day.slice(5)}` });
              return d;
            })}>
            Bring forward {carry.length} from {new Date(`${previous!.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
          </Button>
        )}
        {rows.length === 0 && (
          <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
            Optional — a price here puts it on the map. Marking it on the chart is what counts.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The day on one ladder: every priced level, highest first, with the price
 * the prep started at as the line between above and below — asks and bids,
 * buy-side and sell-side.
 */
export function DayMap({ data, big = false }: { data: PrepData; big?: boolean }) {
  const levels = ladder(data);
  const now = data.htf.priceNow;
  const rows: Array<{ kind: 'level'; l: PrepLevel } | { kind: 'now' }> = [];
  let placed = now == null;
  for (const l of levels) {
    if (!placed && Math.max(l.price!, l.price2 ?? -Infinity) < now!) { rows.push({ kind: 'now' }); placed = true; }
    rows.push({ kind: 'level', l });
  }
  if (!placed) rows.push({ kind: 'now' });

  return (
    <div className="glass rounded-[calc(22px*var(--rk))] p-4" data-day-map>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold tracking-tight">Today&rsquo;s map</h3>
        <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>{levels.length} level{levels.length === 1 ? '' : 's'}</span>
      </div>
      {levels.length === 0 ? (
        <p className="mt-3 text-[11.5px] leading-snug" style={{ color: 'var(--text-faint)' }}>
          Prices typed in the steps land here, highest first — the day on one ladder.
        </p>
      ) : (
        <ol className={`mt-3 space-y-0.5 ${big ? '' : 'max-h-[70vh] overflow-y-auto pr-1'}`}>
          <AnimatePresence initial={false}>
            {rows.map((r) => {
              if (r.kind === 'now') {
                return (
                  <motion.li key="now" layout transition={springSoft} data-price-now
                    className="my-1 flex items-center gap-2 text-[10.5px] font-semibold tabular-nums" style={{ color: 'rgb(var(--accent))' }}>
                    <span className="h-px flex-1" style={{ background: 'rgb(var(--accent) / 0.5)' }} />
                    price {fmt(now!)}
                    <span className="h-px flex-1" style={{ background: 'rgb(var(--accent) / 0.5)' }} />
                  </motion.li>
                );
              }
              const l = r.l;
              const above = now != null && l.price! > now;
              const below = now != null && Math.max(l.price!, l.price2 ?? -Infinity) < now;
              const target = data.draw.target != null && (l.price === data.draw.target || l.price2 === data.draw.target);
              const wrong = data.draw.invalidation != null && (l.price === data.draw.invalidation || l.price2 === data.draw.invalidation);
              const tone = above ? 'var(--outcome-loss)' : below ? 'var(--outcome-win)' : 'var(--accent)';
              return (
                <motion.li key={l.id} layout initial={{ opacity: 0, x: 8 }} animate={{ opacity: l.taken ? 0.5 : 1, x: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={springSoft}
                  data-map-level={l.kind}
                  className="flex items-center gap-2 rounded-[calc(9px*var(--rk))] px-2 py-1 text-[11.5px]"
                  style={target ? { background: 'rgb(var(--accent) / 0.12)', boxShadow: 'inset 0 0 0 1px rgb(var(--accent) / 0.45)' } : undefined}>
                  <span className="w-[5.2rem] shrink-0 font-semibold tabular-nums" style={{ color: `rgb(${tone})`, textDecoration: l.taken ? 'line-through' : undefined }}>
                    {fmt(l.price!)}{l.price2 != null ? <span className="font-normal opacity-70">–{fmt(l.price2)}</span> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-dim)' }} title={levelLabel(l)}>{levelLabel(l)}</span>
                  {target && <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'rgb(var(--accent))' }}>◎ target</span>}
                  {wrong && <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'rgb(var(--amber))' }}>✕ wrong</span>}
                  {now != null && !target && !wrong && (
                    <span className="shrink-0 text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                      {l.price! > now ? '+' : ''}{fmt(l.price! - now)}
                    </span>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
      {(data.draw.target != null && !levels.some((l) => l.price === data.draw.target)) && (
        <p className="mt-2 text-[11px]" style={{ color: 'rgb(var(--accent))' }}>◎ Target {fmt(data.draw.target)}</p>
      )}
      {(data.draw.invalidation != null && !levels.some((l) => l.price === data.draw.invalidation)) && (
        <p className="mt-1 text-[11px]" style={{ color: 'rgb(var(--amber))' }}>✕ Wrong at {fmt(data.draw.invalidation)}</p>
      )}
    </div>
  );
}

/** The end of the prep: the plan in one place, to glance at before an entry. */
function Ready({ data, startedAt, onReview }: { data: PrepData; startedAt: string | null; onReview: () => void }) {
  const p = prepProgress(data);
  const d = data.draw;
  return (
    <div className="glass rounded-[calc(24px*var(--rk))] p-6 sm:p-8" data-prep-ready>
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springSoft}
        className="mb-4 grid size-12 place-items-center rounded-full"
        style={{ background: 'rgb(var(--outcome-win) / 0.14)', color: 'rgb(var(--outcome-win))' }}>
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
      <h2 className="text-[22px] font-semibold tracking-tight">Ready for New York</h2>
      <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
        {p.done} of {p.total} steps marked{p.answered > p.done ? `, ${p.answered - p.done} skipped` : ''}
        {startedAt ? ` · started ${new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.
        Set the alerts, then step away until one rings.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card title="Draw on liquidity">
          {d.direction || d.target != null ? (
            <>
              <span className="text-[15px] font-semibold" style={{ color: d.direction === 'Up' ? 'rgb(var(--outcome-win))' : d.direction === 'Down' ? 'rgb(var(--outcome-loss))' : 'var(--text)' }}>
                {d.direction ?? '—'}{d.target != null ? ` to ${fmt(d.target)}` : ''}
              </span>
              {d.invalidation != null && <span className="mt-1 block text-[12px]" style={{ color: 'rgb(var(--amber))' }}>Wrong at {fmt(d.invalidation)}</span>}
              {d.note && <span className="mt-1 block text-[12px]" style={{ color: 'var(--text-dim)' }}>{d.note}</span>}
            </>
          ) : <Faint>Not decided.</Faint>}
        </Card>
        <Card title="Committed">
          {data.commit.maxTrades != null || data.commit.maxLoss != null ? (
            <span className="text-[13px]">
              {data.commit.maxTrades != null && <>At most <strong>{data.commit.maxTrades}</strong> trade{data.commit.maxTrades === 1 ? '' : 's'}. </>}
              {data.commit.maxLoss != null && <>Done at <strong>−${fmt(data.commit.maxLoss)}</strong>.</>}
            </span>
          ) : <Faint>No limit set.</Faint>}
        </Card>
        <Card title="If long">{data.plans.long.trim() ? <Plain>{data.plans.long}</Plain> : <Faint>No long plan.</Faint>}</Card>
        <Card title="If short">{data.plans.short.trim() ? <Plain>{data.plans.short}</Plain> : <Faint>No short plan.</Faint>}</Card>
      </div>

      <div className="mt-7 flex flex-wrap gap-2">
        <a href="/"><Button variant="primary" tabIndex={-1}>To the board</Button></a>
        <Button onClick={onReview}>Go through the steps again</Button>
      </div>
    </div>
  );
}

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-[calc(16px*var(--rk))] p-4" style={{ background: 'var(--glass-fill)' }}>
    <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>{title}</span>
    {children}
  </div>
);
const Faint = ({ children }: { children: React.ReactNode }) => <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>{children}</span>;
const Plain = ({ children }: { children: React.ReactNode }) => <span className="block whitespace-pre-wrap text-[12.5px] leading-relaxed [overflow-wrap:anywhere]">{children}</span>;

/** Keeps the title-bar chip in step with saves made on this screen. */
export function usePrepProgress(): { label: string; state: 'todo' | 'doing' | 'done' } | null {
  const [prep, setPrep] = useState<Prep | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetch(`/api/prep?day=${localDay()}`).then((r) => r.json()).then((r) => { if (alive) setPrep(r.prep ?? null); })
      .catch(() => { if (alive) setPrep(null); });
    const on = (e: Event) => setPrep((e as CustomEvent<Prep>).detail);
    window.addEventListener(PREP_SAVED, on);
    return () => { alive = false; window.removeEventListener(PREP_SAVED, on); };
  }, []);
  return useMemo(() => {
    if (prep === undefined) return null;
    if (!prep) return { label: 'Chart prep', state: 'todo' };
    const p = prepProgress(prep.data);
    if (prep.completed_at || p.answered === p.total) return { label: 'Day map', state: 'done' };
    return { label: `Prep ${p.answered}/${p.total}`, state: 'doing' };
  }, [prep]);
}
