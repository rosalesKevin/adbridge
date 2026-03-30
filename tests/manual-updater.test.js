'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'index.html'), 'utf8');
const preload = fs.readFileSync(path.join(rootDir, 'src', 'preload', 'preload.js'), 'utf8');
const updaterRoutes = fs.readFileSync(path.join(rootDir, 'src', 'main', 'ipc', 'updater-routes.js'), 'utf8');
const rendererUpdater = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'modules', 'updater.js'), 'utf8');

assert.equal(/id="updateNowBtn"/.test(html), false, 'does not render a self-update button in the banner');
assert.equal(/Download Update/.test(html), false, 'does not present a download-and-swap action label');
assert.equal(/Open Download Page/.test(html), true, 'renders the manual release-page action in the available update banner');

assert.equal(/downloadAndInstall/.test(preload), false, 'does not expose a self-update bridge to the renderer');
assert.equal(/updater:download-and-install/.test(updaterRoutes), false, 'does not register the self-update IPC route');
assert.equal(/downloadAndInstall/.test(rendererUpdater), false, 'does not invoke the removed self-update action from the renderer');

console.log('All tests passed.');
