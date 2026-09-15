import { listTrades } from '@/db/trades';
import { ACCOUNT_VALUES, MIN_SAMPLE, REASON_HUE, type Account } from '@/lib/domain';
import { reasonAccent } from '@/lib/layout';
import {
  accountsInUse, aggregate, byConfidence, byGradeBand, checklistEdge, discipline, edge,
  equityCurves, excursion, forAccount, gradeHonesty, hesitation, money, passedSetups,
  preGradedOnly, rByMistakeTag, rByReason,
} from '@/lib/stats';
import { EquityChart } from '@/components/stats/EquityChart';
import { AccountSwitcher } from '@/components/stats/AccountSwitcher';
import { Line, Panel, SignedBars, Stat, type BarRow } from '@/components/stats/Bars';
import { TitleBar } from '@/components/shell/TitleBar';

export const dynamic = 'force-dynamic';

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
// A typographic minus, not a hyphen — it matches the digit width, so a column
// of R values lines up instead of stepping in and out by a pixel.
const signed = (v: number, dp: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(dp)}R`;
const r = (v: number | null) => (v == null ? '—' : signed(v, 1));
const r2 = (v: number | null) => (v == null ? '—' : signed(v, 2));
/*
  To the cent, always.

  These were rounded to whole dollars, which is fine for a headline and wrong
  for a journal: a $412.37 loss is not a $412 loss, and the difference compounds
  quietly across a month. What the account did is a fact, and a fact reported to
  the nearest dollar is a rounded fact.
*/
const usd = (v: number) =>
  `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

