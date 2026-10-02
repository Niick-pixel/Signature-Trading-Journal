// The Signature mark: a fair value gap. Three candles; the band is the empty
// space between the first candle's top and the third candle's bottom — and
// nothing touches it.

/** Master geometry, 1024 grid. */
export function master({ tile, ink, gap, gapOpacity, withTile = true }) {
  const W = 40; // wick and outline weight
  const cand = (x, w, bt, bb, wt, wb, fill) => {
    const h = w / 2;
    const wicks = `<path d="M${x} ${wt}V${bt}M${x} ${bb}V${wb}" stroke="${ink}" stroke-width="${W}" stroke-linecap="round"/>`;
    const body = fill
      ? `<rect x="${x - h}" y="${bt}" width="${w}" height="${bb - bt}" rx="26" fill="${ink}"/>`
      : `<rect x="${x - h + W / 2}" y="${bt + W / 2}" width="${w - W}" height="${bb - bt - W}" rx="16" fill="none" stroke="${ink}" stroke-width="${W}"/>`;
    return wicks + body;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${withTile ? `<rect width="1024" height="1024" rx="232" fill="${tile}"/>` : ''}
  <!-- The gap: between the first candle's high (below) and the third's low (above). -->
  <rect x="140" y="452" width="744" height="96" rx="30" fill="${gap}" fill-opacity="${gapOpacity}"/>
  <!-- 1: the candle before, hollow (down) -->
  ${cand(268, 148, 630, 780, 600, 840, false)}
  <!-- 2: the displacement candle that leaves the gap -->
  ${cand(512, 156, 300, 770, 240, 834, true)}
  <!-- 3: the candle after, whose low stays above the gap -->
  ${cand(756, 148, 262, 392, 206, 400, true)}
</svg>`;
}

/** 32px: on whole pixels, wicks 2px, the first candle a 1.5px outline. */
export function small({ tile, ink, gap, gapOpacity }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges">
  <rect width="32" height="32" rx="7" fill="${tile}" shape-rendering="geometricPrecision"/>
  <rect x="4" y="14" width="24" height="3" fill="${gap}" fill-opacity="${gapOpacity}"/>
  <rect x="7.5" y="18" width="1" height="2" fill="${ink}"/><rect x="5.8" y="20.8" width="4.4" height="3.4" rx="0.8" fill="none" stroke="${ink}" stroke-width="1.6" shape-rendering="geometricPrecision"/><rect x="7.5" y="25" width="1" height="2" fill="${ink}"/>
  <rect x="15" y="7" width="2" height="20" fill="${ink}"/><rect x="13" y="9" width="6" height="16" rx="1" fill="${ink}"/>
  <rect x="23" y="6" width="2" height="7" fill="${ink}"/><rect x="21" y="8" width="6" height="4" rx="1" fill="${ink}"/>
</svg>`;
}

/** 16px: no wicks, three bars and the gap — all a 16px icon can carry. */
export function tiny({ tile, ink, gap, gapOpacity }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges">
  <rect width="16" height="16" rx="3.5" fill="${tile}" shape-rendering="geometricPrecision"/>
  <rect x="2" y="7" width="12" height="2" fill="${gap}" fill-opacity="${Math.min(1, gapOpacity + 0.15)}"/>
  <rect x="3" y="10" width="3" height="3" fill="${ink}"/>
  <rect x="7" y="3" width="2" height="10" fill="${ink}"/>
  <rect x="10" y="3" width="3" height="3" fill="${ink}"/>
</svg>`;
}

export const LIGHT = { tile: '#E9E2D4', ink: '#241B12', gap: '#8A5205', gapOpacity: 0.38 };
export const DARK = { tile: '#0E1220', ink: '#DAAE60', gap: '#DAAE60', gapOpacity: 0.3 };
