import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadReaderJson, siddurReaderPath, tanakhReaderPath } from '../lib/siddur/text-loading.ts';

const base = { schema: 1, sources: [{ title: 'test', language: 'uk' }] };
test('reader asset compiler splits corpora and books with zero translation changes', async () => {
 const temp = await mkdtemp(path.join(tmpdir(),'kav-readers-'));
 try {
  await mkdir(path.join(temp,'tanakh'),{recursive:true});
  for (const language of ['en','ru','uk']) {
   await writeFile(path.join(temp,`${language}.json`),JSON.stringify({schema:1,language,corpora:{ashkenaz:{sources:[],sections:{a:{sourceHash:'abc',paragraphs:['Text a']}}},edot:{sources:[],sections:{b:{sourceHash:'def',paragraphs:['Text b']}}}}}));
  }
  await writeFile(path.join(temp,'tanakh','uk-jewish-modern.json'),JSON.stringify({...base,language:'uk',edition:'uk-jewish-modern',books:{genesis:{chapters:[['combined']]}}}));
  await writeFile(path.join(temp,'tanakh','uk-test.json'),JSON.stringify({...base,language:'uk',edition:'uk-test',books:{genesis:{chapters:[['first']]},exodus:{chapters:[['second']]}}}));
  const output=path.join(temp,'optimized');
  const script=path.resolve('scripts/prepare-reader-assets.mjs');
  execFileSync(process.execPath,[script,temp,output]);
  const en=JSON.parse(await readFile(path.join(output,'siddur/en-ashkenaz.json'),'utf8'));
  assert.deepEqual(Object.keys(en.corpora),['ashkenaz']);
  assert.equal(en.corpora.ashkenaz.sections.a.paragraphs[0],'Text a');
  const exodus=JSON.parse(await readFile(path.join(output,'tanakh/uk-test/exodus.json'),'utf8'));
  assert.equal(exodus.books.exodus.chapters[0][0],'second');
  assert.deepEqual(Object.keys(exodus.books),['exodus']);
  assert.equal(exodus.sources[0].title,'test');
  assert.equal((await readdir(path.join(output,'siddur'))).length,6);
  assert.equal((await readdir(path.join(output,'tanakh/uk-test'))).length,2);
  // Canonical JSON sources must never be destroyed or rewritten by generation.
  assert.equal((await readdir(path.join(temp,'tanakh'))).length,2);
  assert.deepEqual(await readdir(path.join(output,'tanakh')),['uk-test'],'composite bundle is not shipped twice');
 } finally { await rm(temp,{recursive:true,force:true}); }
});

test('failed regeneration preserves the last complete reader assets',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'kav-reader-rollback-'));
 try {
  const source=path.join(temp,'translations'),output=path.join(source,'optimized');
  await mkdir(path.join(source,'tanakh'),{recursive:true});
  await mkdir(output,{recursive:true});
  await writeFile(path.join(output,'previous.json'),'do not lose me');
  for(const language of ['en','ru','uk']){
   await writeFile(path.join(source,`${language}.json`),JSON.stringify({schema:1,language,corpora:{ashkenaz:{},edot:{}}}));
  }
  await writeFile(path.join(source,'ru.json'),'{broken');
  assert.throws(()=>execFileSync(process.execPath,[path.resolve('scripts/prepare-reader-assets.mjs'),source,output],{stdio:'pipe'}),/Command failed/);
  assert.equal(await readFile(path.join(output,'previous.json'),'utf8'),'do not lose me');
  await assert.rejects(stat(`${output}.staging`));
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('reader URL builders use per-book, per-tradition paths',()=>{
 assert.equal(siddurReaderPath('uk','edot'),'/texts/translations/optimized/siddur/uk-edot.json');
 assert.equal(tanakhReaderPath('uk-varda-torah','genesis'),'/texts/translations/optimized/tanakh/uk-varda-torah/genesis.json');
 assert.throws(()=>tanakhReaderPath('../secret','genesis'),/Invalid/);
});

test('reader fetch cache shares pending requests and reuses resolved results',async()=>{
 const previous=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({content:'hello'})};};
 try {
  const first=loadReaderJson('/fixture-shared.json');
  const second=loadReaderJson('/fixture-shared.json');
  assert.strictEqual(first,second);
  assert.deepEqual(await first,{content:'hello'});
  assert.deepEqual(await loadReaderJson('/fixture-shared.json'),{content:'hello'});
  assert.equal(calls,1);
 } finally {globalThis.fetch=previous;}
});

