'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { reasonAccent } from '@/lib/layout';
import type { Trade } from '@/lib/types';
import { Button } from '@/components/ui/Button';

export function TrashList({ trades }: { trades: Trade[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function restore(id: string) {
    setBusy(id);
    await fetch(`/api/trades/${id}/restore`, { method: 'POST' });
    setBusy(null);
    router.refresh();
  }

  /** The only place in the app that actually destroys anything. */
  async function purge(id: string) {
    setBusy(id);
    await fetch(`/api/trades/${id}?purge=1`, { method: 'DELETE' });
    setBusy(null);
    setConfirming(null);
    router.refresh();
  }

  if (trades.length === 0) {
    return (
      <div className="glass rounded-[calc(24px*var(--rk))] p-8 text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
        Nothing in the Trash.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {trades.map((trade) => (
          <motion.div
            key={trade.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={spring}
            className="glass flex flex-wrap items-center gap-4 rounded-[calc(18px*var(--rk))] p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/screenshots/${trade.screenshot_path}`}
              alt=""
              className="size-14 shrink-0 rounded-[calc(10px*var(--rk))] object-cover"
              style={{ background: 'var(--letterbox)' }}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: `rgb(${reasonAccent(trade.reason)})` }}
                />
                <span className="truncate text-[13px] font-medium">{trade.reason}</span>
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                {new Date(trade.date).toLocaleDateString()} · {trade.instrument} {trade.direction}
                {' · '}{trade.outcome}
                {' · deleted '}
                {trade.deleted_at ? new Date(trade.deleted_at).toLocaleDateString() : '—'}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={() => restore(trade.id)} disabled={busy === trade.id}>Restore</Button>
              {confirming === trade.id ? (
                <>
                  <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                    Permanently? The screenshot goes too.
                  </span>
                  <Button variant="danger" onClick={() => purge(trade.id)} disabled={busy === trade.id}>
                    Purge
                  </Button>
                  <Button onClick={() => setConfirming(null)}>Keep</Button>
                </>
              ) : (
                <Button variant="danger" onClick={() => setConfirming(trade.id)}>Purge…</Button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
