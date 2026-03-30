import assert from 'node:assert/strict';

import { renameSingleExplorerSelection } from '../src/renderer/modules/explorer-rename.mjs';

{
  const calls = [];
  const result = await renameSingleExplorerSelection({
    selectedDeviceId: 'ABC123',
    explorerPath: '/sdcard/',
    selectedItems: [{ name: 'Documents', isDir: true }],
    promptForName: async () => 'Pictures',
    renameEntry: async (deviceId, remotePath, newName) => {
      calls.push({ deviceId, remotePath, newName });
      return { success: true, data: 'Renamed' };
    },
    refresh: async (path) => {
      calls.push({ refresh: path });
    },
    log: (message) => {
      calls.push({ log: message });
    },
    setBusy: (busy) => {
      calls.push({ busy });
    }
  });

  assert.equal(result, true, 'renames a single selected explorer item');
  assert.deepEqual(
    calls,
    [
      { log: 'Renaming ABC123:/sdcard/Documents -> Pictures...' },
      { busy: true },
      { deviceId: 'ABC123', remotePath: '/sdcard/Documents', newName: 'Pictures' },
      { log: 'Renamed: Documents -> Pictures' },
      { refresh: '/sdcard/' },
      { busy: false }
    ],
    'uses the backend rename path and refreshes the current folder on success'
  );
}

{
  const calls = [];
  const result = await renameSingleExplorerSelection({
    selectedDeviceId: 'ABC123',
    explorerPath: '/sdcard/',
    selectedItems: [{ name: 'a.txt' }, { name: 'b.txt' }],
    promptForName: async () => 'c.txt',
    renameEntry: async () => ({ success: true }),
    refresh: async () => {},
    log: (message) => {
      calls.push(message);
    },
    setBusy: () => {}
  });

  assert.equal(result, false, 'does not rename when multiple items are selected');
  assert.deepEqual(calls, ['ERROR: Select exactly one file or folder to rename.']);
}

console.log('All tests passed.');
