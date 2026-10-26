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

  {
    const calls = [];
    const packages = loadPackagesWithStubs({
      fs: { existsSync: () => true },
      runner: {
        async spawnAdbWithInactivityTimeout(args) {
          calls.push(args);
          if (calls.length === 1) throw new Error('Failure [INSTALL_FAILED_DEPRECATED_SDK_VERSION]');
          return 'Success';
        }
      },
      validation: {
        validateDeviceId() {},
        validatePackageName() {}
      }
    });

    await packages.installApk('ABC123', 'C:\\temp\\demo.apk', { grantPermissions: true });
    assert.deepEqual(
      calls,
      [
        ['-s', 'ABC123', 'install', '-r', '-g', 'C:\\temp\\demo.apk'],
        ['-s', 'ABC123', 'install', '--bypass-low-target-sdk-block', '-r', '-g', 'C:\\temp\\demo.apk']
      ],
      'adds -g on install and on the bypass retry when grantPermissions is set'
    );
  }

  const dumpsysSample = [
    'Packages:',
    '  Package [com.example.app] (1a2b3c):',
    '    userId=10234',
    '    requested permissions:',
    '      android.permission.INTERNET',
    '      android.permission.CAMERA',
    '      android.permission.READ_EXTERNAL_STORAGE: restricted=true',
    '      evil;reboot',
    '      android.permission.ACCESS_FINE_LOCATION',
    '    install permissions:',
    '      android.permission.INTERNET: granted=true',
    '    User 0: ceDataInode=12345 installed=true',
    '      runtime permissions:',
    '        android.permission.CAMERA: granted=false'
  ].join('\n');

  {
    const { parseRequestedPermissions } = loadPackagesWithStubs({ fs: {}, runner: {}, validation: {} });
    assert.deepEqual(
      parseRequestedPermissions(dumpsysSample),
      [
        'android.permission.INTERNET',
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.ACCESS_FINE_LOCATION'
      ],
      'parses only the requested permissions block and drops names unsafe for the device shell'
    );
    assert.deepEqual(parseRequestedPermissions('Packages:\n  Package [x]:\n'), [], 'returns empty list when nothing is requested');
  }

  {
    const calls = [];
    const packages = loadPackagesWithStubs({
      fs: {},
      runner: {
        async runAdb(args) {
          calls.push(args);
          if (args.includes('dumpsys')) return { stdout: dumpsysSample, stderr: '' };
          if (args.includes('android.permission.INTERNET')) {
            return { stdout: '', stderr: 'Exception occurred while executing: not a changeable permission type' };
          }
          return { stdout: '', stderr: '' };
        }
      },
      validation: {
        validateDeviceId() {},
        validatePackageName() {}
      }
    });

    const result = await packages.grantAllPermissions('ABC123', 'com.example.app');
    assert.deepEqual(
      result,
      {
        granted: ['android.permission.CAMERA', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.ACCESS_FINE_LOCATION'],
        skipped: ['android.permission.INTERNET']
      },
      'grants each requested permission and reports the ones the device refused'
    );
    assert.deepEqual(calls[0], ['-s', 'ABC123', 'shell', 'dumpsys', 'package', 'com.example.app'], 'reads permissions via dumpsys');
    assert.deepEqual(calls[2], ['-s', 'ABC123', 'shell', 'pm', 'grant', 'com.example.app', 'android.permission.CAMERA'], 'grants via pm grant');
  }

  {
    const outputs = {
      'com.example.app': '  Package [com.example.app] (1a2b3c):\r\n    firstInstallTime=2026-10-20 09:00:00\r\n    lastUpdateTime=2026-10-25 23:41:02\r\n',
      'com.missing.app': 'Dexopt state:\r\n  Unable to find package: com.missing.app\r\n'
    };
    const calls = [];
    const packages = loadPackagesWithStubs({
      fs: {},
      runner: {
        async runAdb(args) {
          calls.push(args);
          return { stdout: outputs[args[args.length - 1]], stderr: '' };
        }
      },
      validation: {
        validateDeviceId() {},
        validatePackageName() {}
      }
    });

    assert.equal(await packages.getPackageUpdateTime('ABC123', 'com.example.app'), '2026-10-25 23:41:02', 'reads lastUpdateTime from dumpsys');
    assert.equal(await packages.getPackageUpdateTime('ABC123', 'com.missing.app'), null, 'returns null when the package is not installed');
    assert.deepEqual(calls[0], ['-s', 'ABC123', 'shell', 'dumpsys', 'package', 'com.example.app'], 'queries dumpsys for the package');
  }

  console.log('All tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
