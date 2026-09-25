'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { press, spring, springSoft } from '@/lib/motion';
import { currentTheme } from '@/lib/themes';
import { ThemeGrid } from './ThemeGrid';

/**
 * The theme button: opens the six themes, right where it sits.
 *
 * It used to flip between light and dark. With six themes a flip no longer
 * describes the choice, so it opens a panel of previews instead. The
 * window-button strip is painted by the shell, not by CSS, so it is told the
 * current theme's colours on load as well as on every change.
 */
export function ThemeToggle() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = currentTheme();
    setMode(t.mode);
    window.signature?.setTitleBarTheme(t.chrome);
    const on = () => setMode(currentTheme().mode);
    window.addEventListener('signature:theme', on);
    return () => window.removeEventListener('signature:theme', on);
  }, []);

  // Outside click and Escape close it.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); setOpen(false); } };
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', key); };
  }, [open]);

  const dark = mode === 'dark';

  return (
    <div ref={wrap} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            // Marked as a dialog so screen-level Escape handlers leave it be.
            role="dialog"
            aria-modal="true"
            aria-label="Theme"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.12 } }}
            transition={springSoft}
            style={{ transformOrigin: 'bottom left' }}
            className="glass absolute bottom-full left-0 z-50 mb-3 w-[21rem] rounded-[calc(20px*var(--rk))] p-3.5"
          >
            <p className="mb-2.5 px-0.5 text-[11px] font-medium uppercase tracking-[0.07em]" style={{ color: 'var(--text-faint)' }}>
              Theme
            </p>
            <ThemeGrid compact />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileTap={press}
        whileHover={{ y: -1 }}
        transition={spring}
        aria-label="Choose a theme"
        aria-expanded={open}
        title="Choose a theme — six, from cream glass to ruled ledger paper"
        className="glass grid size-[34px] place-items-center rounded-full"
        style={{ color: 'var(--text-dim)' }}
      >
        <motion.svg
          key={mode}
          width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
          initial={{ scale: 0.5, rotate: -60, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={spring}
        >
          {dark ? (
            <path d="M13.2 9.6A5.6 5.6 0 016.4 2.8a5.6 5.6 0 106.8 6.8z"
              stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          ) : (
            <>
              <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.3" />
              <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2L3.1 3.1"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </>
          )}
        </motion.svg>
      </motion.button>
    </div>
  );
}
