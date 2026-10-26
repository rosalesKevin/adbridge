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
    Official NOTICE file shipped with Android SDK Platform-Tools 36.0.0
    (copied unmodified). It lists the attribution notices for every
    component built into adb.exe and its DLLs, including BoringSSL/OpenSSL,
    protobuf, zlib, lz4, brotli and mDNSResponder.

  LICENSE-scrcpy.txt
    Apache License 2.0 text covering scrcpy.exe and scrcpy-server in
    the scrcpy/ folder beside ADBridge.exe.

  NOTICE-scrcpy.txt
    Attribution notice for scrcpy and its bundled dependencies (FFmpeg,
    dav1d, libusb, SDL2), with exact versions and source links.

  LICENSE-LGPL-2.1.txt
    GNU Lesser General Public License v2.1 text, covering the bundled
    FFmpeg and libusb DLLs.

  LICENSE-dav1d.txt
    BSD 2-Clause license for dav1d, built into avcodec-61.dll.

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

Trademarks and artwork
----------------------

Android is a trademark of Google LLC.

The antennae in the ADBridge icon are adapted from the Android robot.
The Android robot is
reproduced or modified from work created and shared by Google and used
according to terms described in the Creative Commons 3.0 Attribution
License (https://creativecommons.org/licenses/by/3.0/).
