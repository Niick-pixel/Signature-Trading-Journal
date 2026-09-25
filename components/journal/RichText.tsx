'use client';

import { useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';

/**
 * The page itself: a contentEditable surface with a formatting toolbar.
 *
 * Two deliberate decisions.
 *
 * PASTE IS ALWAYS PLAIN TEXT. Pasting from a web page otherwise drops that
 * page's markup — and its scripts, its tracking pixels, its fonts — straight
 * into the journal, which then renders it back with innerHTML. Forcing text
 * means the only markup a page ever contains is what this toolbar produced,
 * which is also why it never looks like someone else's website.
 *
 * FORMATTING USES execCommand. It is deprecated and it is also the only thing
 * that gets selection-preserving rich editing right in one screen of code
 * rather than three thousand. This runs in one Chromium, offline, where it
 * works; the alternative is a ProseMirror-sized dependency for bold and
 * italic. styleWithCSS makes it emit inline styles instead of <font> tags,
 * which is what the sanitiser's allowlist expects.
 */
export interface RichTextHandle {
  focus: () => void;
}

const SIZES = [
  { label: 'Small', px: '14px' },
  { label: 'Normal', px: '17px' },
  { label: 'Large', px: '21px' },
  { label: 'Huge', px: '28px' },
];

export function RichText({
  value, onChange, onAddImage, placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  onAddImage?: () => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /*
    The editor is not a controlled input.

    Writing `value` back into innerHTML on every keystroke would move the caret
    to the start of the document on each character — the classic
    contentEditable mistake. The DOM is written only when the value changed
    somewhere OTHER than here, which is what `lastPushed` tracks.

    It starts as null rather than as `value`, and that is the whole point.
    Seeded with `value`, the very first run of the effect below compared the
    incoming HTML against itself, matched, and returned WITHOUT ever writing it
    into the div — so the editor mounted empty no matter what the page said.
    The open page is keyed by id, so this happened on every page you opened,
    and then the first keystroke pushed that empty div back as the page's body
    and autosave wrote it to disk. It did not just fail to show your writing,
    it destroyed it. null cannot equal a string, so the first sync always runs.
  */
  const lastPushed = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === lastPushed.current) return;
    el.innerHTML = value;
    lastPushed.current = value;
  }, [value]);

  useEffect(() => {
    document.execCommand('styleWithCSS', false, 'true');
  }, []);

  const push = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    /*
      Never report the contents of an editor that has not been filled in yet.

      Clearing a page on purpose must still save — that is a legitimate edit —
      so this cannot simply refuse empty HTML. What it refuses is a push from a
      surface the sync effect has never written to, which is the only way an
      empty div can be standing in for a page that is not empty.
    */
    if (lastPushed.current === null) return;
    lastPushed.current = el.innerHTML;
    onChange(el.innerHTML);
  }, [onChange]);

  const run = useCallback((command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    push();
  }, [push]);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    // insertText keeps the undo stack intact, which manual DOM surgery does not.
    document.execCommand('insertText', false, text);
    push();
  }, [push]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Group>
          <Tool onClick={() => run('bold')} title="Bold (Ctrl+B)" label="B" bold />
          <Tool onClick={() => run('italic')} title="Italic (Ctrl+I)" label="I" italic />
          <Tool onClick={() => run('underline')} title="Underline (Ctrl+U)" label="U" underline />
          <Tool onClick={() => run('strikeThrough')} title="Strike through" label="S" strike />
        </Group>

        <Group>
          <Tool onClick={() => run('formatBlock', 'h2')} title="Big heading" label="H1" />
          <Tool onClick={() => run('formatBlock', 'h3')} title="Small heading" label="H2" />
          <Tool onClick={() => run('formatBlock', 'p')} title="Normal paragraph" label="¶" />
          <Tool onClick={() => run('formatBlock', 'blockquote')} title="Quote" label="❝" />
        </Group>

        <Group>
          <Tool onClick={() => run('insertUnorderedList')} title="Bulleted list" label="•—" />
          <Tool onClick={() => run('insertOrderedList')} title="Numbered list" label="1—" />
        </Group>

        <Group>
          {SIZES.map((s) => (
            <Tool
              key={s.px}
              onClick={() => { /* handled on mousedown, to keep the selection */ }}
              onMouseDown={(e) => {
                // fontSize only offers 1-7; setting the size directly on the
                // selection is the only way to get an actual pixel value.
                e.preventDefault();
                ref.current?.focus();
                document.execCommand('fontSize', false, '4');
                for (const font of ref.current?.querySelectorAll('font[size="4"]') ?? []) {
                  const span = document.createElement('span');
                  span.style.fontSize = s.px;
                  span.innerHTML = font.innerHTML;
                  font.replaceWith(span);
                }
                push();
              }}
              title={`${s.label} text`}
              label={s.label[0]}
            />
          ))}
        </Group>

        <Group>
          <Tool onClick={() => run('hiliteColor', 'rgb(var(--amber) / 0.28)')} title="Highlight" label="▨" />
          <Tool onClick={() => run('removeFormat')} title="Clear formatting" label="⌫" />
        </Group>

        {onAddImage && (
          <Group>
            <Tool onClick={onAddImage} title="Add a screenshot at the cursor" label="🖼" />
          </Group>
        )}
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={push}
        onBlur={push}
        onPaste={onPaste}
        data-placeholder={placeholder}
        className="signature-page min-h-[24rem] rounded-[calc(18px*var(--rk))] px-1 outline-none"
        style={{ color: 'var(--text)' }}
      />
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 rounded-[calc(11px*var(--rk))] p-0.5"
      style={{ background: 'var(--glass-fill)', border: '1px solid var(--glass-stroke)' }}>
      {children}
    </div>
  );
}

function Tool({
  onClick, onMouseDown, title, label, bold, italic, underline, strike,
}: {
  onClick: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  title: string;
  label: string;
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean;
}) {
  return (
    <motion.button
      type="button"
      title={title}
      aria-label={title}
      // mousedown, not click: clicking a toolbar button blurs the editor and
      // takes the selection with it, so the command lands on nothing.
      onMouseDown={(e) => { if (onMouseDown) onMouseDown(e); else { e.preventDefault(); onClick(); } }}
      whileTap={press}
      transition={spring}
      className="grid size-7 place-items-center rounded-[calc(9px*var(--rk))] text-[12px]"
      style={{
        color: 'var(--text-dim)',
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? 'italic' : undefined,
        textDecoration: underline ? 'underline' : strike ? 'line-through' : undefined,
      }}
    >
      {label}
    </motion.button>
  );
}
