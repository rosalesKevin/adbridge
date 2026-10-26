import assert from 'node:assert/strict';

import { deviceOptionLabel, isWirelessDevice } from '../src/renderer/modules/device-label.mjs';

const usb = { id: 'R5CT1234ABC', status: 'device' };
const wifi = { id: '192.168.1.42:5555', status: 'device' };

assert.equal(isWirelessDevice(wifi.id), true, 'detects ip:port ids as wireless');
assert.equal(isWirelessDevice(usb.id), false, 'treats serials as USB');

assert.equal(
  deviceOptionLabel(usb, new Map(), [usb]),
  '[USB] R5CT1234ABC',
  'falls back to the id until the name is known'
);

assert.equal(
  deviceOptionLabel(usb, new Map([[usb.id, 'Galaxy S23']]), [usb]),
  'Galaxy S23 (USB)',
  'shows the device name with its connection type'
);

{
  const twin = { id: 'R5CT9999XYZ', status: 'device' };
  const names = new Map([[usb.id, 'Galaxy S23'], [twin.id, 'Galaxy S23']]);
  assert.equal(
    deviceOptionLabel(twin, names, [usb, twin]),
    'Galaxy S23 (USB) · 9XYZ',
    'adds the end of the id when two devices share a name'
  );
}

{
  const names = new Map([[usb.id, 'Galaxy S23'], [wifi.id, 'Galaxy S23']]);
  assert.equal(
    deviceOptionLabel(wifi, names, [usb, wifi]),
    'Galaxy S23 (Wi-Fi)',
    'the same phone over USB and Wi-Fi is told apart by connection type'
  );
}

assert.equal(
  deviceOptionLabel({ id: 'R58N91XYZ', status: 'unauthorized' }, new Map(), []),
  '[USB] R58N91XYZ (unauthorized)',
  'shows the status of devices that cannot be used'
);

console.log('All tests passed.');
