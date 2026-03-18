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


async function installApk(deviceId, apkPath) {
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
  return spawnAdbWithInactivityTimeout(['-s', deviceId, 'install', '-r', apkPath], 60000);
}

module.exports = {
  getPackages,
  uninstallApp,
  clearAppData,
  installApk
};
