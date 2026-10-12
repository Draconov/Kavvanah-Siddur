import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPersonalTranslations,savePersonalTranslations} from '../lib/siddur/personal-store.ts';

test('personal translations fall back to localStorage when IndexedDB is absent',async()=>{
 const old=globalThis.localStorage;
 const storage=new Map([['kavvanah.translations',JSON.stringify({'siddur:x:0:uk':'Переклад','bad':'wrong'})]]);
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 try{
  assert.deepEqual(await loadPersonalTranslations(),{'siddur:x:0:uk':'Переклад'});
  assert.equal(await savePersonalTranslations({'siddur:x:1:en':'mine'}),true);
  assert.deepEqual(JSON.parse(storage.get('kavvanah.translations')),{'siddur:x:1:en':'mine'});
 }finally{globalThis.localStorage=old;}
});
