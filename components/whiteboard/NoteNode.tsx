'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { BoardNote } from '@/lib/types';

export type NoteNodeData = {
  note: BoardNote;
  onSave: (id: string, body: string) => void;
  onRemove: (id: string) => void;
  locked: boolean;
};

/**
 * A sticky note, as a first-class board node.
 *
 * It used to be a framer-motion div in a viewport portal, which looked right
 * and worked for nothing: React Flow's pane swallowed the pointer before the
 * textarea could focus, and its own drag fought the canvas pan. As a real node
 * React Flow moves it, and `nodrag` on the textarea lets the text be selected
 * and typed into without the note sliding away underneath the cursor.
 */
function NoteNodeInner({ data, selected }: NodeProps) {
  const { note, onSave, onRemove, locked } = data as unknown as NoteNodeData;
  const [body, setBody] = useState(note.body);
  const timer = useRef<number | null>(null);

  // The note is the source of truth on load; after that the local copy leads,
  // so a save round-trip cannot yank the cursor mid-sentence.
  useEffect(() => { setBody(note.body); }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onType = (value: string) => {
    setBody(value);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onSave(note.id, value), 600);
  };

  return (
    <div
      className="group w-56 overflow-hidden rounded-[calc(16px*var(--rk))] p-3"
      style={{
        background: 'rgb(var(--amber) / 0.14)',
        border: `1px solid rgb(var(--amber) / ${selected ? 0.7 : 0.35})`,
        boxShadow: selected ? 'var(--shadow-panel)' : 'var(--shadow-card)',
      }}
    >
      {/*
        A real grab bar, not a hairline.
        The textarea carries `nodrag` so text can be selected, which means it
        cannot also start a drag — and at the zoom where the whole board fits
        on screen the textarea is almost the entire note. Without a bar with
        actual height, moving a note is hunt-the-pixel.
      */}
      <div className="-mx-3 -mt-3 mb-1.5 flex h-7 items-center justify-between rounded-t-[calc(16px*var(--rk))] px-3"
        style={{ background: 'rgb(var(--amber) / 0.14)', cursor: locked ? 'default' : 'grab' }}>
        <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.1em]"
          style={{ color: 'var(--text-faint)' }}>
          <svg width="11" height="7" viewBox="0 0 11 7" fill="none" aria-hidden>
            <g fill="currentColor" opacity="0.75">
              <circle cx="1.4" cy="1.4" r="1" /><circle cx="5.5" cy="1.4" r="1" /><circle cx="9.6" cy="1.4" r="1" />
              <circle cx="1.4" cy="5.5" r="1" /><circle cx="5.5" cy="5.5" r="1" /><circle cx="9.6" cy="5.5" r="1" />
            </g>
          </svg>
          {locked ? 'Locked' : 'Note'}
        </span>
        <button
          type="button"
          aria-label="Delete note"
          // nodrag, or the pointer-down starts a drag instead of a click.
          className="nodrag grid size-4 place-items-center rounded-full text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => onRemove(note.id)}
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--glass-stroke)', color: 'var(--text-dim)' }}
        >
          ×
        </button>
      </div>

      <textarea
        value={body}
        onChange={(e) => onType(e.target.value)}
        placeholder="What did you conclude?"
        className="nodrag nowheel w-full resize-none bg-transparent text-[12px] leading-snug outline-none"
        style={{ color: 'var(--text)', minHeight: 70, cursor: 'text' }}
      />
    </div>
  );
}


/*
  Re-render only when what the node shows changes.

  React Flow hands every node its absolute position as a prop, so moving a
  group gave each card inside it new props on every frame of the drag — and
  each card re-rendered, with Framer measuring its layout each time. That was
  most of the 55ms of script per pointer move. What a node draws depends on its
  data alone; its position is applied by React Flow to the wrapper around it.
*/
export const NoteNode = memo(NoteNodeInner, (a, b) => a.data === b.data && a.selected === b.selected);
