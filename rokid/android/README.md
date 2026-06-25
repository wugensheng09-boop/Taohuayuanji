# Taohuayuan Rokid Android Workspace

This workspace contains the formal Rokid integration shell for the Taohuayuan web game.

## Modules

- `glass-webview`: APK installed on Rokid glasses. It opens the production web game in fullscreen WebView at `/learn/taohuayuanji?device=rokid&autostart=1`.
- `mobile-controller`: Android phone app that integrates Rokid CXR-L SDK, requests authorization, opens a `CUSTOMAPP` session, installs/starts the glasses APK, and sends game control commands.

## Build

Install Android Studio with Android SDK 36 and JDK 17 or newer, then open this `rokid/android` folder.

Set the production web base URL when building the glasses app:

```powershell
.\gradlew.bat :glass-webview:assembleRelease -PTAOHUA_WEB_BASE_URL=https://your-domain.com
```

Build the controller app:

```powershell
.\gradlew.bat :mobile-controller:assembleRelease
```

If you build from Android Studio, add `TAOHUA_WEB_BASE_URL=https://your-domain.com` to a local Gradle property before release builds.

## Controller APK Upload Path

Rename the built glasses APK to:

```text
taohuayuan-glass.apk
```

Place it on the Android phone in one of these locations before tapping `Install Glass APK`:

- app external downloads folder
- app external `DCIM/Rokid` folder
- `/sdcard/Download/taohuayuan-glass.apk`
- `/sdcard/DCIM/Rokid/taohuayuan-glass.apk`

## Runtime Flow

1. Install Rokid AI App on the phone.
2. Install `mobile-controller` on the phone.
3. Open controller, tap `Check Rokid AI App`.
4. Tap `Request Authorization` and complete Rokid authorization.
5. Tap `Connect CUSTOMAPP Session`.
6. Tap `Install Glass APK`.
7. Tap `Start Glass App`.
8. Use `Game: Start`, `Game: Next`, `Game: Pause`, `Game: Reset`, or `Game: Reload`.

## Production Notes

- The web game must be deployed over HTTPS for production.
- Do not put AI or TTS secrets in either APK. Keep them behind the existing upstream service.
- `mobile-controller` uses CXR-L `CUSTOMAPP`; this is the mode that supports app install/start/stop and custom commands.
- The glasses app includes `CXRServiceBridge` so custom commands can reach the WebView.
