const { ipcMain, dialog } = require('electron');
const { registerAdbHandlers } = require('./ipc/adb-routes');
const { registerDialogHandlers } = require('./ipc/dialog-routes');
const { registerScrcpyHandlers } = require('./ipc/scrcpy-routes');
const { registerLogcatHandlers } = require('./ipc/logcat-routes');

function registerIpcHandlers() {
  registerAdbHandlers(ipcMain);
  registerDialogHandlers(ipcMain, dialog);
  registerScrcpyHandlers(ipcMain);
  registerLogcatHandlers(ipcMain);
}

module.exports = { registerIpcHandlers };
