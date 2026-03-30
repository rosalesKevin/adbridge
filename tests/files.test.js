'use strict';

const assert = require('node:assert/strict');

const { parseTransferLine } = require('../src/main/adb/files');

assert.deepEqual(
  parseTransferLine('[ 15%] /sdcard/file.bin: 15/100 MB'),
  { percent: 15, current: '15', total: '100', unit: 'MB' },
  'parses adb transfer progress lines'
);

assert.equal(
  parseTransferLine('adb: error: failed to copy'),
  null,
  'ignores non-progress output'
);

console.log('All tests passed.');
