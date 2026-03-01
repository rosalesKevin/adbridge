const { ipcMain, dialog } = require('electron');
const adbService = require('./adb-service');

/**
 * Registers all IPC handlers.
 *
 * PATTERN: ipcMain.handle() creates async request/response channels.
 * The renderer calls window.adb.someMethod() → preload invokes
 * ipcRenderer.invoke('channel') → this handler runs in main process →
 * result is returned to the renderer.
 *
 * Every handler wraps its logic in try/catch and returns a consistent
 * { success, data?, error? } shape so the renderer can handle errors
 * without catching exceptions.
 */
function registerIpcHandlers() {

    // ── ADB Status ──
    ipcMain.handle('adb:check', async () => {
        try {
            const available = await adbService.checkAdb();
            return { success: true, data: available };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ── List Devices ──
    ipcMain.handle('adb:devices', async () => {
        try {
            const devices = await adbService.getDevices();
            return { success: true, data: devices };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ── List Packages ──
    ipcMain.handle('adb:packages', async (_event, deviceId, userOnly) => {
        try {
            const packages = await adbService.getPackages(deviceId, userOnly);
            return { success: true, data: packages };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ── Uninstall App ──
    ipcMain.handle('adb:uninstall', async (_event, deviceId, packageName) => {
        try {
            const result = await adbService.uninstallApp(deviceId, packageName);
            return { success: true, data: result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ── Clear App Data ──
    ipcMain.handle('adb:clear', async (_event, deviceId, packageName) => {
        try {
            const result = await adbService.clearAppData(deviceId, packageName);
            return { success: true, data: result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ── Install APK ──
    ipcMain.handle('adb:install', async (_event, deviceId, apkPath) => {
        try {
            const result = await adbService.installApk(deviceId, apkPath);
            return { success: true, data: result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ── Native File Picker for APK ──
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

    // ── List Device Directory ──
    ipcMain.handle('adb:ls', async (_event, deviceId, remotePath) => {
        try {
            const dirs = await adbService.listDirectory(deviceId, remotePath);
            return { success: true, data: dirs };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ── Push File to Device ──
    ipcMain.handle('adb:push', async (_event, deviceId, localPath, remotePath) => {
        try {
            const result = await adbService.pushFile(deviceId, localPath, remotePath);
            return { success: true, data: result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ── Generic File Picker (all files) ──
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

    // ── Native Confirm Dialog (for uninstall confirmation) ──
    ipcMain.handle('dialog:confirm', async (_event, title, message) => {
        try {
            const result = await dialog.showMessageBox({
                type: 'warning',
                title: title,
                message: message,
                buttons: ['Cancel', 'Confirm'],
                defaultId: 0,
                cancelId: 0
            });

            // result.response is the index of the clicked button
            return { success: true, data: result.response === 1 };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
}

module.exports = { registerIpcHandlers };
