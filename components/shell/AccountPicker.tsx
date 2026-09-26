'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ACCOUNT_VALUES } from '@/lib/domain';
import { ACCOUNT_EVENT, readAccountCookie, writeAccountCookie } from '@/lib/account-pref';

const OPTIONS = [...ACCOUNT_VALUES, 'All'] as const;
const label = (a: string) => (a === 'Backtest (FX Replay)' ? 'Backtest' : a === 'All' ? 'All accounts' : a);

/**
 * One account for the whole app, in the title bar.
 *
 * Every figure is scoped to one account at a time — backtest R and live R
 * never sum — and choosing it on each screen separately meant Stats could be
 * on Live while the board showed Demo. This sets it everywhere at once and
 * remembers it; the per-screen switchers stay, and move this with them.
 */
export function AccountPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    // The URL wins where a screen has one; otherwise the remembered choice.
    setAccount(params.get('account') ?? readAccountCookie() ?? 'All');
    const on = (e: Event) => setAccount((e as CustomEvent<string>).detail);
    window.addEventListener(ACCOUNT_EVENT, on);
    return () => window.removeEventListener(ACCOUNT_EVENT, on);
  }, [params]);

  if (account === null) return null;

  const choose = (next: string) => {
    setAccount(next);
    writeAccountCookie(next);
    // Stats and the Calendar read the account from the URL; the board and
    // everything else follow the event.
    if (pathname === '/stats' || pathname === '/calendar') {
      const q = new URLSearchParams(params.toString());
      q.set('account', next);
      router.push(`${pathname}?${q}`);
    }
  };

  return (
    <div className="mr-2 flex items-center text-[11.5px]" title="The account every screen shows — remembered">
      <select
        data-account-picker
        aria-label="Account shown everywhere"
        value={account}
        onChange={(e) => choose(e.target.value)}
        className="cursor-pointer rounded-full border bg-transparent px-3 py-1 font-medium outline-none"
        style={{ borderColor: 'var(--glass-stroke)', background: 'var(--glass-fill)', color: 'var(--text-dim)' }}
      >
        {OPTIONS.map((a) => <option key={a} value={a}>{label(a)}</option>)}
      </select>
    </div>
  );
}
