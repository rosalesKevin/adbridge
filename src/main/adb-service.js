const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// ─────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// COMMAND RUNNER
// ─────────────────────────────────────────────

/**
 * Executes an ADB command safely using execFile.
 *
 * WHY execFile AND NOT exec:
 * - execFile passes arguments as an array, not through a shell
 * - This prevents command injection (e.g., a package name containing "; rm -rf /")
 * - Paths with spaces are handled correctly without manual quoting
 *
 * @param {string[]} args - Arguments to pass to adb (e.g., ['devices'])
 * @param {number} timeoutMs - Timeout in milliseconds (default 30000)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runAdb(args, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        execFile('adb', args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
            if (error) {
                // If it's a timeout, say so clearly
                if (error.killed) {
                    reject(new Error(`Command timed out after ${timeoutMs / 1000}s: adb ${args.join(' ')}`));
                    return;
                }
                // Some ADB commands return non-zero exit codes but still have useful output
                // (e.g., uninstall of a non-existent package). Return output anyway.
                if (stdout || stderr) {
                    resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
                    return;
                }
                reject(new Error(stderr || error.message));
                return;
            }
            resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        });
    });
}

// ─────────────────────────────────────────────
// ADB COMMANDS
// ─────────────────────────────────────────────

/**
 * Checks if ADB is available on the system PATH.
 * @returns {Promise<boolean>}
 */
async function checkAdb() {
    try {
        const { stdout } = await runAdb(['version'], 5000);
        return stdout.includes('Android Debug Bridge');
    } catch {
        return false;
    }
}

/**
 * Lists all connected devices.
 *
 * Parses output of "adb devices":
 *   List of devices attached
 *   SERIAL1\tdevice
 *   SERIAL2\tunauthorized
 *
 * @returns {Promise<Array<{id: string, status: string}>>}
 */
async function getDevices() {
    const { stdout } = await runAdb(['devices']);
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

/**
 * Lists installed packages on a device.
 *
 * @param {string} deviceId - Device serial number
 * @param {boolean} userOnly - If true, only user-installed apps (-3 flag)
 * @returns {Promise<string[]>} Sorted array of package names
 */
async function getPackages(deviceId, userOnly = true) {
    validateDeviceId(deviceId);

    const args = ['-s', deviceId, 'shell', 'pm', 'list', 'packages'];
    if (userOnly) args.push('-3');

    const { stdout } = await runAdb(args);
    const packages = [];

    for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('package:')) {
            packages.push(trimmed.substring('package:'.length).trim());
        }
    }

    packages.sort();
    return packages;
}

/**
 * Uninstalls an app from the device.
 * @returns {Promise<string>} Result message
 */
async function uninstallApp(deviceId, packageName) {
    validateDeviceId(deviceId);
    validatePackageName(packageName);

    const { stdout, stderr } = await runAdb(['-s', deviceId, 'uninstall', packageName], 60000);
    return stdout || stderr || 'No output from ADB';
}

/**
 * Clears app data and cache.
 * @returns {Promise<string>} Result message
 */
async function clearAppData(deviceId, packageName) {
    validateDeviceId(deviceId);
    validatePackageName(packageName);

    const { stdout, stderr } = await runAdb(['-s', deviceId, 'shell', 'pm', 'clear', packageName]);
    return stdout || stderr || 'No output from ADB';
}

/**
 * Installs an APK file from the host machine onto the device.
 * The -r flag allows reinstalling over an existing installation.
 *
 * @param {string} deviceId - Device serial number
 * @param {string} apkPath - Absolute path to .apk on the HOST machine
 * @returns {Promise<string>} Result message
 */
async function installApk(deviceId, apkPath) {
    validateDeviceId(deviceId);

    if (!apkPath || typeof apkPath !== 'string') {
        throw new Error('APK path cannot be empty');
    }
    if (!fs.existsSync(apkPath)) {
        throw new Error(`APK file does not exist: ${apkPath}`);
    }
    if (!apkPath.toLowerCase().endsWith('.apk')) {
        throw new Error(`File is not an APK: ${apkPath}`);
    }

    // execFile handles paths with spaces correctly — do NOT wrap in quotes
    const { stdout, stderr } = await runAdb(['-s', deviceId, 'install', '-r', apkPath], 120000);
    return stdout || stderr || 'No output from ADB';
}

/**
 * Pushes a local file to a path on the device.
 * @param {string} deviceId - Device serial number
 * @param {string} localPath - Absolute path to file on the host machine
 * @param {string} remotePath - Destination path on device (e.g., /sdcard/Download/)
 */
async function pushFile(deviceId, localPath, remotePath) {
    validateDeviceId(deviceId);

    if (!localPath || typeof localPath !== 'string') {
        throw new Error('Local file path cannot be empty');
    }
    if (!fs.existsSync(localPath)) {
        throw new Error(`File not found: ${localPath}`);
    }
    if (!remotePath || typeof remotePath !== 'string') {
        throw new Error('Remote path cannot be empty');
    }
    if (!remotePath.startsWith('/')) {
        throw new Error('Remote path must start with / (e.g., /sdcard/Download/)');
    }
    if (/[\0]/.test(remotePath)) {
        throw new Error('Remote path contains invalid characters');
    }

    const { stdout, stderr } = await runAdb(['-s', deviceId, 'push', localPath, remotePath], 120000);
    return stdout || stderr || 'No output from ADB';
}

module.exports = {
    checkAdb,
    getDevices,
    getPackages,
    uninstallApp,
    clearAppData,
    installApk,
    pushFile
};
