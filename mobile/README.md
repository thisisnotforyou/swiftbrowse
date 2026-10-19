# SwiftBrowse Mobile (prototype)

This folder contains an early Flutter app for Android and iOS. It is separate from the Electron desktop app. It currently has an address/search bar, back/forward, reload, a start page, in-memory tabs, and bundled EasyList/AdGuard filtering through the community `adblocker_webview` package.

The app uses the platform WebView: Chromium-based Android System WebView on Android and WKWebView on iOS. iOS uses WebKit for normal worldwide distribution. Apple's alternative browser engine entitlement is limited to qualifying EU distribution and requires a substantial security and standards program; SwiftBrowse does not have that entitlement.

## Requirements

- Flutter 3.38 or newer
- Android Studio / Android SDK for Android builds
- Xcode for iOS builds

## Set up and run

From this directory:

```sh
./bootstrap.sh
flutter pub get
flutter run
```

To build locally:

```sh
flutter build apk --debug
flutter build ios --simulator --no-codesign
```

The generated `android/` and `ios/` project folders are ignored by Git and created by `bootstrap.sh`. GitHub Actions generates them for prototype build checks. These are not signed store releases. Android Play Store distribution needs a release signing key. iOS device distribution needs Apple signing and provisioning. The ad-blocking package bundles its filter lists, so list freshness depends on package updates.

## Current limits

This is not feature parity with the desktop app. Mobile tabs exist only in memory; workspaces, sync, downloads, bookmarks, history, private browsing, and desktop split view are not implemented here. The ad-filter package is a community dependency and needs real-device compatibility and security review before public release.
