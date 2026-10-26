const fs = require('node:fs');
const path = require('node:path');
const { runAdb, spawnAdbWithInactivityTimeout } = require('./runner');
const { validateDeviceId } = require('./validation');

/** Single-quotes a value for the device shell: 'it'\''s' */
const shQuote = (value) => `'${value.replace(/'/g, "'\\''")}'`;

/**
 * Runs a device shell command that prints nothing on success (mkdir, rm, mv, cp).
 * Any output is the device refusing ("File exists", "Permission denied"), so it becomes the error.
 */
async function runSilentCommand(deviceId, command, timeoutMs) {
  const { stdout, stderr } = await runAdb(['-s', deviceId, 'shell', command], timeoutMs);
  if (stdout || stderr) throw new Error(stdout || stderr);
}

/** Wraps a command so it only runs when `target` doesn't exist yet; prints EXISTS otherwise. */
const unlessExists = (target, command) => `if [ -e ${shQuote(target)} ]; then echo EXISTS; else ${command}; fi`;

function assertRemotePath(remotePath) {
  if (!remotePath || typeof remotePath !== 'string' || !remotePath.startsWith('/')) {
    throw new Error('Remote path must start with /');
  }
}

/**
 * Returns the size of a remote file in bytes.
 * Tries `stat` first (works on all Android versions, outputs "Size: N"),
 * then falls back to `ls -la` parsing.
 * Returns 0 on any error (file not found, directory, unsupported device).
 */
async function getRemoteFileSize(deviceId, remotePath) {
  try {
    // stat is available on both toybox and busybox Android and outputs "Size: N"
    try {
      const { stdout: statOut } = await runAdb(['-s', deviceId, 'shell', `stat ${shQuote(remotePath)}`], 3000);
      const statMatch = statOut.match(/Size:\s+(\d+)/);
      if (statMatch) return parseInt(statMatch[1], 10);
    } catch {}
    // Fallback: ls -la
    const { stdout } = await runAdb(['-s', deviceId, 'shell', `ls -la ${shQuote(remotePath)}`], 3000);
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
 * ADB suppresses [XX%] progress when stderr is a pipe (not a TTY), so progress is
 * measured by polling how many bytes have arrived. Every 250ms getBytes() (may be async)
 * is compared against totalBytes; overlapping polls are skipped and failures ignored.
 * Returns a stop function.
 */
function startProgressPolling(getBytes, totalBytes, onProgress) {
  let busy = false;
  const id = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const percent = Math.floor(await getBytes() / totalBytes * 100);
      if (percent > 0) onProgress({ percent: Math.min(99, percent) });
    } catch {}
    busy = false;
  }, 250);
  return () => clearInterval(id);
}

async function listDirectory(deviceId, remotePath) {
  validateDeviceId(deviceId);
  assertRemotePath(remotePath);

  const { stdout, stderr } = await runAdb(['-s', deviceId, 'shell', `ls -la ${shQuote(remotePath)}`], 15000);
  // Nothing listed but an error printed: unreadable or missing folder, not an empty one.
  if (!stdout && stderr) throw new Error(stderr);
  const entries = [];

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('total ')) continue;

    const typeChar = trimmed[0];
    if (typeChar !== 'd' && typeChar !== 'l' && typeChar !== '-') continue;

    let name = null;
    let size = null;
    let modified = null; // as shown by ls
    let modifiedMs = null; // sortable; only the toybox format (Android 6+) carries a full date

    let match = trimmed.match(/(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+([\s\S]+)/);
    if (match) {
      size = parseInt(match[1], 10);
      modified = `${match[2]} ${match[3]}`;
      modifiedMs = Date.parse(`${match[2]}T${match[3]}`);
      name = match[4].trim();
    } else {
      match = trimmed.match(/(\d+)\s+([A-Z][a-z]{2}\s+\d{1,2}\s+[\d:]+)\s+([\s\S]+)/);
      if (match) {
        size = parseInt(match[1], 10);
        modified = match[2].replace(/\s+/g, ' ');
        name = match[3].trim();
      }
    }

    if (!name) continue;

    if (typeChar === 'l' && name.includes(' -> ')) {
      name = name.substring(0, name.indexOf(' -> ')).trim();
    }

    if (!name || name === '.' || name === '..') continue;

    entries.push({ name, isDir: typeChar === 'd' || typeChar === 'l', size, modified, modifiedMs });
  }

  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
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

  // Progress: watch the remote file grow towards the local file's size.
  let stopPolling = null;
  if (onProgress) {
    let localSize = 0;
    try {
      const stat = fs.statSync(localPath);
      if (stat.isFile()) localSize = stat.size;
    } catch {}

    if (localSize > 0) {
      const remoteFilePath = remotePath.endsWith('/') ? `${remotePath}${path.basename(localPath)}` : remotePath;
      stopPolling = startProgressPolling(() => getRemoteFileSize(deviceId, remoteFilePath), localSize, onProgress);
    }
  }

  try {
    // No inactivity timeout: adb prints nothing while piped, so large transfers look idle.
    // The user can still abort via cancelActiveTransfer.
    return await spawnAdbWithInactivityTimeout(['-s', deviceId, 'push', localPath, remotePath], 0);
  } finally {
    if (stopPolling) stopPolling();
  }
}

