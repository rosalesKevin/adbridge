'use strict';

const { getApkSigningInfo, getKeystoreInfo } = require('../keystore');
const { getApkPackageName } = require('../apk-info');
const { respond } = require('./respond');

function registerKeystoreHandlers(ipcMain) {
  ipcMain.handle('keystore:apk-package', respond((_event, apkPath) => getApkPackageName(apkPath)));
  ipcMain.handle('keystore:apk-signing', respond((_event, apkPath) => getApkSigningInfo(apkPath)));
  ipcMain.handle('keystore:inspect', respond((_event, keystorePath, password) => getKeystoreInfo(keystorePath, password)));
}

module.exports = { registerKeystoreHandlers };
