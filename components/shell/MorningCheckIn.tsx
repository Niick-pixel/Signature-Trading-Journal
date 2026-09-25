'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';
import { localDay } from '@/lib/day';
import { BIAS_DIRECTIONS, NEWS_LEVELS, type BiasDirection, type NewsLevel } from '@/lib/domain';
import type { DailyReview } from '@/lib/types';
import { Overlay } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Choice } from '@/components/ui/Choice';
import { Scale } from '@/components/ui/Scale';
import { usePreferences } from './PreferencesProvider';

/*
  The morning check-in.

  Four questions before the session — how you slept, how you feel, which way
  you lean and what is on the news calendar — plus the most trades you will
  take. They land in the same row as that day's review, so the Mornings panel
  reads them against the trading without anything new to learn.

  It is a prompt, never a gate: "Skip today" is always one click, nothing
  waits on it, and the board works exactly the same without it. What it does
  record is WHEN it was answered, because a morning written after the session
  is written knowing how the session went.
*/

const OPEN = 'signature:checkin-open';
const SAVED = 'signature:checkin';
const ASKED_KEY = 'signature.checkin.asked';

/** Opens the check-in from anywhere — the title bar chip, a shortcut. */
export function openCheckIn() {
  window.dispatchEvent(new Event(OPEN));
}

const DIRECTION_ACCENT: Record<BiasDirection, string> = {
  Bullish: 'var(--outcome-win)',
  Bearish: 'var(--outcome-loss)',
  Neutral: 'var(--accent)',
};
const NEWS_ACCENT: Record<NewsLevel, string> = {
  None: 'var(--outcome-win)',
  Medium: 'var(--amber)',
  High: 'var(--outcome-loss)',
};
const NEWS_LABEL: Record<NewsLevel, string> = { None: 'Nothing major', Medium: 'Medium', High: 'High impact' };

/** The plan in one line, for the chip and the confirmation. */
export function planLine(r: Pick<DailyReview, 'bias_direction' | 'trades_planned' | 'news' | 'news_note'>): string {
  const parts: string[] = [];
  if (r.bias_direction) parts.push(r.bias_direction);
  if (r.trades_planned != null) parts.push(`${r.trades_planned} max`);
  if (r.news === 'High' || r.news === 'Medium') parts.push(r.news_note || `${r.news === 'High' ? 'High-impact' : 'Medium'} news`);
  else if (r.news === 'None') parts.push('No news');
  return parts.join(' · ');
}

const readAsked = () => { try { return window.localStorage.getItem(ASKED_KEY); } catch { return null; } };
const writeAsked = (day: string) => { try { window.localStorage.setItem(ASKED_KEY, day); } catch { /* fine */ } };

/**
 * Owns the dialog. Mounted once, in the layout, so it survives tab switches
 * and asks at most once per day however many pages are visited.
 */
export function MorningCheckIn() {
  const { prefs } = usePreferences();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [existing, setExisting] = useState<DailyReview | null>(null);

  const load = useCallback(async (d: string) => {
    const res = await fetch(`/api/daily?day=${d}&context=1`).then((r) => r.json()).catch(() => null) as
      { review: DailyReview | null; tradesToday: number } | null;
    return res;
  }, []);

  // Opened on request: always today's, loaded fresh so an edit elsewhere shows.
  useEffect(() => {
    const onOpen = async () => {
      const d = localDay();
      const res = await load(d);
      setDay(d);
      setExisting(res?.review ?? null);
      setOpen(true);
    };
    window.addEventListener(OPEN, onOpen);
    return () => window.removeEventListener(OPEN, onOpen);
  }, [load]);

  /*
    Asked once, on the first screen of a trading day — not on Saturday, not
    while a trade is being written, not once the session has already started
    (a trade logged today means the morning has passed), and never again the
    same day once answered or skipped.
  */
  useEffect(() => {
    if (!prefs.askCheckIn) return;
    if (pathname?.startsWith('/new')) return;
    const d = localDay();
    if (new Date().getDay() === 6 || readAsked() === d) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const res = await load(d);
      if (cancelled || !res) return;
      writeAsked(d);
      if (res.review?.checked_in_at || res.tradesToday > 0) return;
      setDay(d);
      setExisting(res.review);
      setOpen(true);
    }, 900);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [prefs.askCheckIn, pathname, load]);

  const close = useCallback(() => {
    if (day) writeAsked(day);
    setOpen(false);
  }, [day]);

  return (
    <Overlay open={open} onClose={close} className="w-[30rem] max-w-full max-h-[90vh] overflow-y-auto rounded-[calc(26px*var(--rk))] p-7">
      {day && <CheckInForm key={`${day}-${existing?.updated_at ?? 'new'}`} day={day} existing={existing} onDone={close} />}
    </Overlay>
  );
}

