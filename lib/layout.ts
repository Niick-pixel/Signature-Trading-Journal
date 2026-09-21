import { aggregate, byReason, leakPairs } from './stats';
import { REASONS, type Reason } from './domain';
import { gradeLetter } from './grade';
import type { Trade } from './types';
import type { Aggregate } from './stats';

export const NODE_W = 208;
export const NODE_H = 152;

const GAP_X = 34;
const GAP_Y = 30;
const PAD = 30;
const HEADER_H = 96;
const CLUSTER_GAP = 60;
/** Clusters wrap onto a new row past this width, when nothing better is known. */
const BOARD_W = 2100;
/**
 * Floor for cluster width. With the header on two rows the label no longer
 * competes with the stats, so this only has to fit the stats row — measured at
 * 315px for the widest group, plus the header's own 28px of padding a side.
 */
const MIN_CLUSTER_W = 380;

/** The screen the board is being laid out for, in CSS pixels. */
export interface Fit { width: number; height: number }

/*
  React Flow's fitView leaves a margin of `padding` on each side, so the board
  has to be this much smaller than the canvas to be shown at its true size.
*/
const FIT_PADDING = 1.16;

/**
 * How many cards a group shows before the rest become a stack.
 *
 * Six fills a 3x2 grid exactly, which is why it is six. Past that the newest
 * five stay on the board and everything older collapses into one tile with a
 * count — a group of forty rendered as forty cards is not information, it is a
 * wall, and the two you care about are the two you just took.
 */
export const VISIBLE_PER_CLUSTER = 6;


/**
 * What the board groups by.
 *
 * Reason is the default and the reason this screen exists, but the same
 * clustering answers different questions: grouped by mistake tag it shows
 * which error repeats, by month it shows whether any of this is improving.
 */
export const GROUP_MODES = [
  'reason', 'mistake', 'grade', 'setup', 'target', 'month',
] as const;
export type GroupMode = (typeof GROUP_MODES)[number];

export const GROUP_LABELS: Record<GroupMode, string> = {
  reason: 'Reason',
  mistake: 'Mistake',
  grade: 'Grade',
  setup: 'Setup',
  target: 'Target',
  month: 'Month',
};

export interface PositionedTrade {
  trade: Trade;
  x: number;
  y: number;
  reason: Reason;
  /**
   * Identifies this PLACEMENT, not the trade.
   *
   * Grouping by mistake puts a trade with three tags in three clusters, which
   * is the whole point of that view — you want to see every trade each error
   * touched. But the board keyed its nodes by trade id, so the three copies
   * collided and React Flow kept one and dropped the rest: two of the three
   * clusters were quietly missing the card that put them there.
   */
  key: string;
}

/** The trade behind a placement key. */
export function tradeIdFromKey(key: string): string {
  const at = key.lastIndexOf('::');
  return at === -1 ? key : key.slice(at + 2);
}

export interface PositionedCluster {
  /** The group's own label — a reason, a tag, a month. */
  key: string;
  /** Hue for the cluster. Reason keeps its identity colour; others cycle. */
  accent: string;
  reason: Reason;
  stats: Aggregate;
  x: number;
  y: number;
  width: number;
  height: number;
  trades: Trade[];
}

/**
 * The tile that stands in for the cards a group is not showing.
 *
 * Carries the ids rather than the trades: the board only needs a count to
 * draw it, and the viewer that opens on click reads the trades it already has.
 */
export interface PositionedStack {
  key: string;
  x: number;
  y: number;
  accent: string;
  hidden: string[];
}

export interface BoardLayout {
  clusters: PositionedCluster[];
  nodes: PositionedTrade[];
  stacks: PositionedStack[];
  /** Chains through each reason cluster. */
  reasonEdges: Array<[string, string]>;
  /** Dashed cross-cluster edges: same target type, both lost. */
  leakEdges: Array<[string, string]>;
  /**
   * The width the grid ASKED for, before anything was dragged.
   *
   * Cluster regions are drawn around where their cards actually ended up, so
   * their bounding box shifts every time a single card moves a pixel. Anything
   * anchored to that box — the board title was — drifts on every drag, which
   * reads as the whole board being unstable. This is the arrangement the
   * layout laid out, and it only changes when the groups themselves do.
   */
  nominalWidth: number;
}

