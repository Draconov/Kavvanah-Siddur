import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

test('offline build excludes hosting-only files and serves cached pages and texts',async()=>{
 const fixture=await mkdtemp(path.join(tmpdir(),'kavvanah-offline-test-'));
 try {
  const root=path.join(fixture,'dist/client');
  await mkdir(path.join(root,'texts/translations/tanakh'),{recursive:true});
  for(const file of ['index.html','404.html','_headers','_redirects'])await writeFile(path.join(root,file),file);
  for(const nusach of ['ashkenaz','edot'])await writeFile(path.join(root,`texts/${nusach}.json`),JSON.stringify({title:nusach,nusach,sources:[],sections:[{id:'s1',title:'Shema',heTitle:'שמע',category:'Morning',service:'Shacharit',path:['Morning','Shema'],ref:'Shema',paragraphs:[{he:'שמע'}]}]}));
  await writeFile(path.join(root,'texts/catalog.json'),JSON.stringify({books:[{id:'genesis'},{id:'exodus'}]}));
  for(const id of ['genesis','exodus'])await writeFile(path.join(root,`texts/${id}.json`),JSON.stringify({id,title:id,heTitle:id,category:'Torah',chapters:1,sources:[],text:[[{he:id,en:id,ru:id,uk:id}]]}));
  for(const language of ['en','ru','uk']){
   const corpus={sources:[],sections:{s1:{sourceHash:'0123456789abcdef',paragraphs:[language]}}};
   await writeFile(path.join(root,`texts/translations/${language}.json`),JSON.stringify({schema:1,language,corpora:{ashkenaz:corpus,edot:corpus}}));
  }
  await writeFile(path.join(root,'texts/translations/tanakh/uk-varda-torah.json'),JSON.stringify({schema:1,language:'uk',edition:'uk-varda-torah',sources:[],books:{genesis:{chapters:[['verse']]}}}));
  execFileSync(process.execPath,[path.resolve('scripts/prepare-reader-assets.mjs'),path.join(root,'texts/translations'),path.join(root,'texts/translations/optimized')]);
  execFileSync(process.execPath,[path.resolve('scripts/prepare-tanakh-chapters.mjs'),path.join(root,'texts'),path.join(root,'texts/optimized/tanakh')]);
  execFileSync(process.execPath,[path.resolve('scripts/prepare-siddur-categories.mjs'),path.join(root,'texts'),path.join(root,'texts/translations'),path.join(root,'texts/optimized/siddur'),path.join(root,'texts/translations/optimized/siddur-categories')]);
  execFileSync(process.execPath,[path.resolve('scripts/finalize-offline.mjs')],{cwd:fixture});
  const manifest=JSON.parse(await readFile(path.join(fixture,'dist/client/offline-manifest.json'),'utf8'));
  assert.ok(!manifest.urls.includes('/_headers'),'hosting headers are not fetchable assets');
  assert.ok(!manifest.urls.includes('/_redirects'),'hosting redirects are not fetchable assets');
  assert.ok(manifest.urls.includes('/texts/optimized/tanakh/exodus/1.json'));
  assert.ok(!manifest.urls.includes('/texts/exodus.json'));
  assert.ok(manifest.hashes['/texts/optimized/tanakh/exodus/1.json']);
  const events={},saved=new Map(),oldSaved=new Map();let network=true,claimed=false,networkRequests=0;
  const key=v=>typeof v==='string'?v:new URL(v.url).pathname;
  const cache={addAll:async urls=>urls.forEach(url=>saved.set(url,new Response(url))),match:async req=>saved.get(key(req))?.clone(),put:async(req,response)=>saved.set(key(req),response.clone())};
  const older={keys:async()=>[...oldSaved.keys()].filter(url=>url.startsWith('/texts/')).map(url=>({url:'https://example.test'+url})),match:async req=>oldSaved.get(key(req))?.clone()};
  const context={URL,Response,self:{location:{origin:'https://example.test'},addEventListener:(event,cb)=>events[event]=cb,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}}},caches:{open:async name=>name===manifest.cacheName?cache:older,keys:async()=>[manifest.cacheName,'kavvanah-old'],delete:async()=>true},fetch:async req=>{networkRequests++;if(!network)throw Error('Offline');return new Response(key(req));}};
  vm.runInNewContext(await readFile(path.join(fixture,'dist/client/sw.js'),'utf8'),context);
  let pending;
  events.install({waitUntil:p=>pending=p});await pending;
  assert.ok(saved.has('/'));assert.ok(saved.has('/texts/optimized/siddur/ashkenaz/index.json'));assert.ok(saved.has('/texts/optimized/siddur/edot/index.json'));assert.ok(saved.has('/texts/translations/optimized/siddur-categories/en/ashkenaz/morning.json'));assert.ok(saved.has('/texts/translations/optimized/siddur-categories/en/edot/morning.json'));assert.ok(!saved.has('/texts/translations/en.json'));
  assert.ok(!saved.has('/texts/optimized/tanakh/exodus/1.json'),'full library is opt-in');
  const retained='/texts/optimized/tanakh/exodus/1.json';
  const changed='/texts/translations/optimized/siddur-categories/ru/ashkenaz/morning.json';
  oldSaved.set('/__kavvanah-cache-integrity',new Response(JSON.stringify({[retained]:manifest.hashes[retained],[changed]:'stale-checksum'})));
  oldSaved.set(retained,new Response('verified-previous-chapter'));
  oldSaved.set(changed,new Response('obsolete translation'));
  // Service-worker activation must not trigger network requests, and must
  // carry forward only content with a matching immutable checksum.
  network=false;
  events.activate({waitUntil:p=>pending=p});await pending;assert.ok(claimed);
  assert.equal(networkRequests,0);
  assert.equal(await saved.get(retained).clone().text(),'verified-previous-chapter');
  assert.equal(saved.has(changed),false);
  async function request(url,mode='cors',method='GET'){pending=undefined;events.fetch({request:{url:`https://example.test${url}`,mode,method},respondWith:p=>pending=p});return pending;}
  assert.equal(await (await request('/texts/optimized/tanakh/exodus/1.json')).text(),'verified-previous-chapter');
  assert.equal(await (await request('/texts/optimized/tanakh/exodus/1.json')).text(),'verified-previous-chapter');
  assert.equal(await (await request('/','navigate')).text(),'/');
  assert.equal((await request('/texts/missing.json')).type,'error');
  assert.equal(await request('/submit','cors','POST'),undefined);
  // The same release is deployed under /Kavvanah-Siddur on GitHub Pages.
  await writeFile(path.join(root,'manifest.webmanifest'),JSON.stringify({id:'/',start_url:'/',scope:'/',icons:[]}));
  await writeFile(path.join(root,'index.html'),'<html><script src="/_next/static/entry.js"></script></html>');
  execFileSync(process.execPath,[path.resolve('scripts/prepare-pages.mjs')],{cwd:fixture});
  assert.match(await readFile(path.join(root,'index.html'),'utf8'),/Kavvanah-Siddur\/_next\/static/);
  const pagesSW=await readFile(path.join(root,'sw.js'),'utf8');
  assert.match(pagesSW,/Kavvanah-Siddur\/texts\/translations\/optimized\/siddur-categories\/en\/edot\/morning/);
  const pagesManifest=JSON.parse(await readFile(path.join(root,'offline-manifest.json'),'utf8'));
  assert.ok(pagesManifest.urls.includes('/Kavvanah-Siddur/texts/optimized/siddur/edot/index.json'));
  assert.ok(pagesManifest.urls.includes('/Kavvanah-Siddur/'));
  assert.ok(pagesManifest.hashes['/Kavvanah-Siddur/texts/optimized/tanakh/exodus/1.json']);
  assert.equal(await readFile(path.join(root,'.nojekyll'),'utf8'),'');
 } finally {await rm(fixture,{recursive:true,force:true});}
});
