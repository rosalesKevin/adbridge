'use strict';

function getAppVersion(app) {
  return app.getVersion();
}

function registerAppInfoHandlers(ipcMain, app) {
  ipcMain.handle('app:version', () => ({
    success: true,
    data: { version: getAppVersion(app) }
  }));
}

module.exports = { getAppVersion, registerAppInfoHandlers };
