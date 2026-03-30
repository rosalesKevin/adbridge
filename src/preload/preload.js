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
    onDevicesChanged: (callback) => {
        const handler = (_event, devices) => callback(devices);
        ipcRenderer.on('adb:devices-changed', handler);
        return () => ipcRenderer.removeListener('adb:devices-changed', handler);
    },

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

    /** Pull a file from the device to the host → { success, data: string } */
    pull: (deviceId, remotePath, localPath, totalSize) => ipcRenderer.invoke('adb:pull', deviceId, remotePath, localPath, totalSize),

    /** List entries on the device → { success, data: Array<{name, isDir}> } */
    ls: (deviceId, remotePath) => ipcRenderer.invoke('adb:ls', deviceId, remotePath),

    /** Get device info (model, Android version, battery, memory) → { success, data: {...} } */
    deviceInfo: (deviceId) => ipcRenderer.invoke('adb:device-info', deviceId),

    /** Get device Wi-Fi IP address → { success, data: string|null } */
    getDeviceIp: (deviceId) => ipcRenderer.invoke('adb:get-ip', deviceId),

    /** Switch device to TCP/IP and connect wirelessly → { success, data: {tcpip, connect} } */
    wirelessSetup: (deviceId, ip) => ipcRenderer.invoke('adb:wireless-setup', deviceId, ip),

    /** Disconnect a wireless ADB device → { success, data: string } */
    wirelessDisconnect: (deviceId) => ipcRenderer.invoke('adb:wireless-disconnect', deviceId),

    /** Create a directory on the device → { success, data: string } */
    mkdir: (deviceId, remotePath) => ipcRenderer.invoke('adb:mkdir', deviceId, remotePath),

    /** Delete a file or folder on the device → { success, data: string } */
    rm: (deviceId, remotePath) => ipcRenderer.invoke('adb:rm', deviceId, remotePath),

    /** Rename a file or folder on the device → { success, data: string } */
    rename: (deviceId, remotePath, newName) => ipcRenderer.invoke('adb:rename', deviceId, remotePath, newName),

    /** Cancel the active push/pull transfer → { success, data: boolean } */
    cancelTransfer: () => ipcRenderer.invoke('adb:cancel-transfer'),

    /** Check if a device IP is on the same subnet as any PC network interface → { success, data: { sameNetwork: boolean } } */
    checkSameNetwork: (deviceIp) => ipcRenderer.invoke('adb:check-same-network', deviceIp),

    /** Subscribe to file transfer progress updates. Returns an unsubscribe function. */
    onTransferProgress: (callback) => {
        const handler = (_event, progress) => callback(progress);
        ipcRenderer.on('adb:transfer-progress', handler);
        return () => ipcRenderer.removeListener('adb:transfer-progress', handler);
    },
});

contextBridge.exposeInMainWorld('scrcpy', {
    start: (deviceId) => ipcRenderer.invoke('scrcpy:start', deviceId),
    stop: (deviceId) => ipcRenderer.invoke('scrcpy:stop', deviceId),
    status: (deviceId) => ipcRenderer.invoke('scrcpy:status', deviceId),
    onStatusChange: (callback) => {
        const handler = (_event, payload) => callback(payload);
        ipcRenderer.on('scrcpy:status', handler);
        return () => ipcRenderer.removeListener('scrcpy:status', handler);
    }
});

contextBridge.exposeInMainWorld('logcat', {
    start: (deviceId, packageName, tag, level) =>
        ipcRenderer.invoke('logcat:start', deviceId, packageName, tag, level),

    stop: (deviceId) => ipcRenderer.invoke('logcat:stop', deviceId),

    status: (deviceId) => ipcRenderer.invoke('logcat:status', deviceId),

    /** Subscribe to incoming logcat lines. Returns an unsubscribe function. */
    onData: (callback) => {
        const handler = (_event, line) => callback(line);
        ipcRenderer.on('logcat:data', handler);
        return () => ipcRenderer.removeListener('logcat:data', handler);
    },

    saveFile: (content, defaultName) =>
        ipcRenderer.invoke('logcat:save', content, defaultName),

    /** Subscribe to logcat process errors (ADB stderr). Returns an unsubscribe function. */
    onError: (callback) => {
        const handler = (_event, line) => callback(line);
        ipcRenderer.on('logcat:error', handler);
        return () => ipcRenderer.removeListener('logcat:error', handler);
    },
});

contextBridge.exposeInMainWorld('dialogs', {
    /** Open native file picker for .apk files → { success, data: string|null } */
    pickApk: () => ipcRenderer.invoke('dialog:open-apk'),

    /** Show a native confirmation dialog → { success, data: boolean } */
    confirm: (title, message) => ipcRenderer.invoke('dialog:confirm', title, message),

    /** Open native file picker for any file → { success, data: string|null } */
    pickFile: () => ipcRenderer.invoke('dialog:open-file'),

    /** Open native directory picker for push source → { success, data: string|null } */
    pickSourceDirectory: () => ipcRenderer.invoke('dialog:open-push-directory'),

    /** Open native directory picker → { success, data: string|null } */
    pickDirectory: () => ipcRenderer.invoke('dialog:open-directory'),

    /** Open native file picker for keystore files → { success, data: string|null } */
    pickKeystore: () => ipcRenderer.invoke('dialog:open-keystore'),
});

contextBridge.exposeInMainWorld('appInfo', {
    /** Get application metadata → { success, data: { version: string } } */
    version: () => ipcRenderer.invoke('app:version'),
});

contextBridge.exposeInMainWorld('keystore', {
    /** Extract package name from a local APK file → { success, data: string } */
    apkPackageName: (apkPath) => ipcRenderer.invoke('keystore:apk-package', apkPath),

    /** Print signing certificate info from an APK → { success, data: string } */
    apkSigning: (apkPath) => ipcRenderer.invoke('keystore:apk-signing', apkPath),

    /** List keystore contents verbosely → { success, data: string } */
    inspect: (keystorePath, password) => ipcRenderer.invoke('keystore:inspect', keystorePath, password),
});

contextBridge.exposeInMainWorld('updater', {
    /** Subscribe to update-available events. Returns an unsubscribe function. */
    onUpdateAvailable: (callback) => {
        const handler = (_event, payload) => callback(payload);
        ipcRenderer.on('updater:update-available', handler);
        return () => ipcRenderer.removeListener('updater:update-available', handler);
    },

    /** Subscribe to download progress events. Returns an unsubscribe function. */
    onProgress: (callback) => {
        const handler = (_event, payload) => callback(payload);
        ipcRenderer.on('updater:progress', handler);
        return () => ipcRenderer.removeListener('updater:progress', handler);
    },

    /** Trigger download and install. */
    downloadAndInstall: () => ipcRenderer.invoke('updater:download-and-install'),

    /** Open the GitHub releases page in the browser. */
    openReleasePage: () => ipcRenderer.invoke('updater:open-release-page'),
});
