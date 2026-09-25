'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { ACCOUNTS, REASONS, TRADE_STATUSES, type Account, type Reason, type TradeStatus } from '@/lib/domain';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface BulkBarProps {
  count: number;
  onApply: (patch: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

/**
 * Change one field across many trades at once.
 *
 * Deliberately narrow: reason, account and stage only. It cannot touch the
 * checklist, the outcome or the explanation, because those are what actually
 * happened and they get edited one at a time, on purpose.
 */
export function BulkBar({ count, onApply, onCancel }: BulkBarProps) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState<TradeStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const patch: Record<string, unknown> = {};
  if (reason) patch.reason = reason;
  if (account) patch.account = account;
  if (status) patch.status = status;
  const ready = count > 0 && Object.keys(patch).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={spring}
      className="glass pointer-events-auto flex flex-wrap items-center gap-3 rounded-[calc(20px*var(--rk))] px-4 py-3"
    >
      <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'rgb(var(--accent))' }}>
        {count} selected
      </span>

      <div className="w-44"><Select value={reason} onChange={setReason} options={REASONS} placeholder="Reason…" /></div>
      <div className="w-44"><Select value={account} onChange={setAccount} options={ACCOUNTS} placeholder="Account…" /></div>
      <div className="w-32"><Select value={status} onChange={setStatus} options={TRADE_STATUSES} placeholder="Stage…" /></div>

      <Button
        variant="primary"
        disabled={!ready || busy}
        onClick={async () => { setBusy(true); await onApply(patch); setBusy(false); }}
      >
        {busy ? 'Applying…' : 'Apply'}
      </Button>
      <Button onClick={onCancel}>Done</Button>
    </motion.div>
  );
}
