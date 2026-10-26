'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

function loadKeystoreWithExecFile(execFile) {
  for (const mod of ['../src/main/keystore', '../src/main/apk-info']) {
    delete require.cache[require.resolve(mod)];
  }

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'node:child_process') return { execFile };
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require('../src/main/keystore');
  } finally {
    Module._load = originalLoad;
  }
}

// Android Studio's default SDK location, with ANDROID_HOME unset.
const localAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'adbridge-keystore-'));
const jar = path.join(localAppData, 'Android', 'Sdk', 'build-tools', '35.0.0', 'lib', 'apksigner.jar');
fs.mkdirSync(path.dirname(jar), { recursive: true });
fs.writeFileSync(jar, '');
delete process.env.ANDROID_HOME;
delete process.env.ANDROID_SDK_ROOT;
process.env.LOCALAPPDATA = localAppData;

(async () => {
  {
    const calls = [];
    const { getApkSigningInfo } = loadKeystoreWithExecFile((file, args, _opts, cb) => {
      calls.push({ file, args });
      cb(null, 'Verifies\nVerified using v2 scheme (APK Signature Scheme v2): true\nSigner #1 certificate DN: CN=Test\n', '');
    });

    const result = await getApkSigningInfo('C:\\apps\\demo.apk');
    assert.match(result, /Signer #1 certificate DN: CN=Test/, 'returns apksigner certificate output');
    assert.deepEqual(
      calls,
      [{ file: 'java', args: ['-jar', jar, 'verify', '--print-certs', '-v', 'C:\\apps\\demo.apk'] }],
      'runs apksigner from the default SDK location so v2/v3-only APKs are readable'
    );
  }

  {
    const { getApkSigningInfo } = loadKeystoreWithExecFile((_file, _args, _opts, cb) => {
      cb(
        Object.assign(new Error('Command failed'), { code: 1 }),
        '',
        'Exception in thread "main" com.android.apksig.apk.ApkFormatException: Malformed APK: not a ZIP archive\r\n\tat com.android.apksig.ApkVerifier.verify(ApkVerifier.java:191)\r\n\t... 3 more\r\n'
      );
    });

    await assert.rejects(
      () => getApkSigningInfo('C:\\apps\\broken.apk'),
      (err) => /Malformed APK: not a ZIP archive/.test(err.message) && !/ApkVerifier\.java|more/.test(err.message),
      'reports apksigner failures as errors without the Java stack trace'
    );
  }

  {
    process.env.LOCALAPPDATA = fs.mkdtempSync(path.join(os.tmpdir(), 'adbridge-nosdk-'));
    const { getApkSigningInfo } = loadKeystoreWithExecFile(() => {
      throw new Error('java should not run without apksigner');
    });

    await assert.rejects(() => getApkSigningInfo('C:\\apps\\demo.apk'), /apksigner not found/, 'explains when the SDK is missing');
  }

  console.log('All tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
