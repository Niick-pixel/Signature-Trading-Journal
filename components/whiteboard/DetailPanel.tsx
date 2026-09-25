'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CHECKLIST_PHASES, CONTEXT_FLAG_LIST, OUTCOMES,
  type ChecklistAnswer, type Outcome,
} from '@/lib/domain';
import { spring, springSoft, scrimExit } from '@/lib/motion';
import { derivedAdherence } from '@/lib/adherence';
import type { Trade } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { GradeBadge } from '@/components/ui/GradeBadge';
import { Select } from '@/components/ui/Select';
import { OUTCOME_COLOR } from './TradeNode';
import { FlagList } from './FlagList';
import { History } from './History';
import { Lightbox } from './Lightbox';
import { ShotGallery } from './ShotGallery';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{label}</span>
      <span className="text-right text-[12px]">{value}</span>
    </div>
  );
}

/**
 * A grouped surface for a run of rows. Two columns of label/value pairs sitting
 * on bare background read as one long run-on list — the left column's values
 * end up hard against the right column's labels. Grouping each column onto its
 * own surface separates them by elevation instead of by a rule.
 */
function Group({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[calc(16px*var(--rk))] px-4 py-2"
      style={{ background: 'var(--glass-fill)', border: '1px solid var(--glass-stroke)' }}
    >
      {children}
    </div>
  );
}

/**
 * One checklist answer. `null` is not a miss — it is a condition that did not
 * apply, shown struck through so it reads as removed from the mark rather than
 * failed against it.
 */
function Check({ on, label }: { on: ChecklistAnswer; label: string }) {
  const na = on === null;
  return (
    <span className="flex items-center gap-1.5 text-[11px]"
      style={{ color: on === true ? 'rgb(var(--grade-aplus))' : 'var(--text-faint)' }}>
      <span className="grid size-[14px] place-items-center rounded-full text-[8px]"
        style={{ background: on === true ? 'rgb(var(--grade-aplus) / 0.18)' : 'var(--glass-fill)' }}>
        {on === true ? '✓' : na ? '–' : '·'}
      </span>
      <span style={na ? { textDecoration: 'line-through', opacity: 0.65 } : undefined}>{label}</span>
      {na && <span className="text-[9px] uppercase tracking-[0.08em]">n/a</span>}
    </span>
  );
}

interface DetailPanelProps {
  trade: Trade | null;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Springs out of the node it came from via a shared layoutId, so the card you
 * clicked visibly becomes the panel. Escape or a click on the scrim collapses
 * it back into the node.
 */
export function DetailPanel({ trade, onClose, onChanged }: DetailPanelProps) {
  const [settling, setSettling] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>('Win');
  const [rMultiple, setRMultiple] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);

