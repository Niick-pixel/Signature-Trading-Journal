import { MIN_SEEN, type MissDimension, type MissRow, type MissedPatterns } from '@/lib/missed';

const WIN = 'rgb(var(--outcome-win))';
const LOSS = 'rgb(var(--outcome-loss))';
const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}R`;

/**
 * Where the misses cluster.
 *
 * Each condition is a bar of its miss rate with a tick at your usual rate, so
 * the question "is this unusual?" is answered by whether the bar passes the
 * tick — not by reading two percentages and subtracting. The would-have R sits
 * beside it because a condition where you miss losers is a filter, and one
 * where you miss winners is a leak.
 */
export function MissedPatternsView({ data }: { data: MissedPatterns }) {
  if (data.missed === 0) {
    return (
      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        No missed trades yet. Log a setup you hesitated on under the Missed account — as if you had
        taken it — and this starts showing where your misses cluster.
      </p>
    );
  }

  return (
    <div data-missed-patterns>
      <div className="mb-5 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div className="tabular-nums text-[40px] font-semibold leading-none tracking-tight"
            style={{ color: 'rgb(var(--accent))' }}>
            {pct(data.rate)}
          </div>
          <div className="mt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
            of the setups you saw went without you · {data.missed} missed, {data.taken} taken
          </div>
        </div>
        {data.reasons.length > 0 && (
          <div className="flex flex-wrap gap-2" data-miss-reasons>
            {data.reasons.map((r) => (
              <span key={r.reason} className="rounded-full border px-3 py-1 text-[11.5px]"
                style={{ borderColor: 'var(--glass-stroke)', background: 'var(--glass-fill)', color: 'var(--text-dim)' }}>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{r.reason}</span>
                {' '}{r.count}
                {r.wouldR !== 0 && (
                  <span className="tabular-nums" style={{ color: r.wouldR > 0 ? WIN : LOSS }}> · {signed(r.wouldR)}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {data.findings.length > 0 ? (
        <ul className="mb-6 space-y-2" data-miss-findings>
          {data.findings.map((f) => (
            <li key={f} className="border-l-2 pl-3 text-[12.5px] leading-snug"
              style={{ borderColor: 'rgb(var(--accent))', color: 'var(--text)' }}>
              {f}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-6 text-[11.5px] leading-snug" style={{ color: 'var(--text-faint)' }}>
          Nothing stands out yet. A condition is only named once it has {MIN_SEEN} or more setups behind it,
          three or more misses, and a miss rate well above your usual — until then, every bar below is a hint,
          not a finding.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.dimensions.map((d) => <Dimension key={d.key} dim={d} usual={data.rate} />)}
      </div>
    </div>
  );
}

function Dimension({ dim, usual }: { dim: MissDimension; usual: number | null }) {
  return (
    <div data-miss-dimension={dim.key} className="rounded-[calc(18px*var(--rk))] border p-4"
      style={{ borderColor: 'var(--glass-stroke)', background: 'var(--glass-fill)' }}>
      <h3 className="mb-3 text-[13px] font-semibold">{dim.title}</h3>
      <div className="space-y-3">
        {dim.rows.map((row) => <Row key={row.label} row={row} usual={usual} />)}
      </div>
    </div>
  );
}

function Row({ row, usual }: { row: MissRow; usual: number | null }) {
  const high = row.lift != null && row.lift >= 1.5 && !row.thin;
  return (
    <div data-miss-row={row.label} style={{ opacity: row.thin ? 0.55 : 1 }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[12px]">
          {row.label}
          {row.thin && <span className="ml-1.5 text-[10px]" style={{ color: 'var(--text-faint)' }}>few</span>}
        </span>
        <span className="shrink-0 tabular-nums text-[12px] font-semibold"
          style={{ color: high ? 'rgb(var(--accent))' : 'var(--text)' }}>
          {pct(row.rate)}
        </span>
      </div>
      <div className="relative mt-1 h-[4px] w-full rounded-full" style={{ background: 'var(--glass-stroke)' }}>
        <div className="h-full rounded-full" style={{
          width: `${(row.rate ?? 0) * 100}%`,
          background: high ? 'rgb(var(--accent))' : 'var(--text-faint)',
        }} />
        {usual != null && (
          <div title={`Your usual: ${pct(usual)}`} className="absolute -top-[3px] h-[10px] w-[2px] rounded-full"
            style={{ left: `calc(${usual * 100}% - 1px)`, background: 'var(--text)' }} />
        )}
      </div>
      <p className="mt-1 text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
        {row.missed} of {row.missed + row.taken} missed
        {row.missed > 0 && row.wouldR !== 0 && (
          <> · would have made <span style={{ color: row.wouldR > 0 ? WIN : LOSS }}>{signed(row.wouldR)}</span></>
        )}
      </p>
    </div>
  );
}
