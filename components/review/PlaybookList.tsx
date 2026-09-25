'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { MIN_SAMPLE } from '@/lib/domain';
import type { Aggregate } from '@/lib/stats';
import type { Playbook } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { ExplanationField } from '@/components/capture/ExplanationField';

interface Entry { book: Playbook; stats: Aggregate }

export function PlaybookList({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [criteria, setCriteria] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    await fetch('/api/playbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, criteria }),
    });
    setBusy(false); setAdding(false); setName(''); setCriteria('');
    router.refresh();
  }

  async function archive(id: string) {
    await fetch(`/api/playbooks?id=${id}`, { method: 'DELETE' });
    router.refresh();
  }

  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
  const r = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(1)}R`;

  return (
    <div className="space-y-3">
      {entries.map(({ book, stats }) => (
        <motion.div
          key={book.id}
          layout
          transition={spring}
          className="glass group rounded-[calc(18px*var(--rk))] p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold tracking-tight">{book.name}</h2>
              {book.criteria && (
                <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed"
                  style={{ color: 'var(--text-dim)' }}>
                  {book.criteria}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-baseline gap-4">
              <span className="tabular-nums text-[13px] font-semibold"
                style={{ color: stats.totalR > 0 ? 'rgb(var(--outcome-win))' : stats.totalR < 0 ? 'rgb(var(--outcome-loss))' : 'var(--text)' }}>
                {r(stats.totalR)}
              </span>
              <span className="tabular-nums text-[12px]" style={{ color: 'var(--text-dim)' }}>
                {pct(stats.winRate)}
              </span>
              <span
                className="tabular-nums text-[11px]"
                style={{ color: stats.taken < MIN_SAMPLE ? 'rgb(var(--amber))' : 'var(--text-faint)' }}
              >
                n {stats.taken}
              </span>
              <button
                type="button"
                onClick={() => archive(book.id)}
                className="text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: 'var(--text-faint)' }}
              >
                Archive
              </button>
            </div>
          </div>
          {stats.taken > 0 && stats.taken < MIN_SAMPLE && (
            <p className="mt-2.5 text-[11px]" style={{ color: 'rgb(var(--amber))' }}>
              {stats.taken} trade{stats.taken === 1 ? '' : 's'} — still a hypothesis.
            </p>
          )}
        </motion.div>
      ))}

      <AnimatePresence>
        {adding ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={spring} className="glass space-y-5 rounded-[calc(18px*var(--rk))] p-5"
          >
            <Field label="Name"><Input autoFocus placeholder="London sweep into NY AM iFVG"
              value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Criteria" hint="What has to be true. Write it so a stranger could apply it.">
              <ExplanationField value={criteria} onChange={setCriteria} required={false} minRows={3}
                placeholder="Asia low swept before 03:00, displacement up through the gap, target the previous day high…" />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" onClick={create} disabled={busy || !name.trim()}>
                {busy ? 'Saving…' : 'Add'}
              </Button>
              <Button onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </motion.div>
        ) : (
          <Button onClick={() => setAdding(true)}>+ Name a setup</Button>
        )}
      </AnimatePresence>
    </div>
  );
}
