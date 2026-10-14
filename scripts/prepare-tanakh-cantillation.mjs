/** Optional WLC te'amim sidecar builder. Never rewrites canonical sacred texts.
 * Usage: node scripts/prepare-tanakh-cantillation.mjs --download
 * Alternatively place OSHB WLC *.xml files under .text-cache/wlc/ and run it
 * without --download. A conservative consonant-by-consonant check refuses
 * mismatched verses rather than inventing or misassigning cantillation.
 */
import {readFile,mkdir,writeFile,readdir,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
const rev='3d15126fb1ef74867fc1434be1942e837932691f';
const upstream=`https://raw.githubusercontent.com/openscriptures/morphhb/${rev}/wlc`;
const names={
 'genesis':'Gen','exodus':'Exod','leviticus':'Lev','numbers':'Num','deuteronomy':'Deut',
 'joshua':'Josh','judges':'Judg','i-samuel':'1Sam','ii-samuel':'2Sam','i-kings':'1Kgs','ii-kings':'2Kgs',
 'isaiah':'Isa','jeremiah':'Jer','ezekiel':'Ezek','hosea':'Hos','joel':'Joel','amos':'Amos','obadiah':'Obad',
 'jonah':'Jonah','micah':'Mic','nahum':'Nah','habakkuk':'Hab','zephaniah':'Zeph','haggai':'Hag',
 'zechariah':'Zech','malachi':'Mal','psalms':'Ps','proverbs':'Prov','job':'Job','song-of-songs':'Song',
 'ruth':'Ruth','lamentations':'Lam','ecclesiastes':'Eccl','esther':'Esth','daniel':'Dan',
 'ezra':'Ezra','nehemiah':'Neh','i-chronicles':'1Chr','ii-chronicles':'2Chr'};
export const consonants = s => [...s.normalize('NFD')].filter(c=>/[א-ת]/u.test(c)).join('');
export function sourceAccents(source,hebrew){
 const marked=[...source.normalize('NFD')];
 if(consonants(source)!==consonants(hebrew))return null;
 const patches=[];let ordinal=-1;
 for(const ch of marked){
  if(/[א-ת]/u.test(ch))ordinal++;
  else if(/[\u0591-\u05AF]/u.test(ch)&&ordinal>=0){
   if(patches.length&&patches.at(-1)[0]===ordinal)patches.at(-1)[1]+=ch;
   else patches.push([ordinal,ch]);
  }
 }
 return patches.length?patches:null;
}
function decode(s){return s.replace(/&(?:#(x[\da-f]+|\d+)|amp|lt|gt|quot|apos);/gi,(all,n)=>{
 if(n)return String.fromCodePoint(n.toLowerCase().startsWith('x')?parseInt(n.slice(1),16):Number(n));
 return ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[all]??all;
});}
export function parseWlc(xml){
 const result=new Map();
 for(const match of xml.matchAll(/<verse\s+[^>]*osisID="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/gu)){
  const verse=match[1].split('.');
  if(verse.length!==3)continue;
  const words=[...match[2].matchAll(/<w\b[^>]*>([\s\S]*?)<\/w>/gu)].map(m=>decode(m[1].replace(/<[^>]*>/g,'').replaceAll('/','')));
  // Consonant equality is independent of whitespace. Spaces between words
  // are retained to keep mark ordinals in the correct sequence.
  result.set(`${verse[1]}.${verse[2]}`,words.join(' '));
 }
 return result;
}
async function readWlc(filename,download){
 const cached=join('.text-cache/wlc',`${filename}.xml`);
 try{return await readFile(cached,'utf8')}catch{}
 if(!download)return null;
 try{
  const response=await fetch(`${upstream}/${filename}.xml`,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error(String(response.status));
  const data=await response.text();
  if(!data.includes('<verse '))throw Error('No verses found');
  await mkdir(dirname(cached),{recursive:true});await writeFile(cached,data);
  return data;
 }catch(e){console.warn(`WLC ${filename}: ${e.message}. This optional edition is unavailable.`);return null;}
}
export async function generate({sourceDir='public/texts',outputDir='public/texts/optimized/cantillation',download=false}={}){
 await rm(outputDir,{recursive:true,force:true});
 const index={source:'Open Scriptures Hebrew Bible / Westminster Leningrad Codex (CC BY 4.0 attribution)',revision:rev,books:{}};
 let covered=0,missed=0;
 // Concurrency limit bounds cold-build downloads; dev builds use cached XML.
 const inputs=Object.entries(names);
 const downloaded=new Map();
 for(let i=0;i<inputs.length;i+=6){
  await Promise.all(inputs.slice(i,i+6).map(async([,code])=>downloaded.set(code,await readWlc(code,download))));
 }
 for(const [book,code] of inputs){
  const original=JSON.parse(await readFile(join(sourceDir,`${book}.json`),'utf8'));
  const xml=downloaded.get(code);
  if(!xml)continue;
  const witness=parseWlc(xml);index.books[book]=[];
  for(let ch=0;ch<original.text.length;ch++){
   const verses=original.text[ch].map((p,i)=>{
    const source=witness.get(`${ch+1}.${i+1}`);
    if(!source){missed++;return null;}
    const accents=sourceAccents(source,p.he);
    if(accents)covered++;else missed++;
    return accents;
   });
   if(!verses.some(Boolean))continue;
   index.books[book].push(ch+1);
   const dest=join(outputDir,book,`${ch+1}.json`);
   await mkdir(dirname(dest),{recursive:true});
   await writeFile(dest,JSON.stringify({source:index.source,verses}));
  }
  if(!index.books[book].length)delete index.books[book];
 }
 await mkdir(outputDir,{recursive:true});
 await writeFile(join(outputDir,'index.json'),JSON.stringify(index));
 console.log(`Optional cantillation sidecars: ${covered} verified verses, ${missed} unavailable/mismatched; canonical texts untouched`);
 return {covered,missed,index};
}
if(process.argv[1]?.endsWith('prepare-tanakh-cantillation.mjs'))await generate({download:process.argv.includes('--download')});
