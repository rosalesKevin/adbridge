const scrcpyService = require('../scrcpy-service');

function registerScrcpyHandlers(ipcMain) {
  ipcMain.handle('scrcpy:start', async (event, deviceId) => {
    try {
      const result = scrcpyService.startMirror(deviceId, (eventType, detail) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('scrcpy:status', {
            deviceId,
            running: false,
            reason: `${eventType}: ${detail}`
          });
        }
      });

      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('scrcpy:stop', async (_event, deviceId) => {
    try {
      return scrcpyService.stopMirror(deviceId);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('scrcpy:status', async (_event, deviceId) => {
    try {
      const running = scrcpyService.isMirrorRunning(deviceId);
      return { success: true, data: { running } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerScrcpyHandlers };
