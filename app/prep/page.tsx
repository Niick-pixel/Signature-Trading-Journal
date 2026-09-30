import { TitleBar } from '@/components/shell/TitleBar';
import { SessionPrep } from '@/components/prep/SessionPrep';

export const dynamic = 'force-dynamic';

/** The chart prep — the longer routine before New York. See lib/prep.ts. */
export default function PrepRoute() {
  return (
    <div className="flex h-dvh flex-col">
      <TitleBar />
      <div className="signature-enter min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[92rem] px-6 pb-16 pt-4">
          <SessionPrep />
        </div>
      </div>
    </div>
  );
}
