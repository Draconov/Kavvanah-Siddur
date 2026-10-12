import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadMissingOfflineAssets} from '../lib/siddur/offline-download.ts';

test('downloads only missing files, resumes after interruption and deduplicates',async()=>{
 const stored=new Map([['/texts/a.json',new Response('a')]]);
 const calls=[],progress=[];
 const cache={match:async url=>stored.get(url),put:async(url,res)=>{stored.set(url,res);}};
 const manifest={cacheName:'kavvanah-test',urls:['/texts/a.json','/texts/b.json','/texts/c.json','/texts/b.json']};
 let fail=true;
 const fetchAsset=async url=>{calls.push(url);if(url.endsWith('c.json')&&fail)throw Error('Disconnected');return new Response(url);};
 await assert.rejects(downloadMissingOfflineAssets(manifest,cache,fetchAsset,(done,total)=>progress.push([done,total]),1),/Disconnected/);
 assert.ok(stored.has('/texts/b.json'));
 fail=false;
 const result=await downloadMissingOfflineAssets(manifest,cache,fetchAsset,()=>{},1);
 assert.deepEqual(result,{downloaded:1,existing:2});
 assert.equal(calls.filter(x=>x==='/texts/a.json').length,0);
 assert.equal(calls.filter(x=>x==='/texts/b.json').length,1);
 assert.equal(progress.at(-1)[1],3);
});
test('rejects unsafe offline manifest urls',async()=>{
 await assert.rejects(downloadMissingOfflineAssets({cacheName:'a',urls:['//evil.test/']},{match:async()=>{},put:async()=>{}},async()=>new Response('')),/Invalid/);
});
