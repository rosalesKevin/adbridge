'use strict';

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { app, shell, BrowserWindow } = require('electron');

// ── Version helpers (exported for unit tests) ────────────────────────────────

/**
 * Parse a version string into { major, minor, patch }.
 * Returns null for pre-release tags (contain "-") or malformed input.
 * @param {string} raw  e.g. "v1.3.0" or "1.3.0"
 * @returns {{ major: number, minor: number, patch: number } | null}
 */
function parseVersion(raw) {
  const cleaned = (raw || '').trim().replace(/^v/, '');
  if (cleaned.includes('-')) return null; // pre-release: skip
  const parts = cleaned.split('.');
  if (parts.length !== 3) return null;
  if (parts.some(p => p === '')) return null; // empty segment e.g. "1..3"
  const nums = parts.map(Number);
  if (nums.some(n => !Number.isInteger(n) || n < 0)) return null;
  return { major: nums[0], minor: nums[1], patch: nums[2] };
}

/**
 * Returns true if version `a` is strictly newer than `b`.
 * @param {{ major: number, minor: number, patch: number }} a
 * @param {{ major: number, minor: number, patch: number }} b
 */
function isNewer(a, b) {
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch > b.patch;
}

// ── Module-level state ────────────────────────────────────────────────────────

/** @type {string | null} */
let _assetDownloadUrl = null;

/** @type {string | null} */
let _releasePageUrl = null;

/** Prevents concurrent download invocations. */
let _inProgress = false;

// ── GitHub API ────────────────────────────────────────────────────────────────

/**
 * GET a URL with redirect following (GitHub asset downloads redirect to CDN).
 * @param {string} url
 * @param {number} [redirectsLeft=5]
 * @returns {Promise<import('http').IncomingMessage>}
 */
