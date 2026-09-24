<div align="center">

<a href="https://draconov.github.io/Kavvanah-Siddur/">
  <img src="public/icons/icon-512.png" width="124" height="124" alt="Kavvanah app icon" />
</a>

# Kavvanah · כַּוָּנָה

**A siddur for thoughtful, everyday prayer.**

Read Hebrew prayers alongside transliteration and translation, explore the Tanakh, follow the Jewish calendar, and find prayer times for your location—all in one installable web app.

<p>
  <a href="https://draconov.github.io/Kavvanah-Siddur/"><img alt="Open online siddur" src="https://img.shields.io/badge/Open%20Kavvanah-Website-152443?style=for-the-badge&logo=googlechrome&logoColor=white" /></a>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/releases"><img alt="Download Kavvanah apps" src="https://img.shields.io/badge/Download-Apps-BDA16D?style=for-the-badge&logo=github&logoColor=152443" /></a>
</p>
<p>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/actions/workflows/pages.yml"><img alt="Build and deploy status" src="https://github.com/Draconov/Kavvanah-Siddur/actions/workflows/pages.yml/badge.svg?branch=main" /></a>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/blob/main/LICENSE"><img alt="License GPL-2.0-only" src="https://img.shields.io/badge/License-GPL--2.0--only-152443?style=flat-square" /></a>
  <a href="CONTENT_SOURCES.md"><img alt="Text and content sources" src="https://img.shields.io/badge/Content-Sources-71614C?style=flat-square" /></a>
</p>

</div>

---

## What you can do

| | |
| :-- | :-- |
| **Pray your way** | Switch between Hebrew, transliteration, translation, or all reading layers. Choose your preferred prayer tradition and pronunciation aid. |
| **Read the Tanakh** | Browse the included books and chapters, with personal reading progress. |
| **Stay in rhythm** | View the Jewish calendar, local prayer times, and the direction to Jerusalem. |
| **Make it yours** | Adjust your themes, accent colors, and text preferences. |
| **Take it offline** | Install the web app and download the included texts, or use a native app with its web resources bundled locally. |

> **Content note:** Siddur translations are still incomplete. Available text and translations depend on their source editions; see [Content sources](CONTENT_SOURCES.md) for attribution and coverage.

## Open or install

<a href="https://draconov.github.io/Kavvanah-Siddur/"><img alt="Open the web app" src="https://img.shields.io/badge/Open-Web%20app-152443?style=for-the-badge&logo=googlechrome&logoColor=white" /></a>

To use the web app, open the site in a supported browser and use **Install app** or **Add to Home Screen** if available. In Settings, select **Download all texts for offline use** to prepare an offline library. Preferences and personal translations are saved on your current device; export a backup before clearing browser storage or changing devices.

### Downloadable development builds

Every update to `main` triggers a unified workflow to build and deploy the website and package native apps. It publishes development **prereleases**, not signed production releases. Choose a platform below to view the downloadable packages; availability depends on successful builds.

<p>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/releases"><img alt="Windows downloads" src="https://img.shields.io/badge/Windows-EXE-0078D4?style=for-the-badge&logo=windows11&logoColor=white" /></a>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/releases"><img alt="Android downloads" src="https://img.shields.io/badge/Android-APK-3DDC84?style=for-the-badge&logo=android&logoColor=black" /></a>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/releases"><img alt="Linux downloads" src="https://img.shields.io/badge/Linux-AppImage-FCC624?style=for-the-badge&logo=linux&logoColor=black" /></a>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/releases"><img alt="macOS downloads" src="https://img.shields.io/badge/macOS-APP-5C5C5C?style=for-the-badge&logo=apple&logoColor=white" /></a>
</p>
<p>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/actions/workflows/pages.yml"><img alt="View build and deployment workflow" src="https://img.shields.io/badge/View-Build%20status-71614C?style=flat-square&logo=githubactions&logoColor=white" /></a>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/releases"><img alt="Browse all prereleases" src="https://img.shields.io/badge/Browse-All%20releases-152443?style=flat-square&logo=github&logoColor=white" /></a>
</p>

| Platform | Package | Installation and limitations |
| :-- | :-- | :-- |
| Windows x64 | `Kavvanah-Windows-x64.exe` | Launch the portable EXE. Requires Windows WebView2 runtime; the EXE is unsigned. |
| Linux x64 | `Kavvanah-Linux-x86_64.AppImage` | One AppImage. Mark as executable before running; some distributions need system libraries/FUSE. |
| macOS Intel | `Kavvanah-macOS-x64.zip` | Unzip to obtain one `Kavvanah.app`. Unsigned and not notarized. |
| macOS Apple Silicon | `Kavvanah-macOS-arm64.zip` | Unzip to obtain one `Kavvanah.app`. Unsigned and not notarized. |
| Android | `Kavvanah-Android-universal-debug.apk` | One APK, but Android requires one-time installation. Debug-signed **for testing only**. |

These builds are not independently signed production applications. macOS Gatekeeper and Windows SmartScreen may warn or block unsigned builds. The app packages bundle the static website and included texts rather than fetching the UI from GitHub Pages. Live compass support still requires an available device sensor and the necessary permissions. iPhone/iPad users can install the web app from Safari; this workflow does not create an iOS `.ipa`.

## Development

Requirements: **Node.js 22.13+** and **pnpm 11.25.0**.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

To check and build the project:

```sh
pnpm check
pnpm test
pnpm build
```

The static build is generated in `dist/client/`. A ready-to-host build is included in `web/` when supplied with a release. Serve it over HTTP(S), not by opening `index.html` as a local file. To test a `web/` build locally:

```sh
python3 -m http.server 8080 --directory web
```

[The unified workflow](.github/workflows/pages.yml) deploys the site from `main`. Project Pages hosting requires the path-adaptation step in `scripts/prepare-pages.mjs`. Set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

## Maintenance and licenses

Text importers and reviewed translation mappings live in `scripts/`. After reimporting original editions, run the supplementary importer and then the Toldot importer. Keep paragraph identities stable: personal translations depend on them.

Application code is licensed under **GPL-2.0-only**. Text editions, fonts, and third-party dependencies have their own terms. Preserve [LICENSE](LICENSE), [CONTENT_SOURCES.md](CONTENT_SOURCES.md), and the bundled notices when redistributing.
