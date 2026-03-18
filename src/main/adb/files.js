const fs = require('node:fs');
const { runAdb, spawnAdbWithInactivityTimeout } = require('./runner');
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

/**
 * Parses ADB push/pull progress output.
 * Example: [ 15%] /sdcard/file.bin: 15/100 MB
 */
function parseTransferLine(line) {
  // Pattern for percentage and bytes/total
  // e.g. [ 15%] /remote/path: 12345/67890
  const match = line.match(/\[\s*(\d+)%\]\s+.*:\s+([\d.]+)\/([\d.]+)\s+(\w+)/);
  if (match) {
    return {
      percent: parseInt(match[1], 10),
      current: match[2],
      total: match[3],
      unit: match[4]
    };
  }
  return null;
}

async function pushFile(deviceId, localPath, remotePath, onProgress) {
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

  return spawnAdbWithInactivityTimeout(['-s', deviceId, 'push', localPath, remotePath], 60000, (str) => {
    if (onProgress) {
      const progress = parseTransferLine(str);
      if (progress) onProgress(progress);
    }
  });
}

async function pullFile(deviceId, remotePath, localPath, onProgress) {
  validateDeviceId(deviceId);

  if (!remotePath || typeof remotePath !== 'string' || !remotePath.startsWith('/')) {
    throw new Error('Remote path must start with /');
  }
  if (!localPath || typeof localPath !== 'string') {
    throw new Error('Local destination path cannot be empty');
  }

  return spawnAdbWithInactivityTimeout(['-s', deviceId, 'pull', remotePath, localPath], 60000, (str) => {
    if (onProgress) {
      const progress = parseTransferLine(str);
      if (progress) onProgress(progress);
    }
  });
}

async function makeDirectory(deviceId, remotePath) {
  validateDeviceId(deviceId);

  if (!remotePath || typeof remotePath !== 'string' || !remotePath.startsWith('/')) {
    throw new Error('Remote path must start with /');
  }
  if (/[\0]/.test(remotePath)) {
    throw new Error('Remote path contains invalid characters');
  }

  const escapedPath = remotePath.replace(/'/g, "'\\''");
  const { stdout, stderr } = await runAdb(['-s', deviceId, 'shell', `mkdir '${escapedPath}'`], 10000);
  return stdout || stderr || 'Directory created';
}

async function deleteEntry(deviceId, remotePath) {
  validateDeviceId(deviceId);

  if (!remotePath || typeof remotePath !== 'string' || !remotePath.startsWith('/')) {
    throw new Error('Remote path must start with /');
  }
  if (remotePath === '/') {
    throw new Error('Cannot delete root directory');
  }
  if (/[\0]/.test(remotePath)) {
    throw new Error('Remote path contains invalid characters');
  }

  const escapedPath = remotePath.replace(/'/g, "'\\''");
  const { stdout, stderr } = await runAdb(['-s', deviceId, 'shell', `rm -rf '${escapedPath}'`], 30000);
  return stdout || stderr || 'Deleted';
}

async function renameEntry(deviceId, remotePath, newName) {
  validateDeviceId(deviceId);

  if (!remotePath || typeof remotePath !== 'string' || !remotePath.startsWith('/')) {
    throw new Error('Remote path must start with /');
  }
  if (!newName || typeof newName !== 'string') {
    throw new Error('New name cannot be empty');
  }
  if (newName.includes('/') || /[\0]/.test(newName)) {
    throw new Error('New name contains invalid characters');
  }

  const parentPath = remotePath.endsWith('/')
    ? remotePath.slice(0, -1).slice(0, remotePath.slice(0, -1).lastIndexOf('/') + 1)
    : remotePath.slice(0, remotePath.lastIndexOf('/') + 1);

  const newPath = `${parentPath}${newName}`;
  const escapedOld = remotePath.replace(/'/g, "'\\''");
  const escapedNew = newPath.replace(/'/g, "'\\''");

  const { stdout, stderr } = await runAdb(
    ['-s', deviceId, 'shell', `mv '${escapedOld}' '${escapedNew}'`],
    10000
  );
  return stdout || stderr || 'Renamed';
}

module.exports = {
  listDirectory,
  pushFile,
  pullFile,
  makeDirectory,
  deleteEntry,
  renameEntry
};