test('failed requests are evicted so Retry fetches again',async()=>{
 const previous=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async()=>{calls++;return {ok:calls>1,status:503,json:async()=>({fixed:true})};};
 try {
  await assert.rejects(loadReaderJson('/fixture-retry.json'),/Unable to load/);
  assert.deepEqual(await loadReaderJson('/fixture-retry.json'),{fixed:true});
  assert.equal(calls,2);
 } finally {globalThis.fetch=previous;}
});


// Minimal, valid source corpus for exercising the same pipeline used by CI.
async function makeOfflineFixture(folder) {
 const root=path.join(folder,'dist/client');
 const save=async(relative,value)=>{
  const file=path.join(root,relative);
  await mkdir(path.dirname(file),{recursive:true});
  await writeFile(file,typeof value==='string'?value:JSON.stringify(value));
 };
 for(const file of ['index.html','texts/catalog.json','texts/ashkenaz.json','texts/edot.json','texts/genesis.json']) await save(file,'{}');
 for(const language of ['en','ru','uk']){
  const corpus=nusach=>({sources:[],sections:{p1:{sourceHash:'0123456789abcdef',paragraphs:[`${language}-${nusach}`]}}});
  await save(`texts/translations/${language}.json`,{schema:1,language,corpora:{ashkenaz:corpus('ashkenaz'),edot:corpus('edot')}});
 }
 const book={chapters:[['A chapter']]};
 const base={schema:1,language:'uk',sources:[],books:{genesis:book}};
 await save('texts/translations/tanakh/uk-varda-torah.json',{...base,edition:'uk-varda-torah'});
 await save('texts/translations/tanakh/uk-jewish-modern.json',{...base,edition:'uk-jewish-modern'});
 execFileSync(process.execPath,[path.resolve('scripts/prepare-reader-assets.mjs'),path.join(root,'texts/translations'),path.join(root,'texts/translations/optimized')]);
 return {root,save};
}

test('offline packager verifies book and Siddur parity before dropping canonical dist copies',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'kav-dist-'));
 try {
  const {root}=await makeOfflineFixture(folder);
  execFileSync(process.execPath,[path.resolve('scripts/finalize-offline.mjs')],{cwd:folder});
  const manifest=JSON.parse(await readFile(path.join(root,'offline-manifest.json'),'utf8'));
  assert.ok(manifest.urls.includes('/texts/translations/optimized/tanakh/uk-varda-torah/genesis.json'));
  assert.ok(manifest.urls.includes('/texts/translations/optimized/siddur/en-ashkenaz.json'));
  assert.ok(manifest.urls.includes('/texts/translations/optimized/siddur/en-edot.json'));
  assert.ok(!manifest.urls.includes('/texts/translations/en.json'));
  await assert.rejects(stat(path.join(root,'texts/translations/tanakh/uk-jewish-modern.json')));
  await assert.rejects(stat(path.join(root,'texts/translations/en.json')));
  const worker=await readFile(path.join(root,'sw.js'),'utf8');
  assert.match(worker,/AVAILABLE_TEXTS/);
  assert.match(worker,/optimized\/siddur\/en-ashkenaz/);
  assert.match(worker,/optimized\/siddur\/en-edot/);
  assert.match(worker,/texts\/edot.json/);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('missing and tampered optimized books fail the release without deleting canonical copies',async()=>{
 for(const problem of ['missing-assets','missing-book','modified-book','missing-nusach']){
  const folder=await mkdtemp(path.join(tmpdir(),'kav-dist-failure-'));
  try {
   const {root}=await makeOfflineFixture(folder);
   const optimized=path.join(root,'texts/translations/optimized');
   if(problem==='missing-assets')await rm(optimized,{recursive:true,force:true});
   else if(problem==='missing-book')await rm(path.join(optimized,'tanakh/uk-varda-torah/genesis.json'));
   else if(problem==='modified-book')await writeFile(path.join(optimized,'tanakh/uk-varda-torah/genesis.json'),JSON.stringify({schema:1,language:'uk',edition:'uk-varda-torah',sources:[],books:{genesis:{chapters:[['Corrupted text']]}}}));
   else await rm(path.join(optimized,'siddur/ru-edot.json'));
   assert.throws(()=>execFileSync(process.execPath,[path.resolve('scripts/finalize-offline.mjs')],{cwd:folder,stdio:'pipe'}),/Command failed/,problem);
   assert.ok((await stat(path.join(root,'texts/translations/tanakh/uk-varda-torah.json'))).isFile(),problem);
   assert.ok((await stat(path.join(root,'texts/translations/en.json'))).isFile(),problem);
   await assert.rejects(stat(path.join(root,'offline-manifest.json')));
  } finally {await rm(folder,{recursive:true,force:true});}
 }
});
