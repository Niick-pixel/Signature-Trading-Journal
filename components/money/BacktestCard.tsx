import type { Trade } from '@/lib/types';
import { isTaken } from '@/lib/domain';
import { CountUp } from '@/components/ui/CountUp';

const r = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}R`;

/**
 * One line at the top of a Backtest page, so replayed numbers never read as
 * real ones — the counterpart of HypotheticalNote for the Missed account.
 */
export function BacktestNote({ undated, where }: { undated: number; where: 'stats' | 'calendar' }) {
  return (
    <p data-backtest-note className="rounded-[calc(14px*var(--rk))] px-3.5 py-2.5 text-[12px] leading-relaxed"
      style={{ background: 'rgb(var(--accent) / 0.08)', border: '1px solid rgb(var(--accent) / 0.25)', color: 'rgb(var(--accent))' }}>
      Backtest. Replayed trades, kept apart from every real figure — the All view, the balances, the risk
      limits, the streaks and the calendar.
      {where === 'stats' && undated > 0 && ` ${undated} ${undated === 1 ? 'is' : 'are'} undated, so ${undated === 1 ? 'it sits' : 'they sit'} out of the weekday and hour heatmap and the day counts.`}
      {where === 'calendar' && ' A replay has no day of its own — its date, when it has one, is the chart’s — so it is not on this calendar. The whiteboard and Stats have them.'}
    </p>
  );
}

/**
 * What the replay says so far. A backtest has no balance — no money moved —
 * so the calendar shows this where a real account shows its balance.
 */
export function BacktestCard({ trades }: { trades: Trade[] }) {
  const taken = trades.filter((t) => isTaken(t.outcome));
  const withR = taken.filter((t) => t.r_multiple != null);
  const totalR = withR.reduce((s, t) => s + (t.r_multiple ?? 0), 0);
  const wins = taken.filter((t) => t.outcome === 'Win').length;
  const losses = taken.filter((t) => t.outcome === 'Loss').length;
  const decided = wins + losses;

  return (
    <div data-backtest-card className="glass rounded-[calc(24px*var(--rk))] p-6">
      <span className="text-[11px] font-medium uppercase tracking-[0.07em]" style={{ color: 'var(--text-faint)' }}>
        Backtest — replayed trades
      </span>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="tabular-nums text-[40px] font-semibold leading-none tracking-tight"
          style={{ color: totalR > 0 ? 'rgb(var(--outcome-win))' : totalR < 0 ? 'rgb(var(--outcome-loss))' : 'var(--text-faint)' }}>
          {withR.length ? <CountUp text={r(totalR)} /> : '—'}
        </span>
        {decided > 0 && (
          <span className="tabular-nums text-[15px]" style={{ color: 'var(--text-dim)' }}>
            {Math.round((wins / decided) * 100)}% of decided trades won
          </span>
        )}
      </div>
      <p className="mt-2.5 text-[12px] leading-snug" style={{ color: 'var(--text-dim)' }}>
        {taken.length === 0
          ? 'Nothing replayed yet. Log a backtest from New trade — choose the Backtest account and the date is not needed.'
          : `${taken.length} replayed · ${wins} won · ${losses} lost. The full breakdown is in Stats, on the Backtest account.`}
      </p>
    </div>
  );
}
