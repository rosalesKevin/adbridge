'use strict';

const assert = require('node:assert/strict');

const { isRiskyToOpen } = require('../src/main/open-on-pc');

for (const name of ['setup.exe', 'run.BAT', 'x.cmd', 'script.ps1', 'a.vbs', 'payload.js', 'thing.msi', 'link.lnk', 'tool.jar', 'hack.hta', 'app.scr', 'keys.reg']) {
  assert.equal(isRiskyToOpen(name), true, `${name} is only shown in Explorer, never run`);
}
for (const name of ['photo.jpg', 'notes.txt', 'video.mp4', 'doc.pdf', 'archive.zip', 'app-release.apk', 'log.json', 'noextension']) {
  assert.equal(isRiskyToOpen(name), false, `${name} opens with its default app`);
}

console.log('All tests passed.');
