// Signature runs in its own window. The renderer is a Next.js server that this
// process starts and owns — nothing is ever served to an outside browser, and
// the server dies with the window.

const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { restoreWindowState, trackWindowState, rememberGround } = require('./window-state');

const isDev = !app.isPackaged;
const ROOT = path.join(__dirname, '..');

/**
 * Where the journal lives.
 *
 * Running from source it is ./data, beside the code. In a packaged build it
 * sits next to the executable, which is what makes the portable build actually
 * portable: copy Signature.exe onto a USB stick, and its data/ folder travels
 * with it. Nothing is written to AppData or the registry.
 */
function resolveDataDir() {
  if (!app.isPackaged) return path.join(ROOT, 'data');

  // A portable build is a self-extracting archive: it unpacks itself into a
  // temp folder and runs from there, so process.execPath points at %TEMP%,
  // not at the executable the user actually double-clicked. Writing the
  // journal there means it is thrown away when the temp folder is cleaned.
  // electron-builder exports the real location for exactly this reason.
  const beside = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  const candidate = path.join(beside, 'data');

  // Beside the executable is only the right answer if it is actually writable.
  // Dropped into Program Files, or onto a read-only volume, it is not — and a
  // journal that silently fails to save is worse than one in an unexpected
  // place. Fall back to the per-user application data directory and say so.
  try {
    fs.mkdirSync(candidate, { recursive: true });
    fs.accessSync(candidate, fs.constants.W_OK);
    return candidate;
  } catch {
    const fallback = path.join(app.getPath('userData'), 'data');
    fs.mkdirSync(fallback, { recursive: true });
    console.warn(`[signature] ${candidate} is not writable; using ${fallback}`);
    return fallback;
  }
}

const DATA_DIR = resolveDataDir();

/** In a packaged build the app is unpacked under resources/app. */
const APP_DIR = app.isPackaged ? path.join(process.resourcesPath, 'app') : ROOT;

/** The window ground. Signature defaults to light, so the frame must too —
 *  otherwise the shell flashes black before React paints. */
const SHELL_BG = '#e9e2d4';

let nextServer = null;
let mainWindow = null;
/** Last few lines of server output, so a startup failure can explain itself. */
let serverLog = [];
let serverExited = null;

/** Ask the OS for a free port so two copies never fight over 3000. */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Wait until the server actually answers a request.
 *
 * This used to be a bare TCP connect, which succeeds the moment the listener
 * exists — before Next has finished wiring up its request handler. The window
 * then loaded too early and the renderer showed a connection error instead of
 * the app. An HTTP round trip is the only honest test of "ready".
 */
function waitForServer(port, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      // If the server already died there is nothing to wait for. Without this
      // the app hangs for the full timeout and then reports a timeout, hiding
      // the real reason.
      if (serverExited !== null) {
        reject(new Error(serverLog.join('').trim() || `The local server exited with code ${serverExited}.`));
        return;
      }

      const req = http.get(
        { host: '127.0.0.1', port, path: '/api/trades', timeout: 4000 },
        (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) resolve();
          else retry();
        },
      );
      req.on('timeout', () => { req.destroy(); retry(); });
      req.on('error', retry);
    };

    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`The local server did not answer on port ${port} within ${timeoutMs / 1000}s.`));
      } else {
        setTimeout(attempt, 200);
      }
    };

    attempt();
  });
}

function startNext(port) {
  // In development Next runs from its CLI; a packaged build runs the standalone
  // server that `next build` emits, which carries only the dependencies it
  // actually needs.
  const entry = app.isPackaged
    ? path.join(APP_DIR, '.next', 'standalone', 'server.js')
    : path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');

  const args = app.isPackaged ? [entry] : [entry, 'dev', '-p', String(port)];

  // Run the server on Electron's own bundled Node (24.x), not a system install.
  //
  // This used to shell out to whatever `node` was on PATH, because the database
  // was a native addon compiled against system Node's ABI. Now that SQLite comes
  // from node:sqlite — built into the runtime — that constraint is gone, and
  // using Electron's Node means the app depends on nothing outside its own
  // folder. That is what makes a portable build possible.
  nextServer = spawn(process.execPath, args, {
    cwd: app.isPackaged ? path.join(APP_DIR, '.next', 'standalone') : ROOT,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: isDev ? 'development' : 'production',
      // process.cwd() means nothing in a packaged app, so hand the server its
      // paths explicitly rather than letting it guess.
      SIGNATURE_DATA_DIR: DATA_DIR,
      SIGNATURE_MIGRATIONS_DIR: path.join(APP_DIR, 'db', 'migrations'),
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Keep the tail of the server's output so a startup failure can explain itself.
  const record = (d) => {
    const text = String(d);
    serverLog.push(text);
    if (serverLog.length > 40) serverLog.shift();
    // A packaged app has no terminal. Without this, a server that dies leaves
    // no evidence at all beyond a blank error page in the window.
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.appendFileSync(path.join(DATA_DIR, 'server.log'), text);
    } catch {
      /* logging must never be the thing that breaks startup */
    }
  };

  nextServer.stdout.on('data', (d) => { record(d); process.stdout.write(`[next] ${d}`); });
  nextServer.stderr.on('data', (d) => { record(d); process.stderr.write(`[next] ${d}`); });
  nextServer.on('exit', (code) => {
    nextServer = null;
    serverExited = code;
    // If the server dies while the window is open, the app is useless — say so.
    if (code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox('Signature stopped', `The local server exited with code ${code}. Restart the app.`);
    }
  });
}

function createWindow(port) {
  const state = restoreWindowState(DATA_DIR);
  mainWindow = new BrowserWindow({
    ...state.options,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: state.ground ?? SHELL_BG,
    // Let the glass surfaces run to the edge; the traffic lights float over them.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: process.platform === 'darwin'
      ? undefined
      : { ...(state.ground ? { color: state.ground, symbolColor: state.symbol } : TITLE_BAR.light), height: 44 },
    trafficLightPosition: process.platform === 'darwin' ? { x: 18, y: 20 } : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  // No white flash: wait until the first frame is actually ready — and come
  // back the way the window was left.
  mainWindow.once('ready-to-show', () => {
    if (state.fullscreen) mainWindow.setFullScreen(true);
    else if (state.maximize) mainWindow.maximize();
    mainWindow.show();
  });
  // The saved zoom, once, on the first load. After that Chromium keeps
  // whatever zoom is set for the rest of the session; re-applying the startup
  // value on a later reload would undo a zoom made from the View menu, which
  // reports no event.
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.setZoomFactor(state.zoomFactor);
  });
  trackWindowState(mainWindow, state.file);

  // Any real link opens in the user's browser, not inside the app frame.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  let loadAttempts = 0;
  const load = () => mainWindow?.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || !mainWindow || mainWindow.isDestroyed()) return;
    if (loadAttempts >= 5) {
      showFailurePage(mainWindow, `${description} (${code})`);
      return;
    }
    loadAttempts += 1;
    // The server can accept a connection a moment before it serves one; give
    // it a beat rather than leaving the window on a browser error page.
    setTimeout(load, 400 * loadAttempts);
  });

  load();
  mainWindow.on('closed', () => { mainWindow = null; });
}

