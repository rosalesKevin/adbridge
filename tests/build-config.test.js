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

test('portable Windows build keeps builder executable editing disabled', () => {
  assert.strictEqual(
    packageJson.build?.win?.signAndEditExecutable,
    false,
    'portable builds should keep electron-builder executable editing disabled so the build does not depend on the broken winCodeSign extraction path'
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
