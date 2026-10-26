import { dom } from './dom.js';
import { state } from './state.js';
import { appendLog } from './logger.js';
import { setBusy } from './ui-state.js';
import { showConfirmDialog } from './confirm-dialog.js';
import { getSettings } from './settings.js';
import { deviceOptionLabel, isWirelessDevice } from './device-label.mjs';

const mirrorRunningByDevice = new Map();
let lastDevices = [];
let callbacks = {};
// Friendly names by device id (null = device has none); fetched once per device.
const deviceNames = new Map();
const nameRequests = new Set();

// ── Mirror button ─────────────────────────────────────────────────────────────

function setMirrorButtonState(running) {
  dom.mirrorBtn.textContent = running ? '■  Stop' : 'Mirror';
  dom.mirrorBtn.classList.toggle('btn-danger', running);
  dom.mirrorBtn.classList.toggle('btn-secondary', !running);
}

function updateMirrorButton() {
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
    : await window.scrcpy.start(deviceId, getSettings().mirror);

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
  const wireless = Boolean(deviceId) && isWirelessDevice(deviceId);
  dom.wirelessBtn.disabled = !deviceId;
  dom.wirelessBtn.textContent = wireless ? '⊘ Disconnect' : '⊛ Wireless';
  dom.wirelessBtn.title = wireless ? 'Disconnect wireless ADB' : 'Set up wireless ADB';
  dom.wirelessBtn.classList.toggle('btn-warning', wireless);
  dom.wirelessBtn.classList.toggle('btn-secondary', !wireless);
}

function updateDeviceButtons() {
  updateMirrorButton();
  updateWirelessButton();
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
      void refreshDevices({ silent: true });
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
      setTimeout(() => void refreshDevices({ silent: true }), 800);
    } else {
      appendLog(`Wireless setup failed: ${result.error}`);
    }
  }
}

// ── Mirror statuses ───────────────────────────────────────────────────────────

async function refreshMirrorStatuses(devices) {
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

// ── Device names ──────────────────────────────────────────────────────────────

function relabelDeviceOptions() {
  for (const opt of dom.deviceSelect.options) {
    const device = lastDevices.find((d) => d.id === opt.value);
    if (device) opt.textContent = deviceOptionLabel(device, deviceNames, lastDevices);
  }
}

async function fetchMissingDeviceNames(devices) {
  const missing = devices.filter((d) => d.status === 'device' && !deviceNames.has(d.id) && !nameRequests.has(d.id));
  if (missing.length === 0) return;

  await Promise.all(missing.map(async (d) => {
    nameRequests.add(d.id);
    const result = await window.adb.deviceName(d.id);
    nameRequests.delete(d.id);
    if (result.success) deviceNames.set(d.id, result.data); // failures retry on the next refresh
  }));
  relabelDeviceOptions();
}

// ── Selection ─────────────────────────────────────────────────────────────────

function applySelection(device) {
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
  updateDeviceButtons();
  appendLog(`Selected device: ${device.id}`);
  callbacks.onDeviceSelected(device);
}

function clearSelection() {
  state.selectedDeviceId = null;
  updateDeviceButtons();
  callbacks.onNoDevices();
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

export async function refreshDevices({ silent = false, devices } = {}) {
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

  // Detect devices that just appeared or disappeared
  const knownIds = new Set(lastDevices.map((d) => d.id));
  const currentIds = new Set(currentDevices.map((d) => d.id));
  const newlyConnected = currentDevices.filter((d) => d.status === 'device' && !knownIds.has(d.id));
  const devicesChanged = currentIds.size !== knownIds.size || [...currentIds].some((id) => !knownIds.has(id));
  lastDevices = currentDevices;

  if (devicesChanged) await refreshMirrorStatuses(currentDevices);

  // Repopulate dropdown
  dom.deviceSelect.innerHTML = '';

  if (currentDevices.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No devices';
    dom.deviceSelect.appendChild(opt);

    if (state.selectedDeviceId !== null) clearSelection();

    if (!silent) appendLog('No devices found. Ensure USB debugging is enabled.');
    return;
  }

  for (const device of currentDevices) {
    const opt = document.createElement('option');
    opt.value = device.id;
    opt.textContent = deviceOptionLabel(device, deviceNames, currentDevices);
    opt.title = device.id;
    opt.disabled = device.status !== 'device';
    dom.deviceSelect.appendChild(opt);
  }

  void fetchMissingDeviceNames(currentDevices);

  // If selected device disconnected, clear state
  if (state.selectedDeviceId) {
    const current = currentDevices.find((d) => d.id === state.selectedDeviceId);
    if (!current) {
      appendLog('[Auto] Selected device disconnected.');
      clearSelection();
    } else {
      dom.deviceSelect.value = current.id;
      updateDeviceButtons();
      // Manual refresh: reload packages to ensure list and button state are in sync
      if (!silent) callbacks.onDeviceSelected(current);
    }
  }

  // Auto-select: prefer newly connected, else first ready device if nothing selected
  if (newlyConnected.length > 0) {
    applySelection(newlyConnected[0]);
  } else if (!state.selectedDeviceId) {
    const first = currentDevices.find((d) => d.status === 'device');
    if (first) applySelection(first);
  }

  if (!silent) appendLog(`Found ${currentDevices.length} device(s).`);
}

// ── Init ──────────────────────────────────────────────────────────────────────

/** callbacks: { onDeviceSelected(device), onNoDevices() } */
export function initDevices(deviceCallbacks) {
  callbacks = deviceCallbacks;

  let debounceTimer = null;
  window.adb.onDevicesChanged((devices) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void refreshDevices({ silent: true, devices }), 300);
  });

  // Polling fallback: adb track-devices is unreliable for USB on Windows.
  // Poll every 5 s to catch connect/disconnect events the tracker misses.
  setInterval(() => void refreshDevices({ silent: true }), 5000);

  window.scrcpy.onStatusChange((payload) => {
    mirrorRunningByDevice.set(payload.deviceId, Boolean(payload.running));

    if (payload.deviceId === state.selectedDeviceId) {
      setMirrorButtonState(payload.running === true);
    }

    if (payload.reason) {
      appendLog(`Mirror status for ${payload.deviceId}: ${payload.reason}`);
    }
  });

  dom.deviceSelect.addEventListener('change', () => {
    const device = lastDevices.find((d) => d.id === dom.deviceSelect.value);
    if (device) applySelection(device);
  });

  dom.refreshDevicesBtn.addEventListener('click', () => void refreshDevices());
  dom.wirelessBtn.addEventListener('click', () => void handleWirelessBtn());
  dom.mirrorBtn.addEventListener('click', () => void toggleMirror());
}
