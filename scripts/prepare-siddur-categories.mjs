/** Build per-category Siddur reading assets and a compact navigation index.
 * Canonical Hebrew / translated Siddur files remain editable and untouched.
 * All output is staged and validated before replacing the generated folders.
 */
import {readFile,mkdir,writeFile,rm,rename} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const source=path.resolve(root,process.argv[2]??'public/texts');
const translations=path.resolve(root,process.argv[3]??'public/texts/translations');
const output=path.resolve(root,process.argv[4]??'public/texts/optimized/siddur');
const translatedOutput=path.resolve(root,process.argv[5]??'public/texts/translations/optimized/siddur-categories');
if(!output.startsWith(source+path.sep)||!translatedOutput.startsWith(translations+path.sep))throw Error('Siddur output must be inside its own source directory');
const staging=output+'.staging',translatedStaging=translatedOutput+'.staging';
const load=async file=>JSON.parse(await readFile(file,'utf8'));
const write=async(file,data)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(data));};
await Promise.all([rm(staging,{recursive:true,force:true}),rm(translatedStaging,{recursive:true,force:true})]);
let groups=0;
try{
 const languages=await Promise.all(['en','ru','uk'].map(lang=>load(path.join(translations,`${lang}.json`))));
 for(const nusach of ['ashkenaz','edot']){
  const book=await load(path.join(source,`${nusach}.json`));
  if(book.nusach!==nusach||!Array.isArray(book.sections))throw Error(`Invalid Siddur: ${nusach}`);
  const groupBy=new Map();
  for(const section of book.sections){
   if(!/^[a-zA-Z]+$/.test(section.category)||!section.id||!Array.isArray(section.paragraphs))throw Error(`Invalid category in ${nusach}`);
   const arr=groupBy.get(section.category)??[];arr.push(section);groupBy.set(section.category,arr);
  }
  await write(path.join(staging,nusach,'index.json'),{...book,sections:book.sections.map(s=>({...s,paragraphs:[]}))});
  for(const [category,sections] of groupBy){
   const slug=category.toLowerCase();
   await write(path.join(staging,nusach,`${slug}.json`),{...book,sections});
   for(let i=0;i<languages.length;i++){
    const language=['en','ru','uk'][i],bundle=languages[i],corpus=bundle.corpora[nusach];
    if(!corpus)throw Error(`Missing Siddur corpus: ${language}/${nusach}`);
    const mapped=Object.fromEntries(sections.filter(s=>corpus.sections[s.id]).map(s=>[s.id,corpus.sections[s.id]]));
    await write(path.join(translatedStaging,language,nusach,`${slug}.json`),{
     schema:bundle.schema,language:bundle.language,corpora:{[nusach]:{sources:corpus.sources,sections:mapped}},
    });
   }
   groups++;
  }
 }
 // Both staging directories must be complete before replacing either.
 await Promise.all([rm(output,{recursive:true,force:true}),rm(translatedOutput,{recursive:true,force:true})]);
 await rename(staging,output);
 await rename(translatedStaging,translatedOutput);
 console.log(`Siddur reader: ${groups} Hebrew category chunks and ${groups*3} translation chunks`);
}catch(error){await Promise.all([rm(staging,{recursive:true,force:true}),rm(translatedStaging,{recursive:true,force:true})]);throw error;}
