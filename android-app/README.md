# LeeTec Engine Android app

This directory contains the Android WebView wrapper for LeeTec Engine. The app opens the live LeeTec Engine web application at `https://leetec.online` and keeps authentication cookies, JavaScript, and local storage enabled so the existing dashboard and payment flows work from Android.

## Build

Install Android SDK platform 35 and build-tools 35.0.0, then run:

```bash
./gradlew assembleRelease
```

The generated release artifact is written to `app/build/outputs/apk/release/app-release.apk` when a release signing configuration is supplied. The repository intentionally excludes signing keys. The verified APK distributed with this commit is `release/leetec-engine.apk`.

The APK requires an internet connection because the application and its API are hosted by LeeTec Engine.
