'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { springSoft } from '@/lib/motion';

/**
 * Opens and closes by height, softly — and only clips while it is moving.
 *
 * Animating to height: auto needs overflow: hidden, but left on afterwards it
 * cut every glow, focus ring and card shadow inside to a hard edge (the
 * selected outcome's highlight lost its bottom and its sides). So the clip is
 * on while the height changes and off the moment it has settled open.
 *
 * Use inside AnimatePresence, with a key, like any exiting motion element.
 */
export function Collapse({ children, className = '', ...rest }: {
  children: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <motion.div
      {...rest}
      // transitionEnd lands once the height has arrived — and also when there
      // is no animation at all (an AnimatePresence with initial={false}), which
      // a completion callback never hears about.
      initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
      animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
      exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
      transition={springSoft}
      className={className}
    >
      {children}
    </motion.div>
  );
}
