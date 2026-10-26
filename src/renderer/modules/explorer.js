import { dom } from './dom.js';
import { state } from './state.js';
import { appendLog } from './logger.js';
import { escapeHtml, formatSize, showToast } from './utils.js';
import { setBusy, updateExplorerActionButtons } from './ui-state.js';
import { showConfirmDialog, showPromptDialog, showInfoDialog } from './confirm-dialog.js';
import { getIcon } from './icons.js';
import { renameSingleExplorerSelection } from './explorer-rename.mjs';
import { getSettings, setShowHiddenFiles } from './settings.js';
import { arrangeEntries } from './explorer-arrange.mjs';

// View: how the current listing is sorted/filtered; visibleEntries is exactly what the list
// shows, in order (selection indexes refer to it, not to state.explorerEntries).
let sortKey = 'name';
let sortDir = 1;
let visibleEntries = [];
// Copy/Cut clipboard for on-device paste: { mode: 'copy' | 'cut', folder, items }. Cleared on device change.
let clipboard = null;

const localName = (localPath) => localPath.split(/[\\/]/).pop();

function formatElapsed(ms) {
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// Bumped by every navigation and clear; an `ls` answer for an older value is stale and ignored.
let navigationSeq = 0;

export function clearExplorer() {
  navigationSeq++;
  clipboard = null;
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
  updateExplorerActionButtons();
  dom.explorerPasteBtn.classList.toggle('hidden', !clipboard);
  if (clipboard) {
    dom.explorerPasteBtn.textContent = `📋 Paste ${clipboard.items.length} (${clipboard.mode === 'cut' ? 'move' : 'copy'})`;
  }

  const selectedCount = state.explorerSelectedItems.length;
  // The bar always keeps its space (empty state = hint + disabled buttons), so selecting
  // never pushes the list down under the cursor and breaks a double-click.
  dom.explorerSelectionBar.classList.toggle('is-empty', selectedCount === 0);
  dom.explorerSelectionCount.textContent = selectedCount > 0
    ? `${selectedCount} selected`
    : 'Click to select · double-click a folder to open';
}

function setPathEditing(editing) {
  dom.explorerBreadcrumb.classList.toggle('hidden', editing);
  dom.explorerEditPathBtn.classList.toggle('hidden', editing);
  dom.explorerPathInput.classList.toggle('hidden', !editing);
  if (editing) {
    dom.explorerPathInput.value = state.explorerPath;
    dom.explorerPathInput.focus();
    dom.explorerPathInput.select();
  }
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
  } else if (total === 0) {
    dom.explorerStatus.textContent = 'Empty folder';
  } else {
    const shown = visibleEntries.length;
    dom.explorerStatus.textContent = shown === total ? `${total} item${total !== 1 ? 's' : ''}` : `${shown} of ${total} items shown`;
  }
}

function showTransferProgress(percent) {
  dom.explorerProgressBar.classList.remove('hidden');
  dom.explorerProgressFill.style.width = `${percent}%`;
  dom.explorerCancelBtn.classList.remove('hidden');
  dom.explorerCancelBtn.disabled = false;
}

function hideTransferProgress() {
  dom.explorerProgressBar.classList.add('hidden');
  dom.explorerProgressFill.style.width = '0%';
  dom.explorerCancelBtn.classList.add('hidden');
  dom.explorerCancelBtn.disabled = true;
}

let transferDoneTimer = null;

function setTransferStatus(text) {
  clearTimeout(transferDoneTimer);
  dom.explorerStatus.innerHTML = `<span class="explorer-transfer-status"><span class="explorer-transfer-spinner"></span>${escapeHtml(text)}</span>`;
}

/** Briefly shows "✓ <text>" in the status bar, then the normal item count. */
function showTransferDone(text) {
  dom.explorerStatus.innerHTML = `<span class="transfer-done">✓ ${escapeHtml(text)}</span>`;
  clearTimeout(transferDoneTimer);
  transferDoneTimer = setTimeout(explorerUpdateStatus, 1800);
}

