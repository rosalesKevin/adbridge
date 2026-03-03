# ADBridge v1.1.0

ADBridge is the swiss knife of ADB: a desktop UI that simplifies day-to-day ADB usage..

It is built for developers, testers, and anyone already familiar with ADB who wants faster workflows without living in a terminal.

<p align="center"><img width="521" height="380" alt="ADBridge Preview" src="https://github.com/user-attachments/assets/35f63722-3755-49cf-9bb8-3388334c126f" /></p>

## Features

- Device discovery with real-time connect/disconnect tracking
- USB and wireless ADB workflows
- Device info bar (model, Android version, battery, RAM)
- App management (list packages, uninstall, clear data)
- APK installation from local files
- Device file explorer (browse, push, pull)
- Logcat viewer with app selector, tag filter, level filter, and export
- Screen mirroring via bundled scrcpy

## Requirements

- [Node.js](https://nodejs.org) (v18+)
- USB debugging enabled on Android devices

## Run

```bash
npm install
npm start
```

## Download Portable EXE

If you just want to use ADBridge, download the latest portable `ADBridge.exe` from the GitHub Releases page:

https://github.com/rosalesKevin/adbridge/releases

## Build Portable EXE

```bash
npm run build
```

Output: `dist/ADBridge.exe` (portable, no installer).

## Third-party licenses

ADBridge bundles [scrcpy](https://github.com/Genymobile/scrcpy) (Apache 2.0).

ADBridge bundles [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) (ADB) by Google, subject to the [Android Software Development Kit License Agreement](https://developer.android.com/studio/terms).
