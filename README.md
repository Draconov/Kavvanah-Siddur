# Kavvanah

Installable multilingual Siddur, Tanakh reader, Jewish calendar, prayer times and Jerusalem compass. Supports English, Russian, Ukrainian and Hebrew UI, including RTL, adjustable reading layers and color themes. Siddur translations are still incomplete.

## Development

Requires Node.js 22.13+ and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm test
pnpm build
```

The static build is written to `dist/client/`. A ready-to-host build is included in `web/`. Serve it at the root of an HTTPS website; do not open `index.html` directly as a file. For local testing: `python3 -m http.server 8080 --directory web`.

Install using your browser's Install/Add to Home Screen command. Download all texts from Settings for offline reading. Preferences and personal translations stay on the current device; export personal translations before clearing browser data.

## Maintenance and licenses

Text importers and reviewed translation mappings are in `scripts/`. Run the supplementary importer and then the Toldot importer after reimporting original editions. Do not change paragraph identities: personal translations depend on them.

Code: GPL-2.0-only. Texts, fonts and other dependencies have separate licenses. Keep `CONTENT_SOURCES.md`, `LICENSE`, and the bundled license notices when redistributing.