export default async function StatsPage(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> },
) {
  const all = listTrades();
  const accounts = accountsInUse(all);

  // One account at a time. Defaults to whichever one actually has trades in
  // it, never to a mixed total — backtest R and live R must never sum.
  const asked = (await searchParams).account;
  const requested = typeof asked === 'string' ? asked : undefined;
  const account: Account | 'All' = requested === 'All'
    ? 'All'
    : (ACCOUNT_VALUES as readonly string[]).includes(requested ?? '')
      ? (requested as Account)
      : (accounts[0]?.account ?? 'Backtest (FX Replay)');

  const scoped = forAccount(all, account);

  /*
    Hindsight-graded and pre-graded trades cannot be pooled without lying to
    myself: a grade given after I already knew the result is not evidence that
    the grading works. ?pregraded=1 drops everything logged in one shot.
  */
  const preOnly = (await searchParams).pregraded === '1';
  const trades = preOnly ? preGradedOnly(scoped) : scoped;
  const agg = aggregate(trades);
  const m = money(trades);
  const e = edge(trades);
  const d = discipline(trades);
  const honesty = gradeHonesty(trades);
  const hes = hesitation(trades);
  const curves = equityCurves(trades);
  const bands = byGradeBand(trades);
  const conf = byConfidence(trades);
  const exc = excursion(trades);
  const passed = passedSetups(trades);
  const tagRows: BarRow[] = rByMistakeTag(trades).map((t) => ({
    label: t.tag, value: t.totalR, display: r(t.totalR), meta: `· ${t.count}`,
  }));

  const reasonRows: BarRow[] = rByReason(trades).map((g) => ({
    label: g.key, value: g.stats.totalR, display: r(g.stats.totalR),
    meta: `· ${g.stats.count}`, swatch: reasonAccent(g.key),
  }));







  // Every row here is a loss, so they all take the loss colour. Tinting them by
  // reason hue put a green bar in a panel about what is costing you.

  // Rule-following against rule-breaking. Two bars, because the comparison is
  // the whole point — a rule-breaking total on its own means nothing.

  // Negative, because R you did not take is R you did not make — a green bar
  // here would read as a win.
  const skipRows: BarRow[] = hes.byReason.map((g) => ({
    label: g.reason, value: -g.rLeft, display: g.rLeft ? `−${g.rLeft.toFixed(1)}R` : '—',
    meta: `· ${g.count} skipped`,
  }));

  // Only items with trades on both sides can be compared at all.
  const itemRows: BarRow[] = checklistEdge(trades)
    .filter((i) => i.lift != null)
    .sort((a, b) => (b.lift as number) - (a.lift as number))
    .map((i) => ({
      label: `${i.label} (${i.points})`,
      value: i.lift as number,
      display: r2(i.lift),
      meta: `· ${i.withCount} with · ${i.withoutCount} without`,
    }));

  return (
    <div className="flex h-dvh flex-col">
      <TitleBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[68rem] px-6 pb-20 pt-4">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-[22px] font-semibold tracking-tight">Stats</h1>
            <div className="flex flex-wrap items-center gap-3">
              <AccountSwitcher available={accounts} current={account} />
              <a
                href={`/stats?${new URLSearchParams({
                  ...(account === 'All' ? {} : { account }),
                  ...(preOnly ? {} : { pregraded: '1' }),
                })}`}
                className="rounded-full border px-3.5 py-1.5 text-[12px] font-medium"
                style={{
                  borderColor: preOnly ? 'rgb(var(--accent) / 0.55)' : 'var(--glass-stroke)',
                  background: preOnly ? 'rgb(var(--accent) / 0.12)' : 'var(--glass-fill)',
                  color: preOnly ? 'rgb(var(--accent))' : 'var(--text-dim)',
                }}
                title="Exclude trades that were logged in one shot after the fact"
              >
                Pre-graded only
              </a>
            </div>
          </header>

          {trades.length === 0 ? (
            <div className="glass rounded-[24px] p-8 text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
              Nothing to measure yet.
            </div>
          ) : (
            <div className="space-y-5">
              {/*
              {/*
                Twenty-five panels, cut to eleven.

                Most of what was here described the record rather than
                interrogating it: R by instrument, by session, by setup, an R
                distribution, a heatmap of which hour I trade. All true, and
                none of it anything I would do differently on Monday for having
                read it. What is left answers one of three questions — did I
                follow the plan, is the plan actually an edge, and where am I
                lying to myself — and each one has an action attached to it.
              */}
              <Panel
                title="Adherence"
                note="Share of the SCORED trades where the checklist says the rules were followed — trigger fired, 70% or more of the boxes that APPLIED, no mistake tagged. Derived, never self-reported. A box marked N/A takes its points out of the denominator instead of counting as a miss, and a trade whose checklist was left blank counts as neither followed nor broken."
              >
                <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                  <div>
                    <div
                      className="tabular-nums text-[46px] font-semibold leading-none tracking-tight"
                      style={{
                        color: d.adherenceRate == null ? 'var(--text-faint)'
                          : d.adherenceRate >= 0.7 ? 'rgb(var(--outcome-win))'
                          : d.adherenceRate >= 0.4 ? 'rgb(var(--accent))'
                          : 'rgb(var(--outcome-loss))',
                      }}
                    >
                      {pct(d.adherenceRate)}
                    </div>
                    <div className="mt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      n = {d.followed.count + d.broken.count}
                      {d.unscored.count > 0 && ` · ${d.unscored.count} not scored`}
                      {(d.followed.count + d.broken.count) < 20 && ' — too few to conclude anything'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-[12rem]">
                    <Line label="Followed the rules" value={`${d.followed.count} · ${r(d.followed.totalR)}`} tone="win" />
                    <Line label="Broke a rule" value={`${d.broken.count} · ${r(d.broken.totalR)}`} tone="loss" />
                    {d.unscored.count > 0 && (
                      <Line
                        label="Not scored"
                        value={`${d.unscored.count} · ${r(d.unscored.totalR)}`}
                      />
                    )}
                  </div>
                </div>
              </Panel>

              <Panel
                title="Following the rules vs breaking them"
                note="Cumulative R, in the order the trades happened, split by what the checklist says about each one."
              >
                <EquityChart followed={curves.followed} broken={curves.broken} />
              </Panel>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/*
                  No balance tile here. Where the account stands lives on the
                  Calendar, next to the days that moved it and the button that
                  funds it; repeating it on Stats gave the same number two homes
                  and no single place that owns it.
                */}
                <Stat
                  label="Net P&L"
                  value={m.priced ? usd(m.net) : '—'}
                  sub={m.priced ? `${usd(m.won)} won · ${usd(m.lost)} lost` : 'No money recorded yet'}
                  tone={m.net > 0 ? 'win' : m.net < 0 ? 'loss' : null}
                />
                <Stat
                  label="Net R"
                  value={r(agg.totalR)}
                  sub={`+${e.rWon.toFixed(1)}R won · −${e.rLost.toFixed(1)}R lost`}
                  tone={agg.totalR > 0 ? 'win' : agg.totalR < 0 ? 'loss' : null}
                />
                <Stat
                  label="Win rate"
                  value={pct(agg.winRate)}
                  sub={`${agg.wins}W · ${agg.losses}L · ${agg.breakeven + agg.scratched} flat`}
                />
                <Stat
                  label="Expectancy"
                  value={r2(e.expectancy)}
                  sub="Average R per trade taken"
                  tone={(e.expectancy ?? 0) > 0 ? 'win' : (e.expectancy ?? 0) < 0 ? 'loss' : null}
                />
                {/*
                  Gross won over gross lost. One number, and the one that says
                  whether the winners are actually paying for the losers — a
                  60% win rate under 1.0 is a losing strategy with good manners.
                */}
                <Stat
                  label="Profit factor"
                  value={e.profitFactor == null ? '—' : e.profitFactor.toFixed(2)}
                  sub={e.profitFactor == null ? 'Needs a win and a loss'
                    : e.profitFactor >= 1 ? 'Winners cover the losers' : 'Losers outweigh the winners'}
                  tone={e.profitFactor == null ? null : e.profitFactor >= 1 ? 'win' : 'loss'}
                />
              </div>

              {/* Where I am lying to myself. */}
              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title="Self-assessment gap"
                  note="How often I said I followed every rule and the checklist disagreed. That gap closing is real progress — and it cannot be faked by being hard on myself, which shows up as the row below it instead."
                >
                  {d.gap.answered === 0 ? (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      Nothing answered yet. The question is unset on every trade, which is the honest
                      state — stats read the checklist regardless, so leaving it blank costs nothing.
                    </p>
                  ) : (
                    <>
                      <div
                        className="tabular-nums text-[34px] font-semibold leading-none tracking-tight"
                        style={{
                          color: (d.gap.overclaimRate ?? 0) > 0.2
                            ? 'rgb(var(--outcome-loss))' : 'rgb(var(--outcome-win))',
                        }}
                      >
                        {pct(d.gap.overclaimRate)}
                      </div>
                      <p className="mb-3 mt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                        said yes when the checklist said no · n = {d.gap.answered}
                        {d.gap.answered < 20 && ' — too few to conclude anything'}
                      </p>
                      <Line label="Agreed" value={String(d.gap.agreed)} tone="win" />
                      <Line label="Overclaimed" value={String(d.gap.overclaimed)}
                        tone={d.gap.overclaimed ? 'loss' : null} />
                      <Line label="Underclaimed" value={String(d.gap.underclaimed)} />
                      <Line label="Never answered" value={String(d.gap.unanswered)} />
                    </>
                  )}
                </Panel>
                <Panel
                  title="Grade honesty"
                  note="The score at entry against the re-grade after the close. A pattern of dropping means the boxes are being ticked to reach a number."
                >
                  {honesty.regraded === 0 ? (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      No trades re-graded yet. Without a re-grade there is nothing to check the checklist against.
                    </p>
                  ) : (
                    <>
                      <Line label="Re-graded" value={`${honesty.regraded} of ${agg.count}`} />
                      <Line label="Graded too kindly" value={String(honesty.inflated)}
                        tone={honesty.inflated ? 'loss' : 'win'} />
                      <Line label="Held up" value={String(honesty.matched)} tone="win" />
                      <Line label="Graded too harshly" value={String(honesty.understated)} />
                      <Line
                        label="Average re-grade"
                        value={honesty.averageDrop == null ? '—' : honesty.averageDrop === 0
                          ? 'Unchanged'
                          : `${Math.abs(honesty.averageDrop).toFixed(1)} steps ${honesty.averageDrop > 0 ? 'lower' : 'higher'}`}
                        tone={(honesty.averageDrop ?? 0) > 0 ? 'loss' : 'win'}
                      />
                      {honesty.worst.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {honesty.worst.map((w) => (
                            <div key={w.trade.id} className="flex items-baseline justify-between gap-3 text-[11px]">
                              <span className="truncate" style={{ color: 'var(--text-dim)' }}>
                                {new Date(w.trade.date).toLocaleDateString()} · {w.trade.reason}
                              </span>
                              <span className="shrink-0 tabular-nums" style={{ color: 'rgb(var(--outcome-loss))' }}>
                                {w.from} → {w.to}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </Panel>
              </div>

              {/* Whether the plan is an edge, and which parts of it are. */}
              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title="Win rate by grade band"
                  note="Does the checklist predict anything? If these do not climb, it does not — and n is on every row because four trades can show any number at all."
                >
                  <div className="space-y-1">
                    {bands.map((b) => (
                      <div key={b.label} className="flex items-baseline justify-between gap-3 py-1">
                        <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>{b.label}</span>
                        <span className="flex items-baseline gap-3">
                          <span className="tabular-nums text-[12px] font-semibold">{pct(b.winRate)}</span>
                          <span className="tabular-nums text-[11px]" style={{ color: 'var(--text-faint)' }}>
                            {r2(b.expectancy)}
                          </span>
                          <span
                            className="tabular-nums text-[11px]"
                            style={{ color: b.thin ? 'rgb(var(--amber))' : 'var(--text-faint)' }}
                          >
                            n {b.taken}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  {bands.some((b) => b.thin) && (
                    <p className="mt-3 text-[11px] leading-snug" style={{ color: 'rgb(var(--amber))' }}>
                      Bands marked in amber have fewer than {MIN_SAMPLE} taken trades. Those numbers
                      are noise — do not change anything because of them.
                    </p>
                  )}
                </Panel>
                <Panel
                  title="Is each box earning its weight?"
                  note="Average R with the box ticked, minus average R without it. A 20-point item with no lift, or a 5-point item with a large one, is an argument that the weights are wrong."
                >
                  {itemRows.length ? <SignedBars rows={itemRows} /> : (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      Not enough trades yet — each box needs trades on both sides of it to be compared.
                    </p>
                  )}
                </Panel>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="R by reason" note="Net, worst first. This is the list that changes how you trade.">
                  <SignedBars rows={reasonRows} />
                </Panel>
                <Panel title="R by mistake" note="Every tag on every trade, worst first. A tag on a winner still counts.">
                  {tagRows.length ? <SignedBars rows={tagRows} /> : (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Nothing tagged yet.</p>
                  )}
                </Panel>
              </div>

              {/* What to change. Each of these names a behaviour. */}
              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title="Management or selection?"
                  note="Whether the losers were ever winners. If most of them were up a full R before stopping out, the entries were fine and the exits were not — and no win rate will ever tell you that."
                >
                  {exc.losersWithData === 0 ? (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      Nothing recorded yet. &ldquo;Reached +1R before the stop?&rdquo; is an optional
                      question on the trade form.
                    </p>
                  ) : (
                    <>
                      <Line
                        label="Losers that reached +1R first"
                        value={`${exc.losersThatReached1R} of ${exc.losersWithData}`}
                        tone={exc.losersThatReached1R > exc.losersWithData / 2 ? 'loss' : 'win'}
                      />
                      {exc.losersThatReached1R > exc.losersWithData / 2 ? (
                        <p className="mt-2.5 text-[11px] leading-snug" style={{ color: 'rgb(var(--amber))' }}>
                          More than half your losers were up a full R before they stopped you out. That is
                          a management problem, not a selection one.
                        </p>
                      ) : (
                        <p className="mt-2.5 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                          Most losers never went your way. Those are selection, not management — the exits
                          are not what is costing you.
                        </p>
                      )}
                    </>
                  )}
                </Panel>
                <Panel
                  title="What hesitating cost"
                  note="A skipped setup that would have won is a real loss that never reaches the P&L — which is exactly why it goes unexamined."
                >
                  {hes.skipped === 0 ? (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      No setups passed on yet.
                    </p>
                  ) : (
                    <>
                      <Line label="Setups skipped" value={String(hes.skipped)} />
                      <Line label="Actually checked afterwards"
                        value={`${hes.checked} of ${hes.skipped}`}
                        tone={hes.checked === hes.skipped ? 'win' : null} />
                      <Line label="Would have won" value={String(hes.wouldHaveWon)} tone="loss" />
                      <Line label="Would have lost" value={String(hes.wouldHaveLost)} tone="win" />
                      <Line label="R left on the table"
                        value={hes.rLeft ? `−${hes.rLeft.toFixed(1)}R` : '0.0R'}
                        tone={hes.rLeft ? 'loss' : 'win'} />
                      <Line label="R the skips saved you"
                        value={`+${hes.rAvoided.toFixed(1)}R`} tone="win" />
                      {skipRows.length > 0 && (
                        <div className="mt-3">
                          <SignedBars rows={skipRows} />
                        </div>
                      )}
                      {hes.checked < hes.skipped && (
                        <p className="mt-2.5 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                          {hes.skipped - hes.checked} skipped setup
                          {hes.skipped - hes.checked === 1 ? ' has' : 's have'} never been checked. Until they are,
                          the number above is the floor, not the cost.
                        </p>
                      )}
                    </>
                  )}
                </Panel>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title="Calibration"
                  note="Win rate by the confidence you claimed before you knew. If the 5s do not beat the 2s, the read is noise and size stays flat until it isn't."
                >
                  {conf.length === 0 ? (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      No confidence recorded yet. It only means anything if it is set before the outcome.
                    </p>
                  ) : (
                    conf.map((c) => (
                      <div key={c.label} className="flex items-baseline justify-between gap-3 py-1">
                        <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
                          {'★'.repeat(Number(c.label))}
                        </span>
                        <span className="flex items-baseline gap-3">
                          <span className="tabular-nums text-[12px] font-semibold">{pct(c.winRate)}</span>
                          <span className="tabular-nums text-[11px]" style={{ color: c.thin ? 'rgb(var(--amber))' : 'var(--text-faint)' }}>
                            n {c.taken}
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </Panel>
              </div>

              {preOnly && (
                <p className="pt-1 text-center text-[11px]" style={{ color: 'rgb(var(--accent))' }}>
                  Showing only trades graded before the outcome was known — {trades.length} of {scoped.length}.
                </p>
              )}

              {agg.passed > 0 && (
                <p className="pt-1 text-center text-[11px]" style={{ color: 'var(--text-faint)' }}>
                  {agg.passed} setup{agg.passed === 1 ? '' : 's'} passed on — journalled, but never counted in any
                  number above.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
