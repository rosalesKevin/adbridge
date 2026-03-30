'use strict';

const { checkForUpdates, openReleasePage } = require('../updater');

/**
 * @param {import('electron').IpcMain} ipcMain
 */
function registerUpdaterHandlers(ipcMain) {
  ipcMain.handle('updater:open-release-page', () => openReleasePage());
}

module.exports = { registerUpdaterHandlers, checkForUpdates };
