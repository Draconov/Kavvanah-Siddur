<div align="center">

<a href="https://draconov.github.io/Kavvanah-Siddur/">
  <img src="public/icons/icon-512.png" width="124" height="124" alt="Kavvanah app icon" />
</a>

# Kavvanah · כַּוָּנָה

**A siddur for thoughtful, everyday prayer.**

Read Hebrew prayers alongside transliteration and translation, explore the Tanakh, follow the Jewish calendar, and find prayer times for your location—all in one installable web app.

[**Open Kavvanah ↗**](https://draconov.github.io/Kavvanah-Siddur/) &nbsp;·&nbsp; [Source code](https://github.com/Draconov/Kavvanah-Siddur) &nbsp;·&nbsp; [Content sources](CONTENT_SOURCES.md)

</div>

---

## What you can do

| | |
| :-- | :-- |
| **Pray your way** | Switch between Hebrew, transliteration, translation, or all reading layers. Choose your preferred prayer tradition and pronunciation aid. |
| **Read the Tanakh** | Browse the included books and chapters, with personal reading progress. |
| **Stay in rhythm** | View the Jewish calendar, local prayer times, and the direction to Jerusalem. |
| **Make it yours** | Adjust your themes, accent colors, and text preferences. |
| **Take it offline** | Install the site as a web app and download the included texts for offline reading. |

> **Content note:** Siddur translations are still incomplete. Available text and translations depend on their source editions; see [Content sources](CONTENT_SOURCES.md) for attribution and coverage.

## Open or install

**[Launch the online siddur →](https://draconov.github.io/Kavvanah-Siddur/)**

Open the site in a supported browser and use its **Install app** or **Add to Home Screen** option if available. In the app, open **Settings → Download all texts for offline use** to prepare an offline library.

Preferences and personal translations are saved on your current device. Export a backup of your personal translations from Settings before clearing browser storage or changing devices.


### Native preview builds

GitHub Actions offers manually triggered **Android APK preview** and **Windows EXE preview** workflows. Open the repository’s **Actions** tab, select a preview workflow, and choose **Run workflow**. Once a successful run finishes, download the artifact from its run page. These packages are *test builds*, not release-signed or store-distributed apps; Windows may warn about unsigned installers. The APK uses a debug signing key, so keep it out of a stable GitHub Release.

Both wrappers embed the static website and text files in the application rather than opening GitHub Pages. The live compass still requires a compatible, permitted orientation sensor. Official signed builds and macOS/Linux packaging can follow device testing and signing setup.

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

The [GitHub Pages workflow](.github/workflows/pages.yml) builds and deploys the site from `main`. Project Pages hosting requires the included path-adaptation step in `scripts/prepare-pages.mjs`.

## Maintenance and licenses

Text importers and reviewed translation mappings live in `scripts/`. After reimporting original editions, run the supplementary importer and then the Toldot importer. Keep paragraph identities stable: personal translations depend on them.

Application code is licensed under **GPL-2.0-only**. Text editions, fonts, and third-party dependencies have their own terms. Preserve [LICENSE](LICENSE), [CONTENT_SOURCES.md](CONTENT_SOURCES.md), and the bundled notices when redistributing.
