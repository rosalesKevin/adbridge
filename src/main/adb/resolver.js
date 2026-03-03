const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let _resolved = null;

/**
 * Returns the path to the ADB executable.
 * Prefers the bundled binary in vendor/adb (or resources/adb when packaged).
 * Falls back to 'adb' on system PATH if bundled binary is not found.
 */
function getAdbExe() {
  if (_resolved) return _resolved;

  const bundled = app.isPackaged
    ? path.join(process.resourcesPath, 'scrcpy', 'adb.exe')
    : path.join(__dirname, '..', '..', '..', 'vendor', 'scrcpy', 'adb.exe');

  _resolved = fs.existsSync(bundled) ? bundled : 'adb';
  console.log(`[ADB] Using: ${_resolved}`);
  return _resolved;
}

module.exports = { getAdbExe };
