import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const evidence=JSON.parse(fs.readFileSync(new URL('scripts/reading-corrections.json',root),'utf8'));
const words=Object.fromEntries(evidence.words.map(r=>[r.word,r.to]));
const contexts=Object.fromEntries(evidence.contexts.map(r=>[r.word+'|'+r.context,r.to]));
const code='// Corpus-backed additions for reading only; evidence in scripts/reading-corrections.json.\n'
 +'export const wordCorrections:Readonly<Record<string,string>>='+JSON.stringify(words)+';\n'
 +'export const contextCorrections:Readonly<Record<string,string>>='+JSON.stringify(contexts)+';\n';
const target=new URL('lib/siddur/reading-corrections.ts',root);
if(process.argv.includes('--check')){
 if(fs.readFileSync(target,'utf8')!==code)throw new Error('Reading corrections need regeneration');
}else fs.writeFileSync(target,code);
console.log(JSON.stringify({words:Object.keys(words).length,contexts:Object.keys(contexts).length}));
