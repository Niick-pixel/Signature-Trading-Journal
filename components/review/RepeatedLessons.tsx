import Link from 'next/link';
import type { LessonGroup } from '@/lib/lessons';

const shortDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const r = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}R`;

/** How many groups to show. The top of this list is the point; the tail is noise. */
const SHOW = 6;

/**
 * The same lesson, written again.
 *
 * Grouped by the words they share, and those words are printed on each group
 * so the grouping can be checked by eye rather than trusted. Each lesson links
 * back to its trade.
 */
export function RepeatedLessons({ groups }: { groups: LessonGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        Nothing repeats yet — no two lessons share enough words to call them the same one.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.slice(0, SHOW).map((g) => (
        <div key={g.lessons[0].id} data-lesson-group className="rounded-[16px] border p-4"
          style={{ borderColor: 'var(--glass-stroke)', background: 'var(--glass-fill)' }}>
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[13px] font-semibold">
              Written {g.lessons.length} times
              <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--text-faint)' }}>
                {shortDate(g.lessons[g.lessons.length - 1].date)} → {shortDate(g.lessons[0].date)}
              </span>
            </span>
            <span className="tabular-nums text-[12px] font-semibold"
              style={{ color: g.totalR < 0 ? 'rgb(var(--outcome-loss))' : g.totalR > 0 ? 'rgb(var(--outcome-win))' : 'var(--text-dim)' }}>
              {r(g.totalR)} across them
            </span>
          </div>

          {g.shared.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {g.shared.map((w) => (
                <span key={w} className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{ background: 'rgb(var(--accent) / 0.1)', color: 'rgb(var(--accent))' }}>
                  {w}
                </span>
              ))}
            </div>
          )}

          <ol className="space-y-2">
            {g.lessons.map((l) => (
              <li key={l.id}>
                <Link href={`/new?edit=${l.id}`} className="block text-[12px] leading-snug hover:underline">
                  <span className="mr-2 text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                    {shortDate(l.date)}
                  </span>
                  <span className="line-clamp-2" style={{ color: 'var(--text-dim)' }}>{l.lesson}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {groups.length > SHOW && (
        <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
          And {groups.length - SHOW} smaller group{groups.length - SHOW === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  );
}
