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

### Downloadable releases

Every update to `main` builds the website and native packages. GitHub publishes a normal release using the version in the root `VERSION` file. Rebuilding the same version replaces that version’s previous release and assets in place.

<p>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/releases"><img alt="Windows downloads" src="https://img.shields.io/badge/Windows-EXE-0078D4?style=for-the-badge&logo=windows11&logoColor=white" /></a>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/releases"><img alt="Android downloads" src="https://img.shields.io/badge/Android-APK-3DDC84?style=for-the-badge&logo=android&logoColor=black" /></a>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/releases"><img alt="Linux downloads" src="https://img.shields.io/badge/Linux-AppImage-FCC624?style=for-the-badge&logo=linux&logoColor=black" /></a>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/releases"><img alt="macOS downloads" src="https://img.shields.io/badge/macOS-APP-5C5C5C?style=for-the-badge&logo=apple&logoColor=white" /></a>
</p>
<p>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/actions/workflows/pages.yml"><img alt="View build and deployment workflow" src="https://img.shields.io/badge/View-Build%20status-71614C?style=flat-square&logo=githubactions&logoColor=white" /></a>
  <a href="https://github.com/Draconov/Kavvanah-Siddur/releases"><img alt="Browse all releases" src="https://img.shields.io/badge/Browse-All%20releases-152443?style=flat-square&logo=github&logoColor=white" /></a>
</p>

| Platform | Package | Installation and limitations |
| :-- | :-- | :-- |
| Windows x64 | `Kavvanah-Windows-x64.exe` | Launch the portable EXE. Requires Windows WebView2 runtime; the EXE is unsigned. |
| Linux x64 | `Kavvanah-Linux-x86_64.AppImage` | One AppImage. Mark as executable before running; some distributions need system libraries/FUSE. |
| macOS Intel | `Kavvanah-macOS-x64.zip` | Unzip to obtain one `Kavvanah.app`. Unsigned and not notarized. |
| macOS Apple Silicon | `Kavvanah-macOS-arm64.zip` | Unzip to obtain one `Kavvanah.app`. Unsigned and not notarized. |
| Android | `Kavvanah-Android-universal.apk` | Release-mode universal APK. CI signs it for direct installation; the CI key is not a store-distribution signing key. |

Windows and macOS packages are not code-signed/notarized, so Windows SmartScreen or macOS Gatekeeper may warn or block them. The app packages bundle the static website and included texts rather than fetching the UI from GitHub Pages. Live compass support still requires an available device sensor and the necessary permissions. iPhone/iPad users can install the web app from Safari; this workflow does not create an iOS `.ipa`.

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

The static build is generated in `dist/client/`; generated website output is not committed to the repository. Serve `dist/client/` over HTTP(S) when testing a production build locally.

```sh
python3 -m http.server 8080 --directory dist/client
```

`VERSION` is the only release-version source. Change that file (for example from `1.0.0` to `1.1.0`) and the build synchronizes the semver fields required by npm, Tauri, Cargo, and Android. Do not maintain release numbers separately in those generated/tooling fields.

[The unified workflow](.github/workflows/pages.yml) deploys the site from `main`. Project Pages hosting requires the path-adaptation step in `scripts/prepare-pages.mjs`. Set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

## Maintenance and licenses

Hebrew Siddur structure lives in `public/texts/ashkenaz.json` and `public/texts/edot.json`. Siddur translations are stored once per language in `public/texts/translations/en.json`, `ru.json`, and `uk.json`; the app joins the selected language at runtime. Run `python3 scripts/validate-siddur-translations.py` after text maintenance. Tanakh importers and the small Tanakh-only supplement remain in `scripts/`. Keep section and paragraph order stable: personal translations depend on those identities.

Application code is licensed under **GPL-2.0-only**. Text editions, fonts, and third-party dependencies have their own terms. Preserve [LICENSE](LICENSE), [CONTENT_SOURCES.md](CONTENT_SOURCES.md), and the bundled notices when redistributing.
