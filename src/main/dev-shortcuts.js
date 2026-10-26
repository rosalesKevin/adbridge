'use strict';

/**
 * Dev-mode window shortcuts (running from source only). Window-scoped rather than
 * globalShortcut, so they don't steal keys from other apps and F5 stays the app's
 * "refresh the visible section" key.
 * @param {Electron.Input} input - from webContents 'before-input-event'
 * @returns {'reload' | 'devtools' | null}
 */
function devShortcutAction(input) {
  if (input.type !== 'keyDown') return null;
  if (input.control && !input.alt && input.key.toLowerCase() === 'r') return 'reload';
  if (input.key === 'F12') return 'devtools';
  return null;
}

module.exports = { devShortcutAction };
