'use client';

/**
 * Moving between screens, animated.
 *
 * The App Router swaps a page out the instant the next one arrives, so a page
 * can animate in but never out — tabs cut rather than move, and the New trade
 * window vanished on close instead of closing. The View Transitions API fixes
 * both: the browser keeps a picture of the old screen, the new one renders
 * underneath, and the two are animated against each other.
 *
 * Every internal link and every programmatic navigation goes through here:
 * <NavTransitions/> catches link clicks, and code calls navigate(). Only a
 * change of screen animates — a filter or a month (same path, new query)
 * swaps in place, because a fade on every filter click is a fade too many.
 *
 * Three shapes, all subtle, all with a little spring at the end:
 *   page    the old screen fades out quickly, the new one rises in 8px with a
 *           faint overshoot. The whiteboard only fades — it is the one screen
 *           that must never be seen to move.
 *   open    the New trade window rises and scales up from just below.
 *   close   it sinks and shrinks away as the board fades back in.
 *
 * Reduced motion (the setting or the OS) skips all of it.
 */

import { EASE_BOUNCE, EASE_SOFT as EASE_OUT } from './motion';

const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

type Push = (href: string) => void;
type Kind = 'page' | 'open' | 'close';

let push: Push | null = null;
let arrive: (() => void) | null = null;

/** Wired once by <NavTransitions/> with the router. */
export function registerNavigator(p: Push) { push = p; }

/** Called by <NavTransitions/> when the new path has rendered. */
export function arrived() { arrive?.(); arrive = null; }

const still = () => document.documentElement.dataset.reduceMotion === 'true'
  || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pathOf = (href: string) => new URL(href, window.location.href).pathname;

function kindFor(from: string, to: string): Kind {
  if (to === '/new') return 'open';
  if (from === '/new') return 'close';
  return 'page';
}

type VT = { ready: Promise<void>; finished: Promise<void> };
type StartVT = (cb: () => Promise<void>) => VT;

/** Go to `href`, animated if it is a different screen. */
export function navigate(href: string): void {
  if (!push) { window.location.href = href; return; }
  const from = window.location.pathname;
  const to = pathOf(href);
  const start = (document as Document & { startViewTransition?: StartVT }).startViewTransition?.bind(document);
  if (to === from || !start || still()) { push(href); return; }

  const kind = kindFor(from, to);
  const root = document.documentElement;
  root.dataset.nav = kind;
  const t = start(() => new Promise<void>((resolve) => {
    // Resolved by arrived(); the cap keeps a slow server from freezing the
    // old picture on screen — past it the new page simply appears.
    const cap = window.setTimeout(resolve, 2500);
    arrive = () => { window.clearTimeout(cap); resolve(); };
    push!(href);
  }));
  let playing: Animation[] = [];
  t.ready.then(() => { playing = play(kind, to); }).catch(() => {});
  t.finished.finally(() => {
    delete root.dataset.nav;
    // They hold their last frame until the transition ends (fill: both) —
    // and would be kept on the document for good after it, one set per
    // navigation, if not let go here.
    for (const a of playing) a.cancel();
  });
}

function play(kind: Kind, to: string): Animation[] {
  const root = document.documentElement;
  const out: Animation[] = [];
  const anim = (pseudo: string, frames: Keyframe[], o: KeyframeAnimationOptions) => {
    out.push(root.animate(frames, { fill: 'both', pseudoElement: pseudo, ...o }));
  };

  if (kind === 'page') {
    anim('::view-transition-old(root)', [{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: EASE_IN });
    anim('::view-transition-new(root)', to === '/'
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(8px) scale(0.996)' }, { opacity: 1, transform: 'none' }],
    { duration: to === '/' ? 260 : 440, delay: 40, easing: to === '/' ? EASE_OUT : EASE_BOUNCE });
  } else if (kind === 'open') {
    anim('::view-transition-old(root)', [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: EASE_OUT });
    anim('::view-transition-new(root)', [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: EASE_OUT });
    anim('::view-transition-new(sheet)', [
      { opacity: 0, transform: 'translateY(22px) scale(0.965)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 480, easing: EASE_BOUNCE });
  } else {
    anim('::view-transition-old(sheet)', [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(14px) scale(0.97)' },
    ], { duration: 200, easing: EASE_IN });
    anim('::view-transition-old(root)', [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: EASE_OUT });
    anim('::view-transition-new(root)', [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: EASE_OUT });
  }
  return out;
}
