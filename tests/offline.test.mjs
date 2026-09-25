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
  await mkdir(path.join(fixture,'dist/client/texts/translations'),{recursive:true});
  for(const file of ['index.html','404.html','_headers','_redirects','texts/ashkenaz.json','texts/translations/en.json','texts/catalog.json','texts/genesis.json','texts/exodus.json'])await writeFile(path.join(fixture,'dist/client',file),file);
  execFileSync(process.execPath,[path.resolve('scripts/finalize-offline.mjs')],{cwd:fixture});
  const manifest=JSON.parse(await readFile(path.join(fixture,'dist/client/offline-manifest.json'),'utf8'));
  assert.ok(!manifest.urls.includes('/_headers'),'hosting headers are not fetchable assets');
  assert.ok(!manifest.urls.includes('/_redirects'),'hosting redirects are not fetchable assets');
  assert.ok(manifest.urls.includes('/texts/exodus.json'));
  const events={},saved=new Map();let network=true,claimed=false;
  const key=v=>typeof v==='string'?v:new URL(v.url).pathname;
  const cache={addAll:async urls=>urls.forEach(url=>saved.set(url,new Response(url))),match:async req=>saved.get(key(req))?.clone(),put:async(req,response)=>saved.set(key(req),response.clone())};
  const context={URL,Response,self:{location:{origin:'https://example.test'},addEventListener:(event,cb)=>events[event]=cb,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}}},caches:{open:async()=>cache,keys:async()=>[manifest.cacheName]},fetch:async req=>{if(!network)throw Error('Offline');return new Response(key(req));}};
  vm.runInNewContext(await readFile(path.join(fixture,'dist/client/sw.js'),'utf8'),context);
  let pending;
  events.install({waitUntil:p=>pending=p});await pending;
  assert.ok(saved.has('/'));assert.ok(saved.has('/texts/ashkenaz.json'));assert.ok(saved.has('/texts/translations/en.json'));
  assert.ok(!saved.has('/texts/exodus.json'),'full library is opt-in');
  events.activate({waitUntil:p=>pending=p});await pending;assert.ok(claimed);
  async function request(url,mode='cors',method='GET'){pending=undefined;events.fetch({request:{url:`https://example.test${url}`,mode,method},respondWith:p=>pending=p});return pending;}
  assert.equal(await (await request('/texts/exodus.json')).text(),'/texts/exodus.json');
  network=false;
  assert.equal(await (await request('/texts/exodus.json')).text(),'/texts/exodus.json');
  assert.equal(await (await request('/','navigate')).text(),'/');
  assert.equal((await request('/texts/missing.json')).type,'error');
  assert.equal(await request('/submit','cors','POST'),undefined);
 } finally {await rm(fixture,{recursive:true,force:true});}
});
