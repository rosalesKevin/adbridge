const fs = require('node:fs');
const path = require('node:path');
const { respond } = require('./respond');

const ALL_FILES = { name: 'All Files', extensions: ['*'] };

// Each picker replies with the chosen path, or null when cancelled.
const PICKERS = {
  'dialog:open-apk': { title: 'Select APK File', properties: ['openFile'], filters: [{ name: 'APK Files', extensions: ['apk'] }, ALL_FILES] },
  'dialog:open-file': { title: 'Select File', properties: ['openFile'], filters: [ALL_FILES] },
  'dialog:open-push-directory': { title: 'Select Folder to Push', properties: ['openDirectory'] },
  'dialog:open-directory': { title: 'Select Save Directory', properties: ['openDirectory', 'createDirectory'] },
  'dialog:open-keystore': {
    title: 'Select Keystore File',
    properties: ['openFile'],
    filters: [{ name: 'Keystore Files', extensions: ['jks', 'keystore', 'p12', 'pfx'] }, ALL_FILES]
  }
};

// Electron 43+ opens dialogs in Downloads unless defaultPath is set, and Windows
// no longer restores the last-used folder. Remember it ourselves for the session.
let lastDir;

function registerDialogHandlers(ipcMain, dialog) {
  for (const [channel, options] of Object.entries(PICKERS)) {
    ipcMain.handle(channel, respond(async () => {
      const result = await dialog.showOpenDialog({ defaultPath: lastDir, ...options });
      if (result.canceled || result.filePaths.length === 0) return null;

      const picked = result.filePaths[0];
      lastDir = options.properties.includes('openDirectory') ? picked : path.dirname(picked);
      return picked;
    }));
  }

  ipcMain.handle('logcat:save', respond(async (_event, content, defaultName) => {
    const result = await dialog.showSaveDialog({
      title: 'Export Logcat',
      defaultPath: lastDir ? path.join(lastDir, defaultName || '') : defaultName,
      filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }, ALL_FILES]
    });
    if (result.canceled || !result.filePath) return null;

    lastDir = path.dirname(result.filePath);
    await fs.promises.writeFile(result.filePath, content, 'utf-8');
    return result.filePath;
  }));

  // Which of these names already exist in a local folder (pull overwrite warning). Bare names only.
  ipcMain.handle('dialog:existing-names', respond((_event, dir, names) => {
    if (typeof dir !== 'string' || !Array.isArray(names) || names.some((n) => typeof n !== 'string' || path.basename(n) !== n)) {
      throw new Error('Invalid folder or file names');
    }
    return names.filter((name) => fs.existsSync(path.join(dir, name)));
  }));
}

module.exports = { registerDialogHandlers };
