const assert = require('node:assert/strict');
const path = require('node:path');
const { getToolCandidates, resolveToolPath, buildMissingToolMessage } = require('../src/main/runtime-paths');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('prefers sibling scrcpy directory beside the launched exe', () => {
  const candidates = getToolCandidates({
    toolName: 'scrcpy.exe',
    execPath: 'C:\\Apps\\ADBridge\\ADBridge.exe',
    resourcesPath: 'C:\\Users\\Seven\\AppData\\Local\\Temp\\resources',
    devBaseDir: 'C:\\repo\\adbridge\\vendor\\scrcpy'
  });

  assert.deepStrictEqual(candidates, [
    path.join('C:\\Apps\\ADBridge', 'scrcpy', 'scrcpy.exe'),
    path.join('C:\\Users\\Seven\\AppData\\Local\\Temp\\resources', 'scrcpy', 'scrcpy.exe'),
    path.join('C:\\repo\\adbridge\\vendor\\scrcpy', 'scrcpy.exe')
  ]);
});

test('returns the first existing helper binary', () => {
  const resolved = resolveToolPath({
    toolName: 'adb.exe',
    execPath: 'C:\\Apps\\ADBridge\\ADBridge.exe',
    resourcesPath: 'C:\\Temp\\resources',
    devBaseDir: 'C:\\repo\\adbridge\\vendor\\scrcpy',
    existsSync: (candidate) => candidate === 'C:\\Apps\\ADBridge\\scrcpy\\adb.exe'
  });

  assert.strictEqual(resolved, 'C:\\Apps\\ADBridge\\scrcpy\\adb.exe');
});

test('missing-tool message explains the extracted folder requirement', () => {
  const message = buildMissingToolMessage({
    toolName: 'scrcpy.exe',
    expectedPath: 'C:\\Apps\\ADBridge\\scrcpy\\scrcpy.exe'
  });

  assert.match(message, /Run ADBridge from the extracted release folder/i);
  assert.match(message, /keep ADBridge\.exe and the scrcpy folder together/i);
});

test('adb resolver falls back to PATH only when no bundled adb exists', () => {
  const { resolveAdbExe } = require('../src/main/adb/resolver');

  const resolved = resolveAdbExe({
    execPath: 'C:\\Apps\\ADBridge\\ADBridge.exe',
    resourcesPath: 'C:\\Temp\\resources',
    existsSync: () => false
  });

  assert.strictEqual(resolved, 'adb');
});

test('scrcpy service missing message points to sibling scrcpy folder first', () => {
  const { getScrcpyExecutableForTest } = require('../src/main/scrcpy-service');
  const scrcpyPath = getScrcpyExecutableForTest({
    execPath: 'C:\\Apps\\ADBridge\\ADBridge.exe',
    resourcesPath: 'C:\\Temp\\resources',
    existsSync: () => false
  });

  assert.strictEqual(scrcpyPath.resolved, null);
  assert.strictEqual(scrcpyPath.expectedPath, 'C:\\Apps\\ADBridge\\scrcpy\\scrcpy.exe');
});
