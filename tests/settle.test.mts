/*
  Dropping a group: it comes to rest clear of every other group, on the grid,
  and as close as possible to where it was let go.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { settle, SNAP } from '../lib/layout.ts';

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('a drop on open board stays where it was let go, snapped', () => {
  assert.deepEqual(settle({ x: 1003, y: 1011, width: 300, height: 200 }, [{ x: 0, y: 0, width: 300, height: 200 }]), { x: 1000, y: 1020 });
});

test('a drop between two close groups lands clear of both (the ping-pong case)', () => {
  // The board that failed: a wide group dropped onto a narrow one with
  // neighbours tight on either side.
  const others = [
    { x: 0, y: 0, width: 752, height: 460 },
    { x: 812, y: 0, width: 380, height: 278 },
    { x: 1252, y: 0, width: 752, height: 460 },
    { x: 0, y: 520, width: 752, height: 460 },
    { x: 812, y: 520, width: 380, height: 278 },
  ];
  const moved = { x: 780, y: 20, width: 752, height: 460 };
  const at = settle(moved, others);
  const rest = { ...moved, ...at };
  for (const o of others) assert.ok(!overlaps(rest, o), `overlaps ${JSON.stringify(o)} at ${JSON.stringify(at)}`);
  assert.ok(at.x % SNAP === 0);
  assert.ok(at.y % SNAP === 0);
});

test('it takes the nearest clear spot, not a far one', () => {
  const at = settle({ x: 90, y: 0, width: 100, height: 100 }, [{ x: 0, y: 0, width: 100, height: 100 }]);
  // Just to the right of the group (100 + 24 gap → 140 on the grid).
  assert.deepEqual(at, { x: 140, y: 0 });
});
