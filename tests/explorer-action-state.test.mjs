import assert from 'node:assert/strict';

import { getExplorerActionState } from '../src/renderer/modules/explorer-action-state.mjs';

assert.deepEqual(
  getExplorerActionState({ busy: false, hasDevice: true, selectedCount: 2 }),
  {
    pushDisabled: false,
    pushFolderDisabled: false,
    pullDisabled: false,
    deleteDisabled: false,
    renameDisabled: true
  },
  'enables all explorer actions when a device is selected and work is idle'
);

assert.deepEqual(
  getExplorerActionState({ busy: true, hasDevice: true, selectedCount: 2 }),
  {
    pushDisabled: true,
    pushFolderDisabled: true,
    pullDisabled: true,
    deleteDisabled: true,
    renameDisabled: true
  },
  'disables all explorer actions while a transfer is busy'
);

assert.deepEqual(
  getExplorerActionState({ busy: false, hasDevice: false, selectedCount: 2 }),
  {
    pushDisabled: true,
    pushFolderDisabled: true,
    pullDisabled: true,
    deleteDisabled: true,
    renameDisabled: true
  },
  'disables explorer actions when no device is selected'
);

assert.deepEqual(
  getExplorerActionState({ busy: false, hasDevice: true, selectedCount: 1 }),
  {
    pushDisabled: false,
    pushFolderDisabled: false,
    pullDisabled: false,
    deleteDisabled: false,
    renameDisabled: false
  },
  'enables rename only when exactly one item is selected'
);

console.log('All tests passed.');
