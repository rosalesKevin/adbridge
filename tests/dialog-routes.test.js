'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { registerDialogHandlers } = require('../src/main/ipc/dialog-routes');

const handlers = {};
const seen = [];
let next;
const ipcMain = { handle: (channel, fn) => { handlers[channel] = fn; } };
const dialog = {
  showOpenDialog: async (options) => { seen.push(options); return next; },
  showSaveDialog: async (options) => { seen.push(options); return next; }
};
registerDialogHandlers(ipcMain, dialog);

const apkDir = path.join('C:\\', 'apks');
const apk = path.join(apkDir, 'app.apk');
const destDir = path.join('D:\\', 'dest');

(async () => {
  next = { canceled: false, filePaths: [apk] };
  assert.deepEqual(await handlers['dialog:open-apk'](), { success: true, data: apk });
  assert.equal(seen[0].defaultPath, undefined, 'first dialog has no remembered folder');
  assert.deepEqual(seen[0].properties, ['openFile'], 'picker options are kept');

  next = { canceled: true, filePaths: [] };
  assert.deepEqual(await handlers['dialog:open-keystore'](), { success: true, data: null });
  assert.equal(seen[1].defaultPath, apkDir, 'opens in the folder of the last picked file');

  next = { canceled: false, filePaths: [destDir] };
  assert.deepEqual(await handlers['dialog:open-directory'](), { success: true, data: destDir });
  assert.equal(seen[2].defaultPath, apkDir, 'a cancelled dialog does not reset the folder');

  next = { canceled: true, filePaths: [] };
  await handlers['dialog:open-file']();
  assert.equal(seen[3].defaultPath, destDir, 'a picked folder is remembered as-is');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbridge-dialog-'));
  const out = path.join(tmp, 'export.log');
  next = { canceled: false, filePath: out };
  assert.deepEqual(await handlers['logcat:save'](null, 'hello', 'logcat.log'), { success: true, data: out });
  assert.equal(seen[4].defaultPath, path.join(destDir, 'logcat.log'), 'save dialog suggests the name inside the remembered folder');
  assert.equal(fs.readFileSync(out, 'utf8'), 'hello');

  next = { canceled: true, filePaths: [] };
  await handlers['dialog:open-push-directory']();
  assert.equal(seen[5].defaultPath, tmp, 'the save location is remembered too');

  // Pull overwrite warning: which of these names already exist in the local folder?
  assert.deepEqual(
    await handlers['dialog:existing-names'](null, tmp, ['export.log', 'new.txt']),
    { success: true, data: ['export.log'] },
    'reports only the names that already exist'
  );
  assert.equal(
    (await handlers['dialog:existing-names'](null, tmp, ['..\\export.log'])).success,
    false,
    'only bare file names are accepted, never paths'
  );

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('All tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
