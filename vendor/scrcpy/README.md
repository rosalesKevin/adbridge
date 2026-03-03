# scrcpy Windows x64 Binaries

Download scrcpy v2.7 (or latest v2.x) Windows x64 zip from:
https://github.com/Genymobile/scrcpy/releases

Extract the following files into this directory:

```
scrcpy.exe
scrcpy-server        (no extension — the Android-side JAR)
SDL2.dll
avcodec-60.dll
avformat-60.dll
avutil-58.dll
swresample-4.dll
swscale-7.dll
(any other DLLs from the scrcpy zip)
```

**Do NOT include `adb.exe`** from the scrcpy zip — ADBridge expects ADB on the system PATH.