function clusterGrid(count: number, scale: number, maxCols?: number) {
  /*
    A group's cards can be arranged square-ish or laid out wide, and which is
    better is not a property of the group — it is a property of the screen.
    Height is almost always what limits how big the board can be drawn, and a
    group two rows deep costs every row on the board that height. Letting the
    arrangement be chosen per board, by bestPack, is worth more than any single
    rule here could be.
  */
  const cols = maxCols
    ? Math.max(1, Math.min(count, maxCols))
    : Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const w = NODE_W * scale;
  const h = NODE_H * scale;
  return {
    cols,
    rows,
    width: Math.max(MIN_CLUSTER_W, cols * w + (cols - 1) * GAP_X + PAD * 2),
    height: HEADER_H + rows * h + (rows - 1) * GAP_Y + PAD,
  };
}

/**
 * Lays clusters out worst-first — the reason costing you the most R lands
 * top-left, where you look first. That placement is the entire argument for
 * this screen existing.
 */
interface BoardGroup { key: string; reason: Reason; accent: string; stats: Aggregate; trades: Trade[] }

/**
 * Buckets the trades for whichever mode the board is in.
 *
 * A trade with three mistake tags appears in three clusters under 'mistake' —
 * that is correct and deliberate: the point of grouping by mistake is to see
 * every trade each error touched, not to force one label per trade.
 */
function groupsFor(trades: Trade[], mode: GroupMode): BoardGroup[] {
  if (mode === 'reason') {
    return byReason(trades)
      .sort((a, b) => a.stats.totalR - b.stats.totalR)
      .map((g) => ({
        key: g.key, reason: g.key, accent: reasonAccent(g.key), stats: g.stats, trades: g.trades,
      }));
  }

  const buckets = new Map<string, Trade[]>();
  const put = (key: string, t: Trade) => {
    const list = buckets.get(key) ?? [];
    list.push(t);
    buckets.set(key, list);
  };

  for (const t of trades) {
    if (mode === 'mistake') {
      if (t.mistake_tags.length === 0) put('No mistake tagged', t);
      else for (const tag of t.mistake_tags) put(tag, t);
    } else if (mode === 'grade') {
      put(gradeLetter(t.checklist_score), t);
    } else if (mode === 'setup') {
      put(t.setup_type, t);
    } else if (mode === 'target') {
      put(t.target_type, t);
    } else {
      put(t.date.slice(0, 7), t);
    }
  }

  return [...buckets]
    .map(([key, list], i) => ({
      key,
      // The nodes keep their own reason hue; the cluster takes a cycled one so
      // adjacent regions stay distinguishable.
      reason: list[0].reason,
      accent: `var(--reason-${i % 12})`,
      stats: aggregate(list),
      trades: list,
    }))
    .sort((a, b) => (mode === 'month' ? a.key.localeCompare(b.key) : a.stats.totalR - b.stats.totalR));
}

/** Lays the regions out in rows, wrapping past `wrapWidth`. Pure geometry. */
function pack(sizes: Array<{ width: number; height: number }>, wrapWidth: number) {
  const at: Array<{ x: number; y: number }> = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let width = 0;

  for (const size of sizes) {
    if (x > 0 && x + size.width > wrapWidth) {
      x = 0;
      y += rowHeight + CLUSTER_GAP;
      rowHeight = 0;
    }
    at.push({ x, y });
    x += size.width + CLUSTER_GAP;
    rowHeight = Math.max(rowHeight, size.height);
    width = Math.max(width, x - CLUSTER_GAP);
  }

  return { at, width, height: y + rowHeight };
}

/**
 * The arrangement that reads biggest on the screen you actually have.
 *
 * The board used to wrap at a flat 2100px whatever it was being shown on. Ten
 * groups then came to roughly 2600 wide and 2400 tall, and fitView answered
 * that by shrinking everything to 54% — at which point the chart on a card is
 * 100px across and there is no reading it. The shape of the board is the only
 * free variable here: the same ten groups laid out three-up instead of
 * five-up is a completely different rectangle, and one of those rectangles
 * matches the window far better than the others.
 *
 * So try each of them and keep whichever can be drawn largest, capping at 1:
 * past full size there is nothing further to gain, and the tie-break prefers
 * the shorter board because vertical scrolling is the one that loses you the
 * overview.
 */
