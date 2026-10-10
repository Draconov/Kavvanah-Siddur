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
| **Read the Tanakh** | Browse the included books and chapters, choose a preferred translation edition per language, and keep personal reading progress. |
| **Stay in rhythm** | View the Jewish calendar, local prayer times, and the direction to Jerusalem. |
| **Make it yours** | Adjust your themes, accent colors, and text preferences. |
| **Take it offline** | Install the web app and download the included texts, or use a native app with its web resources bundled locally. |

> **Content note:** Ukrainian, Russian and English Siddur translations are fully populated for both traditions (19,839 / 19,839 fields). The project owner reports completing manual proofreading. Field coverage and owner review are not independent specialist certification.

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
pnpm run test:smoke # dependency-free version, reader, offline and edition smoke tests
pnpm check
pnpm test
pnpm build
```

### Fast reader assets and validation

The Hebrew books and the **canonical** translation bundles remain in
`public/texts/`. On `pnpm dev` and `pnpm build`, the build automatically runs
`scripts/prepare-reader-assets.mjs` to generate reader-only files:

- Siddur downloads just one language and tradition (for example, `en-ashkenaz.json`), not both traditions.
- Tanakh downloads one book of the selected translation edition, not all 39 books.
- The Ukrainian Jewish Modern preset is already resolved into Varda/Turkonjak components, so no duplicate composite payload is shipped.
- Loaded JSON is reused in a bounded memory cache. Failed requests are retried and changing the active prayer does not reload the Siddur.

The generated `public/texts/translations/optimized/` directory is ignored by
Git and should never be committed. The release packager removes redundant
full-translation JSON **only from `dist/client`**; the canonical originals
remain untouched for imports, editorial work, full-corpus regression tests,
and translation attribution. The installable offline library includes the
optimized per-book assets. The initial offline shell includes both Ashkenaz
and Edot Hebrew texts and English translations; additional books and
translation languages can be saved for offline use from Settings.

To run optional validation locally:

```sh
python3 scripts/validate-siddur-translations.py
python3 -m unittest discover -s tests -p 'test_*.py'
pnpm test
pnpm check
```

The main release workflow deliberately avoids an extra audit job:
it runs one dependency-free release smoke suite, installs the pinned dependencies, builds the
website, and checks the reader assets before handing the same build to
GitHub Pages and native-platform jobs. The offline finalizer compares generated
reader JSON against every canonical source **before** removing any redundant
translation bundles from the distribution. Run the full tests above before
publishing large content changes. A complete field count confirms coverage and file
structure, not independent linguistic certification.

The static build is generated in `dist/client/`; generated website output is not committed to the repository. Serve `dist/client/` over HTTP(S) when testing a production build locally.

```sh
python3 -m http.server 8080 --directory dist/client
```

`VERSION` is the only release-version source. Change that file (for example from `1.0.0` to `1.1.0`) and the build synchronizes the semver fields required by npm, Tauri, Cargo, and Android. Do not maintain release numbers separately in those generated/tooling fields.

[The unified workflow](.github/workflows/pages.yml) deploys the site from `main`. Project Pages hosting requires the path-adaptation step in `scripts/prepare-pages.mjs`. Set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

## Maintenance and licenses

Hebrew Siddur structure lives in `public/texts/ashkenaz.json` and `public/texts/edot.json`. Siddur translations are stored once per language in `public/texts/translations/en.json`, `ru.json`, and `uk.json`; the build creates smaller per-tradition runtime bundles from these sources. Tanakh edition preferences are data-driven by `lib/siddur/translation-editions.ts`, so additional edition files can be added without redesigning Settings. Ukrainian Ohiienko 1962 and Kulish–Puluj are bundled as complete standalone edition files. The Jewish-modern default is a composite preset: the complete supplied Varda Books PDF provides Genesis through Deuteronomy (5,846 Torah verses), while Turkonjak UTT supplies Nevi’im/Ketuvim. Per-record edition metadata preserves the real source and keeps any explicit Turkonjak/Ohiienko fallback provenance distinct from Varda. Run `python3 scripts/validate-siddur-translations.py` after text maintenance, or add `--audit-uk` for a live Ukrainian translation-quality report. Tanakh importers and the small Tanakh-only supplement remain in `scripts/`. Keep section and paragraph order stable: personal translations depend on those identities.

Application code is licensed under **GPL-2.0-only**. Text editions, fonts, and third-party dependencies have their own terms. Preserve [LICENSE](LICENSE), [CONTENT_SOURCES.md](CONTENT_SOURCES.md), and the bundled notices when redistributing.
