const adbService = require('../adb-service');
const { respond } = require('./respond');
const { openOnPc } = require('../open-on-pc');

const TRANSFER_DONE = { percent: 100 };

function registerAdbHandlers(ipcMain) {
  const handle = (channel, fn) => ipcMain.handle(channel, respond(fn));

  handle('adb:check', () => adbService.checkAdb());
  handle('adb:devices', () => adbService.getDevices());
  handle('adb:packages', (_event, deviceId, userOnly) => adbService.getPackages(deviceId, userOnly));
  handle('adb:uninstall', (_event, deviceId, packageName) => adbService.uninstallApp(deviceId, packageName));
  handle('adb:clear', (_event, deviceId, packageName) => adbService.clearAppData(deviceId, packageName));
  handle('adb:package-update-time', (_event, deviceId, packageName) => adbService.getPackageUpdateTime(deviceId, packageName));
  handle('adb:grant-permissions', (_event, deviceId, packageName) => adbService.grantAllPermissions(deviceId, packageName));
  handle('adb:install', (_event, deviceId, apkPath, options) => adbService.installApk(deviceId, apkPath, options));
  handle('adb:ls', (_event, deviceId, remotePath) => adbService.listDirectory(deviceId, remotePath));

  handle('adb:push', async (event, deviceId, localPath, remotePath) => {
    const sendProgress = (progress) => event.sender.send('adb:transfer-progress', progress);
    const result = await adbService.pushFile(deviceId, localPath, remotePath, sendProgress);
    sendProgress(TRANSFER_DONE);
    return result;
  });

  handle('adb:pull', async (event, deviceId, remotePath, localPath, totalSize) => {
    const sendProgress = (progress) => event.sender.send('adb:transfer-progress', progress);
    const result = await adbService.pullFile(deviceId, remotePath, localPath, sendProgress, totalSize);
    sendProgress(TRANSFER_DONE);
    return result;
  });

  handle('adb:device-info', (_event, deviceId) => adbService.getDeviceInfo(deviceId));
  handle('adb:device-name', (_event, deviceId) => adbService.getDeviceName(deviceId));
  handle('adb:get-ip', (_event, deviceId) => adbService.getDeviceIp(deviceId));
  handle('adb:wireless-setup', (_event, deviceId, ip) => adbService.setupWireless(deviceId, ip));
  handle('adb:mkdir', (_event, deviceId, remotePath) => adbService.makeDirectory(deviceId, remotePath));
  handle('adb:rm', (_event, deviceId, remotePath) => adbService.deleteEntry(deviceId, remotePath));
  handle('adb:rename', (_event, deviceId, remotePath, newName) => adbService.renameEntry(deviceId, remotePath, newName));
  handle('adb:copy', (_event, deviceId, srcPath, destDir) => adbService.copyEntry(deviceId, srcPath, destDir));
  handle('adb:move', (_event, deviceId, srcPath, destDir) => adbService.moveEntry(deviceId, srcPath, destDir));
  handle('adb:stat', (_event, deviceId, remotePath) => adbService.statEntry(deviceId, remotePath));
  handle('adb:open-on-pc', (_event, deviceId, remotePath) => openOnPc(deviceId, remotePath));
  handle('adb:wireless-disconnect', (_event, deviceId) => adbService.disconnectWireless(deviceId));
  handle('adb:cancel-transfer', () => adbService.cancelActiveTransfer());

  // Synchronous, and a failed check counts as "not on the same network" rather than an error.
  ipcMain.handle('adb:check-same-network', (_event, deviceIp) => {
    try {
      return { success: true, data: adbService.checkSameNetwork(deviceIp) };
    } catch (err) {
      return { success: true, data: { sameNetwork: false } };
    }
  });
}

module.exports = { registerAdbHandlers };
