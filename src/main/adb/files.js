const fs = require('node:fs');
const { runAdb } = require('./runner');
const { validateDeviceId } = require('./validation');

async function listDirectory(deviceId, remotePath) {
  validateDeviceId(deviceId);

  if (!remotePath || typeof remotePath !== 'string' || !remotePath.startsWith('/')) {
    throw new Error('Remote path must start with /');
  }

  const escapedPath = remotePath.replace(/'/g, "'\\''");
  const { stdout } = await runAdb(['-s', deviceId, 'shell', `ls -la '${escapedPath}'`], 15000);
  const entries = [];

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('total ')) continue;

    const typeChar = trimmed[0];
    if (typeChar !== 'd' && typeChar !== 'l' && typeChar !== '-') continue;

    let name = null;
    let size = null;

    let match = trimmed.match(/(\d+)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+([\s\S]+)/);
    if (match) {
      size = parseInt(match[1], 10);
      name = match[2].trim();
    } else {
      match = trimmed.match(/(\d+)\s+[A-Z][a-z]{2}\s+\d{1,2}\s+[\d:]+\s+([\s\S]+)/);
      if (match) {
        size = parseInt(match[1], 10);
        name = match[2].trim();
      }
    }

    if (!name) continue;

    if (typeChar === 'l' && name.includes(' -> ')) {
      name = name.substring(0, name.indexOf(' -> ')).trim();
    }

    if (!name || name === '.' || name === '..') continue;

    entries.push({ name, isDir: typeChar === 'd' || typeChar === 'l', size });
  }

  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

async function pushFile(deviceId, localPath, remotePath) {
  validateDeviceId(deviceId);

  if (!localPath || typeof localPath !== 'string') {
    throw new Error('Local file path cannot be empty');
  }
  if (!fs.existsSync(localPath)) {
    throw new Error(`File not found: ${localPath}`);
  }
  if (!remotePath || typeof remotePath !== 'string') {
    throw new Error('Remote path cannot be empty');
  }
  if (!remotePath.startsWith('/')) {
    throw new Error('Remote path must start with / (e.g., /sdcard/Download/)');
  }
  if (/[\0]/.test(remotePath)) {
    throw new Error('Remote path contains invalid characters');
  }

  const { stdout, stderr } = await runAdb(['-s', deviceId, 'push', localPath, remotePath], 120000);
  return stdout || stderr || 'No output from ADB';
}

async function pullFile(deviceId, remotePath, localPath) {
  validateDeviceId(deviceId);

  if (!remotePath || typeof remotePath !== 'string' || !remotePath.startsWith('/')) {
    throw new Error('Remote path must start with /');
  }
  if (/[\0]/.test(remotePath)) {
    throw new Error('Remote path contains invalid characters');
  }
  if (!localPath || typeof localPath !== 'string') {
    throw new Error('Local destination path cannot be empty');
  }

  const { stdout, stderr } = await runAdb(['-s', deviceId, 'pull', remotePath, localPath], 120000);
  return stdout || stderr || 'No output from ADB';
}

module.exports = {
  listDirectory,
  pushFile,
  pullFile
};
