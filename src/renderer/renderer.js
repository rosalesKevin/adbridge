/**
 * ADBridge — Renderer Process
 *
 * Runs in the renderer (browser) context — no Node.js access.
 * Communicates with main process via window.adb.* and window.dialogs.*
 * exposed by the preload script through contextBridge.
 */

// ─────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────

const statusDot        = document.getElementById('statusDot');
const statusLabel      = document.getElementById('statusLabel');
const exitBtn          = document.getElementById('exitBtn');
const deviceList       = document.getElementById('deviceList');
const refreshDevicesBtn= document.getElementById('refreshDevicesBtn');
const autoRefreshBtn   = document.getElementById('autoRefreshBtn');
const autoRefreshInterval = document.getElementById('autoRefreshInterval');
const searchField      = document.getElementById('searchField');
const appList          = document.getElementById('appList');
const showSystemApps   = document.getElementById('showSystemApps');
const appCount         = document.getElementById('appCount');
const appActionsBar    = document.getElementById('appActionsBar');
const selectedAppNameEl= document.getElementById('selectedAppName');
const clearDataBtn     = document.getElementById('clearDataBtn');
const uninstallBtn     = document.getElementById('uninstallBtn');
const browseBtn        = document.getElementById('browseBtn');
const apkPathLabel     = document.getElementById('apkPathLabel');
const installBtn       = document.getElementById('installBtn');
const pushBrowseBtn    = document.getElementById('pushBrowseBtn');
const pushFileLabel    = document.getElementById('pushFileLabel');
const pushDestPath     = document.getElementById('pushDestPath');
const browseFolderBtn  = document.getElementById('browseFolderBtn');
const pushBtn          = document.getElementById('pushBtn');
const folderModal      = document.getElementById('folderModal');
const modalCurrentPath = document.getElementById('modalCurrentPath');
const folderList       = document.getElementById('folderList');
const modalCloseBtn    = document.getElementById('modalCloseBtn');
const modalCancelBtn   = document.getElementById('modalCancelBtn');
const modalSelectBtn   = document.getElementById('modalSelectBtn');
const logOutput        = document.getElementById('logOutput');
const clearLogBtn      = document.getElementById('clearLogBtn');

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────

let selectedDeviceId   = null;
let selectedPackage    = null;
let selectedApkPath    = null;
let selectedPushFile   = null;
let allPackages        = [];
let busy               = false;
let autoRefreshTimerId = null;
let modalPath          = '/sdcard/';

// ─────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────

function appendLog(message) {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    logOutput.textContent += `[${time}] ${message}\n`;
    logOutput.scrollTop = logOutput.scrollHeight;
}

// ─────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────

function setBusy(isBusy) {
    busy = isBusy;
    refreshDevicesBtn.disabled = isBusy;
    browseBtn.disabled         = isBusy;
    installBtn.disabled        = isBusy || !selectedApkPath;
    pushBrowseBtn.disabled     = isBusy;
    pushBtn.disabled           = isBusy || !selectedPushFile;
    uninstallBtn.disabled      = isBusy;
    clearDataBtn.disabled      = isBusy;
}

function updateAppCount(filtered, total) {
    appCount.textContent = `${filtered} / ${total} apps`;
}

// ─────────────────────────────────────────────
// ADB STATUS
// ─────────────────────────────────────────────

async function checkAdbStatus() {
    const result = await window.adb.check();
    if (result.success && result.data) {
        statusDot.className = 'status-dot online';
        statusLabel.textContent = 'ADB Connected';
    } else {
        statusDot.className = 'status-dot offline';
        statusLabel.textContent = 'ADB Not Found';
        appendLog('WARNING: ADB not found in PATH. Install Android platform-tools and add to PATH.');
    }
}

// ─────────────────────────────────────────────
// DEVICE LIST
// ─────────────────────────────────────────────

