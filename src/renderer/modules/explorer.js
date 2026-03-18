import { dom } from './dom.js';
import { state } from './state.js';
import { appendLog } from './logger.js';
import { escapeHtml, formatSize } from './utils.js';
import { setBusy } from './ui-state.js';
import { showConfirmDialog, showPromptDialog } from './confirm-dialog.js';
import { getIcon } from './icons.js';
import { getExplorerActionState } from './explorer-action-state.mjs';

export function clearExplorer() {
  state.explorerPath = '/sdcard/';
  state.explorerEntries = [];
  state.explorerSelectedItems = [];
  dom.explorerList.innerHTML = '<li class="empty-state">Select a device to browse files</li>';
  dom.explorerBreadcrumb.innerHTML = '';
  dom.explorerPathInput.value = '/sdcard/';
  dom.explorerStatus.textContent = '-';
  explorerUpdateActionButtons();
}

function explorerUpdateActionButtons() {
  const actionState = getExplorerActionState({
    busy: state.busy,
    hasDevice: Boolean(state.selectedDeviceId),
    selectedCount: state.explorerSelectedItems.length
  });

  dom.explorerPushBtn.disabled = actionState.pushDisabled;
  dom.explorerPushFolderBtn.disabled = actionState.pushFolderDisabled;
  dom.explorerPullBtn.disabled = actionState.pullDisabled;
  dom.explorerDeleteBtn.disabled = actionState.deleteDisabled;
}

function explorerUpdateStatus() {
  const total = state.explorerEntries.length;
  const selectedCount = state.explorerSelectedItems.length;

  if (selectedCount > 0) {
    if (selectedCount === 1) {
      const selected = state.explorerSelectedItems[0];
      const sizeStr = selected.size !== null ? `  •  ${formatSize(selected.size)}` : '';
      dom.explorerStatus.textContent = `Selected: ${selected.name}${sizeStr}`;
    } else {
      let totalSize = 0;
      let hasUnknownSize = false;
      for (const item of state.explorerSelectedItems) {
        if (item.size !== null) {
          totalSize += item.size;
        } else if (!item.isDir) {
           hasUnknownSize = true;
        }
      }
      const sizeStr = totalSize > 0 ? `  •  ${formatSize(totalSize)}${hasUnknownSize ? '+' : ''}` : '';
      dom.explorerStatus.textContent = `Selected: ${selectedCount} items${sizeStr}`;
    }
  } else {
    dom.explorerStatus.textContent = total === 0 ? 'Empty folder' : `${total} item${total !== 1 ? 's' : ''}`;
  }
}

function renderTransferProgress(label, progress, startTime) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const percent = progress.percent || 0;
  const current = progress.current || '0';
  const total = progress.total || '0';
  const unit = progress.unit || '';

  dom.explorerStatus.innerHTML = `
    <span class="explorer-transfer-status">
      <span class="explorer-transfer-spinner"></span>
      ${label}: ${percent}% (${current}/${total} ${unit}) • ${elapsed}s
    </span>
  `;
}

let lastSelectedIndex = -1;

function explorerSelectEntry(event, entry, li, index) {
  const isCtrl = event.ctrlKey || event.metaKey;
  const isShift = event.shiftKey;

  if (isShift && lastSelectedIndex !== -1) {
    // Shift-click: select range
    const start = Math.min(lastSelectedIndex, index);
    const end = Math.max(lastSelectedIndex, index);
    
    if (!isCtrl) {
      state.explorerSelectedItems = [];
      dom.explorerList.querySelectorAll('li.selected').forEach((el) => el.classList.remove('selected'));
    }

    const listItems = dom.explorerList.querySelectorAll('li.explorer-entry');
    for (let i = start; i <= end; i++) {
      const itemToSelect = state.explorerEntries[i];
      if (!state.explorerSelectedItems.some(e => e.name === itemToSelect.name)) {
        state.explorerSelectedItems.push(itemToSelect);
        listItems[i].classList.add('selected');
      }
    }
  } else if (isCtrl) {
    // Ctrl-click: toggle selection
    const existingIndex = state.explorerSelectedItems.findIndex(e => e.name === entry.name);
    if (existingIndex !== -1) {
      state.explorerSelectedItems.splice(existingIndex, 1);
      li.classList.remove('selected');
    } else {
      state.explorerSelectedItems.push(entry);
      li.classList.add('selected');
    }
    lastSelectedIndex = index;
  } else {
    // Normal click: single selection
    const isAlreadySelected = state.explorerSelectedItems.length === 1 && state.explorerSelectedItems[0].name === entry.name;
    
    state.explorerSelectedItems = [];
    dom.explorerList.querySelectorAll('li.selected').forEach((el) => el.classList.remove('selected'));

    if (!isAlreadySelected) {
      state.explorerSelectedItems = [entry];
      li.classList.add('selected');
      lastSelectedIndex = index;
    } else {
      lastSelectedIndex = -1;
    }
  }

  explorerUpdateActionButtons();
  explorerUpdateStatus();
}

