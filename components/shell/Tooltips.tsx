'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { springBouncy } from '@/lib/motion';

/**
 * Tooltips, drawn by the app.
 *
 * Every hint in Signature is a `title` attribute — the ⓘ beside a form label,
 * the explanation on a chip, the full list behind a truncated line — and the
 * browser draws those as a small grey box in the system font after a long
 * pause, in a style that belongs to no theme. This takes them over without
 * touching a single component: while the pointer is on an element with a
 * title, the title is lifted off (so the native one never appears), shown
 * here in the theme's glass with a small spring, and put back the moment the
 * pointer leaves. Nothing reads differently to a screen reader or a test that
 * looks at the attribute when nothing is hovered.
 */

const DELAY = 380;
const GAP = 8;

interface Tip { text: string; x: number; y: number; below: boolean; side: 'left' | 'right' | null }

export function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [ready, setReady] = useState(false);
  const owner = useRef<{ el: Element; title: string } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setReady(true);
    const restore = () => {
      if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
      const o = owner.current;
      // Put the title back — unless something re-set it meanwhile, which wins.
      if (o && !o.el.hasAttribute('title')) o.el.setAttribute('title', o.title);
      owner.current = null;
      setTip(null);
    };

    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = (e.target as Element | null)?.closest?.('[title]');
      if (!el || el === owner.current?.el) return;
      const title = el.getAttribute('title') ?? '';
      restore();
      if (!title.trim()) return;
      // Lift it now, so the native tooltip never gets its chance.
      el.removeAttribute('title');
      owner.current = { el, title };
      timer.current = window.setTimeout(() => {
        if (owner.current?.el !== el || !el.isConnected) return;
        const r = el.getBoundingClientRect();
        // A list (a dropdown's options) gets its hints at the side, so the
        // hint for one option never covers the option above it.
        const list = el.closest('[data-tip-side]')?.getBoundingClientRect();
        if (list) {
          const right = window.innerWidth - list.right > 300;
          setTip({ text: title, x: right ? list.right + GAP : list.left - GAP, y: r.top + r.height / 2, below: false, side: right ? 'right' : 'left' });
          return;
        }
        const below = r.top < 64;
        setTip({ text: title, x: r.left + r.width / 2, y: below ? r.bottom + GAP : r.top - GAP, below, side: null });
      }, DELAY);
    };
    const out = (e: PointerEvent) => {
      const o = owner.current;
      if (!o) return;
      const to = e.relatedTarget as Node | null;
      if (to && o.el.contains(to)) return;
      restore();
    };

    document.addEventListener('pointerover', over, true);
    document.addEventListener('pointerout', out, true);
    window.addEventListener('pointerdown', restore, true);
    window.addEventListener('scroll', restore, true);
    window.addEventListener('blur', restore);
    return () => {
      restore();
      document.removeEventListener('pointerover', over, true);
      document.removeEventListener('pointerout', out, true);
      window.removeEventListener('pointerdown', restore, true);
      window.removeEventListener('scroll', restore, true);
      window.removeEventListener('blur', restore);
    };
  }, []);

  if (!ready) return null;
  return createPortal(
    <AnimatePresence>
      {tip && (
        <motion.div
          key={`${tip.x}:${tip.y}:${tip.text}`}
          role="tooltip"
          data-tooltip
          initial={{ opacity: 0, scale: 0.92, ...(tip.side ? { x: tip.side === 'right' ? -4 : 4 } : { y: tip.below ? -4 : 4 }) }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
          transition={springBouncy}
          className="pointer-events-none fixed z-[200] max-w-[18rem] whitespace-pre-line rounded-[calc(10px*var(--rk))] border px-2.5 py-1.5 text-[11.5px] leading-snug"
          style={{
            left: tip.side ? tip.x : Math.min(Math.max(tip.x, 150), window.innerWidth - 150),
            top: tip.y,
            translateX: tip.side === 'right' ? '0%' : tip.side === 'left' ? '-100%' : '-50%',
            translateY: tip.side ? '-50%' : tip.below ? '0%' : '-100%',
            transformOrigin: tip.side === 'right' ? 'left center' : tip.side === 'left' ? 'right center' : tip.below ? 'top center' : 'bottom center',
            background: 'color-mix(in srgb, var(--bg-raised) 96%, transparent)',
            borderColor: 'var(--glass-stroke)',
            color: 'var(--text)',
            boxShadow: 'var(--shadow-card)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {tip.text}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
