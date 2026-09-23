import Link from 'next/link';
import { MIN_DAYS, type ConditionFactor, type ConditionRow, type Conditions } from '@/lib/conditions';

const WIN = 'rgb(var(--outcome-win))';
const LOSS = 'rgb(var(--outcome-loss))';

const r = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`;
const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);

/**
 * What the morning review says about the day's trading.
 *
 * Three small columns rather than a chart: there are only ever two or three
 * buckets per question, and the thing worth reading is the sentence at the
 * bottom, not a shape. A bucket with too few mornings is still shown — hiding
 * it would suggest the question had not been answered — but faded and marked,
 * because four mornings of anything is an anecdote.
 */
export function Mornings({ data }: { data: Conditions }) {
  if (data.reviews === 0) {
    return (
      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        No daily reviews yet. Open any day on the calendar and fill in the morning — sleep, state of
        mind, and afterwards whether your bias held — and this starts comparing those mornings with
        what you traded on them.{' '}
        <Link href="/day" className="underline underline-offset-2">Write today’s</Link>
      </p>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {data.factors.map((f) => <Factor key={f.key} factor={f} />)}
    </div>
  );
}

function Factor({ factor }: { factor: ConditionFactor }) {
  // Bars scaled within the factor, so the comparison is between its own rows.
  const max = Math.max(0.0001, ...factor.rows.map((row) => Math.abs(row.stats.avgR ?? 0)));

  return (
    <div data-factor={factor.key} className="flex flex-col rounded-[18px] border p-4"
      style={{ borderColor: 'var(--glass-stroke)', background: 'var(--glass-fill)' }}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold">{factor.title}</h3>
        <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
          {factor.answered} morning{factor.answered === 1 ? '' : 's'} answered
        </span>
      </div>

      <div className="space-y-3">
        {factor.rows.map((row) => <Row key={row.label} row={row} max={max} />)}
      </div>

      <p className="mt-auto pt-4 text-[11px] leading-snug"
        style={{ color: factor.finding ? 'var(--text)' : 'var(--text-faint)' }}>
        {factor.finding
          ?? `Needs ${MIN_DAYS} traded mornings at each end before it will say anything.`}
      </p>
    </div>
  );
}

function Row({ row, max }: { row: ConditionRow; max: number }) {
  const avg = row.stats.avgR;
  const tone = avg == null ? 'var(--text-faint)' : avg < 0 ? LOSS : avg > 0 ? WIN : 'var(--text)';
  const width = avg == null ? 0 : (Math.abs(avg) / max) * 100;

  return (
    <div data-row={row.label} style={{ opacity: row.thin ? 0.55 : 1 }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px]">
          {row.label}
          {row.thin && row.days > 0 && (
            <span className="ml-1.5 text-[10px]" style={{ color: 'var(--text-faint)' }}>few</span>
          )}
        </span>
        <span className="tabular-nums text-[12px] font-semibold" style={{ color: tone }}>
          {avg == null ? '—' : r(avg)}
          <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--text-faint)' }}>/ trade</span>
        </span>
      </div>

      <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full" style={{ background: 'var(--glass-stroke)' }}>
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: tone }} />
      </div>

      <p className="mt-1 text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
        {row.days} morning{row.days === 1 ? '' : 's'}
        {row.days > 0 && ` · ${row.tradedDays} traded · ${row.stats.taken} trade${row.stats.taken === 1 ? '' : 's'}`}
        {row.stats.taken > 0 && ` · won ${pct(row.stats.winRate)}`}
        {row.scored > 0 && ` · broke a rule ${pct(row.breakRate)}`}
      </p>
    </div>
  );
}
