'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const domModule = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'modules', 'dom.js'), 'utf8');
const uiStateModule = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'modules', 'ui-state.js'), 'utf8');

assert.equal(/id="explorerGoBtn"/.test(html), false, 'does not render a Go button in the explorer toolbar');
assert.equal(/explorerGoBtn/.test(domModule), false, 'does not keep a dead Go button DOM reference');
assert.equal(/explorerGoBtn/.test(uiStateModule), false, 'does not toggle a removed Go button in UI state');

console.log('All tests passed.');
