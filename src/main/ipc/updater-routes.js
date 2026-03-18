'use strict';

const { checkForUpdates, downloadAndInstall, openReleasePage } = require('../updater');

/**
 * @param {import('electron').IpcMain} ipcMain
 */
function registerUpdaterHandlers(ipcMain) {
  ipcMain.handle('updater:download-and-install', () => downloadAndInstall());
  ipcMain.handle('updater:open-release-page', () => openReleasePage());
}

module.exports = { registerUpdaterHandlers, checkForUpdates };
