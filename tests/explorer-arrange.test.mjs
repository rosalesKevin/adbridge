import assert from 'node:assert/strict';

import { arrangeEntries } from '../src/renderer/modules/explorer-arrange.mjs';

const entries = [
  { name: 'b.txt', isDir: false, size: 300, modifiedMs: 3000 },
  { name: 'Zeta', isDir: true, size: 4096, modifiedMs: 1000 },
  { name: '.hidden', isDir: false, size: 5, modifiedMs: 5000 },
  { name: 'a.jpg', isDir: false, size: 100, modifiedMs: null },
  { name: 'alpha', isDir: true, size: 4096, modifiedMs: 2000 },
  { name: 'C.md', isDir: false, size: 200, modifiedMs: 4000 }
];
const names = (list) => list.map((e) => e.name);
const base = { sortKey: 'name', sortDir: 1, filter: '', showHidden: true };

assert.deepEqual(names(arrangeEntries(entries, base)), ['alpha', 'Zeta', '.hidden', 'a.jpg', 'b.txt', 'C.md'],
  'folders first, then case-insensitive by name');
assert.deepEqual(names(arrangeEntries(entries, { ...base, sortDir: -1 })), ['Zeta', 'alpha', 'C.md', 'b.txt', 'a.jpg', '.hidden'],
  'descending keeps folders first');
assert.deepEqual(names(arrangeEntries(entries, { ...base, sortKey: 'size' })), ['alpha', 'Zeta', '.hidden', 'a.jpg', 'C.md', 'b.txt'],
  'by size, smallest first (folders by name)');
assert.deepEqual(names(arrangeEntries(entries, { ...base, sortKey: 'modified', sortDir: -1 })), ['alpha', 'Zeta', '.hidden', 'C.md', 'b.txt', 'a.jpg'],
  'newest first; unknown dates go last; folders newest first too');
assert.deepEqual(names(arrangeEntries(entries, { ...base, showHidden: false })), ['alpha', 'Zeta', 'a.jpg', 'b.txt', 'C.md'],
  'hides dotfiles when hidden files are off');
assert.deepEqual(names(arrangeEntries(entries, { ...base, filter: '  A ' })), ['alpha', 'Zeta', 'a.jpg'],
  'filter is a trimmed, case-insensitive substring match');
assert.deepEqual(entries[0].name, 'b.txt', 'does not reorder the input array');

console.log('All tests passed.');
