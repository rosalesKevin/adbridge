import { dom } from './dom.js';

function formatBytes(bytes) {
  const gb = bytes / (1024 ** 3);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
}

function buildInfoBar(data) {
  const { model, manufacturer, androidVersion, batteryLevel, batteryCharging, memUsedBytes, memTotalBytes } = data;

  const parts = [];

  const displayName = manufacturer ? `${manufacturer} ${model}` : model;
  if (displayName) parts.push(displayName);

  if (androidVersion) parts.push(`Android ${androidVersion}`);

  if (batteryLevel !== null) {
    const charging = batteryCharging ? ' ⚡' : '';
    parts.push(`🔋 ${batteryLevel}%${charging}`);
  }

  if (memUsedBytes !== null && memTotalBytes !== null) {
    parts.push(`RAM ${formatBytes(memUsedBytes)} / ${formatBytes(memTotalBytes)}`);
  }

  dom.deviceInfoBar.innerHTML = '';
  for (let i = 0; i < parts.length; i++) {
    const chip = document.createElement('span');
    chip.className = 'info-chip';
    chip.textContent = parts[i];
    dom.deviceInfoBar.appendChild(chip);

    if (i < parts.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'info-sep';
      sep.textContent = '·';
      dom.deviceInfoBar.appendChild(sep);
    }
  }
}

export async function loadDeviceInfo(deviceId) {
  dom.deviceInfoBar.classList.remove('hidden');
  dom.deviceInfoBar.innerHTML = '<span class="info-chip" style="color:var(--text-muted)">Loading device info...</span>';

  const result = await window.adb.deviceInfo(deviceId);
  if (!result.success) {
    dom.deviceInfoBar.classList.add('hidden');
    return;
  }

  buildInfoBar(result.data);
}

export function clearDeviceInfo() {
  dom.deviceInfoBar.classList.add('hidden');
  dom.deviceInfoBar.innerHTML = '';
}
