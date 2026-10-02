'use client';

/**
 * The brand lockup in the title bar.
 *
 * The mark is a fair value gap: three candles, and the band is the empty space
 * between the first candle's top and the third candle's bottom — nothing
 * touches it. This is the 32px drawing (brand/signature-mark-small.svg), on
 * whole pixels, which stays crisp at title-bar size where the full drawing
 * goes soft. Its colours come from the theme (--mark-*).
 */
export function Wordmark() {
  return (
    <div className="flex select-none items-center gap-2">
      <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <rect width="32" height="32" rx="7" fill="var(--mark-ground)" stroke="var(--glass-stroke)" strokeWidth="0.75" />
        <g shapeRendering="crispEdges">
          <rect x="4" y="14" width="24" height="3" fill="var(--mark-gap)" />
          <rect x="7.5" y="18" width="1" height="2" fill="var(--mark-ink)" />
          <rect x="5.8" y="20.8" width="4.4" height="3.4" rx="0.8" fill="none" stroke="var(--mark-ink)" strokeWidth="1.6" shapeRendering="geometricPrecision" />
          <rect x="7.5" y="25" width="1" height="2" fill="var(--mark-ink)" />
          <rect x="15" y="7" width="2" height="20" fill="var(--mark-ink)" />
          <rect x="13" y="9" width="6" height="16" rx="1" fill="var(--mark-ink)" />
          <rect x="23" y="6" width="2" height="7" fill="var(--mark-ink)" />
          <rect x="21" y="8" width="6" height="4" rx="1" fill="var(--mark-ink)" />
        </g>
      </svg>
      <span
        className="text-[12px] font-semibold"
        style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}
      >
        Signature
      </span>
    </div>
  );
}
