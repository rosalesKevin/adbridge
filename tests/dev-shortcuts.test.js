'use strict';

const assert = require('node:assert/strict');

const { devShortcutAction } = require('../src/main/dev-shortcuts');

const key = (props) => ({ type: 'keyDown', control: false, alt: false, shift: false, meta: false, ...props });

assert.equal(devShortcutAction(key({ key: 'r', control: true })), 'reload', 'Ctrl+R reloads the window');
assert.equal(devShortcutAction(key({ key: 'R', control: true, shift: true })), 'reload', 'Ctrl+Shift+R also reloads');
assert.equal(devShortcutAction(key({ key: 'F12' })), 'devtools', 'F12 toggles DevTools');
assert.equal(devShortcutAction(key({ key: 'F5' })), null, 'F5 is left to the app (refresh the visible section)');
assert.equal(devShortcutAction(key({ key: 'r' })), null, 'plain R is ordinary typing');
assert.equal(devShortcutAction(key({ key: 'r', control: true, alt: true })), null, 'Ctrl+Alt+R is not a reload');
assert.equal(devShortcutAction({ ...key({ key: 'F12' }), type: 'keyUp' }), null, 'ignores key releases');

console.log('All tests passed.');