async function pullFile(deviceId, remotePath, localPath, onProgress, knownTotalSize = 0) {
  validateDeviceId(deviceId);
  assertRemotePath(remotePath);

  if (!localPath || typeof localPath !== 'string') {
    throw new Error('Local destination path cannot be empty');
  }
  if (!fs.existsSync(localPath)) {
    throw new Error(`Destination folder not found: ${localPath}`);
  }

  // Progress: watch the local copy grow towards the remote size (passed from listDirectory, else queried).
  let stopPolling = null;
  if (onProgress) {
    const totalSize = knownTotalSize > 0 ? knownTotalSize : await getRemoteFileSize(deviceId, remotePath);
    if (totalSize > 0) {
      const localFilePath = path.join(localPath, path.basename(remotePath));
      stopPolling = startProgressPolling(() => fs.statSync(localFilePath).size, totalSize, onProgress);
    }
  }

  try {
    return await spawnAdbWithInactivityTimeout(['-s', deviceId, 'pull', remotePath, localPath], 0);
  } finally {
    if (stopPolling) stopPolling();
  }
}

async function makeDirectory(deviceId, remotePath) {
  validateDeviceId(deviceId);
  assertRemotePath(remotePath);
  if (/[\0]/.test(remotePath)) {
    throw new Error('Remote path contains invalid characters');
  }

  await runSilentCommand(deviceId, `mkdir ${shQuote(remotePath)}`, 10000);
  return 'Directory created';
}

async function deleteEntry(deviceId, remotePath) {
  validateDeviceId(deviceId);
  assertRemotePath(remotePath);
  if (remotePath === '/') {
    throw new Error('Cannot delete root directory');
  }
  if (/[\0]/.test(remotePath)) {
    throw new Error('Remote path contains invalid characters');
  }

  await runSilentCommand(deviceId, `rm -rf ${shQuote(remotePath)}`, 30000);
  return 'Deleted';
}

async function renameEntry(deviceId, remotePath, newName) {
  validateDeviceId(deviceId);
  assertRemotePath(remotePath);
  if (!newName || typeof newName !== 'string') {
    throw new Error('New name cannot be empty');
  }
  if (newName.includes('/') || /[\0]/.test(newName)) {
    throw new Error('New name contains invalid characters');
  }

  const withoutSlash = remotePath.replace(/\/$/, '');
  const newPath = `${withoutSlash.slice(0, withoutSlash.lastIndexOf('/') + 1)}${newName}`;

  // mv onto an existing name would move *into* that folder or overwrite that file, so check first.
  // Android storage ignores case, so a case-only rename ("a.jpg" -> "A.jpg") skips the check.
  const move = `mv ${shQuote(remotePath)} ${shQuote(newPath)}`;
  const caseOnly = newName.toLowerCase() === withoutSlash.slice(withoutSlash.lastIndexOf('/') + 1).toLowerCase();
  const { stdout, stderr } = await runAdb(['-s', deviceId, 'shell', caseOnly ? move : unlessExists(newPath, move)], 10000);
  if (stdout === 'EXISTS') throw new Error(`"${newName}" already exists in this folder`);
  if (stdout || stderr) throw new Error(stdout || stderr);
  return 'Renamed';
}

/** File properties via stat (toybox and busybox both support -c). */
async function statEntry(deviceId, remotePath) {
  validateDeviceId(deviceId);
  assertRemotePath(remotePath);

  const { stdout, stderr } = await runAdb(['-s', deviceId, 'shell', `stat -c '%F|%s|%A|%U|%G|%y' ${shQuote(remotePath)}`], 10000);
  const fields = stdout.split('|');
  if (fields.length !== 6) throw new Error(stderr || stdout || 'Could not read file properties');

  const [type, size, permissions, owner, group, modified] = fields;
  return { type, size: Number(size), permissions, owner, group, modified: modified.replace(/\.\d+.*$/, '') };
}

/**
 * Copies or moves srcPath into destDir on the device. Refuses to overwrite an existing name,
 * to target the same folder, or to put a folder inside itself. No timeout: big folders take time;
 * runs as the active transfer, so the explorer's Cancel stops it.
 */
async function transferOnDevice(verb, deviceId, srcPath, destDir) {
  validateDeviceId(deviceId);
  assertRemotePath(srcPath);
  assertRemotePath(destDir);
  if (/[\0]/.test(srcPath + destDir)) throw new Error('Path contains invalid characters');

  const src = srcPath.replace(/\/$/, '');
  const folder = destDir.endsWith('/') ? destDir : `${destDir}/`;
  const dest = `${folder}${src.slice(src.lastIndexOf('/') + 1)}`;
  if (dest === src) throw new Error('That item is already in this folder');
  if (folder.startsWith(`${src}/`)) throw new Error("Can't put a folder into itself");

  const command = verb === 'copy' ? `cp -r ${shQuote(src)} ${shQuote(dest)}` : `mv ${shQuote(src)} ${shQuote(dest)}`;
  const output = await spawnAdbWithInactivityTimeout(['-s', deviceId, 'shell', unlessExists(dest, command)], 0);
  if (output === 'EXISTS') throw new Error(`"${dest.slice(folder.length)}" already exists in this folder`);
  if (output !== 'Success') throw new Error(output); // older devices exit 0 even when cp/mv fail
  return verb === 'copy' ? 'Copied' : 'Moved';
}

const copyEntry = (deviceId, srcPath, destDir) => transferOnDevice('copy', deviceId, srcPath, destDir);
const moveEntry = (deviceId, srcPath, destDir) => transferOnDevice('move', deviceId, srcPath, destDir);

module.exports = {
  listDirectory,
  statEntry,
  copyEntry,
  moveEntry,
  pushFile,
  pullFile,
  makeDirectory,
  deleteEntry,
  renameEntry
};
