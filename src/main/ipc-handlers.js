const { app, ipcMain, dialog } = require('electron');
const { registerAppInfoHandlers } = require('./app-info');
const { registerAdbHandlers } = require('./ipc/adb-routes');
const { registerDialogHandlers } = require('./ipc/dialog-routes');
const { registerScrcpyHandlers } = require('./ipc/scrcpy-routes');
const { registerLogcatHandlers } = require('./ipc/logcat-routes');
const { registerKeystoreHandlers } = require('./ipc/keystore-routes');
const { registerUpdaterHandlers } = require('./ipc/updater-routes');

function registerIpcHandlers() {
  registerAppInfoHandlers(ipcMain, app);
  registerAdbHandlers(ipcMain);
  registerDialogHandlers(ipcMain, dialog);
  registerScrcpyHandlers(ipcMain);
  registerLogcatHandlers(ipcMain);
  registerKeystoreHandlers(ipcMain);
  registerUpdaterHandlers(ipcMain);
}

module.exports = { registerIpcHandlers };
