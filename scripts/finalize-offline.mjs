import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=path.resolve('dist/client');
async function walk(dir){const out=[];for(const name of await readdir(dir)){const p=path.join(dir,name);if((await stat(p)).isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const hostingOnly=new Set(['_headers','_redirects','_routes.json','vinext-client-entry-manifest.json']);
const files=(await walk(root)).filter(f=>!hostingOnly.has(path.relative(root,f))&&!f.endsWith('.map')&&!f.endsWith('/sw.js')&&!f.endsWith('/offline-manifest.json')&&!f.includes('/.vite/')&&!f.endsWith('.br')&&!f.endsWith('.gz'));
const digest=createHash('sha256');for(const file of files.sort()){digest.update(path.relative(root,file));digest.update(await readFile(file));}
const revision=digest.digest('hex').slice(0,12),cacheName=`kavvanah-${revision}`;
const urls=['/',...files.map(f=>'/'+path.relative(root,f).split(path.sep).join('/')).filter(f=>f!=='/index.html'&&!f.endsWith('.rsc'))];
const shell=urls.filter(url=>!url.startsWith('/texts/')||['/texts/ashkenaz.json','/texts/catalog.json','/texts/genesis.json'].includes(url));
const manifest={revision,cacheName,urls};
const sw=`/* Generated from the verified production assets. */
const CACHE=${JSON.stringify(cacheName)};
const SHELL=${JSON.stringify(shell)};
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(SHELL);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys()){if(key.startsWith('kavvanah-')&&key!==CACHE){const old=await caches.open(key);const current=await caches.open(CACHE);for(const req of await old.keys()){if(new URL(req.url).pathname.startsWith('/texts/')&&!await current.match(req)){try{const response=await fetch(req);if(response.ok)await current.put(req,response);}catch{const response=await old.match(req);if(response)await current.put(req,response);}}}await caches.delete(key);}}await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname==='/sw.js'||url.pathname==='/offline-manifest.json')return;
event.respondWith((async()=>{const cache=await caches.open(CACHE);if(req.mode==='navigate'){try{const response=await fetch(req);if(response.ok)await cache.put('/',response.clone());return response;}catch{return (await cache.match('/'))||Response.error();}}
const hit=await cache.match(req);if(hit)return hit;try{const response=await fetch(req);if(response.ok&&(url.pathname.startsWith('/texts/')||url.pathname.startsWith('/assets/')||url.pathname.startsWith('/fonts/')||url.pathname.startsWith('/_next/')))await cache.put(req,response.clone());return response;}catch{return Response.error();}})());});
`;
for(const target of ['public','dist/client']){await writeFile(`${target}/sw.js`,sw);await writeFile(`${target}/offline-manifest.json`,JSON.stringify(manifest));}
console.log(`Offline manifest: ${urls.length} assets, ${shell.length} automatic shell assets, revision ${revision}`);
