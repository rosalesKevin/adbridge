const os = require('node:os');
const { spawn } = require('node:child_process');
const { runAdb } = require('./runner');
const { getAdbExe } = require('./resolver');
const { validateDeviceId } = require('./validation');

const TRACKER_RESTART_DELAY_MS = 2000;

let trackerProcess = null;
let trackerRestartTimer = null;
let trackerBuffer = '';
let trackerStopping = false;
let trackerOnDevicesChanged = null;
let trackerOnStatus = null;

function parseDevicesOutput(stdout) {
  const lines = stdout.split('\n');
  const devices = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('List of devices')) continue;

    const parts = trimmed.split('\t');
    if (parts.length >= 2) {
      devices.push({
        id: parts[0].trim(),
        status: parts[1].trim()
      });
    }
  }

  return devices;
}

function emitTrackedDevices(snapshot) {
  if (typeof trackerOnDevicesChanged !== 'function') return;

  try {
    trackerOnDevicesChanged(parseDevicesOutput(snapshot));
  } catch {
    // Ignore callback errors to keep tracker alive.
  }
}

function consumeTrackerBuffer() {
  // adb track-devices uses length-prefixed packets: 4 hex chars (length) + device list body.
  // e.g. "0000" = no devices, "001e<serial>\tdevice\n" = one device.
  while (trackerBuffer.length >= 4) {
    const lenHex = trackerBuffer.slice(0, 4);
    const len = parseInt(lenHex, 16);

    if (isNaN(len)) {
      trackerBuffer = '';
      break;
    }

    if (trackerBuffer.length < 4 + len) break;

    const snapshot = trackerBuffer.slice(4, 4 + len);
    trackerBuffer = trackerBuffer.slice(4 + len);

    emitTrackedDevices(snapshot);
  }
}

function reportTrackerStatus(message) {
  if (typeof trackerOnStatus === 'function') {
    trackerOnStatus(message);
  }
}

function scheduleTrackerRestart() {
  if (trackerStopping || trackerRestartTimer !== null) return;

  trackerRestartTimer = setTimeout(() => {
    trackerRestartTimer = null;
    startDeviceTracking();
  }, TRACKER_RESTART_DELAY_MS);
}

async function checkAdb() {
  try {
    const { stdout } = await runAdb(['version'], 5000);
    return stdout.includes('Android Debug Bridge');
  } catch {
    return false;
  }
}

async function getDevices() {
  const { stdout } = await runAdb(['devices']);
  return parseDevicesOutput(stdout);
}