async function refreshDevices(silent = false) {
    if (!silent) appendLog('Refreshing device list...');
    setBusy(true);

    const result = await window.adb.devices();
    setBusy(false);

    if (!result.success) {
        appendLog('ERROR: ' + result.error);
        return;
    }

    const devices  = result.data;
    const prevCount = deviceList.querySelectorAll('li:not(.empty-state)').length;
    deviceList.innerHTML = '';

    if (devices.length === 0) {
        deviceList.innerHTML = '<li class="empty-state">No devices found</li>';
        selectedDeviceId = null;
        clearAppList();
        if (!silent) appendLog('No devices found. Ensure USB debugging is enabled.');
        return;
    }

    for (const device of devices) {
        const li = document.createElement('li');
        li.dataset.deviceId = device.id;
        if (device.id === selectedDeviceId) li.classList.add('selected');
        li.innerHTML = `
            <span class="device-id">${escapeHtml(device.id)}</span>
            <span class="device-status status-${device.status}">${escapeHtml(device.status)}</span>
        `;
        li.addEventListener('click', () => selectDevice(device));
        deviceList.appendChild(li);
    }

    if (!silent) {
        appendLog(`Found ${devices.length} device(s).`);
    } else if (devices.length !== prevCount) {
        appendLog(`[Auto] Device list changed: ${devices.length} device(s) connected.`);
    }
}

function selectDevice(device) {
    if (device.status !== 'device') {
        appendLog(`Device ${device.id} is ${device.status} — cannot manage apps.`);
        return;
    }
    selectedDeviceId = device.id;
    appendLog(`Selected device: ${device.id}`);
    document.querySelectorAll('#deviceList li').forEach(li => {
        li.classList.toggle('selected', li.dataset.deviceId === device.id);
    });
    loadPackages();
}

// ─────────────────────────────────────────────
// PACKAGE LIST
// ─────────────────────────────────────────────

async function loadPackages() {
    if (!selectedDeviceId) return;

    const userOnly = !showSystemApps.checked;
    appendLog(`Loading packages from ${selectedDeviceId}${userOnly ? ' (user apps only)' : ' (all apps)'}...`);
    setBusy(true);

    const result = await window.adb.packages(selectedDeviceId, userOnly);
    setBusy(false);

    if (!result.success) {
        appendLog('ERROR: ' + result.error);
        return;
    }

    selectedPackage = null;
    updateAppActions();
    allPackages = result.data;
    appendLog(`Loaded ${allPackages.length} packages.`);
    renderAppList();
}

function renderAppList() {
    const filter   = searchField.value.toLowerCase().trim();
    const filtered = allPackages.filter(pkg =>
        filter === '' || pkg.toLowerCase().includes(filter)
    );

    appList.innerHTML = '';

    if (filtered.length === 0) {
        const msg = allPackages.length === 0 ? 'No apps found' : 'No matching apps';
        appList.innerHTML = `<li class="empty-state">${msg}</li>`;
        updateAppCount(0, allPackages.length);
        return;
    }

    for (const pkg of filtered) {
        const li = document.createElement('li');
        li.dataset.package = pkg;
        if (pkg === selectedPackage) li.classList.add('selected');
        li.innerHTML = `<span class="package-name" title="${escapeHtml(pkg)}">${escapeHtml(pkg)}</span>`;
        li.addEventListener('click', () => selectPackage(pkg));
        appList.appendChild(li);
    }

    updateAppCount(filtered.length, allPackages.length);
}

function clearAppList() {
    selectedPackage = null;
    allPackages     = [];
    appList.innerHTML = '<li class="empty-state">Select a device to view apps</li>';
    updateAppCount(0, 0);
    updateAppActions();
}

// ─────────────────────────────────────────────
// APP SELECTION
// ─────────────────────────────────────────────

function selectPackage(pkg) {
    selectedPackage = selectedPackage === pkg ? null : pkg; // toggle
    renderAppList();
    updateAppActions();
}

function updateAppActions() {
    if (selectedPackage) {
        selectedAppNameEl.textContent = selectedPackage;
        appActionsBar.classList.remove('hidden');
    } else {
        appActionsBar.classList.add('hidden');
    }
}

// ─────────────────────────────────────────────
// APP ACTIONS
// ─────────────────────────────────────────────

