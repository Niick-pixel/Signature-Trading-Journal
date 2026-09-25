'use client';

import { useState } from 'react';
import type { HeatCell } from '@/lib/stats';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * When the trades actually happen, and what they pay.
 *
 * Diverging: two hues with a neutral midpoint, because the quantity is signed
 * R and zero is the meaningful middle. An empty cell is drawn as absence
 * rather than as zero — no trades at 3am is not the same as breakeven at 3am.
 */
export function WhenHeatmap({ cells }: { cells: HeatCell[] }) {
  const [hover, setHover] = useState<HeatCell | null>(null);

  if (cells.length === 0) {
    return <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>No taken trades yet.</p>;
  }

  // Only the hours that have ever been traded, so the grid is not 90% empty.
  const hours = [...new Set(cells.map((c) => c.hour))].sort((a, b) => a - b);
  const days = [...new Set(cells.map((c) => c.day))].sort((a, b) => a - b);
  const peak = Math.max(...cells.map((c) => Math.abs(c.totalR)), 1);

  const find = (day: number, hour: number) => cells.find((c) => c.day === day && c.hour === hour);

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex gap-1">
          <div className="w-9 shrink-0" />
          {hours.map((h) => (
            <div key={h} className="w-9 shrink-0 text-center text-[9px]" style={{ color: 'var(--text-faint)' }}>
              {String(h).padStart(2, '0')}
            </div>
          ))}
        </div>

        {days.map((d) => (
          <div key={d} className="mt-1 flex gap-1">
            <div className="w-9 shrink-0 text-[10px] leading-8" style={{ color: 'var(--text-faint)' }}>
              {DAYS[d]}
            </div>
            {hours.map((h) => {
              const cell = find(d, h);
              const intensity = cell ? Math.min(1, Math.abs(cell.totalR) / peak) : 0;
              const hue = !cell ? null : cell.totalR > 0 ? 'var(--outcome-win)'
                : cell.totalR < 0 ? 'var(--outcome-loss)' : null;
              return (
                <div
                  key={h}
                  onMouseEnter={() => cell && setHover(cell)}
                  onMouseLeave={() => setHover(null)}
                  title={cell ? `${DAYS[d]} ${h}:00 — ${cell.count} trade${cell.count === 1 ? '' : 's'}, ${cell.totalR < 0 ? '−' : '+'}${Math.abs(cell.totalR).toFixed(1)}R` : undefined}
                  className="grid size-8 shrink-0 place-items-center rounded-[calc(6px*var(--rk))] text-[10px] tabular-nums"
                  style={{
                    background: hue
                      ? `rgb(${hue} / ${0.14 + intensity * 0.55})`
                      : cell ? 'var(--glass-fill-strong)' : 'var(--glass-fill)',
                    border: '1px solid var(--glass-stroke)',
                    color: cell ? 'var(--text)' : 'transparent',
                  }}
                >
                  {cell?.count ?? ''}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px]" style={{ color: 'var(--text-faint)' }}>
        {hover
          ? `${DAYS[hover.day]} ${String(hover.hour).padStart(2, '0')}:00 — ${hover.count} trade${hover.count === 1 ? '' : 's'}, ${hover.totalR < 0 ? '−' : '+'}${Math.abs(hover.totalR).toFixed(1)}R`
          : 'Cell shows the number of trades; colour is net R, green up and red down. Empty means never traded.'}
      </p>
    </div>
  );
}
