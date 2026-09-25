import { aggregate, type Aggregate } from './stats';
import { adherenceOf } from './adherence';
import { isTaken } from './domain';
import type { DailyReview, Trade } from './types';

/**
 * The morning, against the trading.
 *
 * Every daily review asks how long I slept, what state I was in, and — once the
 * day is over — whether the bias held. The form says outright that these "get
 * plotted against adherence", and for as long as that sentence has been on the
 * screen nothing plotted them: the answers were saved and never read back.
 * This is the reading back.
 *
 * It spans every review ever written rather than the month on screen, because
 * the question is a pattern and a month holds maybe twenty mornings split
 * three ways. The trades are whichever account is selected; the morning belongs
 * to the person, not to an account, so every review counts whichever account
 * the day was traded in.
 */

/** Below this many mornings, a bucket is shown but not trusted. */
export const MIN_DAYS = 5;

export interface ConditionRow {
  label: string;
  /** Mornings that fell in this bucket. */
  days: number;
  /** Of those, the ones where anything was actually taken. */
  tradedDays: number;
  /** Everything on those days — taken and passed alike, as `aggregate` expects. */
  stats: Aggregate;
  /** Taken trades whose checklist says a rule was broken. */
  broken: number;
  /** Taken trades whose checklist was filled in at all. */
  scored: number;
  /** broken / scored, or null with nothing scored. */
  breakRate: number | null;
  /** Too few mornings to read anything into. */
  thin: boolean;
}

export interface ConditionFactor {
  key: 'sleep' | 'mind' | 'bias' | 'news' | 'checkin';
  title: string;
  /** Reviews that answered this question at all. */
  answered: number;
  rows: ConditionRow[];
  /** One sentence comparing the two ends, when both have enough behind them. */
  finding: string | null;
}

export interface Conditions {
  /** Every review on record. */
  reviews: number;
  factors: ConditionFactor[];
}

interface Bucket<V> { label: string; test: (v: V) => boolean }

const SLEEP: Bucket<number>[] = [
  { label: 'Under 6h', test: (h) => h < 6 },
  { label: '6–7h', test: (h) => h >= 6 && h < 7 },
  { label: '7h or more', test: (h) => h >= 7 },
];

const MIND: Bucket<number>[] = [
  { label: 'Rattled (1–2)', test: (m) => m <= 2 },
  { label: 'Middling (3)', test: (m) => m === 3 },
  { label: 'Clear (4–5)', test: (m) => m >= 4 },
];

const BIAS: Bucket<boolean>[] = [
  { label: 'Bias held', test: (b) => b },
  { label: 'Bias was wrong', test: (b) => !b },
];

const NEWS: Bucket<string>[] = [
  { label: 'High-impact news', test: (n) => n === 'High' },
  { label: 'Medium news', test: (n) => n === 'Medium' },
  { label: 'Nothing major', test: (n) => n === 'None' },
];

const r = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`;

function row(label: string, days: DailyReview[], byDay: Map<string, Trade[]>): ConditionRow {
  const trades = days.flatMap((d) => byDay.get(d.day) ?? []);
  const taken = trades.filter((t) => isTaken(t.outcome));
  const verdicts = taken.map(adherenceOf);
  const broken = verdicts.filter((v) => v === 'broken').length;
  const scored = verdicts.filter((v) => v !== 'unscored').length;

  return {
    label,
    days: days.length,
    tradedDays: days.filter((d) => (byDay.get(d.day) ?? []).some((t) => isTaken(t.outcome))).length,
    stats: aggregate(trades),
    broken,
    scored,
    breakRate: scored ? broken / scored : null,
    thin: days.length < MIN_DAYS,
  };
}

/**
 * The two ends of a factor, in words — only when both ends have enough
 * mornings behind them AND enough trades to average. A sentence is the most
 * persuasive thing on the page, so it is the thing held to the higher bar.
 */
function compare(rows: ConditionRow[], worse: string, better: string): string | null {
  const low = rows[0];
  const high = rows[rows.length - 1];
  const solid = (x: ConditionRow) => !x.thin && x.tradedDays >= MIN_DAYS && x.stats.avgR != null;
  if (!solid(low) || !solid(high)) return null;
  return `You average ${r(low.stats.avgR!)} per trade ${worse}, against ${r(high.stats.avgR!)} ${better}.`;
}

export function conditions(reviews: DailyReview[], trades: Trade[]): Conditions {
  const byDay = new Map<string, Trade[]>();
  for (const t of trades) {
    const day = t.date.slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(t);
    byDay.set(day, list);
  }

  const slept = reviews.filter((d) => d.sleep_hours != null);
  const minded = reviews.filter((d) => d.state_of_mind != null);
  const judged = reviews.filter((d) => d.bias_held != null);

  const sleepRows = SLEEP.map((b) => row(b.label, slept.filter((d) => b.test(d.sleep_hours!)), byDay));
  const mindRows = MIND.map((b) => row(b.label, minded.filter((d) => b.test(d.state_of_mind!)), byDay));
  const biasRows = BIAS.map((b) => row(b.label, judged.filter((d) => b.test(d.bias_held!)), byDay));

  const newsed = reviews.filter((d) => d.news != null);
  const newsRows = NEWS.map((b) => row(b.label, newsed.filter((d) => b.test(d.news!)), byDay));

  /*
    Did answering the morning first change the day?

    Counted from the first check-in ever made — every traded day before the
    feature existed would otherwise pile into "skipped" and decide the answer.
    "First" means before the day's first trade was logged: a check-in written
    after trading has already started is not the morning it claims to be.
  */
  const firstCheckIn = reviews.map((d) => d.checked_in_at ? d.day : null).filter(Boolean).sort()[0] ?? null;
  const reviewByDay = new Map(reviews.map((d) => [d.day, d]));
  const checkedFirst: DailyReview[] = [];
  const skipped: DailyReview[] = [];
  if (firstCheckIn) {
    for (const [day, list] of byDay) {
      if (day < firstCheckIn || !list.some((t) => isTaken(t.outcome))) continue;
      const rev = reviewByDay.get(day);
      const firstLogged = list.map((t) => t.created_at).sort()[0];
      const before = !!rev?.checked_in_at && (!firstLogged || rev.checked_in_at <= firstLogged);
      (before ? checkedFirst : skipped).push(rev ?? ({ day } as DailyReview));
    }
  }
  const checkinRows = [row('No check-in first', skipped, byDay), row('Checked in first', checkedFirst, byDay)];

  return {
    reviews: reviews.length,
    factors: [
      {
        key: 'sleep', title: 'Sleep', answered: slept.length, rows: sleepRows,
        finding: compare(sleepRows, 'after under 6 hours of sleep', 'after 7 or more'),
      },
      {
        key: 'mind', title: 'State of mind', answered: minded.length, rows: mindRows,
        finding: compare(mindRows, 'on mornings you called rattled', 'on clear ones'),
      },
      {
        key: 'bias', title: 'Daily bias', answered: judged.length,
        // Wrong first, so "low end" means the same thing in every factor.
        rows: [biasRows[1], biasRows[0]],
        finding: compare([biasRows[1], biasRows[0]], 'on days your bias was wrong', 'when it held'),
      },
      {
        key: 'news', title: 'News', answered: newsed.length, rows: newsRows,
        finding: compare(newsRows, 'on high-impact news days', 'on quiet ones'),
      },
      {
        key: 'checkin', title: 'Morning check-in', answered: checkedFirst.length + skipped.length,
        rows: checkinRows,
        finding: compare(checkinRows, 'on days you traded without checking in', 'on days you checked in first'),
      },
    ],
  };
}
