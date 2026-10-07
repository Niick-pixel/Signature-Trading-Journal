import { TAKE_IT_THRESHOLD, isTaken } from './domain';
import type { Trade } from './types';

/**
 * Contradictions in a saved record.
 *
 * These are descriptive, never blocking. Nothing here can stop a save, ask
 * "are you sure", or make a trade unsaveable — a contradictory record of what
 * actually happened is worth infinitely more than a tidy record that was never
 * written. The flag just makes the contradiction visible later, when I am in a
 * state to look at it.
 *
 * Each one is dismissable, because sometimes the contradiction is real and I
 * know exactly why.
 */
export const FLAG_KEYS = [
  'claimed_rules_no_trigger',
  // Retired: no flag is raised under it any more (tags are notes, not rule
  // breaks). Kept so dismissals already stored against it still validate.
  'claimed_rules_with_mistakes',
  'no_target_named',
  'direction_against_pd',
  'passed_a_good_setup',
  'took_a_bad_setup',
  'settled_without_risk',
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

export interface Flag {
  key: FlagKey;
  label: string;
  detail: string;
}

/**
 * Every rule, as a predicate over a saved trade. Written so each one can be
 * read on its own and argued with.
 */
const RULES: Array<{ key: FlagKey; label: string; test: (t: Trade) => string | null }> = [
  {
    key: 'claimed_rules_no_trigger',
    label: 'Said rules followed, but Phase 3 never fired',
    test: (t) => (t.followed_rules === true && !t.trigger_fired)
      ? 'Without both Phase 3 answers the plan says this entry does not exist, so it cannot also be a trade that followed every rule.'
      : null,
  },
  // No flag for "said rules followed, but tagged something went wrong": the
  // tags note what went against a trade, often the market, and following
  // every rule while the market does not cooperate is no contradiction.
  {
    key: 'no_target_named',
    label: 'Taken with no target named',
    // `=== false` rather than falsy: a box marked N/A was not answered "no",
    // and flagging it would be the app asserting from silence again.
    test: (t) => (isTaken(t.outcome) && (t.target_type === 'Other' || t.chk_targets_clear === false))
      ? 'A target you cannot name is a target you cannot be wrong about.'
      : null,
  },
  {
    key: 'direction_against_pd',
    label: 'Direction against premium / discount',
    test: (t) => {
      if (t.direction === 'Long' && t.premium_discount === 'Premium') {
        return 'Long from premium — buying where the discount buyers are taking profit.';
      }
      if (t.direction === 'Short' && t.premium_discount === 'Discount') {
        return 'Short from discount — selling into where the buyers are.';
      }
      return null;
    },
  },
  {
    key: 'passed_a_good_setup',
    label: 'Passed on a setup that met the standard',
    test: (t) => (!isTaken(t.outcome) && t.checklist_score >= TAKE_IT_THRESHOLD && t.trigger_fired)
      ? `Scored ${t.checklist_score} with the trigger fired. By the plan, taking it was the rule.`
      : null,
  },
  {
    key: 'took_a_bad_setup',
    label: 'Taken below the standard',
    test: (t) => (isTaken(t.outcome) && t.checklist_score < TAKE_IT_THRESHOLD)
      ? `Scored ${t.checklist_score}, under the ${TAKE_IT_THRESHOLD} line.`
      : null,
  },
  {
    key: 'settled_without_risk',
    label: 'Settled with no risk recorded',
    test: (t) => (isTaken(t.outcome) && t.risk_dollars == null && t.risk_percent == null)
      ? 'Without a risk amount this trade cannot appear in any money figure.'
      : null,
  },
];

/** Every contradiction in a trade, dismissed ones included. */
export function flagsFor(trade: Trade): Flag[] {
  const out: Flag[] = [];
  for (const rule of RULES) {
    const detail = rule.test(trade);
    if (detail) out.push({ key: rule.key, label: rule.label, detail });
  }
  return out;
}

/** The ones still asking for an answer — what the amber dot counts. */
export function openFlagsFor(trade: Trade): Flag[] {
  const dismissed = new Set(Object.keys(trade.dismissed_flags ?? {}));
  return flagsFor(trade).filter((f) => !dismissed.has(f.key));
}

export function hasOpenFlags(trade: Trade): boolean {
  return openFlagsFor(trade).length > 0;
}
