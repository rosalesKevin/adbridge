'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');

function loadDeviceWithStubs(stubs) {
  const devicePath = require.resolve('../src/main/adb/device');
  delete require.cache[devicePath];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'node:os') return stubs.os;
    if (request === 'node:child_process') return stubs.childProcess;
    if (request === './runner') return stubs.runner;
    if (request === './resolver') return stubs.resolver;
    if (request === './validation') return stubs.validation;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require('../src/main/adb/device');
  } finally {
    Module._load = originalLoad;
  }
}

(async () => {
  {
    const device = loadDeviceWithStubs({
      os: { networkInterfaces: () => ({}) },
      childProcess: { spawn() { throw new Error('unused'); } },
      runner: { runAdb: async () => ({ stdout: '', stderr: '' }) },
      resolver: { getAdbExe: () => 'adb.exe' },
      validation: { validateDeviceId() {} }
    });

    assert.deepEqual(
      device.parseDevicesOutput('List of devices attached\nABC123\tdevice\nemulator-5554\toffline\n\n'),
      [
        { id: 'ABC123', status: 'device' },
        { id: 'emulator-5554', status: 'offline' }
      ],
      'parses adb devices output into id/status pairs'
    );
  }

  {
    const device = loadDeviceWithStubs({
      os: {
        networkInterfaces: () => ({
          Ethernet0: [
            { family: 'IPv4', internal: false, address: '192.168.1.5', netmask: '255.255.255.0' }
          ]
        })
      },
      childProcess: { spawn() { throw new Error('unused'); } },
      runner: { runAdb: async () => ({ stdout: '', stderr: '' }) },
      resolver: { getAdbExe: () => 'adb.exe' },
      validation: { validateDeviceId() {} }
    });

    assert.deepEqual(
      device.checkSameNetwork('192.168.1.77'),
      { sameNetwork: true },
      'reports devices on the same subnet as reachable'
    );
    assert.deepEqual(
      device.checkSameNetwork('10.0.0.8'),
      { sameNetwork: false },
      'reports devices on a different subnet as not reachable'
    );
  }

  {
    const calls = [];
    const device = loadDeviceWithStubs({
      os: { networkInterfaces: () => ({}) },
      childProcess: { spawn() { throw new Error('unused'); } },
      runner: {
        async runAdb(args) {
          calls.push(args);
          const key = args.slice(3).join(' ');
          if (key === 'getprop ro.product.model') return { stdout: '' };
          if (key === 'getprop ro.product.manufacturer') return { stdout: 'Google' };
          if (key === 'getprop ro.build.version.release') return { stdout: '14' };
          if (key === 'dumpsys battery') return { stdout: 'level: 85\nstatus: 2\n' };
          if (key === 'cat /proc/meminfo') return { stdout: 'MemTotal: 4096 kB\nMemAvailable: 1024 kB\n' };
          throw new Error(`Unexpected ADB args: ${args.join(' ')}`);
        }
      },
      resolver: { getAdbExe: () => 'adb.exe' },
      validation: { validateDeviceId() {} }
    });

    const info = await device.getDeviceInfo('ABC123');
    assert.equal(info.model, 'Unknown Device', 'falls back when the model property is empty');
    assert.equal(info.manufacturer, 'Google');
    assert.equal(info.androidVersion, '14');
    assert.equal(info.batteryLevel, 85);
    assert.equal(info.batteryCharging, true);
    assert.equal(info.memTotalBytes, 4096 * 1024);
    assert.equal(info.memUsedBytes, (4096 - 1024) * 1024);
    assert.equal(calls.length, 5, 'queries the expected five adb properties/data sources');
  }

  console.log('All tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
