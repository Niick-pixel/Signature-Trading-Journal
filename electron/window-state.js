// The window as you left it: size, position, maximised or not, and how the
// interface is scaled (see display.js).
//
// The window used to be created at a fixed 1440x920 every launch, never
// maximised, and forgot any Ctrl +/- zoom — the server runs on a new random
// port each time, and Chromium remembers zoom per site, so a new port was a new
// site. This keeps all of it in data/window.json, beside the journal: the app
// promises to write nothing to AppData, and a portable copy on a USB stick
// should open the way it was last used on that stick.

const fs = require('node:fs');
const path = require('node:path');
const { screen } = require('electron');
const { normalise } = require('./display');

const DEFAULTS = { width: 1440, height: 920 };
const MIN_VISIBLE = 120;

function read(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    const b = s && s.bounds;
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    if (!b || !num(b.x) || !num(b.y) || !num(b.width) || !num(b.height)) return null;
    const hex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
    return {
      bounds: b,
      ground: hex(s.ground) ? s.ground : null,
      maximized: s.maximized === true,
      fullscreen: s.fullscreen === true,
      // Fit to screen and the Text size, so the first frame is drawn at the
      // right scale instead of jumping once the page reports its settings.
      // (An older file's fixed zoomFactor is ignored: the zoom now follows the
      // window.)
      display: normalise(s.display),
    };
  } catch {
    return null;   // first run, or a file someone edited by hand
  }
}

/**
 * Whether enough of the saved rectangle is on a screen that still exists.
 * A window saved on a second monitor that has since been unplugged would
 * otherwise open somewhere nobody can see it.
 */
function onSomeScreen(b) {
  return screen.getAllDisplays().some(({ workArea: a }) => {
    const w = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x);
    const h = Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y);
    return w >= MIN_VISIBLE && h >= MIN_VISIBLE;
  });
}

/** Options to spread into `new BrowserWindow`, plus what to do once it exists. */
function restoreWindowState(dataDir) {
  const file = path.join(dataDir, 'window.json');
  const saved = read(file);
  const usable = saved && onSomeScreen(saved.bounds);

  return {
    file,
    options: usable ? { ...saved.bounds } : { ...DEFAULTS },
    // The very first launch opens maximised: this is a full-screen kind of app,
    // and a small window in the middle of a 2560px monitor is what read as the
    // app opening "minimised".
    maximize: saved ? saved.maximized : true,
    fullscreen: Boolean(usable && saved.fullscreen),
    display: saved ? saved.display : normalise(null),
    ground: saved ? saved.ground : null,
    symbol: saved && saved.ground ? symbolFor(saved.ground) : null,
  };
}

/** Readable window-button ink for a given ground: light on dark, dark on light. */
function symbolFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.5 ? '#c9bb9c' : '#54452f';
}

let groundFile = null;
let ground = null;
/** The theme's ground, kept with the window so the next launch opens on it. */
function rememberGround(dataDir, color) {
  ground = color;
  groundFile = path.join(dataDir, 'window.json');
  try {
    const s = JSON.parse(fs.readFileSync(groundFile, 'utf8'));
    if (s.ground !== color) fs.writeFileSync(groundFile, JSON.stringify({ ...s, ground: color }, null, 2));
  } catch { /* no window file yet: the next write carries it */ }
}

let display = null;
/** Fit to screen and the Text size, kept with the window for the next launch. */
function rememberDisplay(value) {
  display = normalise(value);
}

/** Keep the file current as the window changes, and once more on close. */
function trackWindowState(win, file, initialDisplay) {
  let timer = null;
  if (!display) display = normalise(initialDisplay);

  const write = () => {
    if (!win || win.isDestroyed()) return;
    try {
      const state = {
        // The size it returns to when un-maximised, not the maximised size —
        // otherwise un-maximising after a restart gives a full-screen-sized
        // window with no way back to the one you had.
        bounds: win.getNormalBounds(),
        maximized: win.isMaximized(),
        fullscreen: win.isFullScreen(),
        display,
        ...(ground ? { ground } : {}),
      };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(state, null, 2));
    } catch (err) {
      console.warn('[signature] could not save the window state:', err);
    }
  };
  const soon = () => { clearTimeout(timer); timer = setTimeout(write, 400); };

  for (const event of ['resize', 'move']) win.on(event, soon);
  for (const event of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) win.on(event, write);

  win.on('close', () => { clearTimeout(timer); write(); });
  return { save: soon };
}

module.exports = { restoreWindowState, trackWindowState, rememberGround, rememberDisplay };