async function uninstallApp() {
    if (!selectedDeviceId || !selectedPackage || busy) return;

    const confirm = await window.dialogs.confirm(
        'Confirm Uninstall',
        `Uninstall ${selectedPackage}?\n\nThis will remove the app and all its data. This cannot be undone.`
    );
    if (!confirm.success || !confirm.data) return;

    appendLog(`Uninstalling ${selectedPackage} from ${selectedDeviceId}...`);
    setBusy(true);

    const result = await window.adb.uninstall(selectedDeviceId, selectedPackage);
    setBusy(false);

    if (result.success) {
        appendLog(`Uninstall result: ${result.data}`);
        selectedPackage = null;
        updateAppActions();
        loadPackages();
    } else {
        appendLog(`Uninstall FAILED: ${result.error}`);
    }
}

async function clearAppData() {
    if (!selectedDeviceId || !selectedPackage || busy) return;

    appendLog(`Clearing data for ${selectedPackage} on ${selectedDeviceId}...`);
    setBusy(true);

    const result = await window.adb.clear(selectedDeviceId, selectedPackage);
    setBusy(false);

    if (result.success) {
        appendLog(`Clear data result: ${result.data}`);
    } else {
        appendLog(`Clear data FAILED: ${result.error}`);
    }
}

// ─────────────────────────────────────────────
// APK INSTALL
// ─────────────────────────────────────────────

async function browseApk() {
    const result = await window.dialogs.pickApk();
    if (!result.success || !result.data) return;

    selectedApkPath = result.data;
    apkPathLabel.textContent = selectedApkPath.split(/[\\/]/).pop();
    apkPathLabel.title = selectedApkPath;
    installBtn.disabled = false;
    appendLog(`Selected APK: ${selectedApkPath}`);
}

async function installApk() {
    if (!selectedDeviceId) { appendLog('ERROR: No device selected.'); return; }
    if (!selectedApkPath)  { appendLog('ERROR: No APK file selected.'); return; }

    appendLog(`Installing ${selectedApkPath} → ${selectedDeviceId}...`);
    setBusy(true);

    const result = await window.adb.install(selectedDeviceId, selectedApkPath);
    setBusy(false);

    if (result.success) {
        appendLog(`Install result: ${result.data}`);
    } else {
        appendLog(`Install FAILED: ${result.error}`);
    }
}

// ─────────────────────────────────────────────
// PUSH FILE
// ─────────────────────────────────────────────

async function browsePushFile() {
    const result = await window.dialogs.pickFile();
    if (!result.success || !result.data) return;

    selectedPushFile = result.data;
    pushFileLabel.textContent = selectedPushFile.split(/[\\/]/).pop();
    pushFileLabel.title = selectedPushFile;
    pushBtn.disabled = false;
    appendLog(`Selected file to push: ${selectedPushFile}`);
}

async function pushFileToDevice() {
    if (!selectedDeviceId) { appendLog('ERROR: No device selected.'); return; }
    if (!selectedPushFile) { appendLog('ERROR: No file selected.'); return; }

    const dest = pushDestPath.value.trim();
    if (!dest) { appendLog('ERROR: No destination path set.'); return; }

    appendLog(`Pushing ${selectedPushFile} → ${selectedDeviceId}:${dest}...`);
    setBusy(true);

    const result = await window.adb.push(selectedDeviceId, selectedPushFile, dest);
    setBusy(false);

    if (result.success) {
        appendLog(`Push result: ${result.data}`);
    } else {
        appendLog(`Push FAILED: ${result.error}`);
    }
}

// ─────────────────────────────────────────────
// FOLDER BROWSER MODAL
// ─────────────────────────────────────────────

function openFolderBrowser() {
    if (!selectedDeviceId) {
        appendLog('ERROR: Select a device first.');
        return;
    }
    // Start from the current dest input value if it looks valid, else /sdcard/
    const current = pushDestPath.value.trim();
    const startPath = current.startsWith('/') ? current : '/sdcard/';
    folderModal.classList.remove('hidden');
    navigateTo(startPath);
}

