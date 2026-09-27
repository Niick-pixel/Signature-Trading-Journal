// Updates, from this repository's GitHub releases.
//
// The one network call Signature makes, and only in the installed app: "is
// there a newer version than mine?" to the releases of the repository it was
// built from. Nothing about the journal is sent. A newer version downloads in
// the background and installs when the app is closed — or right away from the
// "Restart to update" button. Settings can turn the automatic check off; the
// "Check now" button still works either way.

const fs = require('node:fs');
const path = require('node:path');

const PREFS_FILE = 'updates.json';
const FIRST_CHECK_MS = 8_000;
const EVERY_MS = 4 * 60 * 60 * 1000;

function readPrefs(settingsDir) {
  try { return { auto: true, ...JSON.parse(fs.readFileSync(path.join(settingsDir, PREFS_FILE), 'utf8')) }; } catch { return { auto: true }; }
}
function writePrefs(settingsDir, prefs) {
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(path.join(settingsDir, PREFS_FILE), JSON.stringify(prefs, null, 2));
}

/**
 * Wires the updater to the window. `enabled` is false for a copy that cannot
 * update itself (running from source, or the portable .exe); it still answers
 * the Settings panel so it can explain why.
 */
function setupUpdates({ ipcMain, getWindow, settingsDir, logDir, enabled, reason, version, testFeed }) {
  let state = { state: enabled ? 'idle' : 'unavailable', version, reason: enabled ? null : reason };
  const send = (next) => {
    state = { ...state, ...next };
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('signature:update', state);
  };

  let updater = null;
  if (enabled) {
    ({ autoUpdater: updater } = require('electron-updater'));
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowDowngrade = false;
    // A plain log beside the journal: a packaged app has no console.
    updater.logger = {
      info: (m) => log(logDir, 'info', m), warn: (m) => log(logDir, 'warn', m),
      error: (m) => log(logDir, 'error', m), debug: () => {},
    };
    if (testFeed) {
      // Development only: a local feed, to exercise the whole flow.
      // The download step still reads a config file, as a packaged app's
      // app-update.yml; one is written to the settings folder for it.
      const config = path.join(settingsDir, 'dev-app-update.yml');
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(config, `provider: generic\nurl: ${testFeed}\nupdaterCacheDirName: signature-updater-test\n`);
      updater.forceDevUpdateConfig = true;
      updater.updateConfigPath = config;
      updater.setFeedURL({ provider: 'generic', url: testFeed });
    }
    updater.on('checking-for-update', () => send({ state: 'checking', error: null }));
    updater.on('update-not-available', () => send({ state: 'current', checkedAt: new Date().toISOString() }));
    updater.on('update-available', (info) => send({ state: 'downloading', next: info.version, percent: 0 }));
    updater.on('download-progress', (p) => send({ state: 'downloading', percent: Math.round(p.percent) }));
    updater.on('update-downloaded', (info) => send({ state: 'ready', next: info.version }));
    updater.on('error', (err) => send({ state: 'error', error: String(err?.message ?? err).split('\n')[0] }));
  }

  const check = async () => {
    if (!updater) return state;
    try { await updater.checkForUpdates(); } catch (err) { send({ state: 'error', error: String(err?.message ?? err).split('\n')[0] }); }
    return state;
  };

  ipcMain.handle('signature:update-state', () => ({ ...state, auto: readPrefs(settingsDir).auto }));
  ipcMain.handle('signature:update-check', () => check());
  ipcMain.handle('signature:update-auto', (_e, on) => {
    writePrefs(settingsDir, { ...readPrefs(settingsDir), auto: on === true });
    return readPrefs(settingsDir).auto;
  });
  ipcMain.handle('signature:update-install', () => {
    if (updater && state.state === 'ready') {
      // Closes the window (and with it the journal's server) and runs the
      // installer silently, then reopens Signature.
      setImmediate(() => updater.quitAndInstall(true, true));
      return true;
    }
    return false;
  });

  if (updater) {
    const auto = () => readPrefs(settingsDir).auto;
    setTimeout(() => { if (auto()) check(); }, FIRST_CHECK_MS);
    setInterval(() => { if (auto() && state.state !== 'ready' && state.state !== 'downloading') check(); }, EVERY_MS);
  }
  return { check };
}

function log(dir, level, message) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'update.log'), `${new Date().toISOString()} ${level} ${message}\n`);
  } catch { /* logging never breaks updating */ }
}

module.exports = { setupUpdates, readPrefs, writePrefs };
