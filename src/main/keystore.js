'use strict';

const { execFile } = require('node:child_process');
const path = require('node:path');

function runKeytool(executable, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 2 }, (err, stdout, stderr) => {
      if (err && err.code === 'ENOENT') {
        const e = new Error(err.message);
        e.code = 'ENOENT';
        reject(e);
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

/**
 * Print the signing certificate(s) of an APK file.
 * @param {string} apkPath - local path to the APK
 */
async function getApkSigningInfo(apkPath) {
  if (!apkPath || typeof apkPath !== 'string') throw new Error('APK path is required');
  return findAndRunKeytool(['-printcert', '-jarfile', apkPath]);
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
