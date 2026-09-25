'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { shortcutAllowed } from '@/lib/keys';

/**
 * Arrow-key paging for a screen whose pages are links: the calendar's months.
 * Renders nothing — it only listens.
 */
export function KeyNav({ prev, next, home }: { prev: string; next: string; home?: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shortcutAllowed(e)) return;
      const to = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : e.key === 'Home' ? home : undefined;
      if (!to) return;
      e.preventDefault();
      router.push(to);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [router, prev, next, home]);
  return null;
}
