import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {translate} from '../lib/siddur/i18n.ts';
import {prayerLabels} from '../lib/siddur/prayer-labels.ts';
import {parashaNames} from '../lib/siddur/calendar-labels.ts';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const texts=path.join(root,'public/texts');
const corpora=['ashkenaz','edot'].map(n=>JSON.parse(readFileSync(path.join(texts,n+'.json'),'utf8')));
const names=[...new Set(corpora.flatMap(c=>c.sections.flatMap(section=>[section.title,...section.path])))];
const untranslatedBrandKeys=new Set(['Kavvanah','Sefaria','Hebcal','Android','px','km','GRA']);
// Font-family names are product identifiers, not untranslated interface copy.
// Preserve the exact installed family names in every language.
const unchangedOptionNames=new Set(['Amoled','Alef','Noto Rashi Hebrew']);
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):/\.(tsx?|jsx?)$/.test(x.name)?[path.join(dir,x.name)]:[]);
const files=[...walk(path.join(root,'app')),...walk(path.join(root,'components/siddur')),...walk(path.join(root,'lib/siddur'))].filter(s=>!s.endsWith('i18n.ts')&&!s.endsWith('prayer-labels.ts')&&!s.endsWith('calendar-labels.ts'));
function uiStrings(){
 const found=new Set();
 for(const file of files){
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const visit=n=>{
   if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='t'&&n.arguments.length){
    const first=n.arguments[0];
    if(ts.isStringLiteralLike(first))found.add(first.text);
   }
   ts.forEachChild(n,visit);
  };
  visit(source);
 }
 return [...found];
}

test('every prayer and navigation path in BOTH source traditions has an explicit Russian/Ukrainian label',()=>{
 assert.equal(Object.keys(prayerLabels).length,names.length);
 for(const name of names){
  assert.ok(prayerLabels[name],`missing prayer label: ${name}`);
  for(const locale of ['ru','uk']){
   const localized=translate(locale,name);
   assert.notEqual(localized,name,`${locale}: prayer label remained in source English: ${name}`);
   assert.match(localized,/[А-Яа-яІіЇїЄєҐґЁёЭэЫы]/u,`${locale}: Cyrillic missing in ${name}`);
  }
 }
});
test('known liturgical names are transliterated rather than translated literally',()=>{
 assert.match(translate('uk','Thirteen Principles of Faith'),/^Шлоша асар/);
 assert.match(translate('ru','Torah Reading'),/^Криат/);
 assert.match(translate('uk','Counting of the Omer'),/^Сфірат/);
 assert.match(translate('ru','The Midnight Rite'),/^Тикун/);
 assert.equal(translate('he','Third Blessing after Shema').includes('outside of Israel'),false);
});
test('static UI labels have RU, UK, HE equivalents (brand-only exceptions)',()=>{
 const keys=uiStrings();assert.ok(keys.length>=165,'UI scan unexpectedly small');
 for(const key of keys){
  for(const language of ['ru','uk','he']){
   if(untranslatedBrandKeys.has(key))continue;
   const rendered=translate(language,key);
   assert.notEqual(rendered,key,`${language}: untranslated UI label ${JSON.stringify(key)}`);
  }
 }
});
test('Hebrew calendar names use native-script portion names, including combined portions',()=>{
 assert.ok(Object.keys(parashaNames).length>=50);
 for(const name of Object.keys(parashaNames)){
  for(const language of ['ru','uk']){
   const label=translate(language,'Parashat '+name);
   assert.match(label,/^Парашат /);
   assert.doesNotMatch(label,/[a-z]/i,`${language}: unconverted ${name}`);
  }
 }
 assert.equal(translate('uk','Parashat Achrei Mot-Kedoshim'),'Парашат Ахарей Мот — Кдошім');
});
test('translation placeholders survive and are substituted once',()=>{
 assert.equal(translate('uk','{count} personal translations imported.',{count:4}),'Імпортовано особистих перекладів: 4.');
 assert.match(translate('ru','Jerusalem is {degrees} degrees from true north, {direction}',{degrees:76,direction:'NE'}),/76/);
});

test('user-facing status and error messages do not silently fall back to English',()=>{
 const methods=new Set(['setNotice','setError','setOffline','setMessage','setPersonalError']);
 const messages=new Set();
 for(const file of files){
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const visit=n=>{
   if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&methods.has(n.expression.text)&&n.arguments.length){
    const v=n.arguments[0];if(ts.isStringLiteralLike(v)&&v.text.length>8)messages.add(v.text);
   }
   ts.forEachChild(n,visit);
  };
  visit(source);
 }
 assert.ok(messages.size>12);
 for(const key of messages)for(const language of ['ru','uk','he'])
  assert.notEqual(translate(language,key),key,`${language}: untranslated status message ${key}`);
});
test('static choice option labels remain localized',()=>{
 const keys=new Set();
 for(const file of files.filter(s=>s.includes('/components/siddur/'))){
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const visit=n=>{
   if(ts.isPropertyAssignment(n)&&ts.isIdentifier(n.name)&&['label','description'].includes(n.name.text)&&ts.isStringLiteral(n.initializer))keys.add(n.initializer.text);
   ts.forEachChild(n,visit);
  };
  visit(source);
 }
 assert.ok(keys.size>30);
 for(const key of keys)for(const lang of ['ru','uk','he']){
  if(unchangedOptionNames.has(key))continue;
  assert.notEqual(translate(lang,key),key,`${lang}: untranslated option ${key}`);
 }
});
test('font-family option names remain stable across locales and available in both font menus',()=>{
 const filenames=['components/siddur/SettingsView.tsx','components/siddur/Reader.tsx'];
 for(const name of ['Alef','Noto Rashi Hebrew']){
  for(const file of filenames){
   const content=readFileSync(path.join(root,file),'utf8');
   assert.ok(content.includes(`label:'${name}'`),`${file}: missing font-family choice ${name}`);
  }
  for(const lang of ['en','ru','uk','he'])
   assert.equal(translate(lang,name),name,`${lang}: the selectable font-family name should not be translated`);
 }
});
test('English headings use canonical prayer names where the English source used a descriptive paraphrase',()=>{
 assert.match(translate('en','The Midnight Rite'),/^Tikkun Chatzot/);
 assert.match(translate('en','Thirteen Principles of Faith'),/^Shloshah Asar Ikkarim/);
 assert.match(translate('en','Morning Blessings'),/^Birkhot HaShachar/);
});
test('localized PWA installation manifests keep app identity and platform routes stable',()=>{
 const base=JSON.parse(readFileSync(path.join(root,'public/manifest.webmanifest'),'utf8'));
 for(const language of ['ru','uk','he']){
  const variant=JSON.parse(readFileSync(path.join(root,`public/manifest.${language}.webmanifest`),'utf8'));
  assert.equal(variant.lang,language);
  assert.notEqual(variant.description,base.description);
  for(const key of ['id','start_url','scope','display']) assert.deepEqual(variant[key],base[key]);
  assert.deepEqual(variant.icons,base.icons);
 }
 const script=readFileSync(path.join(root,'scripts/prepare-pages.mjs'),'utf8');
 assert.match(script,/\['', '\.ru', '\.uk', '\.he'\]/,'project Pages must rebase the localized manifests too');
 const storage=readFileSync(path.join(root,'lib/siddur/storage.ts'),'utf8');
 assert.match(storage,/new URL\(basename,manifest\.href\)/,'installed app should select language-specific manifest within its own base URL');
});
