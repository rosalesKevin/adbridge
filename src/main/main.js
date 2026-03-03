const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('node:path');
const { registerIpcHandlers } = require('./ipc-handlers');
const adbService = require('./adb-service');
const scrcpyService = require('./scrcpy-service');
const logcatService = require('./logcat-service');

/**
 * Creates the main application window.
 *
 * SECURITY SETTINGS:
 * - contextIsolation: true  → renderer runs in its own JS context
 * - nodeIntegration: false   → renderer cannot use require() or Node APIs
 * - preload script           → exposes only a safe, limited API via contextBridge
 */
function createWindow() {
    const win = new BrowserWindow({
        width: 950,
        height: 720,
        minWidth: 750,
        minHeight: 550,
        title: 'ADBridge',
        icon: path.join(__dirname, '..', '..', 'assets', 'icon.ico'),
        backgroundColor: '#1a1a2e',
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false // needed for preload to use require
        }
    });

    // Remove the default menu bar
    win.setMenuBarVisibility(false);

    // Load the renderer HTML
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

// App lifecycle
app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
    adbService.startDeviceTracking({
        onDevicesChanged: (devices) => {
            for (const win of BrowserWindow.getAllWindows()) {
                win.webContents.send('adb:devices-changed', devices);
            }
        }
    });

    // Dev-mode shortcuts — only active when running from source (not packaged)
    if (!app.isPackaged) {
        globalShortcut.register('F5', () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.reload();
        });
        globalShortcut.register('F12', () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.toggleDevTools();
        });
    }

    app.on('activate', () => {
        // macOS: re-create window when dock icon is clicked and no windows exist
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('before-quit', () => {
    adbService.stopDeviceTracking();
    scrcpyService.stopAllMirrors();
    logcatService.stopAllLogcat();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
