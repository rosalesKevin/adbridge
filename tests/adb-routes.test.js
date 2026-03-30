'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');

function loadRoutesWithService(service) {
  const routesPath = require.resolve('../src/main/ipc/adb-routes');
  delete require.cache[routesPath];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../adb-service') return service;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require('../src/main/ipc/adb-routes');
  } finally {
    Module._load = originalLoad;
  }
}

(async () => {
  {
    const sent = [];
    const handlers = new Map();
    const { registerAdbHandlers } = loadRoutesWithService({
      async checkAdb() { return true; },
      async getDevices() { return [{ id: 'ABC123', status: 'device' }]; },
      async getPackages() { return ['pkg']; },
      async uninstallApp() { return 'ok'; },
      async clearAppData() { return 'ok'; },
      async installApk() { return 'ok'; },
      async listDirectory() { return []; },
      async pushFile(_deviceId, _local, _remote, onProgress) { onProgress({ percent: 50 }); return 'done'; },
      async pullFile(_deviceId, _remote, _local, onProgress) { onProgress({ percent: 25 }); return 'done'; },
      async getDeviceInfo() { return { model: 'Pixel' }; },
      async getDeviceIp() { return '192.168.1.5'; },
      async setupWireless() { return { tcpip: 'ok', connect: 'ok' }; },
      async makeDirectory() { return 'made'; },
      async deleteEntry() { return 'deleted'; },
      async renameEntry() { return 'renamed'; },
      async disconnectWireless() { return 'disconnected'; },
      checkSameNetwork() { return { sameNetwork: true }; }
    });

    registerAdbHandlers({
      handle(channel, fn) {
        handlers.set(channel, fn);
      }
    });

    const event = {
      sender: {
        send(channel, payload) {
          sent.push({ channel, payload });
        }
      }
    };

    const pushResult = await handlers.get('adb:push')(event, 'ABC123', 'local.apk', '/sdcard/local.apk');
    assert.deepEqual(pushResult, { success: true, data: 'done' }, 'wraps push results in success payloads');
    assert.deepEqual(
      sent[0],
      { channel: 'adb:transfer-progress', payload: { percent: 50 } },
      'forwards push progress events to the renderer'
    );
  }

  {
    const handlers = new Map();
    const { registerAdbHandlers } = loadRoutesWithService({
      async checkAdb() { throw new Error('adb missing'); },
      async getDevices() { throw new Error('offline'); },
      async getPackages() { throw new Error('bad'); },
      async uninstallApp() { throw new Error('bad'); },
      async clearAppData() { throw new Error('bad'); },
      async installApk() { throw new Error('bad'); },
      async listDirectory() { throw new Error('bad'); },
      async pushFile() { throw new Error('push failed'); },
      async pullFile() { throw new Error('bad'); },
      async getDeviceInfo() { throw new Error('bad'); },
      async getDeviceIp() { throw new Error('bad'); },
      async setupWireless() { throw new Error('bad'); },
      async makeDirectory() { throw new Error('bad'); },
      async deleteEntry() { throw new Error('bad'); },
      async renameEntry() { throw new Error('bad'); },
      async disconnectWireless() { throw new Error('bad'); },
      checkSameNetwork() { throw new Error('bad'); }
    });

    registerAdbHandlers({
      handle(channel, fn) {
        handlers.set(channel, fn);
      }
    });

    const pushResult = await handlers.get('adb:push')({ sender: { send() {} } }, 'ABC123', 'local.apk', '/sdcard/local.apk');
    assert.deepEqual(
      pushResult,
      { success: false, error: 'push failed' },
      'returns structured errors when adb push fails'
    );

    const sameNetworkResult = handlers.get('adb:check-same-network')({}, '192.168.1.2');
    assert.deepEqual(
      sameNetworkResult,
      { success: true, data: { sameNetwork: false } },
      'falls back to sameNetwork false when the network check throws'
    );
  }

  console.log('All tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
