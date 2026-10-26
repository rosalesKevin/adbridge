export function isWirelessDevice(deviceId) {
  return /^\d+\.\d+\.\d+\.\d+:\d+$/.test(deviceId);
}

/**
 * Text for a device in the switcher: "Galaxy S23 (USB)" once the name is known, the id until then.
 * names: Map of device id → friendly name (or null when the device has none).
 */
export function deviceOptionLabel(device, names, allDevices) {
  const conn = isWirelessDevice(device.id) ? 'Wi-Fi' : 'USB';
  const name = names.get(device.id);
  let label = name ? `${name} (${conn})` : `[${conn}] ${device.id}`;

  if (name) {
    const sameLabel = allDevices.filter((d) => d.id !== device.id && names.get(d.id) === name
      && isWirelessDevice(d.id) === isWirelessDevice(device.id));
    if (sameLabel.length > 0) label += ` · ${device.id.slice(-4)}`;
  }
  if (device.status !== 'device') label += ` (${device.status})`;
  return label;
}
