import { state } from './state.js';
import { appendLog } from './logger.js';
import { getSettings } from './settings.js';
import { nextAutoGrantActions, autoGrantKey } from './auto-grant-state.mjs';

// Watches remembered packages on the selected device and grants all permissions
// whenever one is installed, reinstalled or updated — from ADBridge or anywhere else.
const POLL_MS = 5000;

let seen = {};
let checking = false;

export async function checkAutoGrant() {
  const deviceId = state.selectedDeviceId;
  const packages = getSettings().autoGrantPackages;
  if (checking || !deviceId || packages.length === 0) return;

  checking = true;
  try {
    const results = await Promise.all(packages.map(async (pkg) => {
      const result = await window.adb.packageUpdateTime(deviceId, pkg);
      return { pkg, time: result.success ? result.data : undefined };
    }));

    const next = nextAutoGrantActions(seen, deviceId, results);
    seen = next.seen;

    for (const pkg of next.toGrant) {
      const result = await window.adb.grantPermissions(deviceId, pkg);
      if (result.success) {
        appendLog(`Auto-granted ${result.data.granted.length} permissions to ${pkg}.`);
      } else {
        delete seen[autoGrantKey(deviceId, pkg)]; // retry on the next check
        appendLog(`Auto-grant FAILED for ${pkg}: ${result.error}`);
      }
    }
  } finally {
    checking = false;
  }
}

/** Forget what we saw for a package so turning auto-grant back on grants right away. */
export function forgetAutoGrant(pkg) {
  for (const key of Object.keys(seen)) {
    if (key.endsWith(`|${pkg}`)) delete seen[key];
  }
}

export function initAutoGrant() {
  setInterval(() => void checkAutoGrant(), POLL_MS);
}
