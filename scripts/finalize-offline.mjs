import {readFile,writeFile,readdir,stat,rm,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

const root=path.resolve('dist/client');
// The build first creates small reader-specific editions. Once copied to dist,
// remove redundant canonical corpora from the *distribution only*. Never touch
// public/texts/translations: those are the editable, auditable source of truth.
const optimized=path.join(root,'texts/translations/optimized');
// A reader-capable release must never silently fall back to unsplit assets.
await access(optimized);
{
 const translations=path.join(root,'texts/translations');
 const tanakhSource=path.join(translations,'tanakh');
 const siddurAssets=path.join(optimized,'siddur');
 const tanakhAssets=path.join(optimized,'tanakh');
 const readJson=async file=>JSON.parse(await readFile(file,'utf8'));
 const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const sameAsset=(expected,actual,label)=>assert.equal(fingerprint(actual),fingerprint(expected),`Incomplete or changed reader asset: ${label}`);
 const siddurNames=[];
 const editions=[];
 // Validate *everything* before deleting any canonical distribution files.
 // Missing, stale or altered reader assets must fail the build rather than
 // silently shipping an incomplete offline library.
 for (const lang of ['en','ru','uk']) {
  const full=await readJson(path.join(translations,`${lang}.json`));
  assert.equal(full.schema,1,`Invalid Siddur source schema: ${lang}`);
  assert.equal(full.language,lang,`Invalid Siddur source language: ${lang}`);
  for (const nusach of ['ashkenaz','edot']) {
   assert.ok(full.corpora?.[nusach],`Missing Siddur corpus: ${lang}/${nusach}`);
   const file=`${lang}-${nusach}.json`;
   const actual=await readJson(path.join(siddurAssets,file));
   sameAsset({schema:full.schema,language:full.language,corpora:{[nusach]:full.corpora[nusach]}},actual,file);
   siddurNames.push(file);
  }
 }
 assert.deepEqual((await readdir(siddurAssets)).sort(),siddurNames.sort(),'Unexpected or missing Siddur reader assets');
 const tanakhFiles=(await readdir(tanakhSource)).filter(f=>f.endsWith('.json')).sort();
 for (const file of tanakhFiles) {
  const full=await readJson(path.join(tanakhSource,file));
  if (full.edition==='uk-jewish-modern') continue; // composite is resolved per book
  const edition=file.slice(0,-5);
  assert.equal(full.edition,edition,`Tanakh filename/edition mismatch: ${file}`);
  assert.equal(full.schema,1,`Invalid Tanakh schema: ${edition}`);
  const ids=Object.keys(full.books ?? {}).sort();
  assert.ok(ids.length,`Empty Tanakh translation: ${edition}`);
  const folder=path.join(tanakhAssets,edition);
  assert.deepEqual((await readdir(folder)).sort(),ids.map(id=>`${id}.json`).sort(),`Missing or unexpected books for ${edition}`);
  for (const id of ids) {
   const actual=await readJson(path.join(folder,`${id}.json`));
   sameAsset({schema:full.schema,language:full.language,edition:full.edition,sources:full.sources,books:{[id]:full.books[id]}},actual,`${edition}/${id}`);
  }
  editions.push(edition);
 }
 assert.deepEqual((await readdir(tanakhAssets)).sort(),editions.sort(),'Unexpected or missing Tanakh reader editions');
 console.log(`Reader integrity verified: ${siddurNames.length} Siddur corpora, ${editions.length} Tanakh editions`);
 // Validation succeeded. These removals affect dist/client, NOT public source files.
 for (const file of tanakhFiles) await rm(path.join(tanakhSource,file));
 for (const lang of ['en','ru','uk']) await rm(path.join(translations,`${lang}.json`));
 console.log('Removed redundant canonical translation bundles from dist/client (sources retained)');
}
async function walk(dir){const out=[];for(const name of await readdir(dir)){const p=path.join(dir,name);if((await stat(p)).isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const hostingOnly=new Set(['_headers','_redirects','_routes.json','vinext-client-entry-manifest.json']);
const files=(await walk(root)).filter(f=>!hostingOnly.has(path.relative(root,f))&&!f.endsWith('.map')&&!f.endsWith('/sw.js')&&!f.endsWith('/offline-manifest.json')&&!f.includes('/.vite/')&&!f.endsWith('.br')&&!f.endsWith('.gz'));
const digest=createHash('sha256');for(const file of files.sort()){digest.update(path.relative(root,file));digest.update(await readFile(file));}
const revision=digest.digest('hex').slice(0,12),cacheName=`kavvanah-${revision}`;
const urls=['/',...files.map(f=>'/'+path.relative(root,f).split(path.sep).join('/')).filter(f=>f!=='/index.html'&&!f.endsWith('.rsc'))];
const shell=urls.filter(url=>!url.startsWith('/texts/')||['/texts/ashkenaz.json','/texts/edot.json','/texts/translations/en.json','/texts/translations/optimized/siddur/en-ashkenaz.json','/texts/translations/optimized/siddur/en-edot.json','/texts/catalog.json','/texts/genesis.json'].includes(url));
const manifest={revision,cacheName,urls};
const sw=`/* Generated from the verified production assets. */
const CACHE=${JSON.stringify(cacheName)};
const SHELL=${JSON.stringify(shell)};
const AVAILABLE_TEXTS=new Set(${JSON.stringify(urls.filter(url=>url.startsWith('/texts/')))});
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(SHELL);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys()){if(key.startsWith('kavvanah-')&&key!==CACHE){const old=await caches.open(key);const current=await caches.open(CACHE);for(const req of await old.keys()){if(AVAILABLE_TEXTS.has(new URL(req.url).pathname)&&!await current.match(req)){ try{const response=await fetch(req);if(response.ok)await current.put(req,response);}catch{const response=await old.match(req);if(response)await current.put(req,response);}}}await caches.delete(key);}}await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname==='/sw.js'||url.pathname==='/offline-manifest.json')return;
event.respondWith((async()=>{const cache=await caches.open(CACHE);if(req.mode==='navigate'){try{const response=await fetch(req);if(response.ok)await cache.put('/',response.clone());return response;}catch{return (await cache.match('/'))||Response.error();}}
const hit=await cache.match(req);if(hit)return hit;try{const response=await fetch(req);if(response.ok&&(url.pathname.startsWith('/texts/')||url.pathname.startsWith('/assets/')||url.pathname.startsWith('/fonts/')||url.pathname.startsWith('/_next/')))await cache.put(req,response.clone());return response;}catch{return Response.error();}})());});
`;
await writeFile(`${root}/sw.js`,sw);await writeFile(`${root}/offline-manifest.json`,JSON.stringify(manifest));
console.log(`Offline manifest: ${urls.length} assets, ${shell.length} automatic shell assets, revision ${revision}`);
