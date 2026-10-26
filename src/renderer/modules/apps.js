import { dom } from './dom.js';
import { state } from './state.js';
import { appendLog, showLog } from './logger.js';
import { escapeHtml, showToast, prefersReducedMotion } from './utils.js';
import { setBusy, updateAppCount } from './ui-state.js';
import { showConfirmDialog, showPromptDialog } from './confirm-dialog.js';
import { getSettings, isAutoGrantPackage, setAutoGrantPackage, setLiveAppList } from './settings.js';
import { checkAutoGrant, forgetAutoGrant } from './auto-grant.js';
import { diffPackages } from './app-list-diff.mjs';

const LIVE_REFRESH_MS = 5000;
const JUST_ADDED_MS = 6000;

// Packages that appeared through a live refresh, highlighted for a few seconds.
const justAdded = new Map(); // pkg → time it appeared
// Which device/filter the current list was loaded for; live refresh only diffs against a matching list.
let loadedFor = null;
let liveRefreshing = false;

function listKey(deviceId) {
  return `${deviceId}|${dom.showSystemApps.checked ? 'all' : 'user'}`;
}

function selectPackage(pkg) {
  state.selectedPackage = state.selectedPackage === pkg ? null : pkg;
  renderAppList();
  updateAppActions();
}

function updateAppActions() {
  const hasSelection = Boolean(state.selectedPackage);
  dom.clearDataBtn.disabled = !hasSelection;
  dom.grantPermsBtn.disabled = !hasSelection;
  dom.uninstallBtn.disabled = !hasSelection;
  dom.autoGrantChk.checked = hasSelection && isAutoGrantPackage(state.selectedPackage);
}

function renderAppList() {
  const filter = dom.searchField.value.toLowerCase().trim();
  const filtered = state.allPackages.filter((pkg) => filter === '' || pkg.toLowerCase().includes(filter));
  const scrollTop = dom.appList.scrollTop;

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
    if (justAdded.has(pkg)) {
      li.classList.add('just-added');
      li.style.animationDelay = `-${Date.now() - justAdded.get(pkg)}ms`; // continue, don't restart, on re-render
    }
    li.innerHTML = `<span class="package-name" title="${escapeHtml(pkg)}">${escapeHtml(pkg)}</span>`;
    if (pkg === state.selectedPackage) {
      li.classList.add('selected');
      li.appendChild(dom.appRowActions);
    }
    li.addEventListener('click', () => selectPackage(pkg));
    dom.appList.appendChild(li);
  }

  dom.appList.scrollTop = scrollTop;
  updateAppCount(filtered.length, state.allPackages.length);
}

function updateLiveIndicator() {
  const enabled = getSettings().liveAppList;
  const live = enabled && Boolean(state.selectedDeviceId);
  dom.liveIndicator.classList.toggle('paused', !live);
  dom.liveIndicator.textContent = live ? 'Live' : enabled ? 'Paused' : 'Off';
  dom.liveIndicator.title = live ? 'The list updates itself every 5 seconds while it is on screen'
    : enabled ? 'Paused: no device connected'
    : 'Automatic refresh is off (Settings → App list)';
}

export function clearAppList() {
  state.selectedPackage = null;
  state.allPackages = [];
  loadedFor = null;
  dom.appList.innerHTML = '<li class="empty-state">Select a device to view apps</li>';
  updateAppCount(0, 0);
  updateAppActions();
  updateLiveIndicator();
}

export async function loadPackages() {
  if (!state.selectedDeviceId) return;

  // Clear selection immediately — before the async gap — so buttons
  // are disabled right away rather than staying enabled from a prior session.
  state.selectedPackage = null;
  updateAppActions();

  const deviceId = state.selectedDeviceId;
  const userOnly = !dom.showSystemApps.checked;
  appendLog(`Loading packages from ${deviceId}${userOnly ? ' (user apps only)' : ' (all apps)'}...`);
  setBusy(true);

  const result = await window.adb.packages(deviceId, userOnly);
  setBusy(false);

  if (!result.success) {
    appendLog(`ERROR: ${result.error}`);
    return;
  }

  state.allPackages = result.data;
  loadedFor = listKey(deviceId);
  appendLog(`Loaded ${state.allPackages.length} packages.`);
  renderAppList();
  updateLiveIndicator();
}

function announceChanges(added, removed) {
  for (const pkg of added) appendLog(`[Live] Installed: ${pkg}`);
  for (const pkg of removed) appendLog(`[Live] Removed: ${pkg}`);

  const parts = [];
  if (added.length) parts.push(added.length === 1 ? `${added[0]} installed` : `${added.length} apps installed`);
  if (removed.length) parts.push(removed.length === 1 ? `${removed[0]} removed` : `${removed.length} apps removed`);
  showToast(parts.join(' · '), 'info');
}

