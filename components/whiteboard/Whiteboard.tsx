'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, BackgroundVariant, ReactFlowProvider, useReactFlow,
  type Edge, type Node, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence, motion } from 'framer-motion';
import {
  computeLayout, reasonAccent, settle, tradeIdFromKey,
  GROUP_LABELS, GROUP_MODES, NODE_H, NODE_W, type GroupMode,
} from '@/lib/layout';
import { spring, springBouncy } from '@/lib/motion';
import type { JournalPage, BoardEdge, BoardNote, Trade } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { usePreferences } from '@/components/shell/PreferencesProvider';
import { DENSITY_SCALE } from '@/lib/preferences';
import { BoardControls } from './BoardControls';
import { BoardTitle } from './BoardTitle';
import { ClusterNode } from './ClusterNode';
import { DetailPanel } from './DetailPanel';
import { StackNode } from './StackNode';
import { EdgeKey } from './EdgeKey';
import { isHypothetical } from '@/lib/domain';
import { LiveFlow } from './LiveFlow';
import { dialogIsOpen } from '@/components/ui/Overlay';
import { GroupViewer } from './GroupViewer';
import { Toolbar, EMPTY_FILTERS, applyFilters, filtersActive, type Filters } from './Toolbar';
import { BulkBar } from './BulkBar';
import { RiskBanner } from './RiskBanner';
import { NoteNode } from './NoteNode';
import { ContextMenu, type MenuState } from './ContextMenu';
import { SearchPalette } from './SearchPalette';
import { StreakBadge } from './StreakBadge';
import { SavedViews } from './SavedViews';
import { OUTCOME_COLOR, TradeNode } from './TradeNode';

/** How far below the top of the canvas the board starts, clear of the floating toolbar. */
const TOP_CLEARANCE = 150;

type View = { x: number; y: number; zoom: number };
const viewKey = (mode: string) => `signature.board.view.${mode}`;

/** Storage can be unavailable or hold junk; either way the board just opens at 100%. */
function readView(mode: string): View | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(viewKey(mode)) ?? 'null') as Partial<View> | null;
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.zoom) && (v.zoom as number) > 0) {
      return v as View;
    }
  } catch { /* fall through to the default view */ }
  return null;
}

function writeView(mode: string, v: View) {
  try { window.localStorage.setItem(viewKey(mode), JSON.stringify(v)); } catch { /* a view is a convenience */ }
}

const nodeTypes = {
  trade: TradeNode, cluster: ClusterNode, title: BoardTitle, note: NoteNode, stack: StackNode,
};

