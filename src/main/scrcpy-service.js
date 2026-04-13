'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { validateDeviceId } = require('./adb-service');
const { resolveToolPath, buildMissingToolMessage } = require('./runtime-paths');

// ── Process Registry ──
// Maps deviceId → ChildProcess for all active mirrors
/** @type {Map<string, import('node:child_process').ChildProcess>} */
const runningProcesses = new Map();

function getScrcpyExecutableForTest({
  execPath = process.execPath,
  resourcesPath = process.resourcesPath,
  existsSync = fs.existsSync
} = {}) {
  const expectedPath = path.join(path.dirname(execPath), 'scrcpy', 'scrcpy.exe');
  const devBaseDir = path.join(__dirname, '..', '..', 'vendor', 'scrcpy');
  const resolved = resolveToolPath({
    toolName: 'scrcpy.exe',
    execPath,
    resourcesPath,
    devBaseDir,
    existsSync
  });

  return {
    resolved,
    expectedPath
  };
}

/**
 * Start mirroring a device. Spawns scrcpy as a long-lived child process.
 *
 * @param {string} deviceId - ADB device serial (validated against DEVICE_ID_PATTERN)
 * @param {(eventType: 'exit'|'error', detail: string) => void} onEvent
 *   Callback fired when the process exits or errors. The IPC layer uses this
 *   to push status updates to the renderer.
 * @returns {{ success: boolean, error?: string }}
 */
function startMirror(deviceId, onEvent) {
  validateDeviceId(deviceId); // throws if invalid — same pattern as adb-service

  if (runningProcesses.has(deviceId)) {
    return { success: false, error: 'Mirror already running for this device' };
  }

  const { resolved: scrcpyExe, expectedPath } = getScrcpyExecutableForTest();

  if (!scrcpyExe) {
    return {
      success: false,
      error: buildMissingToolMessage({
        toolName: 'scrcpy.exe',
        expectedPath
      })
    };
  }

  // Arguments as array — same security principle as execFile in adb-service.js.
  // --serial: target specific device (like adb -s <id>)
  // --no-audio: prevents errors on devices without audio forwarding support
  const args = ['--serial', deviceId, '--no-audio'];
  const scrcpyDir = path.dirname(scrcpyExe);

  const proc = spawn(scrcpyExe, args, {
    cwd: scrcpyDir,        // CRITICAL: scrcpy loads DLLs from CWD on Windows
    stdio: 'ignore',       // no stdout/stderr piping — avoids buffer bloat
    detached: false,       // child dies with parent
    windowsHide: false     // scrcpy creates its own SDL window — must be visible
  });

  runningProcesses.set(deviceId, proc);

  proc.on('exit', (code, signal) => {
    runningProcesses.delete(deviceId);
    const detail = signal ? `killed (${signal})` : `exited (code ${code})`;
    onEvent('exit', detail);
  });

  proc.on('error', (err) => {
    runningProcesses.delete(deviceId);
    onEvent('error', err.message);
  });

  return { success: true };
}

/**
 * Stop mirroring a device. Kills the child process.
 * @param {string} deviceId
 * @returns {{ success: boolean, error?: string }}
 */
function stopMirror(deviceId) {
  validateDeviceId(deviceId);

  const proc = runningProcesses.get(deviceId);
  if (!proc) {
    return { success: false, error: 'No mirror running for this device' };
  }

  proc.kill('SIGTERM'); // On Windows, SIGTERM maps to TerminateProcess
  runningProcesses.delete(deviceId);
  return { success: true };
}

/**
 * Check if a device is currently being mirrored.
 * @param {string} deviceId
 * @returns {boolean}
 */
function isMirrorRunning(deviceId) {
  return runningProcesses.has(deviceId);
}

/**
 * Kill all running scrcpy processes. Called on app quit.
 */
function stopAllMirrors() {
  for (const [, proc] of runningProcesses) {
    try { proc.kill('SIGTERM'); } catch { /* already gone */ }
  }
  runningProcesses.clear();
}

module.exports = {
  getScrcpyExecutableForTest,
  startMirror,
  stopMirror,
  isMirrorRunning,
  stopAllMirrors
};
