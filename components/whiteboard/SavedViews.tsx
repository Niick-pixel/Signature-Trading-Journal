'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';
import { usePreferences } from '@/components/shell/PreferencesProvider';
import type { SavedView } from '@/lib/preferences';
import { useConfirm } from '@/components/ui/Confirm';

/**
 * Filter combinations worth coming back to.
 *
 * "All rule breaks" and "all A+ losers" are questions you ask every week, and
 * rebuilding them out of six chips every time is the reason you stop asking.
 */
export function SavedViews({ current, onApply }: {
  current: Record<string, unknown>;
  onApply: (filters: Record<string, unknown>) => void;
}) {
  const confirm = useConfirm();
  const { prefs, update } = usePreferences();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const views = prefs.savedViews ?? [];

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const view: SavedView = { id: crypto.randomUUID(), name: trimmed, filters: current };
    update({ savedViews: [...views, view] });
    setName(''); setNaming(false);
  };

  const remove = async (id: string) => {
    const name = views.find((v) => v.id === id)?.name;
    if (!(await confirm({ title: `Delete the view “${name ?? ''}”?`, body: 'Only the saved filter goes; no trade is touched.', action: 'Delete view' }))) return;
    update({ savedViews: views.filter((v) => v.id !== id) });
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
        Views
      </span>

      {views.map((view) => (
        <span key={view.id} className="group relative">
          <motion.button
            type="button"
            onClick={() => onApply(view.filters)}
            whileTap={press}
            transition={spring}
            className="rounded-full border px-2.5 py-1 text-[11px]"
            style={{ borderColor: 'var(--glass-stroke)', color: 'var(--text-dim)' }}
          >
            {view.name}
          </motion.button>
          <button
            type="button"
            aria-label={`Forget the ${view.name} view`}
            onClick={() => remove(view.id)}
            className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full text-[8px] opacity-0 transition-opacity group-hover:opacity-100"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--glass-stroke)', color: 'var(--text-faint)' }}
          >
            ×
          </button>
        </span>
      ))}

      {naming ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => (name.trim() ? save() : setNaming(false))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') { setName(''); setNaming(false); }
          }}
          placeholder="Name this view"
          className="w-32 rounded-full border bg-transparent px-2.5 py-1 text-[11px] outline-none"
          style={{ borderColor: 'rgb(var(--accent) / 0.5)', color: 'var(--text)' }}
        />
      ) : (
        <motion.button
          type="button"
          onClick={() => setNaming(true)}
          whileTap={press}
          transition={spring}
          title="Save the current filters as a view"
          className="rounded-full border px-2 py-1 text-[11px]"
          style={{ borderColor: 'var(--glass-stroke)', color: 'var(--text-faint)' }}
        >
          +
        </motion.button>
      )}
    </div>
  );
}
