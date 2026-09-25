'use client';

import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { CountUp } from '@/components/ui/CountUp';

const WIN = 'var(--outcome-win)';
const LOSS = 'var(--outcome-loss)';

export interface BarRow {
  label: string;
  /** The number the bar length is drawn from. */
  value: number;
  /** What to print at the end of the bar. */
  display: string;
  /** Secondary text, e.g. trade count. */
  meta?: string;
  /**
   * Identity colour — a reason's cluster hue, say. Drawn as a dot beside the
   * label, never as the bar: a positive total in FOMO red read as a loss.
   */
  swatch?: string;
  accent?: string;
  /** Draws a ring around the row — used for Diagonal trendline. */
  highlight?: boolean;
}

/**
 * A signed horizontal bar chart with a zero line down the middle. Losses run
 * left, wins run right, so a column of leaks is legible at a glance without
 * reading a single number.
 */
export function SignedBars({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));

  return (
    <div className="space-y-2.5">
      {rows.map((row, i) => {
        const negative = row.value < 0;
        const width = (Math.abs(row.value) / max) * 50;
        // Signed bars are always coloured by sign. Anything else makes a chart
        // about profit and loss lie about which is which.
        const accent = negative ? LOSS : WIN;

        return (
          <div
            key={row.label}
            className="relative rounded-[calc(12px*var(--rk))] px-2 py-1.5"
            style={row.highlight
              ? { background: 'rgb(var(--accent) / 0.09)', boxShadow: 'inset 0 0 0 1px rgb(var(--accent) / 0.35)' }
              : undefined}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 truncate text-[12px]"
                style={{ color: row.highlight ? 'rgb(var(--accent))' : 'var(--text)' }}>
                {row.swatch && (
                  <span className="size-1.5 shrink-0 rounded-full"
                    style={{ background: `rgb(${row.swatch})`, boxShadow: `0 0 6px rgb(${row.swatch} / 0.8)` }} />
                )}
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[12px] font-semibold" style={{ color: `rgb(${accent})` }}>
                {row.display}
                {row.meta && <span className="ml-1.5 font-normal" style={{ color: 'var(--text-faint)' }}>{row.meta}</span>}
              </span>
            </div>

            <div className="relative h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--glass-fill)' }}>
              {/* The zero line sits dead centre; bars grow out from it. */}
              <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: 'var(--glass-stroke)' }} />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ ...spring, delay: i * 0.03 }}
                className="absolute inset-y-0 rounded-full"
                style={{
                  background: `rgb(${accent} / 0.85)`,
                  boxShadow: `0 0 10px rgb(${accent} / 0.5)`,
                  ...(negative ? { right: '50%' } : { left: '50%' }),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Unsigned 0-100% bars, for win rates. */
export function RateBars({ rows }: { rows: BarRow[] }) {
  return (
    <div className="space-y-2.5">
      {rows.map((row, i) => (
        <div key={row.label} className="px-2 py-1.5">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[12px]">{row.label}</span>
            <span className="shrink-0 tabular-nums text-[12px] font-semibold"
              style={{ color: `rgb(${row.accent ?? WIN})` }}>
              {row.display}
              {row.meta && <span className="ml-1.5 font-normal" style={{ color: 'var(--text-faint)' }}>{row.meta}</span>}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--glass-fill)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(100, row.value))}%` }}
              transition={{ ...spring, delay: i * 0.03 }}
              className="h-full rounded-full"
              style={{
                background: `rgb(${row.accent ?? WIN} / 0.85)`,
                boxShadow: `0 0 10px rgb(${row.accent ?? WIN} / 0.5)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A single headline number. The row of these is the first thing you read. */
export function Stat({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone?: 'win' | 'loss' | null }) {
  const color = tone === 'win' ? 'rgb(var(--outcome-win))'
    : tone === 'loss' ? 'rgb(var(--outcome-loss))'
    : 'var(--text)';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="glass rounded-[calc(18px*var(--rk))] px-4 py-3.5"
    >
      <div className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
        {label}
      </div>
      <div className="mt-1.5 tabular-nums text-[19px] font-semibold leading-none" style={{ color }}>
        <CountUp text={value} />
      </div>
      {sub && (
        <div className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>{sub}</div>
      )}
    </motion.div>
  );
}

/** A plain label/value line, for the denser breakdown panels. */
export function Line({
  label, value, tone,
}: { label: string; value: string; tone?: 'win' | 'loss' | null }) {
  const color = tone === 'win' ? 'rgb(var(--outcome-win))'
    : tone === 'loss' ? 'rgb(var(--outcome-loss))'
    : 'var(--text)';
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span className="tabular-nums text-[12px] font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

export function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="glass rounded-[calc(24px*var(--rk))] p-6"
    >
      <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
      {note && <p className="mb-4 mt-1 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>{note}</p>}
      <div className={note ? '' : 'mt-4'}>{children}</div>
    </motion.section>
  );
}
