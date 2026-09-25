'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { springSoft } from '@/lib/motion';

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export interface MenuState { x: number; y: number; items: MenuItem[] }

/**
 * Right-click on the board.
 *
 * Everything here is also reachable another way — nothing is hidden behind a
 * gesture that a first-time user has to guess at — but "delete this" and "lock
 * this down" are the two things you want without hunting for a panel.
 */
export function ContextMenu({ menu, onClose }: { menu: MenuState | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {menu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={springSoft}
            className="glass fixed z-[61] min-w-[9.5rem] overflow-hidden rounded-[calc(14px*var(--rk))] py-1"
            style={{
              // Kept inside the window: a menu opened near the right edge used
              // to run off it.
              left: Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 0) - 180),
              top: Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 0) - (menu.items.length * 34 + 20)),
              background: 'color-mix(in srgb, var(--bg-raised) 94%, transparent)',
            }}
          >
            {menu.items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => { item.onClick(); onClose(); }}
                className="block w-full px-3.5 py-2 text-left text-[12px]"
                style={{ color: item.danger ? 'rgb(var(--outcome-loss))' : 'var(--text)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--glass-fill-strong)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