function explorerRenderBreadcrumb(path) {
  dom.explorerBreadcrumb.innerHTML = '';

  const parts = path.split('/').filter(Boolean);
  const segments = [{ label: '/', path: '/' }];
  let cumulative = '/';

  for (const part of parts) {
    cumulative = cumulative === '/' ? `/${part}/` : `${cumulative}${part}/`;
    segments.push({ label: part, path: cumulative });
  }

  segments.forEach((segment, index) => {
    if (index > 0) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.innerHTML = getIcon('chevronRight');
      dom.explorerBreadcrumb.appendChild(sep);
    }

    const item = document.createElement('span');
    item.textContent = segment.label;

    if (index === segments.length - 1) {
      item.className = 'breadcrumb-item breadcrumb-current';
    } else {
      item.className = 'breadcrumb-item';
      item.addEventListener('click', () => {
        void explorerNavigate(segment.path);
      });
    }

    dom.explorerBreadcrumb.appendChild(item);
  });
}

function explorerRenderEntries() {
  dom.explorerList.innerHTML = '';
  state.explorerSelectedItems = [];
  lastSelectedIndex = -1;
  explorerUpdateActionButtons();

  if (state.explorerEntries.length === 0) {
    dom.explorerList.innerHTML = '<li class="state-msg">Empty folder</li>';
    dom.explorerStatus.textContent = 'Empty folder';
    return;
  }

  state.explorerEntries.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = `explorer-entry ${entry.isDir ? 'explorer-dir' : 'explorer-file'}`;

    const sizeHtml = !entry.isDir && entry.size !== null
      ? `<span class="explorer-size">${formatSize(entry.size)}</span>`
      : '<span class="explorer-size"></span>';

    const icon = entry.isDir ? getIcon('folder') : getIcon('file');

    li.innerHTML = `
      <span class="explorer-icon">${icon}</span>
      <span class="explorer-name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</span>
      ${sizeHtml}
    `;

    li.addEventListener('click', (event) => explorerSelectEntry(event, entry, li, index));
    
    if (entry.isDir) {
      li.addEventListener('dblclick', () => {
        void explorerNavigate(`${state.explorerPath}${entry.name}/`);
      });
    }

    dom.explorerList.appendChild(li);
  });

  explorerUpdateStatus();
}

export async function explorerNavigate(path) {
  if (!state.selectedDeviceId) return;

  state.explorerPath = path.endsWith('/') ? path : `${path}/`;
  state.explorerSelectedItems = [];
  dom.explorerPathInput.value = state.explorerPath;
  explorerRenderBreadcrumb(state.explorerPath);
  dom.explorerList.innerHTML = '<li class="state-msg">Loading...</li>';
  dom.explorerStatus.textContent = 'Loading...';
  setBusy(true);

  const result = await window.adb.ls(state.selectedDeviceId, state.explorerPath);
  setBusy(false);

  if (!result.success) {
    dom.explorerList.innerHTML = `<li class="state-msg">Cannot read folder: ${escapeHtml(result.error)}</li>`;
    dom.explorerStatus.textContent = 'Error reading folder';
    return;
  }

  state.explorerEntries = result.data;
  explorerRenderEntries();
}

function explorerGetParentPath(path) {
  if (path === '/') return null;
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  const lastSlash = trimmed.lastIndexOf('/');
  return lastSlash === 0 ? '/' : trimmed.slice(0, lastSlash + 1);
}

