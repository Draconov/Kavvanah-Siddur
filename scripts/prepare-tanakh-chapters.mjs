/** Generate immutable Tanakh reading chapters from the canonical Hebrew books.
 * Original JSON files remain untouched; only optimized/ is generated.
 */
import {readFile, readdir, mkdir, writeFile, rm, rename} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const source=path.resolve(root,process.argv[2]??'public/texts');
const output=path.resolve(root,process.argv[3]??'public/texts/optimized/tanakh');
if(!output.startsWith(source+path.sep)||output===source)throw Error('Chapter output must live below the text source');
const staging=output+'.staging';
await rm(staging,{recursive:true,force:true});
let count=0,books=0;
try{
 for(const filename of (await readdir(source)).filter(name=>/^[a-z-]+\.json$/.test(name)&&!['ashkenaz.json','edot.json','catalog.json'].includes(name)).sort()){
  const book=JSON.parse(await readFile(path.join(source,filename),'utf8'));
  if(book.id!==filename.slice(0,-5)||!Array.isArray(book.text)||book.chapters!==book.text.length)throw Error(`Invalid canonical book: ${filename}`);
  books++;
  for(let i=0;i<book.chapters;i++){
   if(!Array.isArray(book.text[i]))throw Error(`Invalid chapter: ${filename}:${i+1}`);
   const file=path.join(staging,book.id,`${i+1}.json`);
   await mkdir(path.dirname(file),{recursive:true});
   await writeFile(file,JSON.stringify({...book,chapter:i+1,text:[book.text[i]]}));
   count++;
  }
 }
 if(!books)throw Error('No Tanakh books available to split');
 await rm(output,{recursive:true,force:true});
 await rename(staging,output);
 console.log(`Hebrew Tanakh reader: ${count} chapters from ${books} canonical books`);
}catch(error){await rm(staging,{recursive:true,force:true});throw error;}
