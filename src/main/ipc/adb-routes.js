const adbService = require('../adb-service');

function registerAdbHandlers(ipcMain) {
  ipcMain.handle('adb:check', async () => {
    try {
      const available = await adbService.checkAdb();
      return { success: true, data: available };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:devices', async () => {
    try {
      const devices = await adbService.getDevices();
      return { success: true, data: devices };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:packages', async (_event, deviceId, userOnly) => {
    try {
      const packages = await adbService.getPackages(deviceId, userOnly);
      return { success: true, data: packages };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:uninstall', async (_event, deviceId, packageName) => {
    try {
      const result = await adbService.uninstallApp(deviceId, packageName);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:clear', async (_event, deviceId, packageName) => {
    try {
      const result = await adbService.clearAppData(deviceId, packageName);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:install', async (_event, deviceId, apkPath) => {
    try {
      const result = await adbService.installApk(deviceId, apkPath);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:ls', async (_event, deviceId, remotePath) => {
    try {
      const dirs = await adbService.listDirectory(deviceId, remotePath);
      return { success: true, data: dirs };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:push', async (event, deviceId, localPath, remotePath) => {
    try {
      const result = await adbService.pushFile(deviceId, localPath, remotePath, (progress) => {
        event.sender.send('adb:transfer-progress', progress);
      });
      event.sender.send('adb:transfer-progress', { percent: 100, current: null, total: null, unit: null });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:pull', async (event, deviceId, remotePath, localPath, totalSize) => {
    try {
      const result = await adbService.pullFile(deviceId, remotePath, localPath, (progress) => {
        event.sender.send('adb:transfer-progress', progress);
      }, totalSize);
      event.sender.send('adb:transfer-progress', { percent: 100, current: null, total: null, unit: null });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:device-info', async (_event, deviceId) => {
    try {
      const info = await adbService.getDeviceInfo(deviceId);
      return { success: true, data: info };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:get-ip', async (_event, deviceId) => {
    try {
      const ip = await adbService.getDeviceIp(deviceId);
      return { success: true, data: ip };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:wireless-setup', async (_event, deviceId, ip) => {
    try {
      const result = await adbService.setupWireless(deviceId, ip);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:mkdir', async (_event, deviceId, remotePath) => {
    try {
      const result = await adbService.makeDirectory(deviceId, remotePath);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:rm', async (_event, deviceId, remotePath) => {
    try {
      const result = await adbService.deleteEntry(deviceId, remotePath);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:rename', async (_event, deviceId, remotePath, newName) => {
    try {
      const result = await adbService.renameEntry(deviceId, remotePath, newName);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:wireless-disconnect', async (_event, deviceId) => {
    try {
      const result = await adbService.disconnectWireless(deviceId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:cancel-transfer', () => {
    try {
      const cancelled = adbService.cancelActiveTransfer();
      return { success: true, data: cancelled };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('adb:check-same-network', (_event, deviceIp) => {
    try {
      return { success: true, data: adbService.checkSameNetwork(deviceIp) };
    } catch (err) {
      return { success: true, data: { sameNetwork: false } };
    }
  });
}

module.exports = { registerAdbHandlers };
