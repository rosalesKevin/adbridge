'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');

function loadPackagesWithStubs(stubs) {
  const modulePath = require.resolve('../src/main/adb/packages');
  delete require.cache[modulePath];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'node:fs') return stubs.fs;
    if (request === './runner') return stubs.runner;
    if (request === './validation') return stubs.validation;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require('../src/main/adb/packages');
  } finally {
    Module._load = originalLoad;
  }
}

(async () => {
  {
    const calls = [];
    const packages = loadPackagesWithStubs({
      fs: { existsSync: () => true },
      runner: {
        async runAdb() {
          throw new Error('runAdb should not be used in install tests');
        },
        async spawnAdbWithInactivityTimeout(args, timeoutMs) {
          calls.push({ args, timeoutMs });
          return 'Success';
        }
      },
      validation: {
        validateDeviceId() {},
        validatePackageName() {}
      }
    });

    const result = await packages.installApk('ABC123', 'C:\\temp\\demo.apk');
    assert.equal(result, 'Success', 'keeps the normal install flow unchanged');
    assert.deepEqual(
      calls,
      [{ args: ['-s', 'ABC123', 'install', '-r', 'C:\\temp\\demo.apk'], timeoutMs: 60000 }],
      'uses adb install -r by default'
    );
  }

  {
    const calls = [];
    const packages = loadPackagesWithStubs({
      fs: { existsSync: () => true },
      runner: {
        async runAdb() {
          throw new Error('runAdb should not be used in install tests');
        },
        async spawnAdbWithInactivityTimeout(args, timeoutMs) {
          calls.push({ args, timeoutMs });
          if (calls.length === 1) {
            throw new Error('Failure [INSTALL_FAILED_DEPRECATED_SDK_VERSION]');
          }
          return 'Success via bypass';
        }
      },
      validation: {
        validateDeviceId() {},
        validatePackageName() {}
      }
    });

    const result = await packages.installApk('ABC123', 'C:\\temp\\legacy.apk');
    assert.equal(result, 'Success via bypass', 'retries with bypass for deprecated target SDK installs');
    assert.deepEqual(
      calls,
      [
        { args: ['-s', 'ABC123', 'install', '-r', 'C:\\temp\\legacy.apk'], timeoutMs: 60000 },
        { args: ['-s', 'ABC123', 'install', '--bypass-low-target-sdk-block', '-r', 'C:\\temp\\legacy.apk'], timeoutMs: 60000 }
      ],
      'retries exactly once with the bypass flag'
    );
  }

  {
    const calls = [];
    const packages = loadPackagesWithStubs({
      fs: { existsSync: () => true },
      runner: {
        async runAdb() {
          throw new Error('runAdb should not be used in install tests');
        },
        async spawnAdbWithInactivityTimeout(args, timeoutMs) {
          calls.push({ args, timeoutMs });
          throw new Error('Failure [INSTALL_FAILED_VERSION_DOWNGRADE]');
        }
      },
      validation: {
        validateDeviceId() {},
        validatePackageName() {}
      }
    });

    await assert.rejects(
      () => packages.installApk('ABC123', 'C:\\temp\\downgrade.apk'),
      /INSTALL_FAILED_VERSION_DOWNGRADE/,
      'does not retry unrelated install failures'
    );
    assert.deepEqual(
      calls,
      [{ args: ['-s', 'ABC123', 'install', '-r', 'C:\\temp\\downgrade.apk'], timeoutMs: 60000 }],
      'leaves unrelated failures on the original install path'
    );
  }

  console.log('All tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
