import { dom } from './dom.js';
import { state } from './state.js';
import { appendLog } from './logger.js';
import { escapeHtml } from './utils.js';
import { setBusy, updateAppCount } from './ui-state.js';
import { showConfirmDialog } from './confirm-dialog.js';

function selectPackage(pkg) {
  state.selectedPackage = state.selectedPackage === pkg ? null : pkg;
  renderAppList();
  updateAppActions();
}

function updateAppActions() {
  const hasSelection = Boolean(state.selectedPackage);
  dom.clearDataBtn.disabled = !hasSelection;
  dom.uninstallBtn.disabled = !hasSelection;
  dom.selectedAppNameEl.textContent = hasSelection ? state.selectedPackage : 'No app selected';
  dom.selectedAppNameEl.classList.toggle('has-selection', hasSelection);
  dom.deselectAppBtn.classList.toggle('hidden', !hasSelection);
}

export function renderAppList() {
  const filter = dom.searchField.value.toLowerCase().trim();
  const filtered = state.allPackages.filter((pkg) => filter === '' || pkg.toLowerCase().includes(filter));

  dom.appList.innerHTML = '';

  if (filtered.length === 0) {
    const msg = state.allPackages.length === 0 ? 'No apps found' : 'No matching apps';
    dom.appList.innerHTML = `<li class="empty-state">${msg}</li>`;
    updateAppCount(0, state.allPackages.length);
    return;
  }

  for (const pkg of filtered) {
    const li = document.createElement('li');
    li.dataset.package = pkg;
    if (pkg === state.selectedPackage) li.classList.add('selected');
    li.innerHTML = `<span class="package-name" title="${escapeHtml(pkg)}">${escapeHtml(pkg)}</span>`;
    li.addEventListener('click', () => selectPackage(pkg));
    dom.appList.appendChild(li);
  }

  updateAppCount(filtered.length, state.allPackages.length);
}

export function clearAppList() {
  state.selectedPackage = null;
  state.allPackages = [];
  dom.appList.innerHTML = '<li class="empty-state">Select a device to view apps</li>';
  updateAppCount(0, 0);
  updateAppActions();
}

export async function loadPackages() {
  if (!state.selectedDeviceId) return;

  // Clear selection immediately — before the async gap — so buttons
  // are disabled right away rather than staying enabled from a prior session.
  state.selectedPackage = null;
  updateAppActions();

  const userOnly = !dom.showSystemApps.checked;
  appendLog(`Loading packages from ${state.selectedDeviceId}${userOnly ? ' (user apps only)' : ' (all apps)'}...`);
  setBusy(true);

  const result = await window.adb.packages(state.selectedDeviceId, userOnly);
  setBusy(false);

  if (!result.success) {
    appendLog(`ERROR: ${result.error}`);
    return;
  }

  state.allPackages = result.data;
  appendLog(`Loaded ${state.allPackages.length} packages.`);
  renderAppList();
}

async function uninstallApp() {
  if (!state.selectedDeviceId || !state.selectedPackage || state.busy) return;

  const confirmed = await showConfirmDialog({
    title: 'Confirm uninstall',
    message: `Uninstall ${state.selectedPackage}?\n\nThis will remove the app and all its data. This cannot be undone.`,
    confirmText: 'Uninstall',
    confirmStyle: 'danger'
  });
  if (!confirmed) return;

  appendLog(`Uninstalling ${state.selectedPackage} from ${state.selectedDeviceId}...`);
  setBusy(true);
  const result = await window.adb.uninstall(state.selectedDeviceId, state.selectedPackage);
  setBusy(false);

  if (result.success) {
    appendLog(`Uninstall result: ${result.data}`);
    state.selectedPackage = null;
    updateAppActions();
    await loadPackages();
  } else {
    appendLog(`Uninstall FAILED: ${result.error}`);
  }
}

async function clearAppData() {
  if (!state.selectedDeviceId || !state.selectedPackage || state.busy) return;

  appendLog(`Clearing data for ${state.selectedPackage} on ${state.selectedDeviceId}...`);
  setBusy(true);
  const result = await window.adb.clear(state.selectedDeviceId, state.selectedPackage);
  setBusy(false);

  appendLog(result.success ? `Clear data result: ${result.data}` : `Clear data FAILED: ${result.error}`);
}

async function browseApk() {
  const result = await window.dialogs.pickApk();
  if (!result.success || !result.data) return;

  state.selectedApkPath = result.data;
  dom.apkPathLabel.textContent = result.data.split(/[\\/]/).pop();
  dom.apkPathLabel.title = result.data;
  dom.installBtn.disabled = false;
  appendLog(`Selected APK: ${result.data}`);
}

async function installApk() {
  if (!state.selectedDeviceId) {
    appendLog('ERROR: No device selected.');
    return;
  }
  if (!state.selectedApkPath) {
    appendLog('ERROR: No APK file selected.');
    return;
  }

  appendLog(`Installing ${state.selectedApkPath} -> ${state.selectedDeviceId}...`);
  setBusy(true);
  const result = await window.adb.install(state.selectedDeviceId, state.selectedApkPath);
  setBusy(false);

  if (result.success) {
    appendLog(`Install result: ${result.data}`);
    await loadPackages();
  } else {
    appendLog(`Install FAILED: ${result.error}`);
  }
}

export function initApps() {
  dom.searchField.addEventListener('input', renderAppList);
  dom.showSystemApps.addEventListener('change', () => {
    if (state.selectedDeviceId) {
      void loadPackages();
    }
  });
  dom.uninstallBtn.addEventListener('click', () => {
    void uninstallApp();
  });
  dom.clearDataBtn.addEventListener('click', () => {
    void clearAppData();
  });
  dom.deselectAppBtn.addEventListener('click', () => {
    if (state.selectedPackage) selectPackage(state.selectedPackage);
  });
  dom.browseBtn.addEventListener('click', () => {
    void browseApk();
  });
  dom.installBtn.addEventListener('click', () => {
    void installApk();
  });
}
