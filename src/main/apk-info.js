'use strict';

const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function runAapt(executable, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 4 }, (err, stdout, stderr) => {
      if (err?.code === 'ENOENT') {
        reject(err);
        return;
      }
      if (err && !stdout) {
        reject(new Error(stderr || err.message));
        return;
      }
      resolve(stdout || stderr || '');
    });
  });
}

function findLatestBuildToolsBinDir() {
  // Android Studio installs the SDK under %LOCALAPPDATA% without setting ANDROID_HOME.
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
    || (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
  if (!sdkRoot) return null;

  const buildToolsDir = path.join(sdkRoot, 'build-tools');
  try {
    const versions = fs.readdirSync(buildToolsDir)
      .filter((v) => /^\d+\.\d+\.\d+/.test(v))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    if (versions.length > 0) {
      return path.join(buildToolsDir, versions[0]);
    }
  } catch { /* directory not found */ }

  return null;
}

async function findAndRunAapt(args, timeoutMs = 15000) {
  // aapt/aapt2 from PATH first, then from the newest Android SDK build-tools.
  const binDir = findLatestBuildToolsBinDir();
  const sdkTools = binDir ? ['aapt.exe', 'aapt2.exe', 'aapt', 'aapt2'].map((name) => path.join(binDir, name)) : [];
  for (const executable of ['aapt', 'aapt2', ...sdkTools]) {
    try { return await runAapt(executable, args, timeoutMs); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }

  throw new Error(
    'aapt not found. Install Android SDK build-tools and set ANDROID_HOME, or add aapt to PATH.'
  );
}

/**
 * Extract the package name from a local APK file.
 * @param {string} apkPath
 * @returns {Promise<string>} package name, e.g. "com.example.myapp"
 */
async function getApkPackageName(apkPath) {
  if (!apkPath || typeof apkPath !== 'string') throw new Error('APK path is required');

  const output = await findAndRunAapt(['dump', 'badging', apkPath]);
  const match = output.match(/^package: name='([^']+)'/m);
  if (!match) throw new Error('Could not extract package name from APK');
  return match[1];
}

module.exports = { getApkPackageName, findLatestBuildToolsBinDir };