function startDeviceTracking({ onDevicesChanged, onStatus } = {}) {
  if (typeof onDevicesChanged === 'function') {
    trackerOnDevicesChanged = onDevicesChanged;
  }
  if (typeof onStatus === 'function') {
    trackerOnStatus = onStatus;
  }

  if (trackerProcess) return;

  trackerStopping = false;
  trackerBuffer = '';

  try {
    trackerProcess = spawn(getAdbExe(), ['track-devices'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
  } catch (err) {
    reportTrackerStatus(`error: ${err.message}`);
    scheduleTrackerRestart();
    return;
  }

  reportTrackerStatus('started');

  trackerProcess.stdout.setEncoding('utf8');
  trackerProcess.stderr.setEncoding('utf8');

  trackerProcess.stdout.on('data', (chunk) => {
    trackerBuffer += chunk;
    consumeTrackerBuffer();
  });

  trackerProcess.stderr.on('data', (chunk) => {
    const message = String(chunk).trim();
    if (message) {
      reportTrackerStatus(`stderr: ${message}`);
    }
  });

  trackerProcess.on('error', (err) => {
    reportTrackerStatus(`error: ${err.message}`);
  });

  trackerProcess.on('exit', (code, signal) => {
    trackerProcess = null;
    trackerBuffer = '';
    reportTrackerStatus(`exit: code=${code ?? 'null'} signal=${signal ?? 'null'}`);
    if (!trackerStopping) {
      scheduleTrackerRestart();
    }
  });
}

function stopDeviceTracking() {
  trackerStopping = true;
  trackerBuffer = '';

  if (trackerRestartTimer !== null) {
    clearTimeout(trackerRestartTimer);
    trackerRestartTimer = null;
  }

  if (trackerProcess) {
    trackerProcess.kill();
    trackerProcess = null;
  }
}

async function getDeviceIp(deviceId) {
  validateDeviceId(deviceId);

  // Try targeted wlan0 query first
  try {
    const { stdout } = await runAdb(['-s', deviceId, 'shell', 'ip', 'addr', 'show', 'wlan0'], 10000);
    const match = stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
    if (match) return match[1];
  } catch {}

  // Fallback: scan all interfaces and find wlan section
  const { stdout } = await runAdb(['-s', deviceId, 'shell', 'ip', 'addr'], 10000);
  const lines = stdout.split('\n');
  let inWlan = false;
  for (const line of lines) {
    if (/wlan\d/.test(line)) inWlan = true;
    else if (/^\d+:/.test(line)) inWlan = false;
    if (inWlan) {
      const match = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
      if (match && match[1] !== '127.0.0.1') return match[1];
    }
  }

  return null;
}

async function setupWireless(deviceId, ip) {
  validateDeviceId(deviceId);

  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    throw new Error('Invalid IP address');
  }

  // Switch device to TCP/IP mode
  const { stdout: tcpOut, stderr: tcpErr } = await runAdb(['-s', deviceId, 'tcpip', '5555'], 10000);

  // Give the device a moment to open the port
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Connect wirelessly
  const { stdout: connectOut } = await runAdb(['connect', `${ip}:5555`], 15000);

  return {
    tcpip: (tcpOut || tcpErr || '').trim(),
    connect: connectOut.trim(),
  };
}

async function disconnectWireless(deviceId) {
  if (!deviceId || !/^\d+\.\d+\.\d+\.\d+:\d+$/.test(deviceId)) {
    throw new Error('Not a wireless device ID');
  }

  const { stdout } = await runAdb(['disconnect', deviceId], 10000);
  return stdout.trim();
}

async function getDeviceInfo(deviceId) {
  validateDeviceId(deviceId);

  const prop = (key) =>
    runAdb(['-s', deviceId, 'shell', 'getprop', key], 10000)
      .then((r) => r.stdout.trim())
      .catch(() => '');

  const [model, manufacturer, androidVersion, batteryOut, memOut] = await Promise.all([
    prop('ro.product.model'),
    prop('ro.product.manufacturer'),
    prop('ro.build.version.release'),
    runAdb(['-s', deviceId, 'shell', 'dumpsys', 'battery'], 10000).then((r) => r.stdout).catch(() => ''),
    runAdb(['-s', deviceId, 'shell', 'cat', '/proc/meminfo'], 10000).then((r) => r.stdout).catch(() => ''),
  ]);

  const levelMatch = batteryOut.match(/level:\s*(\d+)/);
  const statusMatch = batteryOut.match(/status:\s*(\d+)/);
  const batteryLevel = levelMatch ? parseInt(levelMatch[1]) : null;
  const batteryStatus = statusMatch ? parseInt(statusMatch[1]) : null;
  // status: 2 = Charging, 5 = Full
  const batteryCharging = batteryStatus === 2 || batteryStatus === 5;

  const totalMatch = memOut.match(/MemTotal:\s*(\d+)\s*kB/);
  const availMatch = memOut.match(/MemAvailable:\s*(\d+)\s*kB/);
  const memTotalBytes = totalMatch ? parseInt(totalMatch[1]) * 1024 : null;
  const memAvailBytes = availMatch ? parseInt(availMatch[1]) * 1024 : null;
  const memUsedBytes = memTotalBytes !== null && memAvailBytes !== null
    ? memTotalBytes - memAvailBytes
    : null;

  return {
    model: model || 'Unknown Device',
    manufacturer: manufacturer || '',
    androidVersion: androidVersion || null,
    batteryLevel,
    batteryCharging,
    memUsedBytes,
    memTotalBytes,
  };
}

function checkSameNetwork(deviceIp) {
  if (!deviceIp || !/^\d+\.\d+\.\d+\.\d+$/.test(deviceIp)) {
    return { sameNetwork: false };
  }

  const deviceOctets = deviceIp.split('.').map(Number);
  const interfaces = os.networkInterfaces();

  for (const ifaces of Object.values(interfaces)) {
    for (const iface of ifaces) {
      if (iface.family !== 'IPv4' || iface.internal) continue;

      const pcOctets = iface.address.split('.').map(Number);
      const maskOctets = iface.netmask.split('.').map(Number);

      const match = maskOctets.every(
        (mask, i) => (deviceOctets[i] & mask) === (pcOctets[i] & mask)
      );

      if (match) return { sameNetwork: true };
    }
  }

  return { sameNetwork: false };
}

module.exports = {
  parseDevicesOutput,
  checkAdb,
  getDevices,
  startDeviceTracking,
  stopDeviceTracking,
  getDeviceInfo,
  getDeviceIp,
  setupWireless,
  disconnectWireless,
  checkSameNetwork,
};