  useEffect(() => {
    if (!trade) return;
    setOutcome(trade.outcome);
    setRMultiple(trade.r_multiple == null ? '' : String(trade.r_multiple));
    setSettling(false);
    setConfirmDelete(false);
    setZoomed(null);
  }, [trade]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function settle() {
    if (!trade) return;
    setBusy(true);
    await fetch(`/api/trades/${trade.id}/settle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, r_multiple: rMultiple.trim() === '' ? null : Number(rMultiple) }),
    });
    setBusy(false);
    onChanged();
    onClose();
  }

  /**
   * Soft. The row and its screenshot stay; the Trash can put it back. The
   * trade I most want to delete at 4pm is usually the one worth reading on
   * Sunday.
   */
  async function remove() {
    if (!trade) return;
    setBusy(true);
    await fetch(`/api/trades/${trade.id}`, { method: 'DELETE' });
    setBusy(false);
    onChanged();
    onClose();
  }

  /** Same setup, second entry. The outcome is deliberately not copied. */
  async function duplicate() {
    if (!trade) return;
    setBusy(true);
    await fetch(`/api/trades/${trade.id}/duplicate`, { method: 'POST' });
    setBusy(false);
    onChanged();
    onClose();
  }

  return (
    <AnimatePresence>
      {trade && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none', transition: scrimExit }}
            transition={spring}
            onClick={onClose}
            className="fixed inset-0 z-40"
            // A modal scrim darkens in both themes — that is what makes the
            // panel read as lifted off the board.
            style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(6px)' }}
          />

          <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-6">
            <motion.div
              layoutId={`trade-${trade.id}`}
              transition={springSoft}
              className="glass pointer-events-auto max-h-full w-full max-w-[54rem] overflow-y-auto rounded-[calc(28px*var(--rk))]"
              style={{
                borderColor: `rgb(${OUTCOME_COLOR[trade.outcome]} / 0.45)`,
                boxShadow: `var(--shadow-panel), 0 0 60px -16px rgb(${OUTCOME_COLOR[trade.outcome]} / 0.5)`,
                // A reading surface, not a window: the board behind this panel
                // was bleeding through the explanation text.
                background: 'color-mix(in srgb, var(--bg-raised) 88%, transparent)',
              }}
            >
              {/* Entry, stop and target live on the chart rather than in the
                  form, so the chart has to be openable. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/screenshots/${trade.screenshot_path}`}
                alt="Chart — click to zoom"
                onClick={() => setZoomed(`/api/screenshots/${trade.screenshot_path}`)}
                className="max-h-[46vh] w-full cursor-zoom-in object-contain"
                style={{ background: 'var(--letterbox)' }}
              />

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.06 }}
                className="p-7"
              >
                <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold tracking-tight">{trade.reason}</h2>
                    <p className="mt-1 text-[12px]" style={{ color: 'var(--text-dim)' }}>
                      {new Date(trade.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      {' · '}{trade.instrument} {trade.direction} · {trade.session}
                      {trade.macro_time && ' · macro'}
                    </p>
                  </div>
                  <GradeBadge
                    total={trade.checklist_earned}
                    max={trade.checklist_possible}
                    size="md"
                    triggerFired={trade.trigger_fired}
                  />
                </div>

                {/* The plan's hardest rule, stated where it was broken. The
                    0/20 on Phase 3 below says the same thing, but only if you
                    already know what Phase 3 is for. */}
                {trade.outcome !== 'Not taken' && !trade.trigger_fired && (
                  <p
                    className="mb-5 rounded-[calc(14px*var(--rk))] px-4 py-2.5 text-[12px] leading-snug"
                    style={{
                      color: 'rgb(var(--outcome-loss))',
                      background: 'rgb(var(--outcome-loss) / 0.10)',
                      border: '1px solid rgb(var(--outcome-loss) / 0.30)',
                    }}
                  >
                    Phase 3 never fired on this one. By the plan, this entry does not exist.
                  </p>
                )}

                <p className="mb-6 whitespace-pre-wrap text-[13px] leading-relaxed">{trade.explanation}</p>

                {trade.lesson && (
                  <div className="mb-6 rounded-[calc(16px*var(--rk))] p-4"
                    style={{ background: 'var(--glass-fill)', border: '1px solid var(--glass-stroke)' }}>
                    <div className="mb-1.5 text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
                      Lesson
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{trade.lesson}</p>
                  </div>
                )}

                {/* Only what was actually true. A wall of eleven greyed-out
                    rows tells you nothing; the ones you ticked do. */}
                <div className="mb-6 flex flex-wrap gap-x-4 gap-y-2">
                  {CONTEXT_FLAG_LIST.filter((flag) => trade[flag.key]).map((flag) => (
                    <Check key={flag.key} on label={flag.label} />
                  ))}
                  {!CONTEXT_FLAG_LIST.some((flag) => trade[flag.key]) && (
                    <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      No context noted.
                    </span>
                  )}
                </div>

                {/*
                  The whole checklist, ticked and unticked alike.
                  Context flags above show only what was true because absence
                  there means nothing — here the missing points ARE the
                  diagnosis, so a blank row has to be visible.
                */}
                <div className="mb-3 grid gap-3 sm:grid-cols-3">
                  {CHECKLIST_PHASES.map((phase) => {
                    const earned = phase.items.reduce((n, i) => n + (trade[i.key] === true ? i.points : 0), 0);
                    // Points that were on the table on this trade, not in the plan.
                    const possible = phase.items.reduce((n, i) => n + (trade[i.key] === null ? 0 : i.points), 0);
                    return (
                      <Group key={phase.phase}>
                        <div className="flex items-baseline justify-between gap-3 pb-1 pt-1.5">
                          <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
                            {phase.phase}
                          </span>
                          <span className="tabular-nums text-[10px]" style={{ color: 'var(--text-dim)' }}>
                            {earned}/{possible}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 pb-2 pt-1">
                          {phase.items.map((item) => (
                            <Check key={item.key} on={trade[item.key]} label={item.label} />
                          ))}
                        </div>
                      </Group>
                    );
                  })}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Group>
                    <Row
                      label="Account"
                      value={trade.account + (trade.account_label ? ` · ${trade.account_label}` : '')}
                    />
                    <Row
                      label="Stage"
                      value={trade.status + (trade.graded_post_hoc ? ' · graded after the fact' : ' · graded at entry')}
                    />
                    <Row label="Setup" value={trade.setup_type} />
                    <Row label="HTF bias" value={trade.htf_bias} />
                    <Row label="Premium / discount" value={trade.premium_discount} />
                    <Row label="Target" value={trade.target_type} />
                    <Row label="Entry / TP / SL"
                      value={`${trade.entry_price ?? '—'} · ${trade.take_profit ?? '—'} · ${trade.stop_loss ?? '—'}`} />
                  </Group>
                  <Group>
                    {/*
                      Tri-state, rendered as three states. Collapsing null to
                      "No" here would put a claim on the record that was never
                      made — the same bug as the form defaulting it to "Yes",
                      just pointing the other way.
                    */}
                    <Row
                      label="Said rules followed"
                      value={
                        <span
                          style={{
                            color: trade.followed_rules === null ? 'var(--text-faint)'
                              : trade.followed_rules ? 'rgb(var(--outcome-win))'
                              : 'rgb(var(--outcome-loss))',
                          }}
                        >
                          {trade.followed_rules === null ? 'Unanswered' : trade.followed_rules ? 'Yes' : 'No'}
                        </span>
                      }
                    />
                    {/* What the checklist says, which is what the stats use. */}
                    <Row
                      label="Checklist says"
                      value={
                        <span style={{
                          color: derivedAdherence(trade) ? 'rgb(var(--outcome-win))' : 'rgb(var(--outcome-loss))',
                        }}>
                          {derivedAdherence(trade) ? 'Rules followed' : 'Rule broken'}
                        </span>
                      }
                    />
                    {/* The grade you gave it before vs. after. Disagreement is
                        the point — see the grade-honesty panel in Stats. */}
                    <Row
                      label="Re-grade, honestly"
                      value={trade.regrade ? `${trade.grade_letter} → ${trade.regrade}` : '—'}
                    />
                    <Row
                      label="Mistakes"
                      value={trade.mistake_tags.length ? trade.mistake_tags.join(', ') : (trade.mistake_tag ?? '—')}
                    />
                    <Row label="Contracts / P&L / stop"
                      value={`${trade.contracts ?? '—'} · ${
                        trade.pnl_dollars == null
                          ? '—'
                          : `${trade.pnl_dollars < 0 ? '−' : ''}$${Math.abs(trade.pnl_dollars).toFixed(2)}`
                      } · ${trade.stop_points ?? '—'}pt`} />
                  </Group>
                </div>

                {/* A setup you passed on still costs something. The plan calls
                    this its most important sheet. */}
                {trade.outcome === 'Not taken' && (
                  <div className="mt-3">
                    <Group>
                      <Row label="Why it was skipped" value={trade.skip_reason ?? '—'} />
                      <Row
                        label="Would have hit TP"
                        value={trade.would_have_hit_tp == null ? 'Unchecked' : trade.would_have_hit_tp ? 'Yes' : 'No'}
                      />
                      <Row
                        label="R left on the table"
                        value={
                          trade.r_left_on_table == null ? '—' : (
                            <span
                              className="tabular-nums"
                              style={{ color: trade.r_left_on_table > 0 ? 'rgb(var(--outcome-loss))' : undefined }}
                            >
                              {trade.r_left_on_table > 0 ? '+' : ''}{trade.r_left_on_table.toFixed(1)}R
                            </span>
                          )
                        }
                      />
                    </Group>
                  </div>
                )}

                {/* The other charts: HTF context, entry, result. Added here
                    rather than at capture time, because they are usually
                    available at different moments from the entry. */}
                <div className="mt-6">
                  <div className="mb-2.5 text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
                    Charts
                  </div>
                  <ShotGallery tradeId={trade.id} />
                </div>

                <FlagList trade={trade} onChanged={onChanged} />
                <History tradeId={trade.id} />

                <div className="mt-10 flex flex-wrap items-center gap-3">
                  <AnimatePresence mode="wait">
                    {settling ? (
                      <motion.div key="settle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} transition={spring} className="flex flex-1 flex-wrap items-center gap-3">
                        <div className="w-44"><Select value={outcome} onChange={setOutcome} options={OUTCOMES} /></div>
                        <Input
                          type="number" step="0.1" placeholder="R multiple" value={rMultiple}
                          onChange={(e) => setRMultiple(e.target.value)}
                          accent="var(--outcome-win)"
                          className="w-32"
                        />
                        <Button variant="primary" accent="var(--outcome-win)" onClick={settle} disabled={busy}>
                          {busy ? 'Saving…' : 'Save'}
                        </Button>
                        <Button onClick={() => setSettling(false)}>Cancel</Button>
                      </motion.div>
                    ) : (
                      <motion.div key="actions" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} transition={spring} className="flex flex-1 flex-wrap items-center gap-3">
                        <span className="tabular-nums text-[13px] font-semibold"
                          style={{ color: `rgb(${OUTCOME_COLOR[trade.outcome]})` }}>
                          {trade.outcome}
                          {trade.r_multiple != null && ` · ${trade.r_multiple > 0 ? '+' : ''}${trade.r_multiple.toFixed(1)}R`}
                        </span>
                        <Button onClick={() => setSettling(true)}>Settle outcome</Button>
                        <a href={`/new?edit=${trade.id}`} className="outline-none">
                          <Button tabIndex={-1}>Edit</Button>
                        </a>
                        <Button onClick={duplicate} disabled={busy}>Duplicate</Button>
                        <div className="ml-auto">
                          {confirmDelete ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                                Move to Trash? It stays restorable.
                              </span>
                              <Button variant="danger" onClick={remove} disabled={busy}>Trash</Button>
                              <Button onClick={() => setConfirmDelete(false)}>Keep</Button>
                            </div>
                          ) : (
                            <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          </div>

          <Lightbox src={zoomed} alt="Chart" onClose={() => setZoomed(null)} />
        </>
      )}
    </AnimatePresence>
  );
}
