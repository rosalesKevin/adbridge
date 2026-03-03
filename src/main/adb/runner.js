const { execFile } = require('node:child_process');
const { getAdbExe } = require('./resolver');

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

module.exports = { runAdb };
