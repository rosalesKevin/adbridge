# ADBridge v1.2.3

ADBridge is the swiss knife of ADB: a desktop UI that simplifies day-to-day ADB usage.

It is built for developers, testers, and anyone already familiar with ADB who wants faster workflows without living in a terminal.

<p align="center"><img width="521" height="380" alt="ADBridge Preview" src="https://github.com/user-attachments/assets/35f63722-3755-49cf-9bb8-3388334c126f" /></p>

## Features

- Device discovery (USB & wireless) with real-time tracking
- Device info bar (model, Android version, battery, RAM, IPv4 address)
- App management: list, uninstall, clear data, install APK
- Device file explorer (browse, push, pull, create folder, delete, rename)
- Logcat viewer with app selector, tag filter, level filter, and export
- Screen mirroring via bundled scrcpy

## Download Windows Zip

To skip the build hassle and just want to use ADBridge, download the latest portable `ADBridge-v<version>.zip` from the GitHub Releases page:

https://github.com/rosalesKevin/adbridge/releases

Extract the zip anywhere. It will create a single `ADBridge-v<version>` folder — open it and run `ADBridge.exe`.

ADBridge notifies you when a newer release exists and opens the GitHub release page. To update, download the new release zip, extract it, and replace your existing/previous version.

## If you wish to clone repo and run it these are the requirements

- [Node.js](https://nodejs.org) (v18+)
- **Optional:** Android SDK build-tools (`aapt`) in PATH or `ANDROID_HOME` set (required for "From APK" logcat feature)
- **Optional:** JDK (`keytool`) in PATH or `JAVA_HOME` set (required for APK signing info and keystore inspection)

### Run

```bash
npm install
npm start
```

### Build Windows Zip

```bash
npm run build
```

Output: `dist/win-unpacked/`

To create a release zip, rename `dist/win-unpacked/` to `dist/ADBridge-v<version>/`, then zip that folder. The zip should extract as a single named folder containing `ADBridge.exe` and everything else inside it.

## Third-party licenses

ADBridge bundles [scrcpy](https://github.com/Genymobile/scrcpy) (Apache 2.0).

ADBridge bundles [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) (ADB) by Google, subject to the [Android Software Development Kit License Agreement](https://developer.android.com/studio/terms).
