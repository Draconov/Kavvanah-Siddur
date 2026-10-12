/** Personal translations live in IndexedDB on capable devices. The legacy
 * localStorage data is imported on first use without being destructively
 * cleared, so older installations and blocked IndexedDB retain a fallback.
 */
import type {PersonalTranslations} from './types.ts';
const LEGACY='kavvanah.translations';
function safeRead(key:string):unknown{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):{};}catch{return {};}}
function safeWrite(key:string,value:unknown):boolean{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
const normalize=(raw:unknown):PersonalTranslations=>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
 return Object.fromEntries(Object.entries(raw).filter(([k,v])=>
  typeof k==='string'&&/(?:en|ru|uk)$/.test(k)&&typeof v==='string'&&v.length<=30000));
};
function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('IndexedDB unsupported'));return;}
  const request=indexedDB.open('kavvanah-personal',1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('translations'))request.result.createObjectStore('translations');};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(Error('Personal translations database is blocked'));
 });
}
async function readDb():Promise<unknown>{
 const db=await openDb();
 try{return await new Promise((resolve,reject)=>{
  const request=db.transaction('translations','readonly').objectStore('translations').get('saved');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });}finally{db.close();}
}
async function writeDb(value:PersonalTranslations):Promise<void>{
 const db=await openDb();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('translations','readwrite');
  tx.objectStore('translations').put(value,'saved');
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error);
 });}finally{db.close();}
}
export async function loadPersonalTranslations():Promise<PersonalTranslations>{
 const local=normalize(safeRead(LEGACY));
 try{
  const raw=await readDb();
  if(raw!==undefined)return normalize(raw);
  if(Object.keys(local).length)await writeDb(local);
 }catch{/* Local storage remains the non-destructive fallback. */}
 return local;
}
let writeQueue:Promise<unknown>=Promise.resolve();
export function savePersonalTranslations(value:PersonalTranslations):Promise<boolean>{
 // Serialize commits so quickly edited passages cannot land out of order.
 const job=writeQueue.catch(()=>{}).then(async()=>{
  const validated=normalize(value);
  try{
   await writeDb(validated);
   // Small best-effort compatibility backup, not required for successful save.
   if(JSON.stringify(validated).length<90_000)safeWrite(LEGACY,validated);
   return true;
  }catch{return safeWrite(LEGACY,validated);}
 });
 writeQueue=job;
 return job;
}
