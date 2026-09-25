'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import { ReactFlow, type Node, type NodeChange, type ReactFlowProps } from '@xyflow/react';

/**
 * React Flow, with drags held locally.
 *
 * The board's nodes are computed from the layout, so a drag has to be applied
 * somewhere or React Flow snaps the node back on the next render. Doing that in
 * the Whiteboard meant every pointer move re-rendered the whole screen — the
 * toolbar, the panels, all of it — to move one box: long tasks of 70ms and a
 * drag that visibly stuttered. Here the held position lives in this component
 * alone, so a move re-renders the canvas and nothing else. Only the drop is
 * handed up, as the ordinary change it always was.
 */
function LiveFlowInner({ nodes = [], onNodesChange, ...rest }: ReactFlowProps) {
  const [held, setHeld] = useState<{ id: string; position: { x: number; y: number } } | null>(null);

  // Every other node keeps its identity, so only the held one re-renders.
  const shown = useMemo<Node[]>(() => (
    held
      ? nodes.map((n) => (n.id === held.id ? { ...n, position: held.position } : n))
      : nodes
  ), [nodes, held]);

  const handle = useCallback((changes: NodeChange[]) => {
    const passOn: NodeChange[] = [];
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        if (change.dragging) {
          setHeld({ id: change.id, position: change.position });
          continue;
        }
        // The drop: let go of the hold in the same update the parent applies
        // the new position in, so the node never flashes back.
        if (change.dragging === false) setHeld(null);
      }
      passOn.push(change);
    }
    if (passOn.length) onNodesChange?.(passOn);
  }, [onNodesChange]);

  return <ReactFlow {...rest} nodes={shown} onNodesChange={handle} />;
}

export const LiveFlow = memo(LiveFlowInner);
