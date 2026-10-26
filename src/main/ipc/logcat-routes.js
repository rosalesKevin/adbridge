const logcatService = require('../logcat-service');

function registerLogcatHandlers(ipcMain) {
  // start/stop return the service's own { success, ... } result.
  ipcMain.handle('logcat:start', async (event, deviceId, packageName, tag, level) => {
    const send = (channel, payload) => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, payload);
    };
    try {
      return await logcatService.startLogcat(
        deviceId, packageName, tag, level,
        (line) => send('logcat:data', line),
        (errLine) => send('logcat:error', errLine)
      );
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
}

module.exports = { registerLogcatHandlers };
