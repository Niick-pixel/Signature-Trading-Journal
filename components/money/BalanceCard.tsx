'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ACCOUNTS, type Account } from '@/lib/domain';
import type { Balance } from '@/lib/balance';
import type { CashEvent } from '@/lib/types';
import { press, spring, springSoft, scrimExit } from '@/lib/motion';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';

const usd = (v: number) =>
  `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

const KINDS = ['Deposit', 'Withdrawal', 'Balance check'] as const;
type KindLabel = (typeof KINDS)[number];
const KIND_FOR: Record<KindLabel, CashEvent['kind']> = {
  Deposit: 'deposit', Withdrawal: 'withdrawal', 'Balance check': 'reconcile',
};

interface BalanceCardProps {
  balance: Balance;
  account: Account | 'All';
  events: CashEvent[];
}

/**
 * What is in the account, and how confident the app is about it.
 *
 * The number is derived from money movements plus realised P&L, so it is only
 * as complete as the P&L behind it. When trades in the window carry no dollar
 * figure the card says so instead of presenting an incomplete sum as the
 * account's position — an almost-right balance is worse than an honest gap,
 * because you stop checking the broker.
 */
export function BalanceCard({ balance, account, events }: BalanceCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<KindLabel>('Deposit');
  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState<Account>(
    account === 'All' ? 'Live' : account,
  );
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount);
  const canSave = amount.trim() !== '' && Number.isFinite(value) && value >= 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: target, kind: KIND_FOR[kind], amount: value, date, note: note.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save that.');
      setOpen(false);
      setAmount('');
      setNote('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/cash/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  const incomplete = balance.unpriced > 0;
  const [showHistory, setShowHistory] = useState(false);

  return (
    <>
      <div className="glass rounded-[24px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-[0.07em]"
              style={{ color: 'var(--text-faint)' }}>
              {account === 'All' ? 'No single account' : account}
            </span>
            <div className="mt-2 tabular-nums text-[40px] font-semibold leading-none tracking-tight"
              style={{
                color: balance.current == null ? 'var(--text-faint)'
                  : balance.current >= 0 ? 'var(--text)' : 'rgb(var(--outcome-loss))',
              }}>
              {balance.current == null ? '—' : usd(balance.current)}
            </div>
            <p className="mt-2.5 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
              {account === 'All'
                ? 'Pick an account. Backtest dollars and live dollars are not the same dollars, and a balance that adds them is a number no broker would recognise.'
                : balance.current == null
                ? 'Nothing recorded yet. Add what the broker shows and the journal will carry it forward.'
                : balance.anchor
                  ? `Counted forward from the ${usd(balance.anchor.amount)} you confirmed on ${balance.anchor.date}.`
                  : 'Deposits, minus withdrawals, plus what the trades paid.'}
            </p>
          </div>

          <Button variant="primary" onClick={() => setOpen(true)} className="shrink-0">
            Add money
          </Button>
        </div>

        {account !== 'All' && balance.current != null && (
          <div className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-3">
            <Row label="Paid in" value={usd(balance.deposited)} />
            <Row label="Taken out" value={balance.withdrawn ? usd(-balance.withdrawn) : '—'} />
            <Row label="Made trading" value={usd(balance.realised)}
              tone={balance.realised > 0 ? 'win' : balance.realised < 0 ? 'loss' : null} />
          </div>
        )}

        {/*
          The gap, stated plainly. Every trade logged before the P&L payload bug
          was fixed has no dollar figure, so the sum above is missing them —
          and a balance that is quietly incomplete is the kind of number you
          stop checking against the broker.
        */}
        {incomplete && (
          <p className="mt-4 rounded-[14px] px-3.5 py-2.5 text-[11px] leading-relaxed"
            style={{
              background: 'rgb(var(--amber) / 0.10)',
              border: '1px solid rgb(var(--amber) / 0.28)',
              color: 'rgb(var(--amber))',
            }}>
            {balance.unpriced} trade{balance.unpriced === 1 ? '' : 's'} in this window {balance.unpriced === 1 ? 'has' : 'have'} no
            P&amp;L recorded, so this figure is short by whatever {balance.unpriced === 1 ? 'it' : 'they'} paid.
            Add a balance check to reset it to what the broker actually shows.
          </p>
        )}

        {/*
          Folded away by default.

          The balance is the answer; the ledger behind it is reference. Four
          rows of transfer history permanently under the number made the card
          read as a bank statement, when the thing being asked is "where am I".
        */}
        {events.length > 0 && (
          <div className="mt-5 border-t pt-3" style={{ borderColor: 'var(--glass-stroke)' }}>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
              className="flex w-full items-center gap-2 text-[11px] font-medium uppercase tracking-[0.07em]"
              style={{ color: 'var(--text-faint)' }}
            >
              <motion.svg
                width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden
                animate={{ rotate: showHistory ? 90 : 0 }}
                transition={spring}
              >
                <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
              Money in and out
              <span style={{ color: 'var(--text-faint)' }}>· {events.length}</span>
            </button>

            <AnimatePresence initial={false}>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={springSoft}
                  className="overflow-hidden"
                >
                  <div className="pt-2.5">
                    {events.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-3 py-1 text-[12px]">
                        <span style={{ color: 'var(--text-dim)' }}>
                          {e.kind === 'reconcile' ? 'Balance check' : e.kind === 'deposit' ? 'Paid in' : 'Taken out'}
                          <span style={{ color: 'var(--text-faint)' }}>
                            {' · '}{e.date}{e.note ? ` · ${e.note}` : ''}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2.5">
                          <span className="tabular-nums" style={{ color: 'var(--text)' }}>
                            {e.kind === 'withdrawal' ? usd(-e.amount) : usd(e.amount)}
                          </span>
                          <button type="button" onClick={() => void remove(e.id)}
                            className="text-[11px] underline underline-offset-2"
                            style={{ color: 'var(--text-faint)' }}>
                            remove
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none', transition: scrimExit }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[70]"
              style={{ background: 'rgb(0 0 0 / 0.45)', backdropFilter: 'blur(3px)' }}
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98, transition: scrimExit }}
              transition={springSoft}
              className="glass fixed left-1/2 top-1/2 z-[71] w-[min(28rem,calc(100vw-2rem))]
                -translate-x-1/2 -translate-y-1/2 rounded-[24px] p-6"
            >
              <h2 className="text-[17px] font-semibold">Add money</h2>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--text-dim)' }}>
                A deposit or a withdrawal moves the balance. A balance check sets it to
                exactly what the broker shows and counts forward from there.
              </p>

              <div className="mt-5 space-y-4">
                <Segmented value={kind} onChange={setKind} options={KINDS} />

                <Field label="Amount" hint="Always positive — the choice above says which way it went.">
                  <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00"
                    value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Account">
                    <Select value={target} onChange={setTarget} options={ACCOUNTS} />
                  </Field>
                  <Field label="Date">
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </Field>
                </div>

                <Field label="Note" hint="Optional — which broker, which transfer.">
                  <Input placeholder="—" value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
              </div>

              {error && (
                <p className="mt-4 rounded-[12px] p-2.5 text-[12px]"
                  style={{ color: 'rgb(var(--outcome-loss))', background: 'rgb(var(--outcome-loss) / 0.10)' }}>
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="primary" disabled={!canSave} onClick={() => void save()}>
                  {busy ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'win' | 'loss' | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>{label}</span>
      <motion.span
        transition={spring}
        whileTap={press}
        className="tabular-nums text-[13px] font-medium"
        style={{
          color: tone === 'win' ? 'rgb(var(--outcome-win))'
            : tone === 'loss' ? 'rgb(var(--outcome-loss))' : 'var(--text)',
        }}
      >
        {value}
      </motion.span>
    </div>
  );
}
