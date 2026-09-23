import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = process.env.SIDDUR_ROOT || fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const {transcription,unpointedWords,isReadingInstruction}=await import(pathToFileURL(path.resolve(process.env.READING_MODULE || root+'/lib/siddur/reading.ts')));
const WORD=/[א-ת\u05F2\uFB1D-\uFB4F][א-ת\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05F2\uFB1D-\uFB4F]*(?:['"׳״][א-ת\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*)*/gu;
const tokens=new Map();const rows=[];const files=[];const unpointedExamples=[];
for(const file of fs.readdirSync(root+'/public/texts').filter(f=>f.endsWith('.json')&&f!=='catalog.json')){
 const data=JSON.parse(fs.readFileSync(root+'/public/texts/'+file));
 const ps=[];
 if(data.sections)for(const section of data.sections)for(const [i,p] of section.paragraphs.entries())ps.push({file,ref:section.title+':'+(i+1),...p});
 else for(const [c,chapter] of data.text.entries())for(const [v,p] of chapter.entries())ps.push({file,ref:`${c+1}:${v+1}`,...p});
 const stat={file,paragraphs:ps.length,instructions:0,prayersWithUnpointed:0,unpointedPrayerTokens:0,fullyUnpointedPrayers:0,unpointedInstructions:0,latinSourceParagraphs:0};
 for(const p of ps){
  const unknown=unpointedWords(p.he);if(/[A-Za-z]/.test(p.he))stat.latinSourceParagraphs++;
  if(isReadingInstruction(p)){stat.instructions++;if(unknown.length)stat.unpointedInstructions++;}
  else if(unknown.length){stat.prayersWithUnpointed++;if(!/[\u05B0-\u05BB\u05C7]|וּ/.test(p.he))stat.fullyUnpointedPrayers++;}
  for(const word of p.he.match(WORD)||[]){const obj=tokens.get(word)||{count:0,prayerCount:0,ref:file+' '+p.ref,unpointed:unpointedWords(word).length>0};obj.count++;if(!isReadingInstruction(p)){obj.prayerCount++;if(obj.unpointed)stat.unpointedPrayerTokens++;}tokens.set(word,obj);}
  if(unknown.length&&!isReadingInstruction(p)&&unpointedExamples.filter(e=>e.file===file).length<12)unpointedExamples.push({file,ref:p.ref,he:p.he.slice(0,200),unknown:unknown.slice(0,12)});
 }
 files.push(stat);rows.push(...ps);
}
const anomalies=[];const renderingCounters={checkedWords:0,outputs:0,residualHebrew:0,residualLatin:0,emptyOutputs:0};
const words=[...tokens].filter(([,meta])=>!meta.unpointed);
console.log(JSON.stringify({phase:'source',paragraphs:rows.length,uniqueWords:tokens.size,wordsToCheck:words.length,files}));
for(const [word,meta] of words){
 renderingCounters.checkedWords++;
 for(const pronunciation of ['sephardi','ashkenazi'])for(const lang of ['en','ru','uk']){
  const marking = /^(ashkenaz|edot)\.json/.test(meta.ref) ? 'siddur' : 'tanakh';
  const out=transcription(word,lang,pronunciation,marking);renderingCounters.outputs++;
  const he=out.match(/[\u0591-\u05C7א-ת\u05F0-\u05F4]/gu)||[];
  const latin=lang==='en'?(out.match(/[А-Яа-яІіЇїЄєҐґ]/gu)||[]):(out.match(/[A-Za-z\u00C0-\u024F]/gu)||[]);
  if(he.length)renderingCounters.residualHebrew++;if(latin.length)renderingCounters.residualLatin++;if(!out)renderingCounters.emptyOutputs++;
  if(he.length||latin.length||!out)anomalies.push({word,out,lang,pronunciation,...meta,he,latin});
 }
 if(renderingCounters.checkedWords%5000===0)console.log(JSON.stringify({phase:'rendering',...renderingCounters}));
}
const report={files,totals:{paragraphs:rows.length,uniqueWords:tokens.size,totalTokens:[...tokens.values()].reduce((n,v)=>n+v.count,0),...renderingCounters},unpointedExamples,commonUnpointed:[...tokens].filter(([,v])=>v.unpointed&&v.prayerCount>0).sort((a,b)=>b[1].prayerCount-a[1].prayerCount).slice(0,100),anomalies};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify({phase:'complete',totals:report.totals,anomalies:anomalies.slice(0,30)}));
