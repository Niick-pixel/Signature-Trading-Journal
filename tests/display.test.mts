/*
  Fit to screen: the zoom the interface gets for a window of a given size,
  and how the Text size multiplies on top.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { stepTextScale, textSizeOf } from '../lib/preferences.ts';

const require = createRequire(import.meta.url);
const { fitFor, zoomFor, normalise } = require('../electron/display.js');

test('the window the layouts are drawn for is drawn at 100%', () => {
  assert.equal(fitFor({ width: 1920, height: 1032 }), 1);   // 1080p, maximised over a taskbar
});

test('a 2560x1440 monitor scales up, and still leaves the layout its room', () => {
  const f = fitFor({ width: 2560, height: 1392 });
  assert.equal(f, 1.3);
  assert.ok(2560 / f >= 1920 && 1392 / f >= 1000);
});

test('a 4K monitor at 100% scales further', () => {
  assert.equal(fitFor({ width: 3840, height: 2112 }), 2);
});

test('small windows shrink, but never below the floor', () => {
  assert.equal(fitFor({ width: 1600, height: 852 }), 0.85);
  assert.equal(fitFor({ width: 1366, height: 728 }), 0.85);
  assert.equal(fitFor({ width: 960, height: 640 }), 0.85);
});

test('the fit moves in steps, not on every pixel of a resize', () => {
  assert.equal(fitFor({ width: 2400, height: 1300 }), fitFor({ width: 2410, height: 1310 }));
});

test('the Text size multiplies the fit; turning fitting off leaves it alone', () => {
  assert.deepEqual(zoomFor({ width: 2560, height: 1392 }, { fit: true, scale: 1.15 }), { fit: 1.3, zoom: 1.495 });
  assert.deepEqual(zoomFor({ width: 2560, height: 1392 }, { fit: false, scale: 1.15 }), { fit: 1, zoom: 1.15 });
});

test('anything stored is made sane', () => {
  assert.deepEqual(normalise(null), { fit: true, scale: 1 });
  assert.deepEqual(normalise({ fit: false, scale: 'big' }), { fit: false, scale: 1 });
  assert.deepEqual(normalise({ scale: 40 }), { fit: true, scale: 2 });
});

test('Ctrl = / - / 0 step through the named sizes', () => {
  assert.equal(stepTextScale(1, 1), 1.15);
  assert.equal(stepTextScale(1.3, 1), 1.3);
  assert.equal(stepTextScale(1, -1), 0.9);
  assert.equal(stepTextScale(0.9, -1), 0.9);
  assert.equal(stepTextScale(1.3, 0), 1);
  assert.equal(textSizeOf(1.12), 'Large');
});
