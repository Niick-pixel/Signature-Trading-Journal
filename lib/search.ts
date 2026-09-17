import type { JournalPage, Trade } from './types';

/**
 * One result. Either a trade or a journal page — the query does not know the
 * difference and neither should the person typing it.
 */
export type Hit =
  | {
      kind: 'trade';
      trade: Trade;
      /** Where it matched, for the result line. */
      field: 'explanation' | 'lesson' | 'reason' | 'setup' | 'mistake';
      /** A window of text around the match. */
      excerpt: string;
    }
  | {
      kind: 'page';
      page: JournalPage;
      field: 'title' | 'page';
      excerpt: string;
    };

/** Enough either side of the match to read the sentence it landed in. */
function window_(text: string, at: number, len: number): string {
  const from = Math.max(0, at - 48);
  const to = Math.min(text.length, at + len + 72);
  return `${from > 0 ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`;
}

/**
 * Search across what I wrote, not what the app computed.
 *
 * The explanation and the lesson are the only free text in the journal, which
 * makes them the only place a half-remembered thought can be found again —
 * "that one where I said I was chasing it" is a real query and no filter
 * answers it.
 */
export function search(
  trades: Trade[],
  raw: string,
  limit = 40,
  pages: JournalPage[] = [],
): Hit[] {
  const q = raw.trim().toLowerCase();
  if (q.length < 2) return [];

  const hits: Hit[] = [];

  /*
    Journal pages first.

    Not a ranking judgement — they are the newest thing written and the least
    indexed anywhere else, so a half-remembered thought is far more likely to
    be in one of them than in a trade's lesson from March.
  */
  for (const page of pages) {
    const fields: Array<['title' | 'page', string]> = [
      ['title', page.title],
      ['page', page.plain],
    ];
    for (const [field, text] of fields) {
      const at = text.toLowerCase().indexOf(q);
      if (at === -1) continue;
      hits.push({ kind: 'page', page, field, excerpt: window_(text, at, q.length) });
      break;
    }
    if (hits.length >= limit) break;
  }

  for (const trade of trades) {
    type TradeField = Extract<Hit, { kind: 'trade' }>['field'];
    const fields: Array<[TradeField, string]> = [
      ['explanation', trade.explanation],
      ['lesson', trade.lesson ?? ''],
      ['reason', trade.reason],
      ['setup', trade.setup_type],
      ['mistake', trade.mistake_tags.join(', ')],
    ];

    for (const [field, text] of fields) {
      const at = text.toLowerCase().indexOf(q);
      if (at === -1) continue;
      hits.push({ kind: 'trade', trade, field, excerpt: window_(text, at, q.length) });
      break; // One hit per trade — the first field that matched is enough.
    }
    if (hits.length >= limit) break;
  }

  return hits;
}
