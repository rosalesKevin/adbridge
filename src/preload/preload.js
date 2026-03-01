const { contextBridge, ipcRenderer } = require('electron');

/**
 * SECURITY: contextBridge exposes only specific IPC invoke calls.
 * The renderer CANNOT:
 * - Access Node.js APIs (require, fs, child_process, etc.)
 * - Access ipcRenderer directly
 * - Send arbitrary IPC messages
 *
 * It CAN only call the methods defined below, which map 1:1
 * to the ipcMain.handle() channels registered in ipc-handlers.js.
 */

contextBridge.exposeInMainWorld('adb', {
    /** Check if ADB is available → { success, data: boolean } */
    check: () => ipcRenderer.invoke('adb:check'),

    /** List connected devices → { success, data: [{id, status}] } */
    devices: () => ipcRenderer.invoke('adb:devices'),

    /** List packages on a device → { success, data: string[] } */
    packages: (deviceId, userOnly) => ipcRenderer.invoke('adb:packages', deviceId, userOnly),

    /** Uninstall an app → { success, data: string } */
    uninstall: (deviceId, packageName) => ipcRenderer.invoke('adb:uninstall', deviceId, packageName),

    /** Clear app data → { success, data: string } */
    clear: (deviceId, packageName) => ipcRenderer.invoke('adb:clear', deviceId, packageName),

    /** Install an APK → { success, data: string } */
    install: (deviceId, apkPath) => ipcRenderer.invoke('adb:install', deviceId, apkPath),

    /** Push a local file to the device → { success, data: string } */
    push: (deviceId, localPath, remotePath) => ipcRenderer.invoke('adb:push', deviceId, localPath, remotePath),
});

contextBridge.exposeInMainWorld('dialogs', {
    /** Open native file picker for .apk files → { success, data: string|null } */
    pickApk: () => ipcRenderer.invoke('dialog:open-apk'),

    /** Show a native confirmation dialog → { success, data: boolean } */
    confirm: (title, message) => ipcRenderer.invoke('dialog:confirm', title, message),

    /** Open native file picker for any file → { success, data: string|null } */
    pickFile: () => ipcRenderer.invoke('dialog:open-file'),
});
