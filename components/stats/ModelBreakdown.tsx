import { MIN_SAMPLE } from '@/lib/domain';
import type { BreakdownRow } from '@/lib/stats';

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const signedR = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(1)}R`;

/**
 * One rule, split by its answer: trades taken, win rate, net R.
 *
 * "Trades" counts trades actually taken — a passed setup has no result to
 * win or lose, so it is left out of all three numbers here, as everywhere
 * else in Stats. A row standing on fewer than MIN_SAMPLE trades is marked,
 * because four trades can show any win rate at all.
 */
export function BreakdownTable({ title, rows, note }: { title: string; rows: BreakdownRow[]; note?: string }) {
  return (
    <div data-breakdown={title}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.07em]" style={{ color: 'var(--text-faint)' }}>
          {title}
        </span>
        {note && <span className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>{note}</span>}
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr style={{ color: 'var(--text-faint)' }}>
            <th className="py-1 text-left text-[10.5px] font-medium">&nbsp;</th>
            <th className="w-[4.5rem] py-1 text-right text-[10.5px] font-medium">Trades</th>
            <th className="w-[4.5rem] py-1 text-right text-[10.5px] font-medium">Win rate</th>
            <th className="w-[4.5rem] py-1 text-right text-[10.5px] font-medium">Total R</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const thin = row.stats.taken < MIN_SAMPLE;
            return (
              <tr key={row.key} data-row={row.key} data-taken={row.stats.taken}
                data-winrate={row.stats.winRate == null ? '' : row.stats.winRate.toFixed(4)}
                data-total-r={row.stats.totalR.toFixed(4)}
                className="border-t" style={{ borderColor: 'var(--glass-stroke)', opacity: row.muted ? 0.62 : 1 }}>
                <td className="py-1.5 pr-2" style={{ color: 'var(--text-dim)' }}>{row.label}</td>
                <td className="py-1.5 text-right tabular-nums"
                  style={{ color: thin ? 'rgb(var(--amber))' : 'var(--text)' }}
                  title={thin ? `Fewer than ${MIN_SAMPLE} trades — not enough to conclude anything` : undefined}>
                  {row.stats.taken}
                </td>
                <td className="py-1.5 text-right font-semibold tabular-nums">{pct(row.stats.winRate)}</td>
                <td className="py-1.5 text-right tabular-nums font-medium"
                  style={{
                    color: row.stats.totalR > 0 ? 'rgb(var(--outcome-win))'
                      : row.stats.totalR < 0 ? 'rgb(var(--outcome-loss))' : 'var(--text-faint)',
                  }}>
                  {row.stats.taken ? signedR(row.stats.totalR) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
