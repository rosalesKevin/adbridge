'use strict';

const https = require('node:https');
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
let _releasePageUrl = null;

// ── GitHub API ────────────────────────────────────────────────────────────────

/**
 * Fetch the latest release info from GitHub.
 * Returns release data or null on any failure.
 * @param {number} timeoutMs
 * @returns {Promise<{ tagName: string, releasePageUrl: string } | null>}
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
            const asset = (data.assets || []).find(a => /^ADBridge-v\d+\.\d+\.\d+\.zip$/.test(a.name));
            if (!asset) return resolve(null);
            resolve({
              tagName: data.tag_name || '',
              releasePageUrl: data.html_url || ''
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
 * Open the GitHub releases page in the system browser.
 * Called when the user clicks "Open Download Page".
 */
function openReleasePage() {
  if (_releasePageUrl) shell.openExternal(_releasePageUrl);
}

module.exports = { checkForUpdates, openReleasePage, parseVersion, isNewer };
