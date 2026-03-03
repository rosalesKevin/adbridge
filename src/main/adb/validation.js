const DEVICE_ID_PATTERN = /^[a-zA-Z0-9.:_\-]+$/;
const PACKAGE_NAME_PATTERN = /^[a-zA-Z0-9._]+$/;

function validateDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') {
    throw new Error('Device ID cannot be empty');
  }
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    throw new Error(`Invalid device ID: ${deviceId}`);
  }
}

function validatePackageName(packageName) {
  if (!packageName || typeof packageName !== 'string') {
    throw new Error('Package name cannot be empty');
  }
  if (!PACKAGE_NAME_PATTERN.test(packageName)) {
    throw new Error(`Invalid package name: ${packageName}`);
  }
}

module.exports = {
  validateDeviceId,
  validatePackageName
};
