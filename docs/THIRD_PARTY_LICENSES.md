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
- **Version:** 36.0.0 (adb 36.0.0-13206524)
- **NOTICE:** `LICENSES/NOTICE-platform-tools.txt` — the official NOTICE file from
  platform-tools 36.0.0, copied unmodified. It carries the attribution notices for
  components built into adb (BoringSSL/OpenSSL, protobuf, zlib, lz4, brotli,
  mDNSResponder, and others).

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

Versions and build scripts are pinned by scrcpy v3.3.4's
[`app/deps`](https://github.com/Genymobile/scrcpy/tree/v3.3.4/app/deps)
(no patches applied).

| Component | Version | License | License text | Corresponding source |
| --- | --- | --- | --- | --- |
| FFmpeg (avcodec, avformat, avutil, swresample) | 7.1.1 | LGPL v2.1+ (no GPL/nonfree parts) | `LICENSES/LICENSE-LGPL-2.1.txt` | https://ffmpeg.org/releases/ffmpeg-7.1.1.tar.xz |
| dav1d (built into avcodec-61.dll) | 1.5.0 | BSD 2-Clause | `LICENSES/LICENSE-dav1d.txt` | https://code.videolan.org/videolan/dav1d/-/tree/1.5.0 |
| libusb | 1.0.29 | LGPL v2.1+ | `LICENSES/LICENSE-LGPL-2.1.txt` | https://github.com/libusb/libusb/archive/refs/tags/v1.0.29.tar.gz |
| SDL2 | 2.32.8 | zlib | — | https://github.com/libsdl-org/SDL/tree/release-2.32.8 |

LGPL components are dynamically linked and unmodified. Users may replace
the bundled DLLs with compatible builds of their own.

## Electron

ADBridge is built on Electron (MIT license + embedded Chromium under
BSD-style license + Node.js under MIT). Electron license notices are
generated into the packaged app by `electron-builder` and ship beside
`ADBridge.exe` in the release zip (`LICENSE.electron.txt`,
`LICENSES.chromium.html`).

## Trademarks and artwork

Android is a trademark of Google LLC.

The antennae in the ADBridge icon and logo are adapted from the Android robot.
The Android robot is
reproduced or modified from work created and shared by Google and used
according to terms described in the
[Creative Commons 3.0 Attribution License](https://creativecommons.org/licenses/by/3.0/).