function getWithRedirects(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ADBridge-updater' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        getWithRedirects(res.headers.location, redirectsLeft - 1).then(resolve, reject);
      } else {
        resolve(res);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Fetch the latest release info from GitHub.
 * Returns release data or null on any failure.
 * @param {number} timeoutMs
 * @returns {Promise<{ tagName: string, releasePageUrl: string, assetDownloadUrl: string } | null>}
 */
function fetchLatestRelease(timeoutMs) {
  return new Promise((resolve) => {
    const req = https.get(
      'https://api.github.com/repos/rosalesKevin/adbridge/releases/latest',
      { headers: { 'User-Agent': 'ADBridge-updater' }, timeout: timeoutMs },
      (res) => {
        if (res.statusCode !== 200) { res.resume(); return resolve(null); }
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const asset = (data.assets || []).find(a => a.name === 'ADBridge.exe');
            if (!asset) return resolve(null);
            resolve({
              tagName: data.tag_name || '',
              releasePageUrl: data.html_url || '',
              assetDownloadUrl: asset.browser_download_url
            });
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Send a progress event to the renderer window. */
function sendProgress(status, percent) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.webContents.isDestroyed()) {
    win.webContents.send('updater:progress', { status, percent });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check GitHub for a newer version. Called once on did-finish-load.
 * Silent on all failures.
 */
async function checkForUpdates() {
  try {
    const release = await fetchLatestRelease(10_000);
    if (!release) return;

    const remote = parseVersion(release.tagName);
    const local = parseVersion(app.getVersion());
    if (!remote || !local) return;
    if (!isNewer(remote, local)) return;

    _assetDownloadUrl = release.assetDownloadUrl;
    _releasePageUrl = release.releasePageUrl;

    const win = BrowserWindow.getAllWindows()[0];
    if (!win || win.webContents.isDestroyed()) return;

    win.webContents.send('updater:update-available', {
      version: release.tagName.replace(/^v/, ''),
      releasePageUrl: release.releasePageUrl
    });
  } catch {
    // silent — update check must never crash the app
  }
}

/**
 * Download the new exe and perform the rename-swap via a detached bat script.
 * Falls back to error state on any failure.
 */
async function downloadAndInstall() {
  if (_inProgress) return;
  _inProgress = true;

  const exePath = process.execPath;
  const exeDir = path.dirname(exePath);
  const exeName = path.basename(exePath);
  const newExePath = path.join(exeDir, 'ADBridge-new.exe');
  const batPath = path.join(exeDir, 'ADBridge-update.bat');

  // ── Pre-flight: writable directory ──
  try {
    fs.accessSync(exeDir, fs.constants.W_OK);
  } catch {
    _inProgress = false;
    sendProgress('error');
    return;
  }

  // ── Download ──
  try {
    await downloadFile(_assetDownloadUrl, newExePath, (percent) => {
      sendProgress('downloading', percent);
    });
  } catch {
    _inProgress = false;
    sendProgress('error');
    return;
  }

  // ── Write bat helper ──
  // IMPORTANT: all paths embedded as literals (no args) to avoid Windows quoting issues.
  // ren second argument MUST be a bare filename only (Windows constraint).
  const bat = [
    '@echo off',
    'timeout /t 4 /nobreak >nul',
    `if not exist "${newExePath}" exit /b 1`,
    `ren "${exePath}" "${exeName}.old"`,
    `ren "${newExePath}" "${exeName}"`,
    `start "" "${exePath}"`,
    'timeout /t 2 /nobreak >nul',
    `del "${exePath}.old" 2>nul`,
    'del "%~f0"'
  ].join('\r\n');

  try {
    fs.writeFileSync(batPath, bat, { encoding: 'utf8', flag: 'w' });
  } catch {
    _inProgress = false;
    sendProgress('error');
    return;
  }

  // ── Launch bat detached and quit ──
  try {
    const child = spawn('cmd.exe', ['/c', batPath], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch {
    _inProgress = false;
    sendProgress('error');
    return;
  }

  app.quit();
}

/**
 * Download a file from `url` to `destPath`, streaming with progress callbacks.
 * Follows HTTP redirects. Aborts if no bytes arrive for 30 seconds.
 * @param {string} url
 * @param {string} destPath
 * @param {(percent: number | undefined) => void} onProgress
 */
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath, { flags: 'w' });
    let received = 0;
    let total = 0;
    let inactivityTimer = null;

    function resetInactivity() {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        file.destroy();
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
        reject(new Error('Download timed out (30s inactivity)'));
      }, 30_000);
    }

    function cleanup() {
      if (inactivityTimer) clearTimeout(inactivityTimer);
    }

    // Start inactivity timer immediately — guards against connection accepted
    // but headers never sent (CDN hang before response begins).
    resetInactivity();

    getWithRedirects(url).then((res) => {
      if (res.statusCode !== 200) {
        cleanup();
        file.destroy();
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      total = parseInt(res.headers['content-length'] || '0', 10);

      // IMPORTANT: attach the data listener BEFORE calling pipe().
      // pipe() calls resume() internally; the listener must be registered
      // first to guarantee it receives all chunks.
      res.on('data', (chunk) => {
        resetInactivity();
        received += chunk.length;
        onProgress(total > 0 ? Math.round((received / total) * 100) : undefined);
      });

      res.pipe(file);

      file.on('finish', () => {
        cleanup();
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        cleanup();
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
        reject(err);
      });

      res.on('error', (err) => {
        cleanup();
        file.destroy();
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
        reject(err);
      });
    }).catch((err) => {
      cleanup();
      file.destroy();
      reject(err);
    });
  });
}

/**
 * Open the GitHub releases page in the system browser.
 * Called when the user clicks "Open Download Page".
 */
function openReleasePage() {
  if (_releasePageUrl) shell.openExternal(_releasePageUrl);
}

module.exports = { checkForUpdates, downloadAndInstall, openReleasePage, parseVersion, isNewer };
