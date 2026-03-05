const fs = require('node:fs');

function registerDialogHandlers(ipcMain, dialog) {
  ipcMain.handle('dialog:open-apk', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select APK File',
        properties: ['openFile'],
        filters: [
          { name: 'APK Files', extensions: ['apk'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dialog:open-file', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select File',
        properties: ['openFile'],
        filters: [{ name: 'All Files', extensions: ['*'] }]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dialog:open-push-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Folder to Push',
        properties: ['openDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dialog:open-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Save Directory',
        properties: ['openDirectory', 'createDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dialog:confirm', async (_event, title, message) => {
    try {
      const result = await dialog.showMessageBox({
        type: 'warning',
        title,
        message,
        buttons: ['Cancel', 'Confirm'],
        defaultId: 0,
        cancelId: 0
      });

      return { success: true, data: result.response === 1 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('logcat:save', async (_event, content, defaultName) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export Logcat',
        defaultPath: defaultName,
        filters: [
          { name: 'Log Files', extensions: ['log', 'txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: true, data: null };
      }

      await fs.promises.writeFile(result.filePath, content, 'utf-8');
      return { success: true, data: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerDialogHandlers };
