import { dom } from './dom.js';
import { state } from './state.js';
import { appendLog } from './logger.js';
import { escapeHtml, formatSize } from './utils.js';
import { setBusy } from './ui-state.js';
import { showConfirmDialog, showPromptDialog } from './confirm-dialog.js';
import { getIcon } from './icons.js';

export function clearExplorer() {
  state.explorerPath = '/sdcard/';
  state.explorerEntries = [];
  state.explorerSelected = null;
  dom.explorerList.innerHTML = '<li class="empty-state">Select a device to browse files</li>';
  dom.explorerBreadcrumb.innerHTML = '';
  dom.explorerPathInput.value = '/sdcard/';
  dom.explorerStatus.textContent = '-';
  dom.explorerPullBtn.disabled = true;
  dom.explorerRenameBtn.disabled = true;
  dom.explorerDeleteBtn.disabled = true;
}

function explorerUpdateStatus() {
  const total = state.explorerEntries.length;
  if (state.explorerSelected) {
    const sizeStr = state.explorerSelected.size !== null ? `  •  ${formatSize(state.explorerSelected.size)}` : '';
    dom.explorerStatus.textContent = `Selected: ${state.explorerSelected.name}${sizeStr}`;
  } else {
    dom.explorerStatus.textContent = total === 0 ? 'Empty folder' : `${total} item${total !== 1 ? 's' : ''}`;
  }
}

function explorerSelectEntry(entry, li) {
  const alreadySelected = state.explorerSelected && state.explorerSelected.name === entry.name;
  dom.explorerList.querySelectorAll('li.selected').forEach((el) => el.classList.remove('selected'));

  if (alreadySelected) {
    state.explorerSelected = null;
  } else {
    li.classList.add('selected');
    state.explorerSelected = entry;
  }

  dom.explorerPullBtn.disabled = state.busy || !state.explorerSelected;
  dom.explorerRenameBtn.disabled = state.busy || !state.explorerSelected;
  dom.explorerDeleteBtn.disabled = state.busy || !state.explorerSelected;
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
  state.explorerSelected = null;
  dom.explorerPullBtn.disabled = true;
  dom.explorerRenameBtn.disabled = true;
  dom.explorerDeleteBtn.disabled = true;

  if (state.explorerEntries.length === 0) {
    dom.explorerList.innerHTML = '<li class="state-msg">Empty folder</li>';
    dom.explorerStatus.textContent = 'Empty folder';
    return;
  }

  for (const entry of state.explorerEntries) {
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

    li.addEventListener('click', () => explorerSelectEntry(entry, li));
    
    if (entry.isDir) {
      li.addEventListener('dblclick', () => {
        void explorerNavigate(`${state.explorerPath}${entry.name}/`);
      });
    }

    dom.explorerList.appendChild(li);
  }

  explorerUpdateStatus();
}

export async function explorerNavigate(path) {
  if (!state.selectedDeviceId) return;

  state.explorerPath = path.endsWith('/') ? path : `${path}/`;
  state.explorerSelected = null;
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
  dom.explorerStatus.innerHTML = '<span class="explorer-transfer-status"><span class="explorer-transfer-spinner"></span>Uploading...</span>';
  setBusy(true);

  const result = await window.adb.push(state.selectedDeviceId, picked.data, state.explorerPath);
  setBusy(false);

  if (result.success) {
    appendLog(`Push result: ${result.data}`);
    await explorerNavigate(state.explorerPath);
  } else {
    appendLog(`Push FAILED: ${result.error}`);
    explorerUpdateStatus();
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
  dom.explorerStatus.innerHTML = '<span class="explorer-transfer-status"><span class="explorer-transfer-spinner"></span>Uploading folder...</span>';
  setBusy(true);

  const result = await window.adb.push(state.selectedDeviceId, picked.data, state.explorerPath);
  setBusy(false);

  if (result.success) {
    appendLog(`Push folder result: ${result.data}`);
    await explorerNavigate(state.explorerPath);
  } else {
    appendLog(`Push folder FAILED: ${result.error}`);
    explorerUpdateStatus();
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
  if (!state.explorerSelected) {
    appendLog('ERROR: Select a file or folder first.');
    return;
  }

  const entry = state.explorerSelected;
  const remotePath = `${state.explorerPath}${entry.name}`;
  const kind = entry.isDir ? 'folder' : 'file';

  const confirmed = await showConfirmDialog({
    title: `Delete ${kind}`,
    message: `Permanently delete "${entry.name}" from the device?\n\nThis cannot be undone.`,
    confirmText: 'Delete',
    confirmStyle: 'danger'
  });

  if (!confirmed) return;

  appendLog(`Deleting ${state.selectedDeviceId}:${remotePath}...`);
  setBusy(true);

  const result = await window.adb.rm(state.selectedDeviceId, remotePath);
  setBusy(false);

  if (result.success) {
    appendLog(`Deleted: ${remotePath}`);
    await explorerNavigate(state.explorerPath);
  } else {
    appendLog(`Delete FAILED: ${result.error}`);
    explorerUpdateStatus();
  }
}

async function explorerRenameSelected() {
  if (!state.selectedDeviceId) {
    appendLog('ERROR: No device selected.');
    return;
  }
  if (!state.explorerSelected) {
    appendLog('ERROR: Select a file or folder first.');
    return;
  }

  const entry = state.explorerSelected;
  const newName = await showPromptDialog({
    title: 'Rename',
    message: `Renaming: ${entry.name}`,
    placeholder: entry.name,
    confirmText: 'Rename'
  });

  if (!newName || newName === entry.name) return;

  if (newName.includes('/') || newName.includes('\0')) {
    appendLog('ERROR: Name cannot contain / or null characters.');
    return;
  }

  const remotePath = `${state.explorerPath}${entry.name}`;
  appendLog(`Renaming ${state.selectedDeviceId}:${remotePath} -> ${newName}...`);
  setBusy(true);

  const result = await window.adb.rename(state.selectedDeviceId, remotePath, newName);
  setBusy(false);

  if (result.success) {
    appendLog(`Renamed to: ${newName}`);
    await explorerNavigate(state.explorerPath);
  } else {
    appendLog(`Rename FAILED: ${result.error}`);
    explorerUpdateStatus();
  }
}

async function explorerPull() {
  if (!state.selectedDeviceId) {
    appendLog('ERROR: No device selected.');
    return;
  }
  if (!state.explorerSelected) {
    appendLog('ERROR: Select a file or folder first.');
    return;
  }

  const remotePath = `${state.explorerPath}${state.explorerSelected.name}`;
  const picked = await window.dialogs.pickDirectory();
  if (!picked.success || !picked.data) return;

  appendLog(`Pulling ${state.selectedDeviceId}:${remotePath} -> ${picked.data}...`);
  dom.explorerStatus.innerHTML = '<span class="explorer-transfer-status"><span class="explorer-transfer-spinner"></span>Downloading...</span>';
  setBusy(true);

  const result = await window.adb.pull(state.selectedDeviceId, remotePath, picked.data);
  setBusy(false);
  explorerUpdateStatus();

  appendLog(result.success ? `Pull result: ${result.data}` : `Pull FAILED: ${result.error}`);
}

export function handleDeviceSelectedForExplorer() {
  state.explorerPath = '/sdcard/';
  state.explorerSelected = null;
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
  dom.explorerRenameBtn.innerHTML = `<span>✎ Rename</span>`;
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
  dom.explorerRenameBtn.addEventListener('click', () => {
    void explorerRenameSelected();
  });
  dom.explorerDeleteBtn.addEventListener('click', () => {
    void explorerDeleteSelected();
  });
}