/** Quietly re-checks the package list and applies only what changed (installs/uninstalls made outside ADBridge). */
export async function refreshPackagesLive() {
  updateLiveIndicator();
  const deviceId = state.selectedDeviceId;
  if (!getSettings().liveAppList || !deviceId || state.busy || liveRefreshing || document.hidden) return;
  if (!dom.tabApps.classList.contains('active') || loadedFor !== listKey(deviceId)) return;

  liveRefreshing = true;
  try {
    const result = await window.adb.packages(deviceId, !dom.showSystemApps.checked);
    // Drop stale answers: the device, filter or list changed while we waited.
    if (!result.success || state.busy || loadedFor !== listKey(deviceId) || deviceId !== state.selectedDeviceId) return;

    const { added, removed } = diffPackages(state.allPackages, result.data);
    if (added.length === 0 && removed.length === 0) return;

    await animateRowsOut(removed);
    state.allPackages = result.data;
    if (removed.includes(state.selectedPackage)) {
      state.selectedPackage = null;
      updateAppActions();
    }
    for (const pkg of added) {
      justAdded.set(pkg, Date.now());
      setTimeout(() => {
        justAdded.delete(pkg);
        dom.appList.querySelector(`li[data-package="${CSS.escape(pkg)}"]`)?.classList.remove('just-added');
      }, JUST_ADDED_MS);
    }
    renderAppList();
    announceChanges(added, removed);
  } finally {
    liveRefreshing = false;
  }
}

/** Fades and collapses the rows of removed packages before the list re-renders without them. */
function animateRowsOut(packages) {
  if (prefersReducedMotion()) return Promise.resolve();
  const rows = packages
    .map((pkg) => dom.appList.querySelector(`li[data-package="${CSS.escape(pkg)}"]`))
    .filter(Boolean);
  const animations = rows.map((li) => li.animate(
    [{ opacity: 1, height: `${li.offsetHeight}px`, overflow: 'hidden' }, { opacity: 0, height: '0px', overflow: 'hidden' }],
    { duration: 220, easing: 'ease-in' }
  ).finished);
  // Windows pauses animations in covered/hidden windows; never let the list update wait on that.
  return Promise.race([Promise.all(animations), new Promise((resolve) => setTimeout(resolve, 400))]);
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
    await animateRowsOut([state.selectedPackage]);
    appendLog(`Uninstall result: ${result.data}`);
    showToast('App uninstalled', 'success');
    await loadPackages();
  } else {
    appendLog(`Uninstall FAILED: ${result.error}`);
    showToast(`Uninstall failed: ${result.error}`, 'error');
  }
}


async function clearAppData() {
  if (!state.selectedDeviceId || !state.selectedPackage || state.busy) return;

  appendLog(`Clearing data for ${state.selectedPackage} on ${state.selectedDeviceId}...`);
  setBusy(true);
  const result = await window.adb.clear(state.selectedDeviceId, state.selectedPackage);
  setBusy(false);

  if (result.success) {
    appendLog(`Clear data result: ${result.data}`);
    showToast('App data cleared', 'success');
  } else {
    appendLog(`Clear data FAILED: ${result.error}`);
    showToast(`Clear data failed: ${result.error}`, 'error');
  }
}

async function grantAllPermissions() {
  if (!state.selectedDeviceId || !state.selectedPackage || state.busy) return;

  appendLog(`Granting all permissions to ${state.selectedPackage} on ${state.selectedDeviceId}...`);
  setBusy(true);
  const result = await window.adb.grantPermissions(state.selectedDeviceId, state.selectedPackage);
  setBusy(false);

  if (!result.success) {
    appendLog(`Grant permissions FAILED: ${result.error}`);
    showToast(`Grant permissions failed: ${result.error}`, 'error');
    return;
  }

  const { granted, skipped } = result.data;
  for (const permission of granted) appendLog(`Granted: ${permission}`);
  if (skipped.length) appendLog(`Skipped (not runtime-grantable): ${skipped.join(', ')}`);

  if (granted.length) {
    showToast(`Granted ${granted.length} permissions (${skipped.length} skipped)`, 'success');
  } else {
    showToast('No runtime permissions to grant', 'info');
  }
}

function toggleAutoGrant() {
  const pkg = state.selectedPackage;
  if (!pkg) return;

  const enabled = dom.autoGrantChk.checked;
  setAutoGrantPackage(pkg, enabled);
  forgetAutoGrant(pkg);
  appendLog(`Auto-grant ${enabled ? 'on' : 'off'} for ${pkg}.`);
  showToast(`Auto-grant ${enabled ? 'on' : 'off'} for ${pkg}`, enabled ? 'success' : 'info');
  if (enabled) void checkAutoGrant();
}

