import { dom } from './dom.js';
import { state } from './state.js';
import { appendLog } from './logger.js';
import { escapeHtml, formatSize } from './utils.js';
import { setBusy } from './ui-state.js';

export function clearExplorer() {
  state.explorerPath = '/sdcard/';
  state.explorerEntries = [];
  state.explorerSelected = null;
  dom.explorerList.innerHTML = '<li class="empty-state">Select a device to browse files</li>';
  dom.explorerBreadcrumb.innerHTML = '';
  dom.explorerPathInput.value = '/sdcard/';
  dom.explorerStatus.textContent = '-';
  dom.explorerPullBtn.disabled = true;
  dom.explorerPushBtn.disabled = true;
  dom.explorerPushFolderBtn.disabled = true;
}

function explorerUpdateStatus() {
  const total = state.explorerEntries.length;
  if (state.explorerSelected) {
    const sizeStr = state.explorerSelected.size !== null ? `  �  ${formatSize(state.explorerSelected.size)}` : '';
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
      sep.textContent = '>'; 
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

    li.innerHTML = `
      <span class="explorer-icon">${entry.isDir ? '[D]' : '[F]'}</span>
      <span class="explorer-name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</span>
      ${sizeHtml}
    `;

    if (entry.isDir) {
      li.addEventListener('click', () => explorerSelectEntry(entry, li));
      li.addEventListener('dblclick', () => {
        void explorerNavigate(`${state.explorerPath}${entry.name}/`);
      });
    } else {
      li.addEventListener('click', () => explorerSelectEntry(entry, li));
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
  dom.explorerPushBtn.addEventListener('click', () => {
    void explorerPush();
  });
  dom.explorerPushFolderBtn.addEventListener('click', () => {
    void explorerPushFolder();
  });
  dom.explorerPullBtn.addEventListener('click', () => {
    void explorerPull();
  });
}
