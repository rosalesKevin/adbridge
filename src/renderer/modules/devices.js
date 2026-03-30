import { dom } from './dom.js';
import { state } from './state.js';
import { appendLog } from './logger.js';
import { setBusy } from './ui-state.js';
import { showConfirmDialog } from './confirm-dialog.js';

const mirrorRunningByDevice = new Map();
let knownDeviceIds = new Set();
let lastDevices = [];
let storedCallbacks = {};

function hasScrcpyApi() {
  return typeof window.scrcpy !== 'undefined';
}

function isWirelessDevice(deviceId) {
  return /^\d+\.\d+\.\d+\.\d+:\d+$/.test(deviceId);
}

// ── Mirror button ─────────────────────────────────────────────────────────────

function setMirrorButtonState(running) {
  dom.mirrorBtn.textContent = running ? '■  Stop' : 'Mirror';
  dom.mirrorBtn.classList.toggle('btn-danger', running);
  dom.mirrorBtn.classList.toggle('btn-secondary', !running);
}

function updateMirrorButton() {
  if (!hasScrcpyApi()) return;
  const deviceId = state.selectedDeviceId;
  dom.mirrorBtn.disabled = !deviceId;
  setMirrorButtonState(deviceId ? mirrorRunningByDevice.get(deviceId) === true : false);
}

async function toggleMirror() {
  const deviceId = state.selectedDeviceId;
  if (!deviceId) return;

  const running = mirrorRunningByDevice.get(deviceId) === true;
  dom.mirrorBtn.disabled = true;

  const result = running
    ? await window.scrcpy.stop(deviceId)
    : await window.scrcpy.start(deviceId);

  if (result.success) {
    const nextRunning = !running;
    mirrorRunningByDevice.set(deviceId, nextRunning);
    setMirrorButtonState(nextRunning);
    appendLog(`${nextRunning ? 'Started' : 'Stopped'} mirroring for ${deviceId}.`);
  } else {
    appendLog(`Mirror ${running ? 'stop' : 'start'} FAILED: ${result.error}`);
  }

  dom.mirrorBtn.disabled = false;
}

// ── Wireless button ───────────────────────────────────────────────────────────

function updateWirelessButton() {
  const deviceId = state.selectedDeviceId;

  if (!deviceId) {
    dom.wirelessBtn.disabled = true;
    dom.wirelessBtn.textContent = '⊛ Wireless';
    dom.wirelessBtn.title = 'Set up wireless ADB';
    dom.wirelessBtn.classList.remove('btn-warning');
    dom.wirelessBtn.classList.add('btn-secondary');
    return;
  }

  if (isWirelessDevice(deviceId)) {
    dom.wirelessBtn.disabled = false;
    dom.wirelessBtn.textContent = '⊘ Disconnect';
    dom.wirelessBtn.title = 'Disconnect wireless ADB';
    dom.wirelessBtn.classList.remove('btn-secondary');
    dom.wirelessBtn.classList.add('btn-warning');
  } else {
    dom.wirelessBtn.disabled = false;
    dom.wirelessBtn.textContent = '⊛ Wireless';
    dom.wirelessBtn.title = 'Set up wireless ADB';
    dom.wirelessBtn.classList.remove('btn-warning');
    dom.wirelessBtn.classList.add('btn-secondary');
  }
}