/** Lets the user choose an APK; it stays loaded so Install and signing info reuse it. */
async function browseApk() {
  const result = await window.dialogs.pickApk();
  if (!result.success || !result.data) return false;

  state.selectedApkPath = result.data;
  dom.apkPathLabel.textContent = result.data.split(/[\\/]/).pop();
  dom.browseBtn.title = `${result.data}\nClick to choose a different APK`;
  dom.browseBtn.classList.add('has-file');
  appendLog(`Selected APK: ${result.data}`);
  return true;
}

async function installApk() {
  if (!state.selectedDeviceId) {
    appendLog('ERROR: No device selected.');
    showToast('Select a device first', 'error');
    return;
  }
  if (!state.selectedApkPath && !(await browseApk())) return;

  appendLog(`Installing ${state.selectedApkPath} -> ${state.selectedDeviceId}...`);
  setBusy(true);
  const result = await window.adb.install(state.selectedDeviceId, state.selectedApkPath, {
    grantPermissions: getSettings().grantOnInstall
  });
  setBusy(false);

  if (result.success) {
    appendLog(`Install result: ${result.data}`);
    showToast('APK installed', 'success');
    await loadPackages();
    void checkAutoGrant();
  } else {
    appendLog(`Install FAILED: ${result.error}`);
    showToast(`Install failed: ${result.error}`, 'error');
  }
}

function setApkMenuOpen(open) {
  dom.apkAdvancedPanel.classList.toggle('open', open);
  dom.apkAdvancedToggle.setAttribute('aria-expanded', String(open));
}

/** Prints a multi-line tool result into the log between a header and a rule. */
function logToolOutput(header, failLabel, result) {
  if (!result.success) {
    appendLog(`${failLabel} FAILED: ${result.error}`);
    return;
  }
  appendLog(header);
  for (const line of result.data.split('\n')) appendLog(line);
  appendLog('──────────────────────────────────────');
}

async function showApkSigningInfo() {
  setApkMenuOpen(false);
  if (!state.selectedApkPath && !(await browseApk())) return;

  showLog();
  appendLog(`Reading signing info for: ${state.selectedApkPath}`);
  setBusy(true);
  const result = await window.keystore.apkSigning(state.selectedApkPath);
  setBusy(false);
  logToolOutput('── APK Signing Info ──────────────────', 'APK Signing Info', result);
}

async function inspectKeystore() {
  setApkMenuOpen(false);
  const picked = await window.dialogs.pickKeystore();
  if (!picked.success || !picked.data) return;

  const password = await showPromptDialog({
    title: 'Keystore Password',
    message: `Keystore: ${picked.data.split(/[\\/]/).pop()}`,
    placeholder: 'Enter store password',
    inputType: 'password',
    confirmText: 'Inspect'
  });

  if (password === null) return;

  showLog();
  appendLog(`Inspecting keystore: ${picked.data}`);
  setBusy(true);
  const result = await window.keystore.inspect(picked.data, password);
  setBusy(false);
  logToolOutput('── Keystore Info ─────────────────────', 'Keystore Inspect', result);
}

export function initApps() {
  dom.searchField.addEventListener('input', renderAppList);
  dom.showSystemApps.addEventListener('change', () => void loadPackages());
  dom.appsRefreshBtn.addEventListener('click', () => void loadPackages());
  // Row actions live inside the selected row; keep their clicks from toggling the selection.
  dom.appRowActions.addEventListener('click', (event) => event.stopPropagation());
  dom.uninstallBtn.addEventListener('click', () => void uninstallApp());
  dom.clearDataBtn.addEventListener('click', () => void clearAppData());
  dom.grantPermsBtn.addEventListener('click', () => void grantAllPermissions());
  dom.autoGrantChk.addEventListener('change', toggleAutoGrant);
  dom.liveAppListChk.addEventListener('change', () => {
    setLiveAppList(dom.liveAppListChk.checked);
    void refreshPackagesLive(); // updates the indicator and catches up right away
  });
  dom.browseBtn.addEventListener('click', () => void browseApk());
  dom.installBtn.addEventListener('click', () => void installApk());
  dom.apkAdvancedToggle.addEventListener('click', () => setApkMenuOpen(!dom.apkAdvancedPanel.classList.contains('open')));
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.menu-anchor')) setApkMenuOpen(false);
  });
  dom.apkSigningInfoBtn.addEventListener('click', () => void showApkSigningInfo());
  dom.inspectKeystoreBtn.addEventListener('click', () => void inspectKeystore());

  updateLiveIndicator();
  setInterval(() => void refreshPackagesLive(), LIVE_REFRESH_MS);
}
