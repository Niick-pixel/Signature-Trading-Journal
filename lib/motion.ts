import type { Transition } from 'framer-motion';

/**
 * Every animation in Signature is a spring (a scrim leaving is the one
 * exception, below). Nothing fades linearly. These are the only transitions
 * the app should reach for.
 */

/*
  Tuned soft. Every preset sits close to critical damping — damping ratio
  ζ = damping / (2·√(stiffness·mass)) between about 0.75 and 1 — so things
  arrive and settle rather than wobble. The old "bouncy" spring was ζ ≈ 0.4
  and visibly rang on every grade change; nothing here overshoots by more than
  a few percent. Softness comes from lower stiffness (a longer, gentler glide),
  not from bounce.
*/

/** The baseline. When in doubt, use this. ζ ≈ 0.93 */
export const spring: Transition = { type: 'spring', stiffness: 280, damping: 31, mass: 1 };

/** Quicker — presses, toggles and small state flips. ζ ≈ 0.95 */
export const springSnappy: Transition = { type: 'spring', stiffness: 420, damping: 39, mass: 1 };

/** Entrances and the live grade badge: a gentle arrival with the faintest settle. ζ ≈ 0.76 */
export const springBouncy: Transition = { type: 'spring', stiffness: 300, damping: 26, mass: 1 };

/** Heavier and slower — panels, dialogs, anything with size. ζ ≈ 1 */
export const springSoft: Transition = { type: 'spring', stiffness: 190, damping: 27, mass: 1 };

/** Whiteboard cards settling into a new layout. ζ ≈ 0.9 */
export const springLayout: Transition = { type: 'spring', stiffness: 220, damping: 27, mass: 1 };

/**
 * The one CSS/WAAPI curve, for the few animations that are not springs (the
 * board regrouping, the theme wipe, page entrances): an expo-out — quick to
 * start, very slow to land, so nothing arrives with a thud.
 */
export const EASE_SOFT = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Buttons compress on press — barely. */
export const press = { scale: 0.975 } as const;

/** Standard entrance: rise and scale in, never a linear fade. */
export const riseIn = {
  initial: { opacity: 0, y: 6, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -3, scale: 0.99 },
} as const;

/** Dropdown options stagger in behind the menu's own spring. */
export const stagger = (index: number): Transition => ({
  ...springSnappy,
  delay: index * 0.022,
});

/**
 * How a scrim leaves.
 *
 * A dimming layer is a modal's only job while it is up, and dead weight the
 * instant it is not. On a spring its exit ran for well over a second, during
 * which it still swallowed every click — press Escape and the board underneath
 * was inert for a beat. Overlays fade out fast and stop taking the pointer the
 * moment they start leaving.
 */
export const scrimExit = { duration: 0.16, ease: [0.4, 0, 0.2, 1] } as const;
