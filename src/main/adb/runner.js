const { execFile, spawn } = require('node:child_process');
const { getAdbExe } = require('./resolver');

/**
 * Executes an ADB command and returns a promise that resolves with stdout/stderr.
 * Has a fixed timeout for simple commands.
 */
function runAdb(args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    execFile(getAdbExe(), args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          reject(new Error(`Command timed out after ${timeoutMs / 1000}s: adb ${args.join(' ')}`));
          return;
        }
        if (stdout || stderr) {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
          return;
        }
        reject(new Error(stderr || error.message));
        return;
      }

      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

/**
 * Spawns an ADB process for streaming output.
 */
function spawnAdb(args) {
  return spawn(getAdbExe(), args);
}

/**
 * Spawns an ADB process with a promise-based completion and an inactivity timeout.
 * The timeout resets whenever the process produces output on stdout or stderr.
 * This is ideal for long transfers that might take minutes/hours but should
 * never be idle for too long.
 */
function spawnAdbWithInactivityTimeout(args, inactivityTimeoutMs = 30000, onData) {
  return new Promise((resolve, reject) => {
    const child = spawn(getAdbExe(), args);
    let output = '';
    let errorOutput = '';
    let timeoutTimer = null;

    const resetTimeout = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (inactivityTimeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          child.kill();
          reject(new Error(`ADB process timed out due to inactivity (${inactivityTimeoutMs / 1000}s)`));
        }, inactivityTimeoutMs);
      }
    };

    resetTimeout();

    child.stdout.on('data', (data) => {
      resetTimeout();
      const str = data.toString();
      output += str;
      if (onData) onData(str, false);
    });

    child.stderr.on('data', (data) => {
      resetTimeout();
      const str = data.toString();
      errorOutput += str;
      if (onData) onData(str, true);
    });

    child.on('close', (code) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (code === 0) {
        resolve(output.trim() || 'Success');
      } else {
        reject(new Error(errorOutput.trim() || `ADB exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      reject(err);
    });
  });
}

module.exports = { runAdb, spawnAdb, spawnAdbWithInactivityTimeout };
