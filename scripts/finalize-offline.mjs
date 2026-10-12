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
 const chapterAssets=path.join(optimized,'tanakh-chapters');
 const siddurChunks=path.join(root,'texts/optimized/siddur');
 const siddurTranslations=path.join(optimized,'siddur-categories');
 const hebrewChapters=path.join(root,'texts/optimized/tanakh');
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
 // Verify the smaller index/category assets are a lossless partition of each
 // source prayer corpus. Check language records against their own source files.
 for(const nusach of ['ashkenaz','edot']){
  const base=await readJson(path.join(root,'texts',`${nusach}.json`));
  assert.equal(base.nusach,nusach);
  const categories=[...new Set(base.sections.map(section=>section.category))];
  const index=await readJson(path.join(siddurChunks,nusach,'index.json'));
  sameAsset({...base,sections:base.sections.map(s=>({...s,paragraphs:[]}))},index,`${nusach} index`);
  assert.deepEqual((await readdir(path.join(siddurChunks,nusach))).sort(),['index.json',...categories.map(c=>`${c.toLowerCase()}.json`)].sort(),`${nusach} category list`);
  for(const category of categories){
   const selected=base.sections.filter(s=>s.category===category),slug=category.toLowerCase();
   const chunk=await readJson(path.join(siddurChunks,nusach,`${slug}.json`));
   sameAsset({...base,sections:selected},chunk,`${nusach}/${category}`);
   for(const lang of ['en','ru','uk']){
    const full=await readJson(path.join(translations,`${lang}.json`));
    const corpus=full.corpora[nusach];
    const mapped=Object.fromEntries(selected.filter(s=>corpus.sections[s.id]).map(s=>[s.id,corpus.sections[s.id]]));
    const actual=await readJson(path.join(siddurTranslations,lang,nusach,`${slug}.json`));
    sameAsset({schema:full.schema,language:full.language,corpora:{[nusach]:{sources:corpus.sources,sections:mapped}}},actual,`${lang}/${nusach}/${category}`);
   }
  }
 }

 const tanakhFiles=(await readdir(tanakhSource)).filter(f=>f.endsWith('.json')).sort();
 for (const file of tanakhFiles) {
  const full=await readJson(path.join(tanakhSource,file));
  if (full.edition==='uk-jewish-modern') continue; // composite is resolved per book
  const edition=file.slice(0,-5);
  assert.equal(full.edition,edition,`Tanakh filename/edition mismatch: ${file}`);
  assert.equal(full.schema,1,`Invalid Tanakh schema: ${edition}`);
  const ids=Object.keys(full.books ?? {}).sort();
  assert.ok(ids.length,`Empty Tanakh translation: ${edition}`);
  for(const id of ids){
   const book=full.books[id];
   const chapterDir=path.join(chapterAssets,edition,id);
   assert.deepEqual((await readdir(chapterDir)).sort(),book.chapters.map((_,i)=>`${i+1}.json`).sort(),`Incorrect translated chapters: ${edition}/${id}`);
   for(let i=0;i<book.chapters.length;i++){
    const actual=await readJson(path.join(chapterDir,`${i+1}.json`));
    sameAsset({schema:full.schema,language:full.language,edition:full.edition,sources:full.sources,books:{[id]:{chapters:[book.chapters[i]]}}},actual,`${edition}/${id}:${i+1}`);
   }
  }
  editions.push(edition);
 }
 assert.deepEqual((await readdir(chapterAssets)).sort(),editions.sort(),'Unexpected or missing Tanakh chapter editions');
 const catalog=await readJson(path.join(root,'texts/catalog.json'));
 // Only split actual canonical books; fixture catalogs may not enumerate books.
 const originals=(await readdir(path.join(root,'texts'))).filter(f=>/^[a-z-]+\.json$/.test(f)&&!['ashkenaz.json','edot.json','catalog.json'].includes(f));
 const countByBook=new Map();
 for(const file of originals){
  const base=await readJson(path.join(root,'texts',file));
  assert.equal(base.id,file.slice(0,-5));
  assert.equal(base.chapters,base.text.length);
  const folder=path.join(hebrewChapters,base.id);
  assert.deepEqual((await readdir(folder)).sort(),base.text.map((_,i)=>`${i+1}.json`).sort(),`Incorrect Hebrew chapters: ${base.id}`);
  for(let i=0;i<base.text.length;i++){
   const actual=await readJson(path.join(folder,`${i+1}.json`));
   sameAsset({...base,chapter:i+1,text:[base.text[i]]},actual,`${base.id}:${i+1}`);
  }
  countByBook.set(base.id,base.chapters);
 }
 // Full production data has its canonical catalog; check it wasn't split partially.
 if(Array.isArray(catalog.books))assert.deepEqual([...countByBook.keys()].sort(),catalog.books.map(b=>b.id).sort(),'Hebrew chapter catalog mismatch');
 console.log(`Reader integrity verified: ${siddurNames.length} Siddur corpora, ${editions.length} Tanakh editions`);
 // Validation succeeded. These removals affect dist/client, NOT public source files.
 for (const file of tanakhFiles) await rm(path.join(tanakhSource,file));
 for (const file of originals) await rm(path.join(root,'texts',file));
 for (const lang of ['en','ru','uk']) await rm(path.join(translations,`${lang}.json`));
 for (const nusach of ['ashkenaz','edot']) await rm(path.join(root,'texts',`${nusach}.json`));
 await rm(siddurAssets,{recursive:true,force:true});
 console.log('Removed redundant canonical translation bundles from dist/client (sources retained)');
}
async function walk(dir){const out=[];for(const name of await readdir(dir)){const p=path.join(dir,name);if((await stat(p)).isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const hostingOnly=new Set(['_headers','_redirects','_routes.json','vinext-client-entry-manifest.json']);
const files=(await walk(root)).filter(f=>!hostingOnly.has(path.relative(root,f))&&!f.endsWith('.map')&&!f.endsWith('/sw.js')&&!f.endsWith('/offline-manifest.json')&&!f.includes('/.vite/')&&!f.endsWith('.br')&&!f.endsWith('.gz'));
const digest=createHash('sha256'),assetHashes={};
for(const file of files.sort()){
 const relative='/'+path.relative(root,file).split(path.sep).join('/');
 const bytes=await readFile(file);
 digest.update(relative);digest.update(bytes);
 if(relative.startsWith('/texts/')) assetHashes[relative]=createHash('sha256').update(bytes).digest('hex').slice(0,24);
}
const revision=digest.digest('hex').slice(0,12),cacheName=`kavvanah-${revision}`;
const urls=['/',...files.map(f=>'/'+path.relative(root,f).split(path.sep).join('/')).filter(f=>f!=='/index.html'&&!f.endsWith('.rsc'))];
const shell=urls.filter(url=>!url.startsWith('/texts/')||['/texts/optimized/siddur/ashkenaz/index.json','/texts/optimized/siddur/edot/index.json','/texts/optimized/siddur/ashkenaz/morning.json','/texts/optimized/siddur/edot/morning.json','/texts/translations/optimized/siddur-categories/en/ashkenaz/morning.json','/texts/translations/optimized/siddur-categories/en/edot/morning.json','/texts/catalog.json','/texts/optimized/tanakh/genesis/1.json'].includes(url));
const manifest={revision,cacheName,urls,hashes:assetHashes};
const sw=`/* Generated from verified production assets: offline and update safe. */
const CACHE=${JSON.stringify(cacheName)};
const SHELL=${JSON.stringify(shell)};
const HASHES=${JSON.stringify(assetHashes)};
const AVAILABLE_TEXTS=new Set(${JSON.stringify(urls.filter(url=>url.startsWith('/texts/')))});
const META='/__kavvanah-cache-integrity';
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(SHELL);
 await cache.put(META,new Response(JSON.stringify(HASHES)));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const current=await caches.open(CACHE);
 for(const key of await caches.keys()){
  if(!key.startsWith('kavvanah-')||key===CACHE)continue;
  const old=await caches.open(key);
  try{
   const metadata=await old.match(META);
   const oldHashes=metadata?await metadata.json():{};
   // Copy only byte-identical verified texts. No network requests during update.
   for(const request of await old.keys()){
    const url=new URL(request.url).pathname;
    if(!AVAILABLE_TEXTS.has(url)||!HASHES[url]||HASHES[url]!==oldHashes[url]||await current.match(request))continue;
    const response=await old.match(request);
    if(response)await current.put(request,response);
   }
   await caches.delete(key);
  }catch(error){console.warn('Retaining previous offline cache after migration error',error);}
 }
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname==='/sw.js'||url.pathname==='/offline-manifest.json')return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(req.mode==='navigate'){
   try{const response=await fetch(req);if(response.ok)await cache.put('/',response.clone());return response;}
   catch{return (await cache.match('/'))||Response.error();}
  }
  const hit=await cache.match(req);if(hit)return hit;
  try{
   const response=await fetch(req);
   if(response.ok&&(url.pathname.startsWith('/texts/')||url.pathname.startsWith('/assets/')||url.pathname.startsWith('/fonts/')||url.pathname.startsWith('/_next/')))await cache.put(req,response.clone());
   return response;
  }catch{return Response.error();}
 })());
});
`;
await writeFile(`${root}/sw.js`,sw);await writeFile(`${root}/offline-manifest.json`,JSON.stringify(manifest));
console.log(`Offline manifest: ${urls.length} assets, ${shell.length} automatic shell assets, revision ${revision}`);