function renderTransferProgress(label, progress, startTime) {
  const percent = progress.percent || 0;
  setTransferStatus(`${label}: ${percent}% • ${formatElapsed(Date.now() - startTime)}`);
  showTransferProgress(percent);
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
      const itemToSelect = visibleEntries[i];
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

/** Navigation the user starts (breadcrumb, double-click, typed path) waits while an operation runs. */
function userNavigate(path) {
  if (state.busy) return;
  void explorerNavigate(path);
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
      item.addEventListener('click', () => userNavigate(segment.path));
    }

    dom.explorerBreadcrumb.appendChild(item);
  });
}

function updateSortIndicators() {
  for (const col of dom.explorerColumns.querySelectorAll('[data-sort]')) {
    col.classList.toggle('sorted', col.dataset.sort === sortKey);
    col.classList.toggle('desc', col.dataset.sort === sortKey && sortDir === -1);
  }
}

function explorerRenderEntries() {
  dom.explorerList.innerHTML = '';
  state.explorerSelectedItems = [];
  lastSelectedIndex = -1;
  const filter = dom.explorerFilter.value;
  visibleEntries = arrangeEntries(state.explorerEntries, { sortKey, sortDir, filter, showHidden: getSettings().showHiddenFiles });
  explorerUpdateActionButtons();
  updateSortIndicators();

  if (visibleEntries.length === 0) {
    const msg = state.explorerEntries.length === 0 ? 'Empty folder'
      : filter.trim() ? `Nothing here matches "${filter.trim()}"`
      : 'Only hidden files here. Tick "Hidden files" to see them.';
    dom.explorerList.innerHTML = `<li class="state-msg">${escapeHtml(msg)}</li>`;
    explorerUpdateStatus();
    return;
  }

  visibleEntries.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = `explorer-entry ${entry.isDir ? 'explorer-dir' : 'explorer-file'}`;

    const icon = entry.isDir ? getIcon('folder') : getIcon('file');

    li.innerHTML = `
      <span class="explorer-icon">${icon}</span>
      <span class="explorer-name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</span>
      <span class="explorer-size">${entry.isDir ? '' : formatSize(entry.size)}</span>
      <span class="explorer-modified">${escapeHtml(entry.modified ?? '')}</span>
    `;

    li.addEventListener('click', (event) => explorerSelectEntry(event, entry, li, index));
    li.addEventListener('contextmenu', (event) => openContextMenu(event, { entry, li, index }));
    
    if (entry.isDir) {
      li.addEventListener('dblclick', () => userNavigate(`${state.explorerPath}${entry.name}/`));
    }

    dom.explorerList.appendChild(li);
  });

  explorerUpdateStatus();
}

