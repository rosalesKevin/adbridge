# Third-Party Licenses

ADBridge bundles several open-source components. Each is listed below
with its license and upstream source. Full license and NOTICE texts are
shipped inside the release zip at `LICENSES/` (source tree:
`vendor/LICENSES/`).

## Android Platform-Tools (adb)

- **Files:** `scrcpy/adb.exe`, `scrcpy/AdbWinApi.dll`, `scrcpy/AdbWinUsbApi.dll`
- **License:** Apache License 2.0
- **Copyright:** © The Android Open Source Project
- **Upstream source:** https://android.googlesource.com/platform/packages/modules/adb/
- **Official binary distribution:** https://developer.android.com/tools/releases/platform-tools
- **License text:** `LICENSES/LICENSE-platform-tools.txt`
- **NOTICE:** `LICENSES/NOTICE-platform-tools.txt`

### Why bundling is permitted

The Android Software Development Kit License Agreement
(https://developer.android.com/studio/terms) §3.5 carves out open-source
components:

> Use, reproduction and distribution of components of the SDK licensed
> under an open source software license are governed solely by the
> terms of that open source software license and not the License
> Agreement.

The adb and AdbWin\* sources are Apache 2.0 in AOSP, so the compiled
binaries ship under Apache 2.0. The bundled binaries are unmodified
copies of Google's official platform-tools release.

## scrcpy

- **Files:** `scrcpy/scrcpy.exe`, `scrcpy/scrcpy-server`, and the
  associated DLLs (SDL2, avcodec, avformat, avutil, swresample)
- **License:** Apache License 2.0
- **Copyright:** © 2017 Genymobile, © 2018–2025 Romain Vimont
- **Upstream:** https://github.com/Genymobile/scrcpy
- **License text:** `LICENSES/LICENSE-scrcpy.txt`
- **NOTICE:** `LICENSES/NOTICE-scrcpy.txt`

## scrcpy dependencies (shipped inside `scrcpy/`)

| Component | License | Upstream |
| --- | --- | --- |
| FFmpeg (avcodec, avformat, avutil, swresample) | LGPL v2.1+ | https://ffmpeg.org/ |
| SDL2 | zlib | https://www.libsdl.org/ |
| libusb | LGPL v2.1+ | https://libusb.info/ |

LGPL components are dynamically linked. Source is available from the
upstream project pages. Users may replace the bundled library files
with compatible builds of their own.

## Electron

ADBridge is built on Electron (MIT license + embedded Chromium under
BSD-style license + Node.js under MIT). Electron license notices are
generated into the packaged app by `electron-builder` and ship inside
`resources/` in the release zip.
