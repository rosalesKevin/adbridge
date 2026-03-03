const logcatService = require('../logcat-service');

function registerLogcatHandlers(ipcMain) {
  ipcMain.handle('logcat:start', async (event, deviceId, packageName, tag, level) => {
    try {
      const result = await logcatService.startLogcat(deviceId, packageName, tag, level, (line) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('logcat:data', line);
        }
      });
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('logcat:stop', async (_event, deviceId) => {
    try {
      return logcatService.stopLogcat(deviceId);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('logcat:status', async (_event, deviceId) => {
    try {
      const running = logcatService.isLogcatRunning(deviceId);
      return { success: true, data: { running } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerLogcatHandlers };
