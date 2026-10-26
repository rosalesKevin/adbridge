'use strict';

/**
 * Keeps a single ADBridge running: a second launch quits immediately and the
 * already-open window is restored and focused instead.
 * Returns false when this process is the duplicate and must not start.
 */
function enforceSingleInstance(app, getWindow) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }

  app.on('second-instance', () => {
    const win = getWindow();
    if (!win) return; // still starting up; it will show itself when ready
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  return true;
}

module.exports = { enforceSingleInstance };
