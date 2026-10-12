/** Resumable, bounded offline download. Verified files in the *current* release
 * cache are never downloaded twice; failures retain everything completed.
 */
export interface OfflineManifest {urls:string[];cacheName:string;revision?:string}
export async function downloadMissingOfflineAssets(
 manifest:OfflineManifest,
 cache:Pick<Cache,'match'|'put'>,
 fetchAsset:(url:string)=>Promise<Response>,
 onProgress:(finished:number,total:number)=>void,
 concurrency=4,
):Promise<{downloaded:number;existing:number}>{
 const urls=[...new Set(manifest.urls)];
 if(!urls.length||urls.some(url=>!url.startsWith('/')||url.startsWith('//')||url.includes('..')))
  throw Error('Invalid offline asset manifest');
 let index=0,finished=0,downloaded=0,existing=0;
 let failure:unknown;
 const worker=async()=>{
  while(index<urls.length&&!failure){
   const url=urls[index++];
   try{
    const cached=await cache.match(url);
    if(cached){existing++;onProgress(++finished,urls.length);continue;}
    const response=await fetchAsset(url);
    if(!response.ok)throw Error(`Unable to download ${url} (${response.status})`);
    await cache.put(url,response);
    downloaded++;
    onProgress(++finished,urls.length);
   }catch(error){failure=error;return;}
  }
 };
 await Promise.all(Array.from({length:Math.min(urls.length,Math.max(1,Math.min(8,Math.trunc(concurrency))))},worker));
 if(failure)throw failure;
 return {downloaded,existing};
}