async function handleWirelessBtn() {
  const deviceId = state.selectedDeviceId;
  if (!deviceId) return;

  if (isWirelessDevice(deviceId)) {
    // Disconnect wireless device
    const confirmed = await showConfirmDialog({
      title: 'Disconnect wireless ADB',
      message: `Disconnect wireless ADB?\n\nDevice: ${deviceId}\n\nThis will terminate the wireless debug session.`,
      confirmText: 'Disconnect',
      confirmStyle: 'danger'
    });
    if (!confirmed) return;

    dom.wirelessBtn.disabled = true;
    appendLog(`Disconnecting ${deviceId}...`);
    const result = await window.adb.wirelessDisconnect(deviceId);
    dom.wirelessBtn.disabled = false;

    if (result.success) {
      appendLog(`Disconnected: ${result.data}`);
      void refreshDevices({ ...storedCallbacks, silent: true });
    } else {
      appendLog(`Disconnect failed: ${result.error}`);
    }
  } else {
    // Set up wireless for USB device
    dom.wirelessBtn.disabled = true;
    appendLog(`Getting IP address for ${deviceId}...`);
    const ipResult = await window.adb.getDeviceIp(deviceId);

    if (!ipResult.success || !ipResult.data) {
      dom.wirelessBtn.disabled = false;
      appendLog('Could not determine device IP. Ensure the device is connected to Wi-Fi.');
      return;
    }

    const ip = ipResult.data;
    const networkResult = await window.adb.checkSameNetwork(ip);
    dom.wirelessBtn.disabled = false;

    if (!networkResult.success || !networkResult.data.sameNetwork) {
      appendLog(`Cannot enable wireless ADB: device (${ip}) is not on the same network as this PC. Connect both to the same Wi-Fi network and try again.`);
      return;
    }

    const confirmed = await showConfirmDialog({
      title: 'Set up wireless ADB',
      message: `Enable wireless ADB debugging?\n\nDevice: ${deviceId}\nIP Address: ${ip}\nPort: 5555\n\nThe device will switch to TCP/IP mode and connect wirelessly on ${ip}:5555.\n\nKeep the USB cable connected until the wireless link is confirmed.`,
      confirmText: 'Enable',
      confirmStyle: 'primary'
    });
    if (!confirmed) return;

    dom.wirelessBtn.disabled = true;
    appendLog(`Switching ${deviceId} to TCP/IP mode on port 5555...`);
    const result = await window.adb.wirelessSetup(deviceId, ip);
    dom.wirelessBtn.disabled = false;

    if (result.success) {
      appendLog(`Wireless ADB ready — ${result.data.connect}`);
      // Give the connection a moment to register, then refresh
      setTimeout(() => void refreshDevices({ ...storedCallbacks, silent: true }), 800);
    } else {
      appendLog(`Wireless setup failed: ${result.error}`);
    }
  }
}

// ── Mirror statuses ───────────────────────────────────────────────────────────

async function refreshMirrorStatuses(devices) {
  if (!hasScrcpyApi()) return;

  const activeIds = new Set(devices.map((d) => d.id));
  for (const cachedId of mirrorRunningByDevice.keys()) {
    if (!activeIds.has(cachedId)) mirrorRunningByDevice.delete(cachedId);
  }

  await Promise.all(
    devices
      .filter((d) => d.status === 'device')
      .map(async (d) => {
        const result = await window.scrcpy.status(d.id);
        mirrorRunningByDevice.set(d.id, Boolean(result.success && result.data && result.data.running));
      })
  );
}

// ── Selection ─────────────────────────────────────────────────────────────────

function applySelection(device, onDeviceSelected) {
  if (device.status !== 'device') {
    appendLog(`Device ${device.id} is ${device.status} — cannot manage apps.`);
    return;
  }

  if (state.selectedDeviceId === device.id) {
    dom.deviceSelect.value = device.id;
    return;
  }

  state.selectedDeviceId = device.id;
  dom.deviceSelect.value = device.id;
  updateMirrorButton();
  updateWirelessButton();
  appendLog(`Selected device: ${device.id}`);

  if (typeof onDeviceSelected === 'function') {
    onDeviceSelected(device);
  }
}

// ── ADB status ────────────────────────────────────────────────────────────────

export async function checkAdbStatus() {
  const result = await window.adb.check();
  if (result.success && result.data) {
    dom.statusDot.className = 'status-dot online';
    dom.statusLabel.textContent = 'ADB Connected';
  } else {
    dom.statusDot.className = 'status-dot offline';
    dom.statusLabel.textContent = 'ADB Not Found';
    appendLog('WARNING: ADB not found in PATH. Install Android platform-tools and add to PATH.');
  }
}

// ── Main refresh ──────────────────────────────────────────────────────────────

