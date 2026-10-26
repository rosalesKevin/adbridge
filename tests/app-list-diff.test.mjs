import assert from 'node:assert/strict';

import { diffPackages } from '../src/renderer/modules/app-list-diff.mjs';

assert.deepEqual(
  diffPackages(['com.a', 'com.b'], ['com.a', 'com.b']),
  { added: [], removed: [] },
  'reports no change for identical lists'
);

assert.deepEqual(
  diffPackages(['com.a', 'com.b'], ['com.a', 'com.c']),
  { added: ['com.c'], removed: ['com.b'] },
  'reports installed and uninstalled packages'
);

assert.deepEqual(
  diffPackages([], ['com.a']),
  { added: ['com.a'], removed: [] },
  'treats everything as added when the old list is empty'
);

console.log('All tests passed.');
