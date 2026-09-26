'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';

export function Field({
  label, hint, children, className = '', group = false, pending = false,
}: {
  label: string; hint?: string; children: React.ReactNode; className?: string;
  /**
   * Still on the value the form started with — not yet looked at. The label
   * lights up until an option is picked (the same one counts), so a default
   * is never mistaken for an answer. Never blocks anything.
   */
  pending?: boolean;
  /**
   * For a row of buttons rather than one control. A <label> labels only its
   * FIRST labelable descendant — so around five buttons it named the first
   * one after the whole field, and a click on the caption pressed it. A group
   * names the row instead and a caption click does nothing.
   */
  group?: boolean;
}) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className={`block ${className}`} {...(group ? { role: 'group', 'aria-label': label } : {})}>
      <span
        data-pending={pending ? 'true' : undefined}
        title={pending ? 'Still on its default — pick an option to confirm it' : undefined}
        className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.07em] transition-[color,font-weight] duration-300"
        style={{ color: pending ? 'rgb(var(--accent))' : 'var(--text-faint)', fontWeight: pending ? 700 : 500 }}>
        {pending && <span aria-hidden className="size-1.5 rounded-full" style={{ background: 'rgb(var(--accent))' }} />}
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>{hint}</span>}
    </Tag>
  );
}

/**
 * The focus glow every control in the app shares.
 *
 * Framer's `whileFocus` only fires on the element that actually receives focus,
 * so wrapping an input in an animated div does nothing — the glow has to be
 * driven by the input's own focus events and applied to the surface around it.
 */
export function useGlowState(accent = 'var(--accent)') {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const lit = focused || hovered;

  return {
    focused,
    handlers: {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
    animate: {
      borderColor: lit ? `rgb(${accent} / ${focused ? 0.6 : 0.35})` : 'var(--glass-stroke)',
      boxShadow: lit
        ? `var(--shadow-card), 0 0 20px rgb(${accent} / ${focused ? 0.3 : 0.16})`
        : 'var(--shadow-card), 0 0 0px rgb(0 0 0 / 0)',
    },
    transition: spring,
  };
}

/** A glass input that glows on hover and focus, on a spring. */
export function Input({
  accent = 'var(--accent)', className = '', ...rest
}: React.ComponentProps<'input'> & { accent?: string }) {
  const glow = useGlowState(accent);

  return (
    <motion.div
      animate={glow.animate}
      transition={glow.transition}
      className={`glass overflow-hidden rounded-[calc(14px*var(--rk))] ${className}`}
    >
      <input
        {...rest}
        {...glow.handlers}
        className="w-full bg-transparent px-4 py-2.5 text-[13px] outline-none
          placeholder:text-[color:var(--text-faint)]"
        style={{ color: 'var(--text)' }}
      />
    </motion.div>
  );
}
