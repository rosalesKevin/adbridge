'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

const headerMatch = html.match(/<h1 class="app-title">[\s\S]*?<span id="appVersion" class="app-version"/);
assert.equal(Boolean(headerMatch), true, 'renders the app version next to the ADBridge title in the header');

const footer = html.match(/<footer[^>]*class="log-panel[^"]*"[^>]*>[\s\S]*?<\/footer>/)?.[0];
assert.ok(footer, 'finds the log footer');
assert.equal(footer.includes('id="appVersion"'), false, 'does not render the app version in the footer');

console.log('All tests passed.');