async function explorerPush() {
  if (!state.selectedDeviceId) {
    appendLog('ERROR: No device selected.');
    return;
  }

  const picked = await window.dialogs.pickFile();
  if (!picked.success || !picked.data) return;

  appendLog(`Pushing ${picked.data} -> ${state.selectedDeviceId}:${state.explorerPath}...`);
  dom.explorerStatus.innerHTML = '<span class="explorer-transfer-status"><span class="explorer-transfer-spinner"></span>Starting upload...</span>';
  setBusy(true);

  const startTime = Date.now();
  const unsub = window.adb.onTransferProgress((progress) => {
    renderTransferProgress('Uploading', progress, startTime);
  });

  try {
    const result = await window.adb.push(state.selectedDeviceId, picked.data, state.explorerPath);
    if (result.success) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      appendLog(`Push result: ${result.data} (took ${elapsed}s)`);
      await explorerNavigate(state.explorerPath);
    } else {
      appendLog(`Push FAILED: ${result.error}`);
      explorerUpdateStatus();
    }
  } finally {
    unsub();
    setBusy(false);
  }
}

async function explorerPushFolder() {
  if (!state.selectedDeviceId) {
    appendLog('ERROR: No device selected.');
    return;
  }

  const picked = await window.dialogs.pickSourceDirectory();
  if (!picked.success || !picked.data) return;

  appendLog(`Pushing folder ${picked.data} -> ${state.selectedDeviceId}:${state.explorerPath}...`);
  dom.explorerStatus.innerHTML = '<span class="explorer-transfer-status"><span class="explorer-transfer-spinner"></span>Starting folder upload...</span>';
  setBusy(true);

  const startTime = Date.now();
  const unsub = window.adb.onTransferProgress((progress) => {
    renderTransferProgress('Uploading folder', progress, startTime);
  });

  try {
    const result = await window.adb.push(state.selectedDeviceId, picked.data, state.explorerPath);
    if (result.success) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      appendLog(`Push folder result: ${result.data} (took ${elapsed}s)`);
      await explorerNavigate(state.explorerPath);
    } else {
      appendLog(`Push folder FAILED: ${result.error}`);
      explorerUpdateStatus();
    }
  } finally {
    unsub();
    setBusy(false);
  }
}

async function explorerCreateFolder() {
  if (!state.selectedDeviceId) {
    appendLog('ERROR: No device selected.');
    return;
  }

  const name = await showPromptDialog({
    title: 'New Folder',
    message: `Creating folder in: ${state.explorerPath}`,
    placeholder: 'Folder name',
    confirmText: 'Create'
  });

  if (!name) return;

  if (name.includes('/') || name.includes('\0')) {
    appendLog('ERROR: Folder name cannot contain / or null characters.');
    return;
  }

  const remotePath = `${state.explorerPath}${name}`;
  appendLog(`Creating folder ${state.selectedDeviceId}:${remotePath}...`);
  setBusy(true);

  const result = await window.adb.mkdir(state.selectedDeviceId, remotePath);
  setBusy(false);

  if (result.success) {
    appendLog(`Folder created: ${remotePath}`);
    await explorerNavigate(state.explorerPath);
  } else {
    appendLog(`Create folder FAILED: ${result.error}`);
    explorerUpdateStatus();
  }
}

async function explorerDeleteSelected() {
  if (!state.selectedDeviceId) {
    appendLog('ERROR: No device selected.');
    return;
  }
  if (state.explorerSelectedItems.length === 0) {
    appendLog('ERROR: Select files or folders first.');
    return;
  }

  const count = state.explorerSelectedItems.length;
  const label = count === 1 ? `"${state.explorerSelectedItems[0].name}"` : `${count} items`;

  const confirmed = await showConfirmDialog({
    title: `Delete`,
    message: `Permanently delete ${label} from the device?\n\nThis cannot be undone.`,
    confirmText: 'Delete',
    confirmStyle: 'danger'
  });

  if (!confirmed) return;

  setBusy(true);
  
  let successCount = 0;
  let failCount = 0;

  for (const entry of state.explorerSelectedItems) {
    const remotePath = `${state.explorerPath}${entry.name}`;
    appendLog(`Deleting ${state.selectedDeviceId}:${remotePath}...`);
    const result = await window.adb.rm(state.selectedDeviceId, remotePath);
    if (result.success) {
      successCount++;
    } else {
      appendLog(`Delete FAILED for ${entry.name}: ${result.error}`);
      failCount++;
    }
  }

  setBusy(false);
  appendLog(`Deleted ${successCount} items${failCount > 0 ? ` (${failCount} failed)` : ''}.`);
  await explorerNavigate(state.explorerPath);
}

