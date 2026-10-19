# SwiftBrowse

SwiftBrowse is an early cross-platform Chromium browser prototype built with Electron and Chromium.

## Browser features

- Tabs, address/search bar, back/forward, reload, keyboard navigation, and pop-up links opening in new tabs
- Local start page with a clock, quick links, and Google search
- Side panel for workspaces, bookmarks, history, downloads, privacy, and appearance
- Personal, Work, and Play workspaces with separate cookies and site sign-ins; up to eight workspaces
- Private tabs in a temporary session; their history and site data are cleared after the last private tab closes. Downloaded files remain in the Downloads folder.
- Split view for two tabs side-by-side
- Built-in EasyList-compatible ad and tracker filtering, with a local filter cache
- Do Not Track and Global Privacy Control request headers
- Custom browser accent colours, local history, and a control to clear cookies, cache, and history

This is still a prototype. It does not yet have browser extensions, a password manager, cross-device sync, AI tools, a reputation-based safe-browsing service, a built-in VPN, or automatic app updates. Ad and tracker filtering depends on the selected filter lists and can vary by site.

## Run from source

Requires Node.js 22 or newer and pnpm 10 or newer.

```sh
pnpm install
pnpm start
```

## Build installers

Build on the matching platform for the most reliable result:

```sh
pnpm dist:mac      # Universal macOS .dmg and .zip (Intel and Apple Silicon)
pnpm dist:windows  # Windows NSIS installer
pnpm dist:linux    # Linux AppImage and .deb
```

Installers are written to `outputs/installers/`. Pushing a version tag such as `v0.4.0` to the public GitHub repository builds Mac, Windows, and Linux packages, then publishes them as downloadable assets on a GitHub Release.

## Public release setup

The Mac release is configured for Developer ID signing and Apple notarization. Add these repository Actions secrets before tagging a release:

- `MAC_CSC_LINK`: base64-encoded Developer ID Application `.p12` certificate
- `MAC_CSC_KEY_PASSWORD`: password for that certificate
- `APPLE_ID`: Apple Developer account email
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password
- `APPLE_TEAM_ID`: Apple Developer Team ID

Apple Developer Program membership and a Developer ID Application certificate are required. Without these secrets, the Mac release build will not be trusted by Gatekeeper. Windows currently builds without Authenticode signing, so SmartScreen may warn. Linux packages are unsigned.

The repository must be public for anyone to access the source and GitHub Releases. Do not put certificates or passwords in the repository; add them only as GitHub Actions secrets.

## Privacy details

Browsing data is stored on this device. Workspaces use separate browser storage. Private tabs use a temporary browser session and are not included in history. The built-in blocker downloads filter data from Ghostery; search queries go to Google. The browser sends Do Not Track and Global Privacy Control signals with web requests. Use Privacy Center to disable filtering or clear local browsing data.
