'use client';

import { useState } from 'react';
import { Overlay } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import type { PastLesson } from '@/lib/lessons';

const shortDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const tone = (l: PastLesson) =>
  l.outcome === 'Win' ? 'rgb(var(--outcome-win))'
    : l.outcome === 'Loss' ? 'rgb(var(--outcome-loss))'
      : 'var(--text-faint)';

const result = (l: PastLesson) =>
  l.outcome === 'Not taken' ? 'passed'
    : l.r_multiple == null ? l.outcome.toLowerCase()
      : `${l.r_multiple > 0 ? '+' : ''}${l.r_multiple.toFixed(1)}R`;

/**
 * The last lessons written on this kind of setup.
 *
 * Planned is the moment this is for — before the entry — and a Planned trade
 * has no outcome fields, which frees exactly the room to show them in full.
 * On a trade logged afterwards it collapses to one line that opens them, so the
 * form still fits one screen; the lessons are still one click away, and still
 * worth reading before you write this one.
 */
export function PastLessons({ setup, lessons, inline }: {
  setup: string;
  lessons: PastLesson[];
  inline: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (lessons.length === 0) return null;

  const list = (
    <ol className="space-y-2.5">
      {lessons.map((l) => (
        <li key={l.id} data-lesson={l.id} className="text-[12px] leading-snug">
          <span className="mr-2 text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {shortDate(l.date)}
            <span className="ml-1.5 font-semibold" style={{ color: tone(l) }}>{result(l)}</span>
          </span>
          <span style={{ color: 'var(--text-dim)' }}>{l.lesson}</span>
        </li>
      ))}
    </ol>
  );

  if (inline) {
    return (
      <div data-past-lessons="inline" className="mt-4 rounded-[14px] border px-4 py-3"
        style={{ borderColor: 'rgb(var(--accent) / 0.3)', background: 'rgb(var(--accent) / 0.05)' }}>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.07em]"
          style={{ color: 'rgb(var(--accent))' }}>
          Last time on {setup}
        </p>
        {list}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        data-past-lessons="chip"
        onClick={() => setOpen(true)}
        className="text-left text-[11px] underline decoration-dotted underline-offset-2"
        style={{ color: 'rgb(var(--accent))' }}
      >
        What you wrote last time on {setup} · {lessons.length} lesson{lessons.length === 1 ? '' : 's'}
      </button>

      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        className="w-[min(36rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[24px] p-6"
      >
        <h2 className="text-[17px] font-semibold">Last time on {setup}</h2>
        <p className="mb-4 mt-1 text-[12px]" style={{ color: 'var(--text-dim)' }}>
          The lessons from your most recent trades on this setup, newest first.
        </p>
        {list}
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setOpen(false)}>Close</Button>
        </div>
      </Overlay>
    </>
  );
}