export async function explorerNavigate(path) {
  if (!state.selectedDeviceId) return;

  const seq = ++navigationSeq;
  const nextPath = path.endsWith('/') ? path : `${path}/`;
  if (nextPath !== state.explorerPath) dom.explorerFilter.value = '';
  state.explorerPath = nextPath;
  state.explorerSelectedItems = [];
  dom.explorerPathInput.value = state.explorerPath;
  explorerRenderBreadcrumb(state.explorerPath);
  dom.explorerList.innerHTML = '<li class="state-msg">Loading...</li>';
  dom.explorerStatus.textContent = 'Loading...';
  setBusy(true);

  const result = await window.adb.ls(state.selectedDeviceId, state.explorerPath);
  setBusy(false);
  if (seq !== navigationSeq) return; // the user (or a device switch) moved on; this list is for another folder

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

async function explorerPush(folder) {
  if (!state.selectedDeviceId) {
    appendLog('ERROR: No device selected.');
    return;
  }

  const picked = await (folder ? window.dialogs.pickSourceDirectory() : window.dialogs.pickFile());
  if (!picked.success || !picked.data) return;
  await pushPaths([picked.data], folder ? ' folder' : '');
}

/** Asks before an operation replaces items that already exist. */
function confirmReplace(names, where) {
  const list = names.slice(0, 5).map((name) => `• ${name}`).join('\n') + (names.length > 5 ? `\n…and ${names.length - 5} more` : '');
  const what = names.length === 1 ? 'This item already exists' : `${names.length} items already exist`;
  return showConfirmDialog({
    title: 'Replace existing items?',
    message: `${what} ${where}:\n\n${list}\n\nReplace ${names.length === 1 ? 'it' : 'them'}?`,
    confirmText: 'Replace',
    confirmStyle: 'danger'
  });
}

/** Pushes local files/folders (picked or dropped) into the current device folder, one after another. */
async function pushPaths(localPaths, kind = '') {
  if (!state.selectedDeviceId || state.busy || localPaths.length === 0) return;

  const folder = state.explorerPath;
  const existing = localPaths.map(localName).filter((name) => state.explorerEntries.some((e) => e.name === name));
  if (existing.length > 0 && !(await confirmReplace(existing, `in ${folder}`))) return;

  showTransferProgress(0);
  setBusy(true);
  let pushed = 0;

  try {
    for (const [i, localPath] of localPaths.entries()) {
      const prefix = localPaths.length > 1 ? `[${i + 1}/${localPaths.length}] ` : '';
      appendLog(`Pushing${kind} ${localPath} -> ${state.selectedDeviceId}:${folder}...`);
      setTransferStatus(`${prefix}Starting${kind} upload...`);

      const startTime = Date.now();
      const unsub = window.adb.onTransferProgress((progress) => {
        renderTransferProgress(`${prefix}Uploading${kind}`, progress, startTime);
      });
      try {
        const result = await window.adb.push(state.selectedDeviceId, localPath, folder);
        if (result.success) {
          pushed++;
          appendLog(`Push${kind} result: ${result.data} (took ${formatElapsed(Date.now() - startTime)})`);
        } else if (result.error === 'Transfer cancelled') {
          appendLog('Upload cancelled.');
          break;
        } else {
          appendLog(`Push${kind} FAILED: ${result.error}`);
        }
      } finally {
        unsub();
      }
    }

    if (pushed > 0) await explorerNavigate(folder);
    if (pushed === localPaths.length) showTransferDone('Upload complete');
    else explorerUpdateStatus();
  } finally {
    hideTransferProgress();
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

  // Snapshot: the folder and selection must not change under a running delete.
  const folder = state.explorerPath;
  const items = [...state.explorerSelectedItems];
  const count = items.length;
  const label = count === 1 ? `"${items[0].name}"` : `${count} items`;

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

  for (const entry of items) {
    const remotePath = `${folder}${entry.name}`;
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
  await explorerNavigate(folder);
}

async function explorerRenameSelected() {
  await renameSingleExplorerSelection({
    selectedDeviceId: state.selectedDeviceId,
    explorerPath: state.explorerPath,
    selectedItems: state.explorerSelectedItems,
    promptForName: async (currentName) => showPromptDialog({
      title: 'Rename',
      message: `Rename "${currentName}" in ${state.explorerPath}`,
      placeholder: currentName,
      confirmText: 'Rename'
    }),
    renameEntry: (deviceId, remotePath, newName) => window.adb.rename(deviceId, remotePath, newName),
    refresh: explorerNavigate,
    log: appendLog,
    setBusy
  });
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

  // Snapshot: the folder and selection must not change under a running download.
  const folder = state.explorerPath;
  const items = [...state.explorerSelectedItems];
  const totalItems = items.length;

  let destDir = getSettings().downloadFolder;
  if (!destDir) {
    const picked = await window.dialogs.pickDirectory();
    if (!picked.success || !picked.data) return;
    destDir = picked.data;
  }
  const existing = await window.dialogs.existingNames(destDir, items.map((entry) => entry.name));
  if (existing.success && existing.data.length > 0 && !(await confirmReplace(existing.data, `in ${destDir}`))) return;
  setBusy(true);
  let successCount = 0;
  let failCount = 0;
  let wasCancelled = false;
  const overallStartTime = Date.now();

  for (let i = 0; i < totalItems; i++) {
    const entry = items[i];
    const remotePath = `${folder}${entry.name}`;

    appendLog(`Pulling (${i + 1}/${totalItems}) ${state.selectedDeviceId}:${remotePath} -> ${destDir}...`);
    setTransferStatus(`Starting download (${i + 1}/${totalItems}): ${entry.name}...`);
    showTransferProgress(0);

    const startTime = Date.now();
    const unsub = window.adb.onTransferProgress((progress) => {
      const prefix = totalItems > 1 ? `[${i + 1}/${totalItems}] ` : '';
      renderTransferProgress(`${prefix}Downloading ${entry.name}`, progress, startTime);
    });

    try {
      const result = await window.adb.pull(state.selectedDeviceId, remotePath, destDir, entry.size ?? 0);
      const elapsed = formatElapsed(Date.now() - startTime);
      if (result.success) {
        appendLog(`Pull result: ${entry.name} (took ${elapsed})`);
        successCount++;
      } else if (result.error === 'Transfer cancelled') {
        wasCancelled = true;
        appendLog('Download cancelled.');
        break;
      } else {
        appendLog(`Pull FAILED for ${entry.name}: ${result.error}`);
        failCount++;
      }
    } finally {
      unsub();
    }
  }

  setBusy(false);
  hideTransferProgress();
  explorerUpdateStatus();

  if (!wasCancelled && failCount === 0) showTransferDone('Download complete');

  if (!wasCancelled && totalItems > 1) {
    const totalElapsed = ((Date.now() - overallStartTime) / 1000).toFixed(1);
    appendLog(`Pull completed: ${successCount} successful, ${failCount} failed. Total time: ${totalElapsed}s.`);
  }
}

function setCancelVisible(visible) {
  dom.explorerCancelBtn.classList.toggle('hidden', !visible);
  dom.explorerCancelBtn.disabled = !visible;
}

function setClipboard(mode) {
  if (state.explorerSelectedItems.length === 0) return;
  clipboard = { mode, folder: state.explorerPath, items: [...state.explorerSelectedItems] };
  const count = clipboard.items.length;
  appendLog(`${mode === 'cut' ? 'Cut' : 'Copied'} ${count} item${count !== 1 ? 's' : ''} from ${clipboard.folder}. Open a folder and Paste.`);
  explorerUpdateActionButtons();
}

async function explorerPaste() {
  if (!clipboard || !state.selectedDeviceId || state.busy) return;

  const { mode, folder: from, items } = clipboard;
  const to = state.explorerPath;
  const verb = mode === 'cut' ? 'move' : 'copy';
  const doing = verb === 'move' ? 'Moving' : 'Copying';
  const failed = [];
  let done = 0;

  setBusy(true);
  setCancelVisible(true);
  try {
    for (const [i, item] of items.entries()) {
      setTransferStatus(`${doing} ${i + 1}/${items.length}: ${item.name}...`);
      appendLog(`${doing} ${from}${item.name} -> ${to}...`);
      const result = await window.adb[verb](state.selectedDeviceId, `${from}${item.name}`, to);
      if (result.success) {
        done++;
      } else if (result.error === 'Transfer cancelled') {
        appendLog(`${doing} cancelled.`);
        break;
      } else {
        failed.push(item);
        appendLog(`${verb === 'move' ? 'Move' : 'Copy'} FAILED for ${item.name}: ${result.error}`);
      }
    }
  } finally {
    setCancelVisible(false);
    setBusy(false);
  }

  // A cut item that moved no longer exists at its source; keep only the ones that didn't move.
  if (mode === 'cut') clipboard = failed.length > 0 ? { ...clipboard, items: failed } : null;
  appendLog(`${verb === 'move' ? 'Moved' : 'Copied'} ${done} of ${items.length} item${items.length !== 1 ? 's' : ''}.`);
  if (failed.length > 0) showToast(`${failed.length} item${failed.length !== 1 ? 's' : ''} couldn't be ${verb === 'move' ? 'moved' : 'copied'}. See the log.`, 'error');
  await explorerNavigate(to);
  if (done === items.length) showTransferDone(verb === 'move' ? 'Move complete' : 'Copy complete');
}

function singleSelection() {
  return state.explorerSelectedItems.length === 1 ? state.explorerSelectedItems[0] : null;
}

async function explorerOpenOnPc() {
  const entry = singleSelection();
  if (!entry || entry.isDir || !state.selectedDeviceId || state.busy) return;

  const remotePath = `${state.explorerPath}${entry.name}`;
  setBusy(true);
  setCancelVisible(true);
  setTransferStatus(`Opening ${entry.name} on this PC...`);
  const result = await window.adb.openOnPc(state.selectedDeviceId, remotePath);
  setCancelVisible(false);
  setBusy(false);
  explorerUpdateStatus();

  if (!result.success) {
    appendLog(`Open on PC FAILED for ${entry.name}: ${result.error}`);
    showToast(`Couldn't open ${entry.name}: ${result.error}`, 'error');
    return;
  }
  appendLog(`Opened ${entry.name} (copied to ${result.data.localPath})`);
  if (!result.data.opened) showToast(`${entry.name} could run code on this PC, so it was only shown in Explorer`, 'info');
}

async function explorerCopyPath() {
  const entry = singleSelection();
  if (!entry) return;
  const remotePath = `${state.explorerPath}${entry.name}${entry.isDir ? '/' : ''}`;
  try {
    await navigator.clipboard.writeText(remotePath);
    showToast('Path copied', 'success');
  } catch (error) {
    showToast(`Couldn't copy the path: ${error.message}`, 'error');
  }
}

async function explorerShowProperties() {
  const entry = singleSelection();
  if (!entry || !state.selectedDeviceId) return;

  const remotePath = `${state.explorerPath}${entry.name}`;
  const result = await window.adb.stat(state.selectedDeviceId, remotePath);
  if (!result.success) {
    showToast(`Couldn't read properties: ${result.error}`, 'error');
    return;
  }
  const info = result.data;
  const size = entry.isDir ? '—' : `${formatSize(info.size)} (${info.size.toLocaleString()} bytes)`;
  await showInfoDialog({
    title: entry.name,
    message: [
      `Path: ${remotePath}`,
      `Type: ${info.type}`,
      `Size: ${size}`,
      `Modified: ${info.modified}`,
      `Permissions: ${info.permissions}`,
      `Owner: ${info.owner} (group ${info.group})`
    ].join('\n')
  });
}

// ── Menus (quick locations, right-click) ──

function setPlacesMenuOpen(open) {
  dom.explorerPlacesMenu.classList.toggle('open', open);
  dom.explorerPlacesBtn.setAttribute('aria-expanded', String(open));
}

function closeContextMenu() {
  dom.explorerContextMenu.classList.remove('open');
}

/** Right-click on a row (target) or on empty list space (no target). */
function openContextMenu(event, target) {
  event.preventDefault();
  if (!state.selectedDeviceId) return;
  if (target && !state.explorerSelectedItems.some((e) => e.name === target.entry.name)) {
    explorerSelectEntry({}, target.entry, target.li, target.index); // right-clicking an unselected row selects just it
  }

  const count = target ? state.explorerSelectedItems.length : 0;
  const single = target ? singleSelection() : null;
  const visible = {
    open: Boolean(single && !single.isDir),
    pull: count > 0,
    copy: count > 0,
    cut: count > 0,
    paste: Boolean(clipboard),
    rename: Boolean(single),
    copyPath: Boolean(single),
    properties: Boolean(single),
    newFolder: !target,
    delete: count > 0
  };
  let shown = 0;
  for (const item of dom.explorerContextMenu.querySelectorAll('[data-action]')) {
    const action = item.dataset.action;
    item.classList.toggle('hidden', !visible[action]);
    item.disabled = state.busy && action !== 'copyPath';
    if (visible[action]) shown++;
  }
  if (shown === 0) return;

  const menu = dom.explorerContextMenu;
  menu.classList.add('open');
  const x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 4);
  const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 4);
  menu.style.left = `${Math.max(4, x)}px`;
  menu.style.top = `${Math.max(4, y)}px`;
}

const CONTEXT_ACTIONS = {
  open: () => explorerOpenOnPc(),
  pull: () => explorerPull(),
  copy: () => setClipboard('copy'),
  cut: () => setClipboard('cut'),
  paste: () => explorerPaste(),
  rename: () => explorerRenameSelected(),
  copyPath: () => explorerCopyPath(),
  properties: () => explorerShowProperties(),
  newFolder: () => explorerCreateFolder(),
  delete: () => explorerDeleteSelected()
};

// ── Drag & drop from Windows ──

function initDropToPush() {
  // A file dropped anywhere else must not navigate the window to it.
  document.addEventListener('dragover', (event) => event.preventDefault());
  document.addEventListener('drop', (event) => event.preventDefault());

  const list = dom.explorerList;
  const canDrop = (event) => event.dataTransfer?.types.includes('Files') && state.selectedDeviceId && !state.busy;
  list.addEventListener('dragover', (event) => {
    if (!canDrop(event)) return;
    event.dataTransfer.dropEffect = 'copy';
    list.classList.add('drop-target');
  });
  list.addEventListener('dragleave', (event) => {
    if (!list.contains(event.relatedTarget)) list.classList.remove('drop-target');
  });
  list.addEventListener('drop', (event) => {
    list.classList.remove('drop-target');
    if (!canDrop(event)) return;
    const paths = [...event.dataTransfer.files].map((file) => window.dialogs.pathForFile(file)).filter(Boolean);
    void pushPaths(paths);
  });
}

export function handleDeviceSelectedForExplorer() {
  state.explorerEntries = [];
  clipboard = null; // paths copied on another device mean nothing here

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

  dom.explorerEditPathBtn.addEventListener('click', () => setPathEditing(true));
  dom.explorerBreadcrumb.addEventListener('click', (event) => {
    if (event.target === dom.explorerBreadcrumb) setPathEditing(true);
  });
  dom.explorerPathInput.addEventListener('blur', () => setPathEditing(false));
  dom.explorerPathInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setPathEditing(false);
      return;
    }
    if (event.key !== 'Enter') return;
    const path = dom.explorerPathInput.value.trim();
    if (path.startsWith('/')) userNavigate(path);
    setPathEditing(false);
  });

  dom.explorerRefreshBtn.addEventListener('click', () => void explorerNavigate(state.explorerPath));
  dom.explorerNewFolderBtn.addEventListener('click', () => void explorerCreateFolder());
  dom.explorerPushBtn.addEventListener('click', () => void explorerPush(false));
  dom.explorerPushFolderBtn.addEventListener('click', () => void explorerPush(true));
  dom.explorerPullBtn.addEventListener('click', () => void explorerPull());
  dom.explorerRenameBtn.addEventListener('click', () => void explorerRenameSelected());
  dom.explorerDeleteBtn.addEventListener('click', () => void explorerDeleteSelected());

  dom.explorerCancelBtn.addEventListener('click', () => {
    dom.explorerCancelBtn.disabled = true;
    void window.adb.cancelTransfer();
  });

  // View: sorting, filter, hidden files
  dom.explorerColumns.addEventListener('click', (event) => {
    const key = event.target.closest('[data-sort]')?.dataset.sort;
    if (!key) return;
    sortDir = key === sortKey ? -sortDir : key === 'modified' ? -1 : 1; // dates start newest-first
    sortKey = key;
    explorerRenderEntries();
  });
  dom.explorerFilter.addEventListener('input', () => explorerRenderEntries());
  dom.explorerShowHidden.checked = getSettings().showHiddenFiles;
  dom.explorerShowHidden.addEventListener('change', () => {
    setShowHiddenFiles(dom.explorerShowHidden.checked);
    explorerRenderEntries();
  });

  // Copy / cut / paste on the device
  dom.explorerCopyBtn.addEventListener('click', () => setClipboard('copy'));
  dom.explorerCutBtn.addEventListener('click', () => setClipboard('cut'));
  dom.explorerPasteBtn.addEventListener('click', () => void explorerPaste());

  // Quick locations
  dom.explorerPlacesBtn.addEventListener('click', () => setPlacesMenuOpen(!dom.explorerPlacesMenu.classList.contains('open')));
  dom.explorerPlacesMenu.addEventListener('click', (event) => {
    const path = event.target.closest('[data-path]')?.dataset.path;
    if (!path) return;
    setPlacesMenuOpen(false);
    userNavigate(path);
  });

  // Right-click menu
  dom.explorerList.addEventListener('contextmenu', (event) => {
    if (!event.target.closest('li.explorer-entry')) openContextMenu(event, null); // empty space
  });
  dom.explorerContextMenu.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    closeContextMenu();
    void CONTEXT_ACTIONS[action]();
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#explorerContextMenu')) closeContextMenu();
    if (!event.target.closest('#explorerPlacesBtn, #explorerPlacesMenu')) setPlacesMenuOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeContextMenu();
    setPlacesMenuOpen(false);
  });
  dom.explorerList.addEventListener('scroll', closeContextMenu);
  window.addEventListener('blur', closeContextMenu);

  initDropToPush();
}
