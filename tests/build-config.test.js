const assert = require('node:assert/strict');
const path = require('node:path');

const packageJson = require(path.join(__dirname, '..', 'package.json'));

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('windows build keeps builder executable editing disabled', () => {
  assert.strictEqual(
    packageJson.build?.win?.signAndEditExecutable,
    false,
    'windows builds should keep electron-builder executable editing disabled so the build does not depend on the broken winCodeSign extraction path'
  );
});

test('windows build ships a folder-based release instead of a portable exe target', () => {
  assert.deepStrictEqual(
    packageJson.build?.win?.target,
    [{ target: 'dir', arch: ['x64'] }],
    'windows builds should stage a runnable app folder for zipping'
  );
});

test('windows build copies scrcpy beside the app executable via extraFiles', () => {
  assert.deepStrictEqual(
    packageJson.build?.extraFiles,
    [
      { from: 'vendor/scrcpy', to: 'scrcpy', filter: ['**/*'] },
      { from: 'vendor/LICENSES', to: 'LICENSES', filter: ['**/*'] },
      { from: 'docs/THIRD_PARTY_LICENSES.md', to: 'THIRD_PARTY_LICENSES.md' },
      { from: 'build/README.txt', to: 'README.txt' }
    ],
    'release folder should contain a sibling scrcpy directory, bundled license attributions, and top-level README.txt'
  );
});

test('windows build keeps only en-US Electron locale files', () => {
  assert.deepStrictEqual(
    packageJson.build?.electronLanguages,
    ['en-US'],
    'windows build should keep only the en-US Electron locale to reduce release size safely'
  );
});

test('windows builds patch the packed app executable through an afterPack hook', () => {
  assert.strictEqual(
    packageJson.build?.afterPack,
    'scripts/after-pack.js',
    'build should patch the packed Windows app executable during electron-builder afterPack'
  );
});

test('rcedit is available as a local dev dependency for post-build patching', () => {
  assert.ok(
    packageJson.devDependencies?.rcedit,
    'rcedit must be available locally so the portable release can be patched after build'
  );
});

test('build script runs only the dir build step', () => {
  assert.strictEqual(
    packageJson.scripts?.build,
    'npm run build:dir',
    'build script should only run build:dir — no extra packaging step'
  );
});
