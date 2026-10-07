import { listTrades } from '@/db/trades';
import { boardStart } from '@/db/boardlayout';
import { Whiteboard } from '@/components/whiteboard/Whiteboard';
import { TitleBar } from '@/components/shell/TitleBar';

export const dynamic = 'force-dynamic';

export default function WhiteboardPage() {
  return (
    <div className="flex h-dvh flex-col">
      <TitleBar />
      <div className="min-h-0 flex-1">
        <Whiteboard trades={listTrades()} start={boardStart()} />
      </div>
    </div>
  );
}
