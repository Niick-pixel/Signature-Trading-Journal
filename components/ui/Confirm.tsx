'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Overlay } from './Overlay';
import { Button } from './Button';

/**
 * "Are you sure?" — once, the same everywhere.
 *
 * Deleting a journal page, a note, a deposit, a chart or a saved view used to
 * happen on the first click, and a misclick was a loss. Every delete now asks
 * first, through this one dialog:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete this page?', action: 'Delete page' }))) return;
 *
 * Cancel has the focus, so an Enter pressed by habit keeps things; Escape and
 * a click outside cancel too. (Trades have their own, slower three-step
 * delete — see DeleteTradeDialog — and the Trash's purge asks for PURGE.)
 */
export interface ConfirmOptions {
  title: string;
  /** What will happen, in a sentence. */
  body?: string;
  /** The button that goes ahead, e.g. "Delete page". */
  action?: string;
  /** Red for anything destructive (the default). */
  danger?: boolean;
}

type Ask = (o: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask>(async () => true);

export function useConfirm(): Ask {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [asking, setAsking] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const ask = useCallback<Ask>((o) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setAsking(o);
  }), []);

  const answer = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setAsking(null);
  }, []);

  useEffect(() => {
    if (asking) window.setTimeout(() => cancelRef.current?.focus(), 60);
  }, [asking]);

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <Overlay open={asking !== null} onClose={() => answer(false)}
        className="w-full max-w-[24rem] rounded-[calc(22px*var(--rk))] p-6"
        surface="color-mix(in srgb, var(--bg-raised) 94%, transparent)">
        {asking && (
          <div data-confirm>
            <h2 className="text-[16px] font-semibold tracking-tight">{asking.title}</h2>
            {asking.body && (
              <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>{asking.body}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button ref={cancelRef} onClick={() => answer(false)} data-confirm-cancel>Cancel</Button>
              <Button variant={asking.danger === false ? 'primary' : 'danger'} onClick={() => answer(true)} data-confirm-ok>
                {asking.action ?? 'Delete'}
              </Button>
            </div>
          </div>
        )}
      </Overlay>
    </ConfirmContext.Provider>
  );
}
