'use strict';

const assert = require('node:assert/strict');

// Inline the functions under test to avoid requiring Electron modules
function parseVersion(raw) {
  const cleaned = (raw || '').trim().replace(/^v/, '');
  if (cleaned.includes('-')) return null;
  const parts = cleaned.split('.');
  if (parts.length !== 3) return null;
  if (parts.some(p => p === '')) return null; // empty segment e.g. "1..3"
  const nums = parts.map(Number);
  if (nums.some(n => !Number.isInteger(n) || n < 0)) return null;
  return { major: nums[0], minor: nums[1], patch: nums[2] };
}

function isNewer(a, b) {
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch > b.patch;
}

// ── parseVersion ──────────────────────────────────────────────────────────────
assert.deepEqual(parseVersion('1.2.3'),    { major: 1, minor: 2, patch: 3 }, 'bare semver');
assert.deepEqual(parseVersion('v1.2.3'),   { major: 1, minor: 2, patch: 3 }, 'v-prefix stripped');
assert.deepEqual(parseVersion('0.0.0'),    { major: 0, minor: 0, patch: 0 }, 'all zeros');
assert.deepEqual(parseVersion('10.20.30'), { major: 10, minor: 20, patch: 30 }, 'multi-digit');

assert.equal(parseVersion('v2.0.0-beta.1'), null, 'pre-release rejected');
assert.equal(parseVersion('v1.0.0-rc1'),    null, 'rc rejected');
assert.equal(parseVersion('1.2'),           null, 'missing patch rejected');
assert.equal(parseVersion('1.2.3.4'),       null, 'four parts rejected');
assert.equal(parseVersion('1.a.3'),         null, 'non-numeric rejected');
assert.equal(parseVersion(''),              null, 'empty string rejected');
assert.equal(parseVersion(null),            null, 'null rejected');
assert.equal(parseVersion('1..3'),          null, 'empty segment rejected');
assert.equal(parseVersion('v1..3'),         null, 'empty segment with prefix rejected');

// ── isNewer ───────────────────────────────────────────────────────────────────
const v = (s) => parseVersion(s);
assert.equal(isNewer(v('2.0.0'), v('1.9.9')), true,  'major bump is newer');
assert.equal(isNewer(v('1.3.0'), v('1.2.9')), true,  'minor bump is newer');
assert.equal(isNewer(v('1.2.4'), v('1.2.3')), true,  'patch bump is newer');
assert.equal(isNewer(v('1.2.3'), v('1.2.3')), false, 'same version is not newer');
assert.equal(isNewer(v('1.2.2'), v('1.2.3')), false, 'older patch is not newer');
assert.equal(isNewer(v('1.1.9'), v('1.2.0')), false, 'older minor is not newer');
assert.equal(isNewer(v('0.9.9'), v('1.0.0')), false, 'older major is not newer');

console.log('All tests passed.');