async function explorerPull() {
  if (!state.selectedDeviceId) {
    appendLog('ERROR: No device selected.');
    return;
  }
  if (state.explorerSelectedItems.length === 0) {
    appendLog('ERROR: Select files or folders first.');
    return;
  }

  const picked = await window.dialogs.pickDirectory();
  if (!picked.success || !picked.data) return;

  const destDir = picked.data;
  setBusy(true);
  
  const totalItems = state.explorerSelectedItems.length;
  let successCount = 0;
  let failCount = 0;
  const overallStartTime = Date.now();

  for (let i = 0; i < totalItems; i++) {
    const entry = state.explorerSelectedItems[i];
    const remotePath = `${state.explorerPath}${entry.name}`;
    
    appendLog(`Pulling (${i + 1}/${totalItems}) ${state.selectedDeviceId}:${remotePath} -> ${destDir}...`);
    dom.explorerStatus.innerHTML = `<span class="explorer-transfer-status"><span class="explorer-transfer-spinner"></span>Starting download (${i + 1}/${totalItems}): ${entry.name}...</span>`;
    
    const startTime = Date.now();
    const unsub = window.adb.onTransferProgress((progress) => {
      const prefix = totalItems > 1 ? `[${i + 1}/${totalItems}] ` : '';
      renderTransferProgress(`${prefix}Downloading ${entry.name}`, progress, startTime);
    });

    try {
      const result = await window.adb.pull(state.selectedDeviceId, remotePath, destDir);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (result.success) {
        appendLog(`Pull result: ${entry.name} (took ${elapsed}s)`);
        successCount++;
      } else {
        appendLog(`Pull FAILED for ${entry.name}: ${result.error}`);
        failCount++;
      }
    } finally {
      unsub();
    }
  }

  setBusy(false);
  explorerUpdateStatus();
  
  const totalElapsed = ((Date.now() - overallStartTime) / 1000).toFixed(1);
  if (totalItems > 1) {
      appendLog(`Pull completed: ${successCount} successful, ${failCount} failed. Total time: ${totalElapsed}s.`);
  }
}

export function handleDeviceSelectedForExplorer() {
  state.explorerPath = '/sdcard/';
  state.explorerSelectedItems = [];
  state.explorerEntries = [];

  if (dom.tabExplorer.classList.contains('active')) {
    void explorerNavigate('/sdcard/');
  } else {
    clearExplorer();
  }
}

export function initExplorer() {
  // Populate icons
  dom.explorerUpBtn.innerHTML = getIcon('up');
  dom.explorerRefreshBtn.innerHTML = getIcon('refresh');
  dom.explorerNewFolderBtn.innerHTML = `${getIcon('plus')} <span>New Folder</span>`;
  dom.explorerPushBtn.innerHTML = `${getIcon('upload')} <span>Push File</span>`;
  dom.explorerPushFolderBtn.innerHTML = `${getIcon('folder')} <span>Push Folder</span>`;
  dom.explorerPullBtn.innerHTML = `${getIcon('download')} <span>Pull</span>`;
  dom.explorerDeleteBtn.innerHTML = `${getIcon('trash')} <span>Delete</span>`;

  dom.explorerUpBtn.addEventListener('click', () => {
    const parent = explorerGetParentPath(state.explorerPath);
    if (parent) {
      void explorerNavigate(parent);
    }
  });

  dom.explorerGoBtn.addEventListener('click', () => {
    const path = dom.explorerPathInput.value.trim();
    if (path.startsWith('/')) {
      void explorerNavigate(path);
    }
  });

  dom.explorerPathInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const path = dom.explorerPathInput.value.trim();
    if (path.startsWith('/')) {
      void explorerNavigate(path);
    }
  });

  dom.explorerRefreshBtn.addEventListener('click', () => {
    void explorerNavigate(state.explorerPath);
  });
  dom.explorerNewFolderBtn.addEventListener('click', () => {
    void explorerCreateFolder();
  });
  dom.explorerPushBtn.addEventListener('click', () => {
    void explorerPush();
  });
  dom.explorerPushFolderBtn.addEventListener('click', () => {
    void explorerPushFolder();
  });
  dom.explorerPullBtn.addEventListener('click', () => {
    void explorerPull();
  });
  dom.explorerDeleteBtn.addEventListener('click', () => {
    void explorerDeleteSelected();
  });
}
