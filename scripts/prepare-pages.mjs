import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

// Rebase the *built* static export; leave the root-hosted source unchanged.
const root = path.resolve('dist/client');
const base = '/Kavvanah-Siddur';
const homepage = path.join(root, 'index.html');
await stat(homepage);

async function walk(folder) {
  const files = [];
  for (const name of await readdir(folder)) {
    const file = path.join(folder, name);
    if ((await stat(file)).isDirectory()) files.push(...await walk(file));
    else files.push(file);
  }
  return files;
}

const builtFiles = await walk(root);
// Match only known application assets, never external URLs or downloaded texts.
const assets = /(?<![\w/])\/(?:_next|texts|assets|fonts|icons|licenses)(?=\/)|(?<![\w/])\/(?:manifest\.webmanifest|favicon\.svg|sw\.js|offline-manifest\.json)(?=["'?#/)\\]|$)/g;
for (const file of builtFiles) {
  const name = path.relative(root, file).replaceAll(path.sep, '/');
  if (!/\.(?:html|js|css|rsc)$/.test(name)) continue;
  const original = await readFile(file, 'utf8');
  let updated = original.replace(assets, matched => base + matched);
  if (name === 'sw.js') {
    // The generated worker's navigation fallback and precache use '/'.
    updated = updated.replace(/(["'])\/\1/g, (_match, quote) => quote + base + '/' + quote);
    // Existing domain-root comparisons must be scoped to this project.
    updated = updated.replace("url.pathname==='/sw.js'", "url.pathname==='" + base + "/sw.js'");
    updated = updated.replace("url.pathname==='/offline-manifest.json'", "url.pathname==='" + base + "/offline-manifest.json'");
  }
  if (updated !== original) await writeFile(file, updated);
}

const manifestPath = path.join(root, 'manifest.webmanifest');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const field of ['id', 'start_url', 'scope']) manifest[field] = base + '/';
for (const icon of manifest.icons ?? []) if (icon.src.startsWith('/') && !icon.src.startsWith(base + '/')) icon.src = base + icon.src;
await writeFile(manifestPath, JSON.stringify(manifest));

const offlinePath = path.join(root, 'offline-manifest.json');
const offline = JSON.parse(await readFile(offlinePath, 'utf8'));
offline.urls = offline.urls.map(url => url === '/' ? base + '/' : url.startsWith(base + '/') ? url : base + url);
await writeFile(offlinePath, JSON.stringify(offline));
await writeFile(path.join(root, '.nojekyll'), '');

const html = await readFile(homepage, 'utf8');
if (!html.includes(base + '/_next/')) throw Error('Missing project-prefixed framework assets in index.html');
if (/\b(?:src|href)\s*=\s*["']\/(?!Kavvanah-Siddur\/|\/)/.test(html)) throw Error('Unprefixed root-relative HTML assets remain');
const sw = await readFile(path.join(root, 'sw.js'), 'utf8');
if (!sw.includes(base + '/texts/') || !sw.includes(base + '/')) throw Error('Service worker not rebased');
console.log(`GitHub Pages export ready: ${base}/ (${builtFiles.length} files)`);