export async function refreshDevices({ silent = false, onNoDevices, onDeviceSelected, devices } = {}) {
  let currentDevices = devices;

  if (!currentDevices) {
    if (!silent) appendLog('Refreshing device list...');
    if (!silent) setBusy(true);
    const result = await window.adb.devices();
    if (!silent) setBusy(false);

    if (!result.success) {
      appendLog(`ERROR: ${result.error}`);
      return;
    }

    currentDevices = result.data;
  }

  // Detect devices that just appeared
  const currentIds = new Set(currentDevices.map((d) => d.id));
  const newlyConnected = currentDevices.filter((d) => d.status === 'device' && !knownDeviceIds.has(d.id));
  knownDeviceIds = currentIds;
  lastDevices = currentDevices;

  await refreshMirrorStatuses(currentDevices);

  // Repopulate dropdown
  dom.deviceSelect.innerHTML = '';

  if (currentDevices.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No devices';
    dom.deviceSelect.appendChild(opt);

    if (state.selectedDeviceId !== null) {
      state.selectedDeviceId = null;
      updateMirrorButton();
      updateWirelessButton();
      if (typeof onNoDevices === 'function') onNoDevices();
    }

    if (!silent) appendLog('No devices found. Ensure USB debugging is enabled.');
    return;
  }

  for (const device of currentDevices) {
    const opt = document.createElement('option');
    opt.value = device.id;
    const connType = isWirelessDevice(device.id) ? '[Wi-Fi]' : '[USB]';
    opt.textContent = device.status === 'device'
      ? `${connType} ${device.id}`
      : `${connType} ${device.id} (${device.status})`;
    opt.disabled = device.status !== 'device';
    dom.deviceSelect.appendChild(opt);
  }

  // If selected device disconnected, clear state
  if (state.selectedDeviceId) {
    const stillConnected = currentDevices.some((d) => d.id === state.selectedDeviceId);
    if (!stillConnected) {
      state.selectedDeviceId = null;
      appendLog('[Auto] Selected device disconnected.');
      updateMirrorButton();
      updateWirelessButton();
      if (typeof onNoDevices === 'function') onNoDevices();
    } else {
      dom.deviceSelect.value = state.selectedDeviceId;
      updateMirrorButton();
      updateWirelessButton();
      // Manual refresh: reload packages to ensure list and button state are in sync
      if (!silent && typeof onDeviceSelected === 'function') {
        const current = currentDevices.find((d) => d.id === state.selectedDeviceId);
        if (current) onDeviceSelected(current);
      }
    }
  }

  // Auto-select: prefer newly connected, else first ready device if nothing selected
  if (newlyConnected.length > 0) {
    applySelection(newlyConnected[0], onDeviceSelected);
  } else if (!state.selectedDeviceId) {
    const first = currentDevices.find((d) => d.status === 'device');
    if (first) applySelection(first, onDeviceSelected);
  }

  if (!silent) appendLog(`Found ${currentDevices.length} device(s).`);
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initDevices(callbacks) {
  storedCallbacks = callbacks;

  if (!hasScrcpyApi()) {
    dom.mirrorBtn.style.display = 'none';
  }

  if (typeof window.adb.onDevicesChanged === 'function') {
    let debounceTimer = null;
    window.adb.onDevicesChanged(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void refreshDevices({ ...storedCallbacks, silent: true });
      }, 300);
    });
  }

  // Polling fallback: adb track-devices is unreliable for USB on Windows.
  // Poll every 3 s to catch connect/disconnect events the tracker misses.
  setInterval(() => {
    void refreshDevices({ ...storedCallbacks, silent: true });
  }, 3000);

  if (hasScrcpyApi() && typeof window.scrcpy.onStatusChange === 'function') {
    window.scrcpy.onStatusChange((payload) => {
      mirrorRunningByDevice.set(payload.deviceId, Boolean(payload.running));

      if (payload.deviceId === state.selectedDeviceId) {
        setMirrorButtonState(payload.running === true);
      }

      if (payload.reason) {
        appendLog(`Mirror status for ${payload.deviceId}: ${payload.reason}`);
      }
    });
  }

  dom.deviceSelect.addEventListener('change', () => {
    const deviceId = dom.deviceSelect.value;
    if (!deviceId) return;
    const device = lastDevices.find((d) => d.id === deviceId);
    if (device) applySelection(device, callbacks.onDeviceSelected);
  });

  dom.refreshDevicesBtn.addEventListener('click', () => {
    void refreshDevices({ ...callbacks, silent: false });
  });

  dom.wirelessBtn.addEventListener('click', () => void handleWirelessBtn());

  if (hasScrcpyApi()) {
    dom.mirrorBtn.addEventListener('click', () => void toggleMirror());
  }
}
