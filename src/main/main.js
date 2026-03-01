const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { registerIpcHandlers } = require('./ipc-handlers');

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
        title: 'ADB Multi Tool',
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

    app.on('activate', () => {
        // macOS: re-create window when dock icon is clicked and no windows exist
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