function CheckInForm({ day, existing, onDone }: {
  day: string; existing: DailyReview | null; onDone: () => void;
}) {
  const [sleep, setSleep] = useState(existing?.sleep_hours?.toString() ?? '');
  const [mind, setMind] = useState<number | null>(existing?.state_of_mind ?? null);
  const [direction, setDirection] = useState<BiasDirection | null>(existing?.bias_direction ?? null);
  const [why, setWhy] = useState(existing?.bias ?? '');
  const [news, setNews] = useState<NewsLevel | null>(existing?.news ?? null);
  const [newsNote, setNewsNote] = useState(existing?.news_note ?? '');
  const [max, setMax] = useState(existing?.trades_planned?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<DailyReview | null>(null);

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function save() {
    setSaving(true);
    const res = await fetch('/api/daily', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day, check_in: true,
        sleep_hours: num(sleep), state_of_mind: mind, bias_direction: direction, bias: why,
        news, news_note: news === 'None' ? '' : newsNote, trades_planned: num(max),
      }),
    });
    setSaving(false);
    if (!res.ok) return;
    const saved = await res.json() as DailyReview;
    window.dispatchEvent(new CustomEvent(SAVED, { detail: saved }));
    setDone(saved);
    window.setTimeout(onDone, 1800);
  }

  const when = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <AnimatePresence mode="wait" initial={false}>
      {done ? (
        <motion.div key="done" data-checkin-done
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={spring}
          className="py-6 text-center">
          <motion.div
            initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 16 }}
            className="mx-auto mb-4 grid size-12 place-items-center rounded-full"
            style={{ background: 'rgb(var(--outcome-win) / 0.14)', color: 'rgb(var(--outcome-win))' }}
          >
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
          <h2 className="text-[18px] font-semibold tracking-tight">Checked in</h2>
          <p className="mt-1.5 text-[13px]" style={{ color: 'var(--text-dim)' }}>
            {planLine(done) || 'Written before the session.'}
          </p>
        </motion.div>
      ) : (
        <motion.div key="form" exit={{ opacity: 0, scale: 0.98 }} transition={spring}>
          <div className="mb-6">
            <h2 className="text-[20px] font-semibold tracking-tight">{greeting}</h2>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
              {when} · before the session. Written now these mean something; written tonight they don&rsquo;t.
            </p>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-[7rem_1fr] gap-4">
              <Field label="Slept">
                <Input type="number" step="0.5" min="0" max="24" placeholder="hours" aria-label="Hours slept"
                  value={sleep} onChange={(e) => setSleep(e.target.value)} />
              </Field>
              <Scale value={mind} onChange={setMind} label="State of mind" hint="1 rattled, 5 clear." />
            </div>

            <Field label="Bias" group>
              <Choice name="Bias direction" value={direction} onChange={setDirection}
                options={BIAS_DIRECTIONS} accentFor={(d) => DIRECTION_ACCENT[d]} />
              <div className="mt-2">
                <Input placeholder="Why, in a line — daily into the weekly FVG, expecting a London sweep…"
                  aria-label="Why" value={why} onChange={(e) => setWhy(e.target.value)} />
              </div>
            </Field>

            <Field label="News today" group>
              <Choice name="News today" value={news} onChange={setNews} options={NEWS_LEVELS}
                accentFor={(n) => NEWS_ACCENT[n]} labelFor={(n) => NEWS_LABEL[n]} />
              <AnimatePresence initial={false}>
                {(news === 'Medium' || news === 'High') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden"
                  >
                    <div className="pt-2">
                      <Input placeholder="What and when — CPI 8:30, FOMC 14:00" aria-label="Which news"
                        value={newsNote} onChange={(e) => setNewsNote(e.target.value)} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Field>

            <Field label="Most trades I will take today">
              <Input type="number" step="1" min="0" placeholder="—" aria-label="Most trades today"
                value={max} onChange={(e) => setMax(e.target.value)} />
            </Field>
          </div>

          <div className="mt-7 flex items-center gap-3">
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : existing?.checked_in_at ? 'Update the morning' : 'Start the session'}
            </Button>
            <Button onClick={onDone}>{existing?.checked_in_at ? 'Close' : 'Skip today'}</Button>
            {existing?.checked_in_at && (
              <span className="ml-auto text-[11px]" style={{ color: 'var(--text-faint)' }}>
                Checked in at {new Date(existing.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The title bar's view of this morning: an invitation until answered, then
 * the plan in a few words — the thing worth glancing at before an entry.
 */
export function CheckInChip() {
  const [review, setReview] = useState<DailyReview | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch(`/api/daily?day=${localDay()}`).then((r) => r.json()).then((r) => { if (alive) setReview(r); })
      .catch(() => { if (alive) setReview(null); });
    const onSaved = (e: Event) => setReview((e as CustomEvent<DailyReview>).detail);
    window.addEventListener(SAVED, onSaved);
    return () => { alive = false; window.removeEventListener(SAVED, onSaved); };
  }, []);

  if (review === undefined) return null;
  const done = !!review?.checked_in_at;
  const line = done ? planLine(review!) : '';

  return (
    <motion.button
      type="button"
      data-checkin-chip={done ? 'done' : 'todo'}
      onClick={openCheckIn}
      whileTap={press}
      whileHover={{ y: -1 }}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      title={done ? 'Your morning check-in — click to change it (M)' : 'Four questions before the session (M)'}
      className="flex max-w-[22rem] items-center gap-2 rounded-full border px-3 py-1 text-[11.5px] font-medium"
      style={{
        borderColor: done ? 'var(--glass-stroke)' : 'rgb(var(--accent) / 0.45)',
        background: done ? 'var(--glass-fill)' : 'rgb(var(--accent) / 0.1)',
        color: done ? 'var(--text-dim)' : 'rgb(var(--accent))',
      }}
    >
      {done ? (
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden style={{ color: 'rgb(var(--outcome-win))' }}>
          <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="relative flex size-2">
          <span className="checkin-ping absolute inset-0 rounded-full" style={{ background: 'rgb(var(--accent))' }} />
          <span className="relative size-2 rounded-full" style={{ background: 'rgb(var(--accent))' }} />
        </span>
      )}
      <span className="truncate">{done ? (line || 'Checked in') : 'Morning check-in'}</span>
    </motion.button>
  );
}