/**
 * Windows and Linux draw their window buttons onto a strip we colour ourselves.
 * Set once at creation it stays light forever, so switching the app to dark
 * left a white slab in the corner. The renderer tells us when the theme flips.
 */
const TITLE_BAR = {
  light: { color: '#e9e2d4', symbolColor: '#54452f' },
  dark: { color: '#131009', symbolColor: '#c0a883' },
};

ipcMain.on('signature:titlebar-theme', (_event, theme) => {
  // Six themes send their own colours; the old 'light' | 'dark' still works.
  const valid = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  const palette = theme && typeof theme === 'object' && valid(theme.color) && valid(theme.symbolColor)
    ? { color: theme.color, symbolColor: theme.symbolColor }
    : TITLE_BAR[theme === 'dark' ? 'dark' : 'light'];
  // Remembered so the next launch opens on the right ground instead of
  // flashing cream before a dark theme paints.
  rememberGround(DATA_DIR, palette.color);
  if (process.platform === 'darwin' || !mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.setBackgroundColor(palette.color);
    mainWindow.setTitleBarOverlay({ ...palette, height: 44 });
  } catch {
    /* not every platform supports a title bar overlay */
  }
});

// The Settings panel offers to reveal the journal folder; only the main
// process can talk to the OS file browser.
ipcMain.handle('signature:open-data-folder', async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  await shell.openPath(DATA_DIR);
  return DATA_DIR;
});

/**
 * Our own failure screen, carrying the tail of the server log.
 *
 * The renderer's default is Chromium's "This page couldn't load", which says
 * nothing about why and leaves no way to find out.
 */
function showFailurePage(win, reason) {
  const log = serverLog.join('').slice(-3000).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin:0; padding:48px; background:#ece7dd; color:#2b2118;
         font:14px/1.6 -apple-system,Segoe UI,system-ui,sans-serif; }
  h1 { font-size:19px; margin:0 0 6px; letter-spacing:-0.02em; }
  p { margin:0 0 18px; color:#6b5a45; }
  code { display:block; white-space:pre-wrap; background:#f6f2ea; border:1px solid #d9cfbe;
         border-radius:12px; padding:14px; font-size:11.5px; max-height:44vh; overflow:auto; color:#4a3b2a; }
  small { display:block; margin-top:16px; color:#8a7860; }
</style>
<h1>Signature could not start its local server</h1>
<p>${reason}</p>
<code>${log || 'The server produced no output.'}</code>
<small>This is also written to server.log next to your journal.</small>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Trade', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('signature:navigate', '/new') },
        { label: 'Whiteboard', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.webContents.send('signature:navigate', '/') },
        { label: 'Stats', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.webContents.send('signature:navigate', '/stats') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // Paste must stay wired up — pasting a chart out of TradingView is the
    // primary way trades get into this app.
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]));
}

// One window, one instance. A second launch focuses the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const port = await freePort();
    startNext(port);
    try {
      await waitForServer(port);
    } catch (err) {
      // Show the window with the reason in it rather than a modal and a quit —
      // an error you can read and copy is worth more than one you dismiss.
      buildMenu();
      createWindow(port);
      if (mainWindow) showFailurePage(mainWindow, String(err.message));
      return;
    }
    buildMenu();
    createWindow(port);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    });
  });

  app.on('window-all-closed', () => app.quit());
  // The server is ours; never leave it running after the window is gone.
  app.on('before-quit', () => nextServer?.kill());
  process.on('exit', () => nextServer?.kill());
}
