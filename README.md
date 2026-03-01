# ADBridge

A simple desktop app for managing Android devices via ADB. Built with Electron.

---

## What it does

- Shows all connected Android devices
- Lists installed apps on a selected device
- Uninstalls apps
- Clears app data
- Installs APK files from your computer

---

## Requirements

- [Node.js](https://nodejs.org) (v18 or later)
- [ADB](https://developer.android.com/tools/adb) installed and available in your system PATH
- USB debugging enabled on your Android device

---

## Getting started

**1. Install dependencies**
```bash
npm install
```

**2. Run the app**
```bash
npm start
```

---

## Build a portable .exe

```bash
npm run build
```

Output: `dist/ADBridge.exe` — no installation needed, just run it.

---

## How to use

1. Connect your Android device via USB with USB debugging on
2. Open the app — it will detect connected devices automatically
3. Select a device from the list on the left
4. The app list will load on the right
5. Use the buttons next to each app to **uninstall** or **clear data**
6. To install an APK, click **Browse**, select the file, then click **Install**

---

## Project structure

```
src/
  main/
    main.js          # Electron main process
    adb-service.js   # ADB command logic
    ipc-handlers.js  # Communication between UI and main process
  preload/
    preload.js       # Secure bridge between UI and Electron
  renderer/
    index.html       # App UI
    styles.css       # Dark theme styles
    renderer.js      # UI logic
```

---

## Troubleshooting

**ADB not found** — Make sure ADB is installed and the `adb` command works in your terminal.

**Device not showing up** — Check that USB debugging is enabled and you've accepted the connection prompt on your phone.

**Build fails with symlink error** — Enable Developer Mode in Windows Settings (Settings → Privacy & Security → For Developers) or run your terminal as Administrator.
