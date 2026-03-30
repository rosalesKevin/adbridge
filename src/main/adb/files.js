const fs = require('node:fs');
const path = require('node:path');
const { runAdb, spawnAdbWithInactivityTimeout } = require('./runner');
const { validateDeviceId } = require('./validation');

/**
 * Returns the size of a remote file in bytes.
 * Tries `stat` first (works on all Android versions, outputs "Size: N"),
 * then falls back to `ls -la` parsing.
 * Returns 0 on any error (file not found, directory, unsupported device).
 */
async function getRemoteFileSize(deviceId, remotePath) {
  try {
    const escaped = remotePath.replace(/'/g, "'\\''");
    // stat is available on both toybox and busybox Android and outputs "Size: N"
    try {
      const { stdout: statOut } = await runAdb(['-s', deviceId, 'shell', `stat '${escaped}'`], 3000);
      const statMatch = statOut.match(/Size:\s+(\d+)/);
      if (statMatch) return parseInt(statMatch[1], 10);
    } catch {}
    // Fallback: ls -la
    const { stdout } = await runAdb(['-s', deviceId, 'shell', `ls -la '${escaped}'`], 3000);
    // Toybox (Android 6+): ... size YYYY-MM-DD HH:MM name
    let match = stdout.match(/\s(\d+)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/);
    if (match) return parseInt(match[1], 10);
    // Busybox: ... size Mon DD HH:MM or Mon DD YYYY
    match = stdout.match(/\s(\d+)\s+[A-Z][a-z]{2}\s+\d{1,2}\s+[\d:]+/);
    if (match) return parseInt(match[1], 10);
  } catch {}
  return 0;
}

/**
 * Polls progress on a 500ms interval by calling getProgressFn().
 * getProgressFn may be async. Overlapping calls are skipped.
 * Returns a stop function that cancels the interval.
 */
function startProgressPolling(getProgressFn, onProgress) {
  let busy = false;
  const id = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const progress = await getProgressFn();
      if (progress !== null && onProgress) onProgress(progress);
    } catch {}
    busy = false;
  }, 250);
  return () => clearInterval(id);
}

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
 * ADB outputs lines like:
 *   [ 15%] /sdcard/file.bin                          (percent only)
 *   [ 15%] /sdcard/file.bin: 15.98/100.0 MB          (with transfer size)
 */
function parseTransferLine(line) {
  // With transfer size: [ 15%] /path: 15.98/100.0 MB
  const fullMatch = line.match(/\[\s*(\d+)%\]\s+.*:\s+([\d.]+)\/([\d.]+)\s+(\w+)/);
  if (fullMatch) {
    return {
      percent: parseInt(fullMatch[1], 10),
      current: fullMatch[2],
      total: fullMatch[3],
      unit: fullMatch[4]
    };
  }
  // Percent only: [ 15%] /path
  const pctMatch = line.match(/\[\s*(\d+)%\]/);
  if (pctMatch) {
    return {
      percent: parseInt(pctMatch[1], 10),
      current: null,
      total: null,
      unit: null
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

  // ADB suppresses [XX%] progress when stderr is a pipe (not a TTY).
  // Instead, poll the remote file size and compare against the known local size.
  let stopPolling = null;
  if (onProgress) {
    let localSize = 0;
    try {
      const stat = fs.statSync(localPath);
      if (stat.isFile()) localSize = stat.size;
    } catch {}

    if (localSize > 0) {
      const fileName = path.basename(localPath);
      const remoteFilePath = remotePath.endsWith('/') ? `${remotePath}${fileName}` : remotePath;
      stopPolling = startProgressPolling(async () => {
        const remoteSize = await getRemoteFileSize(deviceId, remoteFilePath);
        const percent = Math.floor(remoteSize / localSize * 100);
        if (percent <= 0) return null;
        return { percent: Math.min(99, percent), current: null, total: null, unit: null };
      }, onProgress);
    }
  }

  try {
    return await spawnAdbWithInactivityTimeout(['-s', deviceId, 'push', localPath, remotePath], 60000);
  } finally {
    if (stopPolling) stopPolling();
  }
}

async function pullFile(deviceId, remotePath, localPath, onProgress, knownTotalSize = 0) {
  validateDeviceId(deviceId);

  if (!remotePath || typeof remotePath !== 'string' || !remotePath.startsWith('/')) {
    throw new Error('Remote path must start with /');
  }
  if (!localPath || typeof localPath !== 'string') {
    throw new Error('Local destination path cannot be empty');
  }

  // ADB suppresses [XX%] progress when stderr is a pipe (not a TTY).
  // Instead, use the known file size (passed from listDirectory) or query it,
  // then poll the local destination file size as it grows.
  let stopPolling = null;
  if (onProgress) {
    const totalSize = knownTotalSize > 0 ? knownTotalSize : await getRemoteFileSize(deviceId, remotePath);
    if (totalSize > 0) {
      const localFilePath = path.join(localPath, path.basename(remotePath));
      stopPolling = startProgressPolling(() => {
        try {
          const { size } = fs.statSync(localFilePath);
          const percent = Math.floor(size / totalSize * 100);
          if (percent <= 0) return null;
          return { percent: Math.min(99, percent), current: null, total: null, unit: null };
        } catch {
          return null;
        }
      }, onProgress);
    }
  }

  try {
    return await spawnAdbWithInactivityTimeout(['-s', deviceId, 'pull', remotePath, localPath], 60000);
  } finally {
    if (stopPolling) stopPolling();
  }
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
  parseTransferLine,
  listDirectory,
  pushFile,
  pullFile,
  makeDirectory,
  deleteEntry,
  renameEntry
};
