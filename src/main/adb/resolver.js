const path = require('node:path');
const fs = require('node:fs');
const { resolveToolPath } = require('../runtime-paths');

let _resolved = null;

/**
 * Returns the path to the ADB executable.
 * Prefers the bundled binary in vendor/scrcpy (dev) or scrcpy/ beside the exe (packaged).
 * Falls back to 'adb' on system PATH if bundled binary is not found.
 */
function getAdbExe() {
  if (_resolved) return _resolved;

  _resolved = resolveAdbExe();
  console.log(`[ADB] Using: ${_resolved}`);
  return _resolved;
}

function resolveAdbExe({
  execPath = process.execPath,
  resourcesPath = process.resourcesPath,
  existsSync = fs.existsSync
} = {}) {
  const devBaseDir = path.join(__dirname, '..', '..', '..', 'vendor', 'scrcpy');
  const bundled = resolveToolPath({
    toolName: 'adb.exe',
    execPath,
    resourcesPath,
    devBaseDir,
    existsSync
  });

  return bundled || 'adb';
}

module.exports = { getAdbExe, resolveAdbExe };
