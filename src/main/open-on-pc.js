'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { shell } = require('electron');
const { pullFile } = require('./adb/files');

// Files that Windows would execute instead of display. A phone's storage is not trusted,
// so these are only revealed in Explorer, never launched.
const RISKY_EXTENSIONS = /\.(exe|msi|msp|bat|cmd|com|scr|pif|cpl|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|msc|jar|lnk|reg|inf|application|appref-ms|gadget|scf|url|sh)$/i;

function isRiskyToOpen(fileName) {
  return RISKY_EXTENSIONS.test(fileName);
}

/** Pulls a device file into a fresh temp folder and opens it with its default Windows app. */
async function openOnPc(deviceId, remotePath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adbridge-open-'));
  await pullFile(deviceId, remotePath, dir);
  const localPath = path.join(dir, path.posix.basename(remotePath));

  if (isRiskyToOpen(localPath)) {
    shell.showItemInFolder(localPath);
    return { opened: false, localPath };
  }
  const error = await shell.openPath(localPath);
  if (error) throw new Error(error);
  return { opened: true, localPath };
}

module.exports = { isRiskyToOpen, openOnPc };
