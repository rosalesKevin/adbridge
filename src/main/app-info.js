'use strict';

function registerAppInfoHandlers(ipcMain, app) {
  ipcMain.handle('app:version', () => ({
    success: true,
    data: { version: app.getVersion() }
  }));
}

module.exports = { registerAppInfoHandlers };
