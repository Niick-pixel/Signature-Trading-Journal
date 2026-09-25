import type { Trade } from '@/lib/types';
import { isTaken } from '@/lib/domain';
import { CountUp } from '@/components/ui/CountUp';

const usd = (v: number) =>
  `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}R`;

/**
 * What hesitation cost — or saved.
 *
 * The Missed account has no balance: nothing went in, nothing came out, none
 * of it happened. What it can answer is the question it exists for. Summed as
 * if taken, did the trades I hesitated on add up to money left on the table,
 * or did the hesitation keep me out of losers? Both are worth knowing, and
 * they point at opposite fixes.
 */
export function MissedCard({ trades }: { trades: Trade[] }) {
  const taken = trades.filter((t) => isTaken(t.outcome));
  const totalR = taken.reduce((s, t) => s + (t.r_multiple ?? 0), 0);
  const priced = taken.filter((t) => t.pnl_dollars != null);
  const dollars = priced.reduce((s, t) => s + (t.pnl_dollars ?? 0), 0);
  const wins = taken.filter((t) => t.outcome === 'Win').length;
  const losses = taken.filter((t) => t.outcome === 'Loss').length;

  const verdict = taken.length === 0
    ? 'Nothing logged yet. Log a setup you saw and did not take — with the outcome and R it would have had — and this says what hesitating cost.'
    : totalR > 0
      ? `Hesitating cost you ${r(totalR)}. Taken, these would have paid.`
      : totalR < 0
        ? `Hesitating saved you ${r(-totalR)}. Taken, these would have lost.`
        : 'Taken, these would have come out flat.';

  return (
    <div data-missed-card className="glass rounded-[calc(24px*var(--rk))] p-6">
      <span className="text-[11px] font-medium uppercase tracking-[0.07em]" style={{ color: 'var(--text-faint)' }}>
        Missed — trades you saw and did not take
      </span>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="tabular-nums text-[40px] font-semibold leading-none tracking-tight"
          style={{ color: totalR > 0 ? 'rgb(var(--outcome-win))' : totalR < 0 ? 'rgb(var(--outcome-loss))' : 'var(--text-faint)' }}>
          {taken.length ? <CountUp text={r(totalR)} /> : '—'}
        </span>
        {priced.length > 0 && (
          <span className="tabular-nums text-[15px]" style={{ color: 'var(--text-dim)' }}>
            {usd(dollars)} {dollars >= 0 ? 'left on the table' : 'avoided'}
          </span>
        )}
      </div>
      <p className="mt-2.5 text-[12px] leading-snug" style={{ color: 'var(--text-dim)' }}>{verdict}</p>
      {taken.length > 0 && (
        <p className="mt-1.5 text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {taken.length} missed · {wins} would have won · {losses} would have lost
          {priced.length < taken.length && ` · ${taken.length - priced.length} with no dollar figure`}
        </p>
      )}
    </div>
  );
}

/** One line at the top of a page, so hypothetical numbers never read as real ones. */
export function HypotheticalNote() {
  return (
    <p data-hypothetical-note className="rounded-[calc(14px*var(--rk))] px-3.5 py-2.5 text-[12px] leading-relaxed"
      style={{ background: 'rgb(var(--accent) / 0.08)', border: '1px solid rgb(var(--accent) / 0.25)', color: 'rgb(var(--accent))' }}>
      Hypothetical. These are the setups you hesitated on or missed, as if you had taken them. They are
      kept apart from every real figure — the All view, the balances, the risk limits and the streak.
    </p>
  );
}
