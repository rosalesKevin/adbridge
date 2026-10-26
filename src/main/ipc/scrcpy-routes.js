const scrcpyService = require('../scrcpy-service');
const { respond } = require('./respond');

function registerScrcpyHandlers(ipcMain) {
  ipcMain.handle('scrcpy:start', async (event, deviceId, options) => {
    try {
      const result = scrcpyService.startMirror(deviceId, (eventType, detail) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('scrcpy:status', {
            deviceId,
            running: false,
            reason: `${eventType}: ${detail}`
          });
        }
      }, options);

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

  ipcMain.handle('scrcpy:status', respond((_event, deviceId) => ({ running: scrcpyService.isMirrorRunning(deviceId) })));
}

module.exports = { registerScrcpyHandlers };
