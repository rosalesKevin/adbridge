'use strict';

const assert = require('node:assert/strict');

const { registerAppInfoHandlers } = require('../src/main/app-info');

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
