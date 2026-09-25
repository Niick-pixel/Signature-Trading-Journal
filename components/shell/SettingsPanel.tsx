'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { press, spring, springSoft } from '@/lib/motion';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { TogglePill } from '@/components/ui/TogglePill';
import { usePreferences } from './PreferencesProvider';
import type { Preferences } from '@/lib/preferences';
import { ThemeGrid } from './ThemeGrid';
import { SETTINGS_TOGGLE, SHEET_OPEN } from './Shortcuts';

interface Info {
  dataDir: string;
  trades: number;
}

const TEXT_SIZES = ['Small', 'Normal', 'Large', 'Huge'] as const;
const TEXT_SCALE: Record<(typeof TEXT_SIZES)[number], number> = {
  Small: 0.9, Normal: 1, Large: 1.15, Huge: 1.3,
};
const DENSITIES = ['compact', 'normal', 'roomy'] as const;

/**
 * A group of settings, with a line saying what the group is for.
 *
 * Every control in here used to be a bare label — "Reason lines", "Compact",
 * "Reset" — which is fine if you wrote them and opaque if you did not. The
 * hint is the sentence you would otherwise have to guess at, and the buttons
 * below carry the same explanation as a hover title.
 */
function Section({ title, hint, children }: {
  title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="mb-1 text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
        {title}
      </div>
      {hint && (
        <p className="mb-2.5 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
          {hint}
        </p>
      )}
      {!hint && <div className="mb-2.5" />}
      {children}
    </div>
  );
}

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs, update, reset } = usePreferences();
  const [info, setInfo] = useState<Info | null>(null);
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  /**
   * Restores from an export. Idempotent on id, so importing the same file
   * twice is safe — which matters, because the obvious way to check a backup
   * worked is to import it again.
   */
  async function runImport(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const body = await file.text();
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const json = await res.json();
      setImportResult(res.ok
        ? `${json.imported} imported, ${json.skipped} already here${json.rejected?.length ? `, ${json.rejected.length} rejected` : ''}.`
        : (json.error ?? 'Import failed.'));
      if (res.ok && json.imported > 0) window.location.reload();
    } catch {
      setImportResult('Could not read that file.');
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    fetch('/api/settings').then((r) => r.json()).then(setInfo).catch(() => setInfo(null));
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const currentSize = (Object.keys(TEXT_SCALE) as (typeof TEXT_SIZES)[number][])
    .find((k) => TEXT_SCALE[k] === prefs.textScale) ?? 'Normal';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={spring} onClick={onClose}
            className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)' }}
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={springSoft}
            style={{
              transformOrigin: 'bottom left',
              background: 'color-mix(in srgb, var(--bg-raised) 92%, transparent)',
            }}
            className="glass absolute bottom-full left-0 z-50 mb-3 max-h-[78vh] w-[24rem]
              overflow-y-auto rounded-[calc(22px*var(--rk))] p-5"
          >
            <h2 className="text-[14px] font-semibold tracking-tight">Settings</h2>

            <Section
              title="Theme"
              hint="Six, all in warm creams. Each changes the surfaces, corners and headings, not only the colours."
            >
              <ThemeGrid />
            </Section>

            <Section
              title="Text size"
              hint="Scales every bit of text in the app. Useful on a 1440p screen where the default reads small."
            >
              <Segmented
                value={currentSize}
                onChange={(size) => update({ textScale: TEXT_SCALE[size] })}
                options={TEXT_SIZES}
                titleFor={(size) => ({
                  small: 'Smaller text everywhere — fits the most on screen',
                  normal: 'The default',
                  large: 'Larger text everywhere — easier on a big monitor',
                  huge: 'Largest text everywhere',
                } as Record<string, string>)[size] ?? size}
              />
            </Section>

            <Section
              title="Whiteboard"
              hint="How tightly the board packs its cards. Compact fits more on screen; roomy is easier to read."
            >
              <Segmented
                value={prefs.boardDensity}
                onChange={(boardDensity) => update({ boardDensity })}
                options={DENSITIES}
                labelFor={(d) => d[0].toUpperCase() + d.slice(1)}
                titleFor={(d) => ({
                  compact: 'Smaller cards — more of the board visible at once',
                  normal: 'The default card size',
                  roomy: 'Bigger cards — the charts are easier to read',
                } as Record<string, string>)[d] ?? d}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <TogglePill
                  checked={prefs.showReasonEdges}
                  onChange={(showReasonEdges) => update({ showReasonEdges })}
                  label="Reason lines"
                  hint="Dotted lines joining trades taken for the same reason."
                />
                <TogglePill
                  checked={prefs.showLeakEdges}
                  onChange={(showLeakEdges) => update({ showLeakEdges })}
                  label="Leak lines"
                  accent="var(--outcome-loss)"
                  hint="Dashed lines joining losses that share a target type."
                />
                <TogglePill
                  checked={prefs.showGrid}
                  onChange={(showGrid) => update({ showGrid })}
                  label="Dot grid"
                  hint="The faint dots behind the board."
                />
                <TogglePill
                  checked={prefs.dimPassed}
                  onChange={(dimPassed) => update({ dimPassed })}
                  label="Fade passed trades"
                  hint="Dims setups you journalled but never took, so the ones you did take stand out."
                />
              </div>
            </Section>

            <Section
              title="Morning check-in"
              hint="Four questions before the session: sleep, state of mind, bias and news. Asked once on the first screen of a trading day, never while a trade is being written, and never again once the day has trades in it."
            >
              <TogglePill
                checked={prefs.askCheckIn}
                onChange={(askCheckIn) => update({ askCheckIn })}
                label="Ask each morning"
                hint="Off, it waits in the title bar until you open it (or press M)."
              />
            </Section>

            <Section
              title="Keyboard"
              hint="Single keys move you around: N new trade, M the morning, 1–4 the tabs, J and K through the board's trades."
            >
              <Button title="Lists every keyboard shortcut in the app — or press ? anywhere" onClick={() => { onClose(); window.dispatchEvent(new Event(SHEET_OPEN)); }}>
                Show every shortcut <span className="ml-1.5 opacity-60">?</span>
              </Button>
            </Section>

            <Section
              title="Motion"
              hint="Turn this on if the animations are distracting or the app feels heavy on your machine."
            >
              <TogglePill
                checked={prefs.reduceMotion}
                onChange={(reduceMotion) => update({ reduceMotion })}
                label="Reduce motion"
                hint="Turns off the spring animations."
              />
            </Section>

            <Section title="Your journal lives here">
              <p className="break-all rounded-[calc(12px*var(--rk))] p-2.5 text-[11px] leading-relaxed"
                style={{ background: 'var(--glass-fill)', border: '1px solid var(--glass-stroke)' }}>
                {info?.dataDir ?? 'Loading…'}
              </p>
              <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                Back up that one folder and you have backed up everything — the database and
                every chart screenshot. {info ? `${info.trades} trade${info.trades === 1 ? '' : 's'} recorded.` : ''}
              </p>
            </Section>

            {importResult && (
              <p className="mt-3 text-[11px] leading-snug" style={{ color: 'var(--text-dim)' }}>
                {importResult}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {typeof window !== 'undefined' && window.signature?.isDesktop && (
                <Button
                  title="Opens the folder above in your file manager — the database and every screenshot are in there"
                  onClick={() => window.signature?.openDataFolder()}
                >
                  Open folder
                </Button>
              )}
              {/* One zip: trades.json, trades.csv, and every screenshot. */}
              <a href="/api/export" download className="outline-none">
                <Button
                  tabIndex={-1}
                  title="Downloads one zip: every trade as JSON and as a spreadsheet, your money movements, the journal as a readable document, and every chart screenshot"
                >
                  Export everything
                </Button>
              </a>
              <Button
                onClick={() => importRef.current?.click()}
                disabled={importing}
                title="Restores from a trades.json out of an export. Matched on id, so importing the same file twice changes nothing the second time"
              >
                {importing ? 'Importing…' : 'Import JSON'}
              </Button>
              <a href="/trash" className="outline-none">
                <Button
                  tabIndex={-1}
                  title="Trades you deleted. Nothing is destroyed until you purge it there"
                >
                  Trash
                </Button>
              </a>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) runImport(f);
                  e.target.value = '';
                }}
              />
              <Button
                title="Copies the folder path above to the clipboard"
                onClick={async () => {
                  if (!info?.dataDir) return;
                  try {
                    await navigator.clipboard.writeText(info.dataDir);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                  } catch { /* clipboard blocked; the path is on screen anyway */ }
                }}
              >
                {copied ? 'Copied' : 'Copy path'}
              </Button>
              <Button
                onClick={reset}
                title="Puts the settings on this panel back to their defaults. Touches no trade, no page and no money"
              >
                Reset
              </Button>
              <Button onClick={onClose} className="ml-auto" title="Closes this panel. Every setting here saved the moment you changed it">Done</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** The bottom-left cluster: theme above settings, on every screen. */
export function BottomLeftControls({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener(SETTINGS_TOGGLE, toggle);
    return () => window.removeEventListener(SETTINGS_TOGGLE, toggle);
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-30 flex flex-col items-start gap-2">
      <SettingsPanel open={open} onClose={() => setOpen(false)} />
      {children}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileTap={press}
        whileHover={{ y: -1 }}
        transition={spring}
        aria-label="Settings"
        title="Settings"
        className="glass grid size-[34px] place-items-center rounded-full"
        style={{ color: 'var(--text-dim)' }}
      >
        {/* Sliders, not a cog: a spoked circle sits directly above the sun of
            the theme toggle and reads as a second one. */}
        <motion.svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden
          animate={{ rotate: open ? 90 : 0 }} transition={spring}>
          <path d="M3 6h5M12 6h5M3 14h9M16 14h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="14" cy="14" r="2" stroke="currentColor" strokeWidth="1.6" />
        </motion.svg>
      </motion.button>
    </div>
  );
}

export type { Preferences };
