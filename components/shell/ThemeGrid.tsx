'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { THEMES, applyTheme, currentTheme, type ThemeInfo } from '@/lib/themes';

/**
 * Every theme as a small live preview — the ground, a card on it, a line of
 * type and the accent — so a theme is chosen by what it looks like rather than
 * by its name. Used in the theme button's panel and in Settings.
 */
export function ThemeGrid({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState<string>('cream');
  useEffect(() => {
    setActive(currentTheme().id);
    const on = (e: Event) => setActive((e as CustomEvent<string>).detail);
    window.addEventListener('signature:theme', on);
    return () => window.removeEventListener('signature:theme', on);
  }, []);

  return (
    <div className={`grid gap-2.5 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`} role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <Tile key={t.id} theme={t} on={t.id === active} compact={compact} />
      ))}
    </div>
  );
}

function Tile({ theme: t, on, compact }: { theme: ThemeInfo; on: boolean; compact: boolean }) {
  const p = t.preview;
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={on}
      data-theme-tile={t.id}
      title={t.blurb}
      onClick={(e) => applyTheme(t.id, { x: e.clientX, y: e.clientY })}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={spring}
      className="group rounded-[calc(14px*var(--rk))] p-1.5 text-left outline-none"
      style={{
        border: `1px solid ${on ? 'rgb(var(--accent) / 0.7)' : 'var(--glass-stroke)'}`,
        background: on ? 'rgb(var(--accent) / 0.08)' : 'transparent',
        boxShadow: on ? '0 0 0 3px rgb(var(--accent) / 0.14)' : 'none',
      }}
    >
      {/* The preview is drawn in the theme's own colours, not the current one's. */}
      <div className="relative overflow-hidden" aria-hidden
        style={{ background: p.bg, height: compact ? 54 : 64, borderRadius: Math.max(3, p.radius) }}>
        <div className="absolute left-2.5 top-2.5 right-6 bottom-2"
          style={{ background: p.raised, border: `1px solid ${p.stroke}`, borderRadius: p.radius }}>
          <div className="ml-2 mt-2 h-[5px] w-[46%] rounded-full" style={{ background: p.text, opacity: 0.85 }} />
          <div className="ml-2 mt-1.5 h-[4px] w-[64%] rounded-full" style={{ background: p.text, opacity: 0.35 }} />
          <div className="ml-2 mt-2 h-[9px] w-[28%] rounded-full" style={{ background: p.accent }} />
        </div>
        <span className="absolute right-2 top-2 size-2 rounded-full" style={{ background: p.accent }} />
      </div>
      <div className="px-1 pb-0.5 pt-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold">{t.name}</span>
          {on && (
            <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}
              width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ color: 'rgb(var(--accent))' }}>
              <path d="M2.5 6.3l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}
        </div>
        {!compact && (
          <p className="mt-0.5 text-[10px] leading-snug" style={{ color: 'var(--text-faint)' }}>{t.blurb}</p>
        )}
      </div>
    </motion.button>
  );
}
