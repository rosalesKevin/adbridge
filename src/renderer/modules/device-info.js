import { dom } from './dom.js';

function formatBytes(bytes) {
  const gb = bytes / (1024 ** 3);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
}

function infoRow(label, value) {
  const row = document.createElement('div');
  row.className = 'info-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'info-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'info-value';
  valueEl.textContent = value;
  valueEl.title = value;
  row.append(labelEl, valueEl);
  return row;
}

function buildInfoBar(data, ip, deviceId) {
  const { model, manufacturer, androidVersion, batteryLevel, batteryCharging, memUsedBytes, memTotalBytes } = data;

  const rows = [];
  const maker = manufacturer ? manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1) : '';
  const displayName = maker ? `${maker} ${model}` : model;
  if (displayName) rows.push(['Model', displayName]);
  if (androidVersion) rows.push(['Android', androidVersion]);
  if (batteryLevel !== null) rows.push(['Battery', `${batteryLevel}%${batteryCharging ? ' ⚡ charging' : ''}`]);
  if (memUsedBytes !== null && memTotalBytes !== null) {
    rows.push(['RAM', `${formatBytes(memUsedBytes)} / ${formatBytes(memTotalBytes)}`]);
  }
  if (ip) rows.push(['IP', ip]);
  rows.push(['ID', deviceId]);

  dom.deviceInfoBar.replaceChildren(...rows.map(([label, value]) => infoRow(label, value)));
}

export async function loadDeviceInfo(deviceId) {
  dom.deviceInfoBar.classList.remove('hidden');
  dom.deviceInfoBar.replaceChildren(infoRow('Loading…', ''));

  const [infoResult, ipResult] = await Promise.all([
    window.adb.deviceInfo(deviceId),
    window.adb.getDeviceIp(deviceId)
  ]);

  if (!infoResult.success) {
    dom.deviceInfoBar.classList.add('hidden');
    return;
  }

  const ip = ipResult.success ? ipResult.data : null;
  buildInfoBar(infoResult.data, ip, deviceId);
}

export function clearDeviceInfo() {
  dom.deviceInfoBar.classList.add('hidden');
  dom.deviceInfoBar.innerHTML = '';
}
