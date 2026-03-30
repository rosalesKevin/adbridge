'use strict';

const assert = require('node:assert/strict');

const { getAppVersion, registerAppInfoHandlers } = require('../src/main/app-info');

assert.equal(getAppVersion({ getVersion: () => '1.2.1' }), '1.2.1', 'returns the Electron app version');

{
  const handlers = new Map();
  const ipcMain = {
    handle(channel, fn) {
      handlers.set(channel, fn);
    }
  };

  registerAppInfoHandlers(ipcMain, { getVersion: () => '9.9.9' });

  assert.equal(handlers.has('app:version'), true, 'registers the app version channel');
}

{
  const handlers = new Map();
  const ipcMain = {
    handle(channel, fn) {
      handlers.set(channel, fn);
    }
  };

  registerAppInfoHandlers(ipcMain, { getVersion: () => '2.4.6' });

  const result = handlers.get('app:version')();
  assert.deepEqual(
    result,
    { success: true, data: { version: '2.4.6' } },
    'returns the version payload expected by the renderer'
  );
}

console.log('All tests passed.');
