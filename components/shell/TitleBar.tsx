'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';
import { Wordmark } from './Wordmark';
import { CheckInChip } from './MorningCheckIn';

const TABS = [
  { href: '/', label: 'Whiteboard' },
  { href: '/stats', label: 'Stats' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/journal', label: 'Journal' },
] as const;

/**
 * The window's own chrome. Electron hides the native title bar so the glass can
 * run to the edge, which means this strip provides the drag region — and has to
 * leave room for the platform's window buttons, which are drawn over it.
 */
export function TitleBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    setPlatform(window.signature?.platform ?? null);
    // Menu items (Cmd+N and friends) navigate through the preload bridge.
    return window.signature?.onNavigate((route) => router.push(route));
  }, [router]);

  const isMac = platform === 'darwin';
  const isWindows = platform === 'win32';

  return (
    <header
      className="titlebar-drag relative flex h-11 shrink-0 items-center"
      style={{
        // macOS draws its traffic lights on the left; Windows and Linux draw
        // minimise/maximise/close on the right. Either way the buttons sit on
        // top of this strip, so the content has to get out of their way — the
        // theme control was landing underneath the minimise button.
        paddingLeft: isMac ? 88 : 16,
        paddingRight: isWindows ? 148 : 16,
      }}
    >
      <Wordmark />

      {/* Centred on the window, not on the space left over — so the tabs stay
          put regardless of what sits either side of them. */}
      <nav className="pointer-events-none absolute inset-x-0 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <motion.div key={tab.href} whileTap={press} transition={spring}>
                <Link
                  href={tab.href}
                  className="relative block rounded-full px-3.5 py-1.5 text-[12px] font-medium outline-none"
                  style={{ color: active ? 'var(--text)' : 'var(--text-faint)' }}
                >
                  {active && (
                    // A shared layoutId slides the pill between tabs on a
                    // spring instead of cross-fading.
                    <motion.span
                      layoutId="titlebar-tab"
                      transition={spring}
                      className="absolute inset-0 rounded-full"
                      style={{ background: 'var(--glass-fill-strong)', border: '1px solid var(--glass-stroke)' }}
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </nav>

      {/* Right-hand side, clear of the window buttons (see the padding above). */}
      <div className="relative ml-auto flex items-center">
        <CheckInChip />
      </div>
    </header>
  );
}