function WhiteboardInner({ trades: initial, readOnly = false }: { trades: Trade[]; readOnly?: boolean }) {
  const flow = useReactFlow();
  const [trades, setTrades] = useState(initial);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  /** Which group's stack has been opened into the full viewer. */
  const [viewing, setViewing] = useState<string | null>(null);
  /**
   * Per-group nudges, keyed `${mode}::${key}`.
   *
   * Held locally as well as on the server so a drag lands immediately: a
   * controlled node whose position comes only from the server snaps back on
   * every render, which is the bug the sticky notes had.
   */
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({});

  // An explicit mode rather than React Flow's own selection: on this board a
  // click already means "open this trade", and overloading it with
  // shift-to-select made both gestures unreliable.
  // The same clustering answers different questions: by mistake tag it shows
  // which error repeats, by month whether any of this is improving.
  const [groupMode, setGroupMode] = useState<GroupMode>('reason');
  const [searching, setSearching] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [board, setBoard] = useState<{ notes: BoardNote[]; edges: BoardEdge[] }>({ notes: [], edges: [] });
  const loadBoard = useCallback(async () => {
    const res = await fetch('/api/board');
    if (res.ok) setBoard(await res.json());
  }, []);
  useEffect(() => { loadBoard(); }, [loadBoard]);

  /*
    Journal pages, for the search palette only.

    Loaded here rather than passed from the server component because the board
    is already client-side and the palette is the only consumer — the cost is
    one request on mount, and the payoff is that "/" searches everything I
    have written rather than only the trades.
  */
  const [pages, setPages] = useState<JournalPage[]>([]);
  useEffect(() => {
    if (readOnly) return;
    let live = true;
    void fetch('/api/journal')
      .then((r) => r.json())
      .then((ps) => { if (live) setPages(ps ?? []); })
      .catch(() => { /* search still works over the trades */ });
    return () => { live = false; };
  }, [readOnly]);

  useEffect(() => {
    let live = true;
    void fetch('/api/board/offsets')
      .then((r) => r.json())
      .then((o) => { if (live) setOffsets(o ?? {}); })
      .catch(() => { /* an unreachable nudge is not worth a broken board */ });
    return () => { live = false; };
  }, []);

  /*
    Board shortcuts. Typing is always sacred — a key that means "new trade"
    must never fire while I am halfway through writing an explanation, so every
    one of these bails out when focus is in a field.
  */
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement
        || el instanceof HTMLTextAreaElement
        || el instanceof HTMLSelectElement
        || (el as HTMLElement | null)?.isContentEditable === true;

      if (e.key === '/' && !typing) { e.preventDefault(); setSearching(true); return; }
      if ((e.key === 'n' || e.key === 'N') && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        window.location.href = '/new';
        return;
      }
      // The stack viewer is a dialog and closes itself; this only handles what
      // is not one, so a single Escape never closes two layers at once.
      if (e.key === 'Escape' && !searching && !dialogIsOpen()) {
        // Innermost first: the viewer sits over the board, the panel over both.
        if (openId) setOpenId(null);
        else if (viewing) setViewing(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [readOnly, searching, openId, viewing]);

  /** Locked items refuse to move. Kept per machine — it is a working habit. */
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<MenuState | null>(null);

  const toggleLock = useCallback((id: string) => {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const saveNote = useCallback((id: string, body: string) => {
    void fetch('/api/board', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'note', id, body }),
    });
  }, []);

  const removeNote = useCallback(async (id: string) => {
    await fetch(`/api/board?kind=note&id=${id}`, { method: 'DELETE' });
    await loadBoard();
  }, [loadBoard]);

  const moveNote = useCallback((id: string, x: number, y: number) => {
    void fetch('/api/board', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'note', id, x, y }),
    });
  }, []);

  /** A note lands in the middle of what I am looking at, not at the origin. */
  const addNote = useCallback(async () => {
    const centre = flow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'note', body: '', x: centre.x - 112, y: centre.y - 60 }),
    });
    await loadBoard();
  }, [loadBoard, flow]);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/trades');
    if (res.ok) setTrades(await res.json());
  }, []);

  const { prefs } = usePreferences();
  const scale = DENSITY_SCALE[prefs.boardDensity];

  const visible = useMemo(() => trades.filter(applyFilters(filters)), [trades, filters]);
  const realTrades = useMemo(() => trades.filter((t) => !isHypothetical(t.account)), [trades]);

  /*
    Which node the pointer is on.

    The board draws three kinds of derived line — the branch down to a group,
    the chain through a group, and the repeating leak across groups — and with
    ten groups all of them at full strength is a hairball that crosses every
    card on the screen. They are drawn faint instead, and whatever you are
    pointing at brings its own lines up to full. The board is then calm to look
    at and still answers "what is this one connected to" on demand.
  */
  const [hovered, setHovered] = useState<string | null>(null);

  /** The canvas, for placing the opening view. Never used to lay the board out. */
  const canvasRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(
    () => computeLayout(visible, scale, groupMode, offsets),
    [visible, scale, groupMode, offsets],
  );

  /*
    Where you were looking, per grouping.

    The board used to fitView on every load, so it opened at whatever zoom made
    everything fit — 54%, 75%, never the same twice — and forgot any zoom you
    had chosen. It now opens at 100% the first time, centred, with the title
    clear of the toolbar, and after that exactly where you left it. Each
    grouping keeps its own, since the reason board and the month board are
    different shapes. Kept per machine, like the locks: a view is a working
    habit, not part of the journal.
  */
  const [flowReady, setFlowReady] = useState(false);
  const placedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!flowReady || layout.clusters.length === 0) return;
    if (placedFor.current === groupMode) return;
    placedFor.current = groupMode;
    const saved = readOnly ? null : readView(groupMode);
    if (saved) {
      flow.setViewport(saved);
      return;
    }
    const width = canvasRef.current?.getBoundingClientRect().width ?? 1600;
    flow.setViewport({
      x: Math.round(width / 2 - layout.nominalWidth / 2),
      // The title sits 200 above the first row; this puts it just under the toolbar.
      y: TOP_CLEARANCE + 200,
      zoom: 1,
    });
  }, [flowReady, groupMode, layout.clusters.length, layout.nominalWidth, readOnly, flow]);

  /** Content bounding box plus a generous margin, for the pan wall. */
  const bounds = useMemo<[[number, number], [number, number]]>(() => {
    const xs = layout.clusters.flatMap((c) => [c.x, c.x + c.width]);
    const ys = layout.clusters.flatMap((c) => [c.y, c.y + c.height]);
    const noteXs = board.notes.flatMap((n) => [n.x, n.x + 240]);
    const noteYs = board.notes.flatMap((n) => [n.y, n.y + 140]);
    const all = { x: [...xs, ...noteXs], y: [...ys, ...noteYs] };
    if (all.x.length === 0) return [[-2000, -2000], [2000, 2000]];
    const M = 1600;
    return [
      [Math.min(...all.x) - M, Math.min(...all.y) - M - 260],
      [Math.max(...all.x) + M, Math.max(...all.y) + M],
    ];
  }, [layout.clusters, board.notes]);

  const onOpen = useCallback((id: string) => {
    if (readOnly) return;
    if (selectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      return;
    }
    setOpenId(id);
  }, [readOnly, selectMode]);

  const applyBulk = useCallback(async (patch: Record<string, unknown>) => {
    await fetch('/api/trades/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selectedIds], patch }),
    });
    await refresh();
  }, [selectedIds, refresh]);

  /**
   * A link the app could never have inferred — "same mistake as this one".
   * Two selected trades is the whole gesture.
   */
  const linkSelected = useCallback(async () => {
    const [from, to] = [...selectedIds];
    if (!from || !to) return;
    const label = window.prompt('Why are these two linked?', 'same mistake as this');
    if (label === null) return;
    await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'edge', from_id: from, to_id: to, label }),
    });
    await loadBoard();
    setSelectedIds(new Set());
  }, [selectedIds, loadBoard]);

  const leaveSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const nodes = useMemo<Node[]>(() => {
    /*
      The root. Centred over the arrangement and above it, so it reads as the
      thing the groups hang from rather than as another card.

      Centred on the width the GRID asked for, not on the bounding box of the
      clusters as drawn. Those regions are computed around wherever their cards
      actually sit, so the box changes by a pixel or two every time any card is
      nudged — and the title, anchored to it, slid a little on every single
      drag. Nothing else on the board moves when you move one card, and the
      title should not either.
    */
    const titleNode: Node[] = layout.clusters.length === 0 ? [] : [{
      id: 'board-title',
      type: 'title',
      position: { x: layout.nominalWidth / 2 - 150, y: -200 },
      data: {
        label: GROUP_LABELS[groupMode],
        sub: `${layout.clusters.length} group${layout.clusters.length === 1 ? '' : 's'} · ${visible.length} trade${visible.length === 1 ? '' : 's'}`,
      },
      draggable: false,
      selectable: false,
      zIndex: 1,
    }];

    const clusterNodes: Node[] = layout.clusters.map((cluster, index) => ({
      id: `cluster-${cluster.key}`,
      type: 'cluster',
      position: { x: cluster.x, y: cluster.y },
      data: { cluster, accent: cluster.accent, index },
      // A group moves as a group. Dragging the enclosure carries every card in
      // it — rearranging the board by reason is the point of the board, and
      // doing it one card at a time is not rearranging, it is tidying.
      /*
        Draggable in every grouping now. It used to be reason-only because the
        drag rewrote each card's absolute position, so a nudge made while
        grouped by setup would quietly rearrange the reason board. The offset
        is keyed by grouping mode, so each view remembers its own arrangement
        and none of them can corrupt another.
      */
      draggable: !readOnly && !locked.has(`cluster-${cluster.key}`),
      dragHandle: '.signature-cluster-handle',
      selectable: false,
      zIndex: 0,
      style: { width: cluster.width, height: cluster.height },
    }));

    /*
      Cards and stacks are children of their group, positioned relative to it.
      Dragging a group then moves one node — React Flow carries the children —
      instead of re-rendering every card in it on every frame of the drag.
    */
    const groupAt = new Map(layout.clusters.map((c) => [c.key, c]));
    const inGroup = (groupKey: string, x: number, y: number) => {
      const g = groupAt.get(groupKey);
      return g
        ? { parentId: `cluster-${groupKey}`, position: { x: x - g.x, y: y - g.y } }
        : { position: { x, y } };
    };

    const tradeNodes: Node[] = layout.nodes.map((n) => ({
      // The placement, not the trade: under 'mistake' one trade is legitimately
      // on the board more than once. Everything that acts on a card reads the
      // trade back out of the key, or off the node's own data.
      id: n.key,
      type: 'trade',
      ...inGroup(n.key.slice(0, n.key.lastIndexOf('::')), n.x, n.y),
      data: {
        trade: n.trade,
        selected: selectMode ? selectedIds.has(n.trade.id) : openId === n.trade.id,
        onOpen,
        scale,
        dimPassed: prefs.dimPassed,
        selectMode,
      },
      zIndex: 1,
      /*
        Cards are placed by the layout and nothing else.

        They used to be draggable, with the position stored per trade. That is
        what made the board messy: a nudged card left a gap, the enclosure was
        drawn around wherever the cards had ended up, and two cards could sit
        on top of each other. Groups still move as groups — that is the
        arrangement that carries meaning — but where a card sits inside its
        group is not information, it is just tidiness, and the app is better at
        tidiness than I am.
      */
      draggable: false,
      /*
        pointerEvents has to be stated.

        React Flow sets `pointer-events: none` on a node that is neither
        draggable nor connectable nor selectable — so the moment cards stopped
        being draggable they also stopped being CLICKABLE, and opening a trade
        silently died. The drag is gone on purpose; the click is the whole
        point of the card.
      */
      style: { width: NODE_W * scale, height: NODE_H * scale, pointerEvents: 'auto' },
    }));

    const stackNodes: Node[] = layout.stacks.map((st) => ({
      id: `stack-${st.key}`,
      type: 'stack',
      ...inGroup(st.key, st.x, st.y),
      data: {
        count: st.hidden.length,
        accent: st.accent,
        label: st.key,
        scale,
        onOpen: () => setViewing(st.key),
      },
      draggable: false,
      selectable: false,
      zIndex: 1,
      // Same reason as the cards above: not draggable means not clickable
      // unless pointer events are handed back explicitly.
      style: { width: NODE_W * scale, height: NODE_H * scale, pointerEvents: 'auto' },
    }));

    const noteNodes: Node[] = board.notes.map((note) => ({
      id: `note-${note.id}`,
      type: 'note',
      position: { x: note.x, y: note.y },
      data: { note, onSave: saveNote, onRemove: removeNote, locked: locked.has(`note-${note.id}`) },
      draggable: !locked.has(`note-${note.id}`),
      zIndex: 5,
    }));

    return [...titleNode, ...clusterNodes, ...tradeNodes, ...stackNodes, ...noteNodes];
  }, [
    layout, openId, onOpen, scale, prefs.dimPassed, selectMode, selectedIds, groupMode,
    visible.length, board.notes, saveNote, removeNote, locked,
  ]);

  const edges = useMemo<Edge[]>(() => {
    /*
      Where each placement actually sits, and which placement stands for a
      trade.

      Both matter because a node's id is its PLACEMENT key, not its trade id.
      Edges derived from trades — the repeating leaks, and the links drawn by
      hand — were still being built from bare trade ids, so they named nodes
      that do not exist and React Flow discarded every one of them. Neither
      has been drawn since cards started being keyed by placement.

      A trade can also have no placement at all: past the sixth in its group it
      lives inside a stack. An edge to a card that is not on the board is not
      drawn rather than drawn into space.
    */
    const at = new Map(layout.nodes.map((n) => [n.key, n]));
    const placementOf = new Map<string, string>();
    for (const n of layout.nodes) if (!placementOf.has(n.trade.id)) placementOf.set(n.trade.id, n.key);

    /*
      How loudly a line is drawn.

      Faint unless it touches whatever the pointer is on, or the trade that is
      open. A line you asked about is worth seeing; twenty you did not ask
      about are a mess laid over the cards.
    */
    const lit = (...ends: string[]) => {
      if (hovered === null && openId === null) return false;
      return ends.some((e) => {
        if (e === hovered) return true;
        if (openId === null) return false;
        return e === openId || tradeIdFromKey(e) === openId;
      });
    };

    /** The two faces that point at each other, so no line loops the long way. */
    const facing = (aKey: string, bKey: string) => {
      const a = at.get(aKey);
      const b = at.get(bKey);
      if (!a || !b) return { sourceHandle: 's-bottom', targetHandle: 't-top' };
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0
          ? { sourceHandle: 's-right', targetHandle: 't-left' }
          : { sourceHandle: 's-left', targetHandle: 't-right' };
      }
      return dy >= 0
        ? { sourceHandle: 's-bottom', targetHandle: 't-top' }
        : { sourceHandle: 's-top', targetHandle: 't-bottom' };
    };

    const within: Edge[] = layout.reasonEdges.map(([a, b]) => {
      const reason = layout.nodes.find((n) => n.key === a)?.reason;
      const accent = reason ? reasonAccent(reason) : '140 140 150';
      return {
        id: `r-${a}-${b}`,
        source: a, target: b, ...facing(a, b), type: 'default', animated: false,
        // Dotted, in the cluster's own hue: these say "same reason", which is a
        // quieter statement than the repeating-leak edges below.
        style: {
          stroke: `rgb(${accent} / ${lit(a, b) ? 0.9 : 0.22})`,
          strokeWidth: lit(a, b) ? 2 : 1.2,
          strokeDasharray: '1 5',
          strokeLinecap: 'round',
        },
        zIndex: lit(a, b) ? 4 : 0,
      };
    });

    // The repeating leak: same target type, both lost. Deliberately loud.
    const leaks: Edge[] = layout.leakEdges
      .map(([a, b]) => [placementOf.get(a), placementOf.get(b)] as const)
      .filter((pair): pair is readonly [string, string] =>
        pair[0] != null && pair[1] != null && pair[0] !== pair[1])
      .map(([a, b]) => ({
      id: `leak-${a}-${b}`,
      source: a, target: b, ...facing(a, b), type: 'default',
      // Dashed, and moving only when it is the line you are asking about —
      // twenty crawling dashes across the board is not emphasis, it is noise.
      animated: lit(a, b),
      style: {
        stroke: `rgb(${OUTCOME_COLOR.Loss} / ${lit(a, b) ? 0.85 : 0.2})`,
        strokeWidth: lit(a, b) ? 2.2 : 1.4,
        strokeDasharray: '6 4',
      },
      zIndex: lit(a, b) ? 4 : 2,
    }));

    /*
      Links I drew by hand. Always shown and never filtered away with the
      derived ones: a connection I made deliberately is the most valuable line
      on this board precisely because the app could not have found it.
    */
    const manual: Edge[] = board.edges
      .map((e) => ({ e, a: placementOf.get(e.from_id), b: placementOf.get(e.to_id) }))
      .filter((m): m is { e: BoardEdge; a: string; b: string } => m.a != null && m.b != null)
      .map(({ e, a, b }) => ({
        id: `m-${e.id}`,
        source: a, target: b, ...facing(a, b), type: 'default',
        label: e.label ?? undefined,
        labelStyle: { fill: 'var(--text-dim)', fontSize: 10 },
        labelBgStyle: { fill: 'var(--bg-raised)' },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 6,
        style: { stroke: 'rgb(var(--accent) / 0.75)', strokeWidth: 2 },
      }));

    /*
      The branches. One line from the board title to each group, in that
      group's own hue, so the whole board reads as one tree instead of a field
      of unexplained islands.
    */
    const branches: Edge[] = layout.clusters.map((cluster) => ({
      id: `branch-${cluster.key}`,
      source: 'board-title',
      target: `cluster-${cluster.key}`,
      type: 'default',
      // Thicker than the derived edges: this is the board's skeleton, and it
      // has to read at the zoom where the whole board fits on screen.
      style: {
        stroke: `rgb(${cluster.accent} / ${lit(`cluster-${cluster.key}`) ? 0.85 : 0.18})`,
        strokeWidth: lit(`cluster-${cluster.key}`) ? 2.6 : 1.4,
      },
      // Always beneath the cards, lit or not: a branch to a lower row has to
      // cross the rows above it, and drawn on top it cut straight through them.
      zIndex: 0,
    }));

    return [
      ...branches,
      ...(prefs.showReasonEdges ? within : []),
      ...(prefs.showLeakEdges ? leaks : []),
      ...manual,
    ];
  }, [layout, prefs.showReasonEdges, prefs.showLeakEdges, board.edges, hovered, openId]);

  /*
    Persist a drag so a manual arrangement survives a reload — but only in the
    default grouping. A position is "where I put this card on my board", and my
    board is organised by reason; saving a drag made while grouped by setup
    would silently rewrite that arrangement from a view that was never meant to
    be permanent.
  */
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type !== 'position' || !change.position) continue;

      /*
        Notes are controlled nodes whose position lives on the server, so the
        local copy has to move WHILE the drag happens. Without this the node
        was re-rendered back to its stored position on every frame and never
        appeared to move at all — the drag was working and being undone
        sixty times a second.

        They also move in every grouping: a note annotates the canvas, not the
        arrangement, so it keeps its place whatever is being grouped by.
      */
      if (change.id.startsWith('note-')) {
        // Held by LiveFlow while it moves; this is the drop.
        const noteId = change.id.slice(5);
        const { x, y } = change.position;
        setBoard((prev) => ({
          ...prev,
          notes: prev.notes.map((n) => (n.id === noteId ? { ...n, x, y } : n)),
        }));
        moveNote(noteId, x, y);
        continue;
      }

      if (change.dragging !== false) continue;

      /*
        A group moves as a group, and what is stored is the OFFSET from where
        the grid put it — not an absolute position, and not the cards.

        Absolute positions per card were the old scheme, and they went stale
        the moment a group gained a trade or was re-sorted: the arrangement was
        pinned to coordinates that the layout had since moved on from. An
        offset survives all of that. The cards themselves are placed entirely
        by the layout now, so there is nothing else to write.
      */
      if (change.id.startsWith('cluster-')) {
        const key = change.id.slice(8);
        const cluster = layout.clusters.find((c) => c.key === key);
        if (!cluster) continue;
        const nudge = offsets[`${groupMode}::${key}`] ?? { dx: 0, dy: 0 };

        // Snapped, and pushed clear of anything it was dropped on top of.
        const rest = settle(
          { x: change.position.x, y: change.position.y, width: cluster.width, height: cluster.height },
          layout.clusters.filter((c) => c.key !== key),
        );

        const dx = nudge.dx + (rest.x - cluster.x);
        const dy = nudge.dy + (rest.y - cluster.y);
        if (dx === nudge.dx && dy === nudge.dy) continue;

        // One render: the new offset lands as the held position is let go, so the
        // group never flashes back to where it started.
        setOffsets((prev) => ({ ...prev, [`${groupMode}::${key}`]: { dx, dy } }));
        void fetch('/api/board/offsets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: groupMode, key, dx, dy }),
        });
      }
    }
  }, [groupMode, moveNote, layout, offsets]);

  /** Every group back where the grid puts it. */
  const tidyUp = useCallback(async () => {
    setOffsets({});
    await fetch('/api/board/offsets', { method: 'DELETE' });
  }, []);

  /**
   * Pin anything the layout just placed for the first time.
   *
   * A trade with no stored coordinates is positioned by the clustering
   * algorithm, which means its spot depends on every other trade on the board —
   * so adding one trade quietly rearranged all the others, and closing the app
   * lost the arrangement entirely. Writing the computed position back the first
   * time a trade is drawn makes the board stable: from then on it stays where
   * you last saw it until you re-order deliberately.
   *
   * Skipped while a filter is active, because that layout is a subset and
   * pinning it would bake a filtered arrangement into the whole board.
   */
  useEffect(() => {
    if (readOnly || filtersActive(filters)) return;
    const unpinned = layout.nodes.filter((n) => n.trade.position_x == null);
    if (unpinned.length === 0) return;

    const positions = unpinned.map((n) => ({ id: n.trade.id, x: n.x, y: n.y }));
    void fetch('/api/trades/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
    }).then(() => {
      setTrades((prev) => prev.map((t) => {
        const pin = positions.find((pos) => pos.id === t.id);
        return pin ? { ...t, position_x: pin.x, position_y: pin.y } : t;
      }));
    });
  }, [layout, filters, readOnly]);

  const recluster = useCallback(async () => {
    await fetch('/api/trades/positions', { method: 'DELETE' });
    await refresh();
  }, [refresh]);

  const open = openId ? trades.find((t) => t.id === openId) ?? null : null;

  if (trades.length === 0) {
    return (
      <div className="grid h-full place-items-center">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={springBouncy} className="glass max-w-sm rounded-[calc(28px*var(--rk))] p-9 text-center"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ ...springBouncy, delay: 0.08 }}
            className="mx-auto mb-5 grid size-12 place-items-center rounded-[calc(16px*var(--rk))]"
            style={{ background: 'var(--glass-fill-strong)', color: 'var(--text-faint)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="7" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="17.5" cy="15.5" r="3.2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9.6 9.8l5.4 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 2.4" />
            </svg>
          </motion.div>
          <h2 className="text-[17px] font-semibold tracking-tight">Nothing on the board yet</h2>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            Log a trade and it will appear here, clustered with every other trade you took
            for the same reason.
          </p>
          <a href="/new" className="mt-7 inline-block outline-none">
            <Button variant="primary" tabIndex={-1}>Log your first trade</Button>
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* In the layout, not floating over it. As an overlay this bar covered the
          top of whichever clusters happened to be nearest the top of the board,
          including their headers — which are the point of the screen. */}
      {!readOnly && (
        <div className="shrink-0 px-4 pb-2">
          <div className="mb-2 flex items-center justify-center gap-2.5">
            {/* Real trades only: a trade you did not take cannot break a daily
                limit or a clean streak. */}
            <StreakBadge trades={realTrades} />
            <RiskBanner trades={realTrades} />
          </div>
          <Toolbar
            filters={filters}
            onChange={setFilters}
            shown={visible.length}
            total={trades.length}
            selectMode={selectMode}
            onToggleSelectMode={() => (selectMode ? leaveSelectMode() : setSelectMode(true))}
            groupMode={groupMode}
            onGroupMode={setGroupMode}
            onAddNote={addNote}
            onLinkSelected={selectedIds.size === 2 ? linkSelected : undefined}
            onSearch={() => setSearching(true)}
            savedViews={
              <SavedViews
                current={filters as unknown as Record<string, unknown>}
                onApply={(f) => setFilters({ ...EMPTY_FILTERS, ...(f as Partial<Filters>) })}
              />
            }
          />
        </div>
      )}

      <div ref={canvasRef} className="relative min-h-0 flex-1">
      {/* Bulk edit — the only practical way to backfill an account or a reason
          across a month of old entries. */}
      <AnimatePresence>
        {selectMode && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-6">
            <BulkBar count={selectedIds.size} onApply={applyBulk} onCancel={leaveSelectMode} />
          </div>
        )}
      </AnimatePresence>

      {/* What the lines mean — bottom left, clear of the zoom controls. */}
      <div className="pointer-events-none absolute bottom-5 left-[4.5rem] z-20 [&>*]:pointer-events-auto">
        <EdgeKey chains={prefs.showReasonEdges} leaks={prefs.showLeakEdges} />
      </div>

      <LiveFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onInit={() => setFlowReady(true)}
        // An attribute on the canvas rather than state: toggling it must not
        // re-render the board, or the thing meant to make moving cheap costs a
        // render at the start and end of every pan.
        onMoveStart={() => canvasRef.current?.setAttribute('data-moving', '')}
        onMoveEnd={(_event, viewport) => {
          canvasRef.current?.removeAttribute('data-moving');
          if (!readOnly) writeView(groupMode, viewport);
        }}
        onNodeDragStart={() => canvasRef.current?.setAttribute('data-moving', '')}
        onNodeDragStop={() => canvasRef.current?.removeAttribute('data-moving')}
        minZoom={0.12}
        maxZoom={2.2}
        /*
          A wall around the board. Without it one careless scroll sends the
          canvas into empty space with no landmark to steer back by, and the
          only way home is the fit button. The extent is the content plus a
          screen of margin on each side, recomputed as the board grows.
        */
        translateExtent={bounds}
        nodeExtent={bounds}
        /* Snapping makes a group drag land cleanly instead of a pixel off. */
        snapToGrid
        snapGrid={[8, 8]}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesDraggable={!readOnly}
        panOnDrag={!readOnly}
        zoomOnScroll={!readOnly}
        zoomOnDoubleClick={!readOnly}
        panOnScroll={!readOnly}
        selectionOnDrag={false}
        onPaneClick={() => { setOpenId(null); setMenu(null); setHovered(null); }}
        onNodeMouseEnter={(_event, node) => setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(null)}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          const items = [];
          if (node.type === 'trade') {
            const id = tradeIdFromKey(node.id);
            items.push({ label: 'Open', onClick: () => setOpenId(id) });
            // No "lock in place" for a card: it has no place of its own to
            // lock. The layout puts it where it goes.
            items.push({
              label: 'Move to Trash',
              danger: true,
              onClick: async () => {
                await fetch(`/api/trades/${id}`, { method: 'DELETE' });
                await refresh();
              },
            });
          } else if (node.type === 'note') {
            const noteId = node.id.slice(5);
            items.push({
              label: locked.has(node.id) ? 'Unlock note' : 'Lock in place',
              onClick: () => toggleLock(node.id),
            });
            items.push({ label: 'Delete note', danger: true, onClick: () => void removeNote(noteId) });
          } else if (node.type === 'cluster') {
            items.push({
              label: locked.has(node.id) ? 'Unlock group' : 'Lock group in place',
              onClick: () => toggleLock(node.id),
            });
          }
          if (items.length) setMenu({ x: event.clientX, y: event.clientY, items });
        }}
        onEdgeContextMenu={(event, edge) => {
          if (!edge.id.startsWith('m-')) return;
          event.preventDefault();
          const edgeId = edge.id.slice(2);
          setMenu({
            x: event.clientX,
            y: event.clientY,
            items: [{
              label: 'Delete link',
              danger: true,
              onClick: async () => {
                await fetch(`/api/board?kind=edge&id=${edgeId}`, { method: 'DELETE' });
                await loadBoard();
              },
            }],
          });
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          setMenu({
            x: (event as MouseEvent).clientX,
            y: (event as MouseEvent).clientY,
            items: [
              { label: 'Add a note here', onClick: () => void addNote() },
              { label: 'Fit everything', onClick: () => flow.fitView({ padding: 0.08, duration: 400 }) },
              { label: 'Tidy up the groups', onClick: () => void tidyUp() },
            ],
          });
        }}
        attributionPosition="bottom-center"
        style={{ background: 'transparent' }}
      >
        {prefs.showGrid && (
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="var(--board-dots)" />
        )}
      </LiveFlow>

      {/* Filtering to nothing used to leave a blank canvas with no explanation. */}
      <AnimatePresence>
        {visible.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring}
            className="pointer-events-none absolute inset-0 grid place-items-center"
          >
            <div className="glass pointer-events-auto rounded-[calc(24px*var(--rk))] px-7 py-6 text-center">
              <p className="text-[14px] font-medium">No trades match these filters</p>
              <p className="mt-1.5 text-[12px]" style={{ color: 'var(--text-dim)' }}>
                {trades.length} trade{trades.length === 1 ? '' : 's'} are hidden.
              </p>
              <div className="mt-5">
                <Button onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom and layout, bottom-right — opposite the theme and settings
          cluster, and out of the way of the board itself. */}
      {!readOnly && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex justify-end">
          <BoardControls onRecluster={recluster} />
        </div>
      )}

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />

      <SearchPalette
        trades={trades}
        pages={pages}
        open={searching}
        onClose={() => setSearching(false)}
        onOpenTrade={(id) => setOpenId(id)}
      />

      {!readOnly && <DetailPanel trade={open} onClose={() => setOpenId(null)} onChanged={refresh} />}

      {/*
        The stack, opened. Reads the trades the board already has rather than
        refetching: the group is right there in the layout.
      */}
      {!readOnly && (
        <GroupViewer
          label={viewing}
          trades={viewing === null ? [] : (layout.clusters.find((c) => c.key === viewing)?.trades ?? [])}
          onOpenTrade={(id) => { setViewing(null); setOpenId(id); }}
          onClose={() => setViewing(null)}
        />
      )}
      </div>
    </div>
  );
}

export function Whiteboard({ trades, readOnly }: { trades: Trade[]; readOnly?: boolean }) {
  // ReactFlowProvider has to sit above anything calling its hooks.
  return (
    <ReactFlowProvider>
      <WhiteboardInner trades={trades} readOnly={readOnly} />
    </ReactFlowProvider>
  );
}
