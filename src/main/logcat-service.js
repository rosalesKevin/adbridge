'use strict';

const { spawn } = require('node:child_process');
const readline = require('node:readline');
const { validateDeviceId, validatePackageName } = require('./adb/validation');
const { runAdb } = require('./adb/runner');
const { getAdbExe } = require('./adb/resolver');

const TAG_PATTERN = /^[a-zA-Z0-9._\-]+$/;

function validateTag(tag) {
  if (!TAG_PATTERN.test(tag)) {
    throw new Error(`Invalid logcat tag: ${tag}`);
  }
}

// ── Process Registry ──
// Maps deviceId → ChildProcess for all active logcat streams
/** @type {Map<string, import('node:child_process').ChildProcess>} */
const runningProcesses = new Map();

/**
 * Start a logcat stream for a device/app.
 * First resolves the app PID via `adb shell pidof`, then spawns
 * `adb logcat --pid=<pid>` with optional tag/level filters.
 *
 * @param {string} deviceId
 * @param {string} packageName
 * @param {string} tags - comma-separated tag names; empty string to skip
 * @param {string} level - V, D, I, W, E, F, or "" (all); defaults to all
 * @param {(line: string) => void} onLine - called for each stdout line
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function startLogcat(deviceId, packageName, tags, level, onLine) {
  validateDeviceId(deviceId);
  validatePackageName(packageName);

  // Parse and validate comma-separated tags
  const tagList = tags
    ? tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];
  for (const t of tagList) validateTag(t);

  if (runningProcesses.has(deviceId)) {
    return { success: false, error: 'Logcat already running for this device' };
  }

  // Resolve the app's PID — app must be running
  let pid;
  try {
    const result = await runAdb(['-s', deviceId, 'shell', 'pidof', '-s', packageName], 5000);
    pid = result.stdout.trim();
  } catch (err) {
    return { success: false, error: `Failed to resolve PID: ${err.message}` };
  }

  if (!pid || !/^\d+$/.test(pid)) {
    return {
      success: false,
      error: `"${packageName}" is not running. Start the app first.`
    };
  }

  // Build logcat args — arguments as array, same security principle as execFile
  // "" level means "All" — treat the same as "V" in filter specs
  const effectiveLevel = level || 'V';
  const args = ['-s', deviceId, 'logcat', `--pid=${pid}`, '-v', 'brief'];

  if (tagList.length > 0) {
    // Show specified tags at effectiveLevel; silence everything else
    for (const t of tagList) args.push(`${t}:${effectiveLevel}`);
    args.push('*:S');
  } else if (level && level !== 'V') {
    // No tag filter — apply global level filter (skip if "All" or "Verbose")
    args.push(`*:${level}`);
  }
  // If no tags and level is "All"/"Verbose", no extra filter — show everything for this PID

  const proc = spawn(getAdbExe(), args, {
    stdio: ['ignore', 'pipe', 'ignore']
  });

  runningProcesses.set(deviceId, proc);

  const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });

  rl.on('line', (line) => {
    if (line.trim()) onLine(line);
  });

  proc.on('exit', () => {
    runningProcesses.delete(deviceId);
    rl.close();
  });

  proc.on('error', () => {
    runningProcesses.delete(deviceId);
    rl.close();
  });

  return { success: true };
}

/**
 * Stop the logcat stream for a device.
 * @param {string} deviceId
 * @returns {{ success: boolean, error?: string }}
 */
function stopLogcat(deviceId) {
  validateDeviceId(deviceId);

  const proc = runningProcesses.get(deviceId);
  if (!proc) {
    return { success: false, error: 'No logcat running for this device' };
  }

  proc.kill('SIGTERM');
  runningProcesses.delete(deviceId);
  return { success: true };
}

/**
 * Check if logcat is running for a device.
 * @param {string} deviceId
 * @returns {boolean}
 */
function isLogcatRunning(deviceId) {
  return runningProcesses.has(deviceId);
}

/**
 * Kill all running logcat processes. Called on app quit.
 */
function stopAllLogcat() {
  for (const [, proc] of runningProcesses) {
    try { proc.kill('SIGTERM'); } catch { /* already gone */ }
  }
  runningProcesses.clear();
}

module.exports = { startLogcat, stopLogcat, isLogcatRunning, stopAllLogcat };