function bestPack(counts: number[], scale: number, fit?: Fit) {
  const squares = counts.map((n) => clusterGrid(n, scale));
  const fallback = () => ({ ...pack(squares, BOARD_W), grids: squares });
  if (counts.length === 0) return fallback();
  if (!fit || fit.width < 200 || fit.height < 200) return fallback();

  const room = { width: fit.width / FIT_PADDING, height: fit.height / FIT_PADDING };

  let best = fallback();
  let bestScore = -Infinity;

  // Every shape the groups can take, against every width they can wrap at.
  const shapes: Array<number | undefined> = [undefined];
  for (let c = 1; c <= VISIBLE_PER_CLUSTER; c++) shapes.push(c);

  for (const maxCols of shapes) {
    const grids = maxCols === undefined ? squares : counts.map((n) => clusterGrid(n, scale, maxCols));
    const widest = Math.max(...grids.map((g) => g.width));

    const candidates = new Set<number>([BOARD_W]);
    let run = 0;
    for (const g of grids) {
      run += g.width + CLUSTER_GAP;
      candidates.add(Math.max(widest, run - CLUSTER_GAP));
    }

    for (const wrapWidth of candidates) {
      const laid = pack(grids, wrapWidth);
      const zoom = Math.min(room.width / laid.width, room.height / laid.height, 1);
      // Biggest first; a shorter board breaks the tie.
      const score = zoom * 1e6 - laid.height;
      if (score > bestScore) {
        bestScore = score;
        best = { ...laid, grids };
      }
    }
  }
  return best;
}

/** Groups come to rest on this grid, so a hand-made arrangement still lines up. */
export const SNAP = 20;
/** And never closer than this to the next group. */
const SETTLE_GAP = 24;

export const snapTo = (n: number) => Math.round(n / SNAP) * SNAP;
/*
  Snapping a push has to round the way the push is going.

  Rounding to nearest undid the correction: a group pushed clear to 824 was
  snapped back to 820, four pixels inside the neighbour it had just been moved
  out of, and the next pass computed the same four pixels and snapped back
  again — it never converged and the drop stayed overlapping.
*/
const clearUpTo = (n: number) => Math.ceil(n / SNAP) * SNAP;
const clearDownTo = (n: number) => Math.floor(n / SNAP) * SNAP;

export interface Rect { x: number; y: number; width: number; height: number }

/**
 * Where a dragged group actually comes to rest.
 *
 * Dropping a group used to put it exactly where the pointer let go, which
 * meant it could land squarely on top of another one — the board's own
 * arrangement is careful about not overlapping and then hands you the ability
 * to undo that with one careless drag, with nothing but "Tidy up" (which
 * discards every other nudge too) to get out of it.
 *
 * So it snaps to a grid, and if it still lands on something it is pushed clear
 * along whichever axis it is least buried in — the smallest correction that
 * makes the drop legal, rather than a rearrangement you did not ask for.
 */
export function settle(moved: Rect, others: Rect[]): { x: number; y: number } {
  let x = snapTo(moved.x);
  let y = snapTo(moved.y);

  for (let pass = 0; pass < 24; pass++) {
    let pushed = false;
    for (const other of others) {
      const left = other.x - SETTLE_GAP;
      const top = other.y - SETTLE_GAP;
      const right = other.x + other.width + SETTLE_GAP;
      const bottom = other.y + other.height + SETTLE_GAP;

      const clear = x >= right || x + moved.width <= left
        || y >= bottom || y + moved.height <= top;
      if (clear) continue;

      const outLeft = (x + moved.width) - left;
      const outRight = right - x;
      const outUp = (y + moved.height) - top;
      const outDown = bottom - y;
      const least = Math.min(outLeft, outRight, outUp, outDown);

      if (least === outLeft) x = clearDownTo(left - moved.width);
      else if (least === outRight) x = clearUpTo(right);
      else if (least === outUp) y = clearDownTo(top - moved.height);
      else y = clearUpTo(bottom);
      pushed = true;
    }
    if (!pushed) break;
  }

  return { x, y };
}