async function navigateTo(path) {
    // Normalise: ensure trailing slash
    modalPath = path.endsWith('/') ? path : path + '/';
    modalCurrentPath.textContent = modalPath;
    folderList.innerHTML = '<li class="state-msg">Loading...</li>';

    const result = await window.adb.ls(selectedDeviceId, modalPath);

    folderList.innerHTML = '';

    // "Go up" row — show unless already at root
    const parent = getParentPath(modalPath);
    if (parent !== null) {
        const li = document.createElement('li');
        li.className = 'go-up';
        li.innerHTML = '<span>↑</span><span>..</span>';
        li.addEventListener('click', () => navigateTo(parent));
        folderList.appendChild(li);
    }

    if (!result.success) {
        const li = document.createElement('li');
        li.className = 'state-msg';
        li.textContent = 'Cannot read folder';
        folderList.appendChild(li);
        return;
    }

    if (result.data.length === 0) {
        const li = document.createElement('li');
        li.className = 'state-msg';
        li.textContent = 'No subfolders';
        folderList.appendChild(li);
        return;
    }

    for (const dir of result.data) {
        const li = document.createElement('li');
        li.innerHTML = `<span>📁</span><span>${escapeHtml(dir)}</span>`;
        li.addEventListener('click', () => navigateTo(modalPath + dir));
        folderList.appendChild(li);
    }
}

function getParentPath(path) {
    if (path === '/') return null;
    const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
    const lastSlash = trimmed.lastIndexOf('/');
    return lastSlash === 0 ? '/' : trimmed.slice(0, lastSlash + 1);
}

function closeFolderBrowser() {
    folderModal.classList.add('hidden');
    folderList.innerHTML = '';
}

function selectFolder() {
    pushDestPath.value = modalPath;
    closeFolderBrowser();
}

// ─────────────────────────────────────────────
// AUTO REFRESH
// ─────────────────────────────────────────────

function startAutoRefresh() {
    stopAutoRefresh();
    const seconds = parseInt(autoRefreshInterval.value, 10);
    autoRefreshTimerId = setInterval(() => {
        if (!busy) refreshDevices(true);
    }, seconds * 1000);
    autoRefreshBtn.textContent = '⏹  Auto Refresh: ON';
    autoRefreshBtn.classList.add('active');
    appendLog(`Auto-refresh enabled every ${seconds}s.`);
}

function stopAutoRefresh() {
    if (autoRefreshTimerId !== null) {
        clearInterval(autoRefreshTimerId);
        autoRefreshTimerId = null;
    }
    autoRefreshBtn.textContent = '↺  Auto Refresh';
    autoRefreshBtn.classList.remove('active');
}

function toggleAutoRefresh() {
    if (autoRefreshTimerId !== null) {
        stopAutoRefresh();
        appendLog('Auto-refresh disabled.');
    } else {
        startAutoRefresh();
    }
}

// ─────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ─────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────

exitBtn.addEventListener('click', () => window.close());
refreshDevicesBtn.addEventListener('click', () => refreshDevices());
autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
autoRefreshInterval.addEventListener('change', () => {
    if (autoRefreshTimerId !== null) startAutoRefresh();
});
searchField.addEventListener('input', renderAppList);
showSystemApps.addEventListener('change', () => {
    if (selectedDeviceId) loadPackages();
});
uninstallBtn.addEventListener('click', uninstallApp);
clearDataBtn.addEventListener('click', clearAppData);
browseBtn.addEventListener('click', browseApk);
installBtn.addEventListener('click', installApk);
pushBrowseBtn.addEventListener('click', browsePushFile);
pushBtn.addEventListener('click', pushFileToDevice);
browseFolderBtn.addEventListener('click', openFolderBrowser);
modalCloseBtn.addEventListener('click', closeFolderBrowser);
modalCancelBtn.addEventListener('click', closeFolderBrowser);
modalSelectBtn.addEventListener('click', selectFolder);
// Close when clicking the backdrop
folderModal.addEventListener('click', (e) => {
    if (e.target === folderModal) closeFolderBrowser();
});
clearLogBtn.addEventListener('click', () => { logOutput.textContent = ''; });

// ─────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────

(async function init() {
    appendLog('ADBridge starting...');
    await checkAdbStatus();
    await refreshDevices();
})();
