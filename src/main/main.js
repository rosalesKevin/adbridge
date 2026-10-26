const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { registerIpcHandlers } = require('./ipc-handlers');
const adbService = require('./adb-service');
const scrcpyService = require('./scrcpy-service');
const logcatService = require('./logcat-service');
const { checkForUpdates } = require('./updater');
const { enforceSingleInstance } = require('./single-instance');
const { devShortcutAction } = require('./dev-shortcuts');

// A second launch focuses the open window instead of starting another copy.
const isPrimaryInstance = enforceSingleInstance(app, () => BrowserWindow.getAllWindows()[0]);

// Set a stable AppUserModelId so Windows taskbar always shows the correct icon,
// regardless of the temp directory the portable exe extracts into.
if (process.platform === 'win32') {
    app.setAppUserModelId('com.adbridge.app');
}

/**
 * Creates the main application window.
 *
 * SECURITY SETTINGS:
 * - contextIsolation: true  → renderer runs in its own JS context
 * - nodeIntegration: false   → renderer cannot use require() or Node APIs
 * - preload script           → exposes only a safe, limited API via contextBridge
 */
function createWindow() {
    // In packaged mode the icon must be a real file on disk (not inside app.asar).
    // extraResources places icon.ico at process.resourcesPath/icon.ico.
    const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(__dirname, '..', '..', 'assets', 'icon.ico');

    const win = new BrowserWindow({
        width: 950,
        height: 720,
        minWidth: 750,
        minHeight: 550,
        title: 'ADBridge',
        icon: iconPath,
        backgroundColor: '#1a1a2e',
        show: false, // prevent partial icon render on first portable launch
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false // needed for preload to use require
        }
    });

    // Re-assert icon and show window once fully initialised.
    // On first portable launch Windows reads the icon from a fresh temp path;
    // waiting for ready-to-show ensures the icon cache is warm before display.
    win.once('ready-to-show', () => {
        win.setIcon(iconPath);
        win.show();
    });

    // Remove the default menu bar
    win.setMenuBarVisibility(false);

    // Dev-mode shortcuts (running from source): Ctrl+R reloads, F12 toggles DevTools.
    if (!app.isPackaged) {
        win.webContents.on('before-input-event', (event, input) => {
            const action = devShortcutAction(input);
            if (!action) return;
            event.preventDefault();
            if (action === 'reload') win.webContents.reload();
            else win.webContents.toggleDevTools();
        });
    }

    // Load the renderer HTML
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    win.webContents.once('did-finish-load', () => {
        checkForUpdates();
    });
}

// App lifecycle
if (isPrimaryInstance) app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
    adbService.startDeviceTracking({
        onDevicesChanged: (devices) => {
            for (const win of BrowserWindow.getAllWindows()) {
                win.webContents.send('adb:devices-changed', devices);
            }
        }
    });
});

app.on('before-quit', () => {
    adbService.stopDeviceTracking();
    scrcpyService.stopAllMirrors();
    logcatService.stopAllLogcat();
});

app.on('window-all-closed', () => app.quit());