export function computeLayout(
  trades: Trade[],
  scale = 1,
  mode: GroupMode = 'reason',
  /** Per-group nudges, keyed `${mode}::${key}`. See db/boardlayout.ts. */
  offsets: Record<string, { dx: number; dy: number }> = {},
  /** The canvas this board is being drawn on, so it can be shaped to fit it. */
  fit?: Fit,
): BoardLayout {
  const groups = groupsFor(trades, mode);

  const clusters: PositionedCluster[] = [];
  const nodes: PositionedTrade[] = [];
  const stacks: PositionedStack[] = [];
  const reasonEdges: Array<[string, string]> = [];

  const nodeW = NODE_W * scale;
  const nodeH = NODE_H * scale;

  // Sized for what is actually drawn: up to five cards plus a stack tile.
  const counts = groups.map((g) => Math.min(g.trades.length, VISIBLE_PER_CLUSTER));
  const packed = bestPack(counts, scale, fit);
  const grids = packed.grids;
  const nominalWidth = packed.width;

  groups.forEach((group, index) => {
    const grid = grids[index];
    const cursorX = packed.at[index].x;
    const cursorY = packed.at[index].y;

    /*
      Newest first, and placed on an exact grid.

      Both halves of this used to be wrong. Cards were scattered by up to 26px
      "organically", and pinned drag positions were honoured on top of that, so
      a group of two could render as two cards overlapping each other — the
      board looked broken because it was being told to look loose. Placement is
      now entirely the layout's job: same gaps everywhere, nothing to nudge out
      of alignment, nothing to tidy up after.
    */
    const nudge = offsets[`${mode}::${group.key}`] ?? { dx: 0, dy: 0 };
    const originX = cursorX + nudge.dx;
    const originY = cursorY + nudge.dy;

    const ordered = [...group.trades].sort((a, b) => b.date.localeCompare(a.date));
    const shown = ordered.length > VISIBLE_PER_CLUSTER
      ? ordered.slice(0, VISIBLE_PER_CLUSTER - 1)
      : ordered;
    const hidden = ordered.slice(shown.length);
    const placed: PositionedTrade[] = [];

    shown.forEach((trade, i) => {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      placed.push({
        trade,
        reason: trade.reason,
        key: `${group.key}::${trade.id}`,
        x: originX + PAD + col * (nodeW + GAP_X),
        y: originY + HEADER_H + row * (nodeH + GAP_Y),
      });

      // Between placements, not between trades: the same pair of trades can be
      // adjacent inside two different mistake clusters and each chain is its
      // own line.
      if (i > 0) reasonEdges.push([placed[i - 1].key, placed[i].key]);
    });

    // The stack takes the slot after the last visible card.
    if (hidden.length > 0) {
      const i = shown.length;
      stacks.push({
        key: group.key,
        x: originX + PAD + (i % grid.cols) * (nodeW + GAP_X),
        y: originY + HEADER_H + Math.floor(i / grid.cols) * (nodeH + GAP_Y),
        accent: group.accent,
        hidden: hidden.map((t) => t.id),
      });
    }

    nodes.push(...placed);

    /*
      The region is the grid, because the grid is now the only thing placing
      anything. It used to be derived from where the cards actually were, which
      was necessary while they could be dragged and is exactly what made the
      enclosure jump a pixel whenever one moved.
    */
    const x = originX;
    const y = originY;
    const { width, height } = grid;

    clusters.push({
      key: group.key, accent: group.accent, reason: group.reason,
      stats: group.stats, x, y, width, height, trades: group.trades,
    });

  });

  return { clusters, nodes, stacks, reasonEdges, leakEdges: leakChains(trades), nominalWidth };
}

/**
 * Repeating leaks. leakPairs() returns every pair, which becomes a hairball on
 * a group of any size — chaining them by date keeps the line visible while
 * still linking every trade in the group.
 */
function leakChains(trades: Trade[]): Array<[string, string]> {
  const pairs = leakPairs(trades);
  if (pairs.length === 0) return [];

  const byTarget = new Map<string, Trade[]>();
  for (const t of trades) {
    if (t.outcome !== 'Loss') continue;
    const list = byTarget.get(t.target_type) ?? [];
    list.push(t);
    byTarget.set(t.target_type, list);
  }

  const chains: Array<[string, string]> = [];
  for (const group of byTarget.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < ordered.length; i++) chains.push([ordered[i - 1].id, ordered[i].id]);
  }
  return chains;
}

/**
 * The colour for a reason cluster, as a CSS variable reference.
 *
 * Indexed off REASONS rather than computed from the hue angle, because the same
 * hue needs a different lightness per theme and a server component has no way to
 * know which theme is active. app/globals.css defines --reason-0..11 twice.
 */
export function reasonAccent(reason: Reason): string {
  const index = REASONS.indexOf(reason);
  return `var(--reason-${index < 0 ? 0 : index})`;
}
