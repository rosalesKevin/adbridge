# ADBridge v1.2.2

ADBridge is the swiss knife of ADB: a desktop UI that simplifies day-to-day ADB usage..

It is built for developers, testers, and anyone already familiar with ADB who wants faster workflows without living in a terminal.

<p align="center"><img width="521" height="380" alt="ADBridge Preview" src="https://github.com/user-attachments/assets/35f63722-3755-49cf-9bb8-3388334c126f" /></p>

## Features

- Device discovery with real-time connect/disconnect tracking
- USB and wireless ADB workflows
- Device info bar (model, Android version, battery, RAM, IPv4 address)
- App management (list packages, uninstall, clear data)
- APK installation from local files
- Device file explorer (browse, push, pull, create folder, delete, rename)
- Logcat viewer with app selector, tag filter, level filter, export, and ADB error surfacing
- Auto-fill logcat app from a release APK file (extracts package name via `aapt`)
- APK signing info and keystore inspector (Advanced, requires JDK `keytool`)
- Resizable log panel
- Screen mirroring via bundled scrcpy

## Requirements

- [Node.js](https://nodejs.org) (v18+)
- USB debugging enabled on Android devices
- **Optional:** Android SDK build-tools (`aapt`) in PATH or `ANDROID_HOME` set — required for "From APK" logcat feature
- **Optional:** JDK (`keytool`) in PATH or `JAVA_HOME` set — required for APK signing info and keystore inspection

## Run

```bash
npm install
npm start
```

## Download Windows Zip

If you just want to use ADBridge, download the latest `ADBridge-win-x64.zip` from the GitHub Releases page:

https://github.com/rosalesKevin/adbridge/releases

`v1.2.1` was removed because its Windows self-update flow could leave the portable app unusable after updating. If you ever downloaded `v1.2.1`, replace it manually with the current release zip.

Extract the zip to a writable folder and run `ADBridge.exe` from the extracted folder. Keep `ADBridge.exe` and the bundled `scrcpy` folder together.

ADBridge now only notifies you when a newer release exists and opens the GitHub release page. To update, download the new release zip, extract it, and replace your existing app folder.

## Build Windows Zip

```bash
npm run build
```

Output:

- `dist/win-unpacked/`
- `dist/ADBridge-win-x64/`
- `dist/ADBridge-win-x64.zip`

## Third-party licenses

ADBridge bundles [scrcpy](https://github.com/Genymobile/scrcpy) (Apache 2.0).

ADBridge bundles [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) (ADB) by Google, subject to the [Android Software Development Kit License Agreement](https://developer.android.com/studio/terms).
