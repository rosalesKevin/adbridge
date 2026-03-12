'use strict';

const { getApkSigningInfo, getKeystoreInfo } = require('../keystore');
const { getApkPackageName } = require('../apk-info');

function registerKeystoreHandlers(ipcMain) {
  ipcMain.handle('keystore:apk-package', async (_event, apkPath) => {
    try {
      const packageName = await getApkPackageName(apkPath);
      return { success: true, data: packageName };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('keystore:apk-signing', async (_event, apkPath) => {
    try {
      const result = await getApkSigningInfo(apkPath);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('keystore:inspect', async (_event, keystorePath, password) => {
    try {
      const result = await getKeystoreInfo(keystorePath, password);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerKeystoreHandlers };
