export function autoGrantKey(deviceId, pkg) {
  return `${deviceId}|${pkg}`;
}

/**
 * Decides which remembered packages need their permissions granted.
 * results: [{ pkg, time }] where time is the package's lastUpdateTime,
 * null when it is not installed, or undefined when the lookup failed.
 */
export function nextAutoGrantActions(seen, deviceId, results) {
  const next = { ...seen };
  const toGrant = [];

  for (const { pkg, time } of results) {
    const key = autoGrantKey(deviceId, pkg);
    if (time === undefined) continue;
    if (time === null) {
      delete next[key];
      continue;
    }
    if (next[key] !== time) toGrant.push(pkg);
    next[key] = time;
  }

  return { toGrant, seen: next };
}
