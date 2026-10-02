// Fit to screen: the whole interface scales with the window it is in.
//
// Every size in the app is authored in px for a window about 1920 wide. On a
// 2560x1440 monitor at 100% Windows scaling that is the same 12px text on a
// screen a third wider, so it read tiny; on a 1366x768 laptop the same layout
// ran off the bottom. This sets Chromium's page zoom — exactly what Ctrl +/-
// does in a browser — from the size of the window, so the interface keeps its
// proportions on any screen. Page zoom shrinks the CSS viewport rather than
// magnifying a picture of it, so text stays sharp, the layouts' breakpoints
// still apply, and the whiteboard's pointer maths needs no correction.
//
// The Text size setting multiplies on top, and Fit to screen can be turned
// off, which leaves the Text size alone.

/** The window the layouts are drawn for. */
const DESIGN = { width: 1920, height: 1000 };
/** Never smaller than this from fitting alone — past it, scrolling beats squinting. */
const FIT_MIN = 0.85;
const FIT_MAX = 2;
/** Fits move in steps, so dragging a window edge does not re-zoom on every pixel. */
const STEP = 0.05;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** The zoom that fits a window of this content size, in device-independent px. */
function fitFor({ width, height }) {
  const raw = Math.min(width / DESIGN.width, height / DESIGN.height);
  // Down to the step below, so the layout always has at least the room it was
  // drawn for — rounding up would put a scrollbar on a form that just fitted.
  return clamp(Math.floor((raw + 1e-9) / STEP) * STEP, FIT_MIN, FIT_MAX);
}

/** Text size from the renderer, plus whether to fit at all. */
function normalise(display) {
  const d = display && typeof display === 'object' ? display : {};
  const scale = typeof d.scale === 'number' && Number.isFinite(d.scale) ? clamp(d.scale, 0.5, 2) : 1;
  return { fit: d.fit !== false, scale };
}

function zoomFor(size, display) {
  const { fit, scale } = normalise(display);
  const f = fit ? fitFor(size) : 1;
  return { fit: f, zoom: Math.round(clamp(f * scale, 0.5, 3) * 1000) / 1000 };
}

module.exports = { DESIGN, FIT_MIN, FIT_MAX, fitFor, zoomFor, normalise };
