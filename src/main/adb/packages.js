const fs = require('node:fs');
const { runAdb, spawnAdbWithInactivityTimeout } = require('./runner');
const { validateDeviceId, validatePackageName } = require('./validation');

async function getPackages(deviceId, userOnly = true) {
  validateDeviceId(deviceId);

  const args = ['-s', deviceId, 'shell', 'pm', 'list', 'packages'];
  if (userOnly) args.push('-3');

  const { stdout } = await runAdb(args);
  const packages = [];

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('package:')) {
      packages.push(trimmed.substring('package:'.length).trim());
    }
  }

  packages.sort();
  return packages;
}

async function uninstallApp(deviceId, packageName) {
  validateDeviceId(deviceId);
  validatePackageName(packageName);

  // Use inactivity timeout for uninstalls as they can sometimes hang
  return spawnAdbWithInactivityTimeout(['-s', deviceId, 'uninstall', packageName], 60000);
}

async function clearAppData(deviceId, packageName) {
  validateDeviceId(deviceId);
  validatePackageName(packageName);

  const { stdout, stderr } = await runAdb(['-s', deviceId, 'shell', 'pm', 'clear', packageName]);
  return stdout || stderr || 'No output from ADB';
}


/**
 * Extracts the "requested permissions:" block from `dumpsys package` output.
 * Names are passed to the device shell, so anything beyond [A-Za-z0-9_.] is dropped.
 */
function parseRequestedPermissions(dumpsysOutput) {
  const permissions = [];
  let headerIndent = -1;

  for (const line of dumpsysOutput.split('\n')) {
    const indent = line.search(/\S/);
    if (headerIndent < 0) {
      if (line.trim() === 'requested permissions:') headerIndent = indent;
      continue;
    }
    if (indent <= headerIndent) break;

    const name = line.trim().split(/[:\s]/)[0];
    if (/^[A-Za-z0-9_.]+$/.test(name)) permissions.push(name);
  }

  return permissions;
}

async function grantAllPermissions(deviceId, packageName) {
  validateDeviceId(deviceId);
  validatePackageName(packageName);

  const { stdout } = await runAdb(['-s', deviceId, 'shell', 'dumpsys', 'package', packageName]);
  const granted = [];
  const skipped = [];

  for (const permission of parseRequestedPermissions(stdout)) {
    // pm grant prints nothing on success; install-time/special permissions print an exception.
    const result = await runAdb(['-s', deviceId, 'shell', 'pm', 'grant', packageName, permission]);
    (result.stdout || result.stderr ? skipped : granted).push(permission);
  }

  return { granted, skipped };
}

/** Returns the package's lastUpdateTime (changes on every install/update), or null if not installed. */
async function getPackageUpdateTime(deviceId, packageName) {
  validateDeviceId(deviceId);
  validatePackageName(packageName);

  const { stdout } = await runAdb(['-s', deviceId, 'shell', 'dumpsys', 'package', packageName]);
  const match = stdout.match(/lastUpdateTime=([^\r\n]+)/);
  return match ? match[1].trim() : null;
}

async function installApk(deviceId, apkPath, options) {
  validateDeviceId(deviceId);

  if (!apkPath || typeof apkPath !== 'string') {
    throw new Error('APK path cannot be empty');
  }
  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK file does not exist: ${apkPath}`);
  }
  if (!apkPath.toLowerCase().endsWith('.apk')) {
    throw new Error(`File is not an APK: ${apkPath}`);
  }

  // Use inactivity timeout for installs as large APKs can take a long time to push and install
  const flags = options?.grantPermissions === true ? ['-r', '-g'] : ['-r'];
  const installArgs = ['-s', deviceId, 'install', ...flags, apkPath];

  try {
    return await spawnAdbWithInactivityTimeout(installArgs, 60000);
  } catch (error) {
    if (!error.message.includes('INSTALL_FAILED_DEPRECATED_SDK_VERSION')) {
      throw error;
    }

    return spawnAdbWithInactivityTimeout(
      ['-s', deviceId, 'install', '--bypass-low-target-sdk-block', ...flags, apkPath],
      60000
    );
  }
}

module.exports = {
  getPackages,
  uninstallApp,
  clearAppData,
  parseRequestedPermissions,
  grantAllPermissions,
  getPackageUpdateTime,
  installApk
};
