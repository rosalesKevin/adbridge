import assert from 'node:assert/strict';

import { nextAutoGrantActions, autoGrantKey } from '../src/renderer/modules/auto-grant-state.mjs';

{
  const { toGrant, seen } = nextAutoGrantActions({}, 'DEV1', [{ pkg: 'com.a', time: 't1' }]);
  assert.deepEqual(toGrant, ['com.a'], 'grants on first sight so the current install is covered');
  assert.equal(seen[autoGrantKey('DEV1', 'com.a')], 't1', 'remembers the install time');
}

{
  const before = { [autoGrantKey('DEV1', 'com.a')]: 't1' };
  const { toGrant } = nextAutoGrantActions(before, 'DEV1', [{ pkg: 'com.a', time: 't1' }]);
  assert.deepEqual(toGrant, [], 'skips packages whose install time is unchanged');
}

{
  const before = { [autoGrantKey('DEV1', 'com.a')]: 't1' };
  const { toGrant, seen } = nextAutoGrantActions(before, 'DEV1', [{ pkg: 'com.a', time: 't2' }]);
  assert.deepEqual(toGrant, ['com.a'], 'grants again after a reinstall or update');
  assert.equal(seen[autoGrantKey('DEV1', 'com.a')], 't2', 'stores the new install time');
}

{
  const before = { [autoGrantKey('DEV1', 'com.a')]: 't1' };
  const { toGrant, seen } = nextAutoGrantActions(before, 'DEV1', [{ pkg: 'com.a', time: null }]);
  assert.deepEqual(toGrant, [], 'does nothing while the package is uninstalled');
  assert.equal(autoGrantKey('DEV1', 'com.a') in seen, false, 'forgets uninstalled packages so a reinstall is granted');
}

{
  const before = { [autoGrantKey('DEV1', 'com.a')]: 't1' };
  const { toGrant, seen } = nextAutoGrantActions(before, 'DEV1', [{ pkg: 'com.a', time: undefined }]);
  assert.deepEqual(toGrant, [], 'ignores packages whose lookup failed');
  assert.equal(seen[autoGrantKey('DEV1', 'com.a')], 't1', 'keeps the last known time when a lookup fails');
}

{
  const before = { [autoGrantKey('DEV1', 'com.a')]: 't1' };
  const { toGrant } = nextAutoGrantActions(before, 'DEV2', [{ pkg: 'com.a', time: 't1' }]);
  assert.deepEqual(toGrant, ['com.a'], 'tracks each device separately');
}

console.log('All tests passed.');
