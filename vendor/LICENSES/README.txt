Third-Party License Notices for ADBridge
=========================================

This folder contains the license and attribution files required by the
open-source components bundled with ADBridge.

Files in this folder:

  LICENSE-platform-tools.txt
    Apache License 2.0 text covering the bundled Android platform-tools
    binaries (adb.exe, AdbWinApi.dll, AdbWinUsbApi.dll) located in the
    scrcpy/ folder beside ADBridge.exe.

  NOTICE-platform-tools.txt
    Attribution notice from the Android Open Source Project for the
    adb/platform-tools source tree.

  LICENSE-scrcpy.txt
    Apache License 2.0 text covering scrcpy.exe and scrcpy-server in
    the scrcpy/ folder beside ADBridge.exe.

  NOTICE-scrcpy.txt
    Attribution notice for scrcpy and its bundled dependencies
    (FFmpeg, SDL2, libusb).

Legal basis for bundling platform-tools
---------------------------------------

The Android SDK Platform-Tools source (adb, fastboot, AdbWinApi,
AdbWinUsbApi) is published by the Android Open Source Project under
the Apache License 2.0.

Section 3.5 of the Android Software Development Kit License Agreement
(https://developer.android.com/studio/terms) states:

  "Use, reproduction and distribution of components of the SDK licensed
   under an open source software license are governed solely by the
   terms of that open source software license and not the License
   Agreement."

Therefore redistribution of adb.exe and its companion DLLs is governed
by the Apache License 2.0, not the Android SDK License Agreement. The
binaries in scrcpy/ are unmodified copies of Google's official
platform-tools release.
