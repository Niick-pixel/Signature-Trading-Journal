'use client';

/**
 * Per-machine display preferences.
 *
 * These are deliberately not in the database: they describe how this screen
 * should look, not what happened in the market. Keeping them in localStorage
 * means a copy of the journal carried to another machine brings the trades and
 * leaves the furniture behind.
 */
export interface Preferences {
  /** Multiplies every font size in the app. */
  textScale: number;
  /** Card size on the whiteboard. */
  boardDensity: 'compact' | 'normal' | 'roomy';
  /** Dotted lines joining trades that share a reason. */
  showReasonEdges: boolean;
  /** Dashed lines joining losses that share a target type. */
  showLeakEdges: boolean;
  /** The dot grid behind the board. */
  showGrid: boolean;
  /** Fade trades you passed on rather than took. */
  dimPassed: boolean;
  /** Skip entrance and layout animation. */
  reduceMotion: boolean;
  /** Offer the morning check-in on the first screen of a trading day. */
  askCheckIn: boolean;
  /**
   * Filter combinations worth returning to — "all rule breaks", "all A+
   * losers". Stored per machine with the rest of the furniture, because they
   * describe how I want to look at the journal rather than what happened in it.
   */
  savedViews: SavedView[];
}

export interface SavedView {
  id: string;
  name: string;
  /** The Filters object, stored opaquely so adding a filter needs no migration. */
  filters: Record<string, unknown>;
}

export const DEFAULT_PREFERENCES: Preferences = {
  textScale: 1,
  boardDensity: 'normal',
  showReasonEdges: true,
  showLeakEdges: true,
  showGrid: true,
  dimPassed: true,
  reduceMotion: false,
  askCheckIn: true,
  savedViews: [],
};

export const PREFERENCES_KEY = 'signature:preferences';

export const DENSITY_SCALE: Record<Preferences['boardDensity'], number> = {
  compact: 0.78,
  normal: 1,
  roomy: 1.3,
};

export function readPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    // Merge rather than replace, so a preference added in a later version has a
    // sane value instead of undefined.
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(prefs: Preferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    /* private window — the choice just won't stick */
  }
  applyPreferences(prefs);
  window.dispatchEvent(new CustomEvent('signature:preferences', { detail: prefs }));
}

/** Pushes the preferences that are pure CSS onto the document. */
export function applyPreferences(prefs: Preferences): void {
  const root = document.documentElement;
  root.style.setProperty('--text-scale', String(prefs.textScale));
  root.dataset.reduceMotion = prefs.reduceMotion ? 'true' : 'false';
}
