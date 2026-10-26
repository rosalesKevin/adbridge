'use strict';

const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { findLatestBuildToolsBinDir } = require('./apk-info');

function runKeytool(executable, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 2 }, (err, stdout, stderr) => {
      if (err?.code === 'ENOENT') {
        reject(err);
        return;
      }
      // keytool can write info to stderr even on success — combine both streams
      const output = [stdout, stderr].filter(Boolean).join('\n').trim();
      resolve(output || '(no output)');
    });
  });
}

async function findAndRunKeytool(args, timeoutMs = 15000) {
  try {
    return await runKeytool('keytool', args, timeoutMs);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;

    if (!process.env.JAVA_HOME) {
      throw new Error('keytool not found. Install a JDK and add it to PATH, or set the JAVA_HOME environment variable.');
    }

    const fallback = path.join(process.env.JAVA_HOME, 'bin', 'keytool.exe');
    try {
      return await runKeytool(fallback, args, timeoutMs);
    } catch (err2) {
      if (err2.code === 'ENOENT') {
        throw new Error('keytool not found in PATH or JAVA_HOME. Install a JDK.');
      }
      throw err2;
    }
  }
}

function runJava(executable, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 2 }, (err, stdout, stderr) => {
      if (!err) {
        resolve(stdout.trim() || '(no output)');
        return;
      }
      if (err.code === 'ENOENT') {
        reject(err);
        return;
      }
      // apksigner reports failures with a Java stack trace; its frames are indented, messages are not.
      const message = [stdout, stderr].join('\n').split(/\r?\n/)
        .filter((line) => line.trim() && !/^\s/.test(line))
        .join(' ');
      reject(new Error(message || err.message));
    });
  });
}

/**
 * Print the signing certificate(s) of an APK file.
 * keytool -printcert only reads v1 (JAR) signatures, so modern v2/v3-only APKs need apksigner.
 * @param {string} apkPath - local path to the APK
 */
async function getApkSigningInfo(apkPath) {
  if (!apkPath || typeof apkPath !== 'string') throw new Error('APK path is required');

  const binDir = findLatestBuildToolsBinDir();
  const jar = binDir && path.join(binDir, 'lib', 'apksigner.jar');
  if (!jar || !fs.existsSync(jar)) {
    throw new Error('apksigner not found. Install Android SDK build-tools (e.g. via Android Studio) or set ANDROID_HOME.');
  }

  const args = ['-jar', jar, 'verify', '--print-certs', '-v', apkPath];
  try {
    return await runJava('java', args, 60000);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    if (!process.env.JAVA_HOME) {
      throw new Error('java not found. Install a JDK and add it to PATH, or set the JAVA_HOME environment variable.');
    }
    return runJava(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'), args, 60000);
  }
}

/**
 * List keystore contents verbosely.
 * @param {string} keystorePath - local path to the .jks / .keystore file
 * @param {string} password - store password
 */
async function getKeystoreInfo(keystorePath, password) {
  if (!keystorePath || typeof keystorePath !== 'string') throw new Error('Keystore path is required');
  if (!password || typeof password !== 'string') throw new Error('Keystore password is required');

  return findAndRunKeytool([
    '-list', '-v',
    '-keystore', keystorePath,
    '-storepass', password,
    '-noprompt'
  ]);
}

module.exports = { getApkSigningInfo, getKeystoreInfo };
