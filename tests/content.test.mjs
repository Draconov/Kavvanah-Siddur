import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>JSON.parse(readFileSync(new URL(`../public/texts/${name}.json`,import.meta.url),'utf8'));
const readTranslations=language=>JSON.parse(readFileSync(new URL(`../public/texts/translations/${language}.json`,import.meta.url),'utf8'));

function hydrateSiddur(name,languages=['en','ru','uk']){
 const data=structuredClone(read(name));
 const byId=new Map(data.sections.map(section=>[section.id,section]));
 for(const language of languages){
  const bundle=readTranslations(language);assert.equal(bundle.schema,1);assert.equal(bundle.language,language);
  const corpus=bundle.corpora[name];assert.ok(corpus,`${language}: missing ${name}`);
  data.sources.push(...corpus.sources);
  for(const [id,translation] of Object.entries(corpus.sections)){
   const section=byId.get(id);assert.ok(section,`${language}: unknown section ${id}`);
   assert.match(translation.sourceHash,/^[0-9a-f]{16}$/);
   const records=translation.paragraphs;
   assert.equal(records.length,section.paragraphs.length,`${language}: ${name}:${id} paragraph count`);
   records.forEach((record,index)=>{
    if(record==null)return;
    const meta=typeof record==='string'?null:record,text=typeof record==='string'?record:record.text;
    assert.ok(text?.trim());const p=section.paragraphs[index];p[language]=text;
    if(meta?.ref)(p.translationRefs??={})[language]=meta.ref;
    if(meta?.edition)(p.translationEditions??={})[language]=meta.edition;
    if(meta?.note)(p.translationNotes??={})[language]=meta.note;
   });
  }
 }
 return data;
}

test('Siddur Hebrew structure and translations are stored separately',()=>{
 for(const name of ['ashkenaz','edot']){
  const data=read(name);assert.ok(data.sections.length>100);
  assert.ok(data.sources.every(source=>!['en','ru','uk'].includes(source.language)));
  for(const p of data.sections.flatMap(section=>section.paragraphs)){
   for(const language of ['en','ru','uk']){
    assert.equal(p[language],undefined,`${name}: embedded ${language}`);
    assert.equal(p.translationRefs?.[language],undefined,`${name}: embedded ${language} ref`);
    assert.equal(p.translationEditions?.[language],undefined,`${name}: embedded ${language} edition`);
    assert.equal(p.translationNotes?.[language],undefined,`${name}: embedded ${language} note`);
   }
  }
 }
 for(const language of ['en','ru','uk']){
  const bundle=readTranslations(language);assert.equal(bundle.schema,1);assert.equal(bundle.language,language);
  assert.deepEqual(Object.keys(bundle.corpora).sort(),['ashkenaz','edot']);
 }
 const ashkenaz=hydrateSiddur('ashkenaz',['ru']);
 const paragraphs=ashkenaz.sections.flatMap(section=>section.paragraphs);
 assert.equal(paragraphs.length,3689);
 assert.equal(paragraphs.filter(p=>p.ru?.trim()).length,3689,'Russian Ashkenaz must remain complete');
});

test('Kavvanah additions have their own edition attribution and no empty text',()=>{
 for(const name of ['ashkenaz','edot']){
  const data=hydrateSiddur(name,['ru','uk']);
  for(const p of data.sections.flatMap(section=>section.paragraphs))for(const language of ['ru','uk']){
   if(p.translationEditions?.[language]!=='kavvanah-supplement-2026')continue;
   assert.ok(p[language]?.trim(),`${name}: empty ${language}`);
   assert.match(p.translationRefs[language],/^KAV /);
   assert.ok(data.sources.some(s=>s.id==='kavvanah-supplement-2026'&&s.language===language));
   assert.notEqual(p.translationNotes?.[language],'combined');
  }
 }
 for(const name of read('catalog').books.map(b=>b.id)){
  const data=read(name);
  for(const p of data.text.flat())for(const language of ['ru','uk']){
   if(p.translationEditions?.[language]!=='kavvanah-supplement-2026')continue;
   assert.ok(p[language]?.trim(),`${name}: empty ${language}`);
   assert.match(p.translationRefs[language],/^KAV /);
   assert.ok(data.sources.some(s=>s.id==='kavvanah-supplement-2026'&&s.language===language));
  }
 }
});

test('the Tanakh corpus includes 929 nonempty chapters with edition attribution',()=>{
 const {books}=read('catalog');assert.equal(books.length,39);
 assert.equal(books.reduce((sum,b)=>sum+b.chapters,0),929);
 for(const entry of books){const book=read(entry.id);assert.equal(book.text.length,entry.chapters);assert.deepEqual([...new Set(book.sources.map(s=>s.language))].sort(),['en','he','ru','uk']);for(const chapter of book.text){assert.ok(chapter.length);for(const verse of chapter){assert.ok(verse.he?.trim());assert.ok(!/<\/?[a-z][^>]*>/i.test(verse.he));}}}
});

test('Russian follows Hebrew references through chapter boundaries and combined verses',()=>{
 const verse=(id,ch,v)=>read(id).text[ch-1][v-1];
 const cases=[['genesis',32,1,'GEN 31:55'],['genesis',32,2,'GEN 32:1'],['psalms',10,1,'PSA 9:22'],['psalms',114,1,'PSA 113:1'],['psalms',116,10,'PSA 115:1'],['psalms',147,12,'PSA 147:1'],['joel',3,1,'JOL 2:28'],['joel',4,1,'JOL 3:1'],['malachi',3,19,'MAL 4:1'],['daniel',3,24,'DAN 3:91'],['daniel',6,1,'DAN 5:31'],['daniel',6,29,'DAN 6:28'],['isaiah',3,26,'ISA 3:25']];
 for(const [id,ch,v,reference] of cases)assert.equal(verse(id,ch,v).translationRefs.ru,reference,`${id} ${ch}:${v}`);
 assert.match(verse('daniel',6,1).ru,/Дарий Мидянин/);
 assert.match(verse('psalms',114,1).ru,/Когда вышел Израиль/);
 assert.equal(verse('exodus',20,13).ru,'Не убивай. Не прелюбодействуй. Не кради. Не произноси ложного свидетельства на ближнего твоего.');
 assert.match(verse('proverbs',18,8).ru,/Слова наушника/);
 assert.equal(verse('psalms',116,8).ru,verse('psalms',116,9).ru);
 assert.equal(verse('psalms',116,9).translationNotes.ru,'combined');
 assert.match(verse('psalms',90,1).ru,/Молитва Моисея.*Господи! Ты нам прибежище/);
 const gaps=[];let count=0;
 for(const {id} of read('catalog').books)read(id).text.forEach((ch,c)=>ch.forEach((p,v)=>{if(p.ru)count++;else gaps.push(`${id} ${c+1}:${v+1}`);}));
 assert.equal(count,23206);assert.deepEqual(gaps,[]);
 for(const [book,ch,v] of [['psalms',142,1],['song-of-songs',1,1]])assert.equal(verse(book,ch,v).translationEditions.ru,'kavvanah-supplement-2026');
});

test('Ukrainian edition retains its source wording across split and combined verses',()=>{
 const verse=(id,ch,v)=>read(id).text[ch-1][v-1];
 const cases=[['genesis',3,2,'GEN 3:1'],['genesis',3,24,'GEN 3:23'],['genesis',6,22,'GEN 6:21'],['genesis',32,1,'GEN 31:55'],['leviticus',5,24,'LEV 5:24, LEV 5:25'],['leviticus',6,23,'LEV 6:22'],['numbers',12,16,'NUM 12:16'],['numbers',23,17,'NUM 23:17, NUM 23:18'],['numbers',30,1,'NUM 29:40'],['deuteronomy',28,69,'DEU 28:69'],['deuteronomy',29,1,'DEU 29:1, DEU 29:2'],['ii-samuel',2,4,'2SA 2:4, 2SA 2:5'],['i-kings',22,44,'1KI 22:44'],['job',21,34,'JOB 21:33'],['proverbs',30,33,'PRO 30:32'],['isaiah',9,20,'ISA 9:21, ISA 9:22'],['daniel',3,24,'DAN 3:24'],['daniel',6,1,'DAN 5:31'],['psalms',51,3,'PSA 51:1'],['psalms',54,7,'PSA 54:4'],['psalms',60,3,'PSA 60:3'],['psalms',63,12,'PSA 63:11'],['psalms',127,5,'PSA 127:5, PSA 127:6'],['joel',4,1,'JOL 3:1']];
 for(const [id,ch,v,ref] of cases)assert.equal(verse(id,ch,v).translationRefs.uk,ref,`${id} ${ch}:${v}`);
 assert.equal(verse('genesis',1,1).uk,'У початку сотворив Бог небо та землю.');
 assert.match(verse('genesis',3,2).uk,/І каже жінка/);
 assert.equal(verse('genesis',3,1).uk,verse('genesis',3,2).uk);
 assert.equal(verse('psalms',51,1).translationNotes.uk,'combined');
 assert.equal(verse('psalms',60,1).translationNotes?.uk,undefined);
 assert.match(verse('i-kings',22,44).uk,/Тільки висот/);
 const gaps=[];let count=0;
 for(const {id} of read('catalog').books)read(id).text.forEach((ch,c)=>ch.forEach((p,v)=>{if(p.uk){count++;assert.ok(!p.uk.includes('\\'));assert.ok(p.translationRefs.uk);}else gaps.push(`${id} ${c+1}:${v+1}`);}));
 assert.equal(count,23206);assert.deepEqual(gaps,[]);
 for(const [book,ch,v] of [['leviticus',21,24],['psalms',148,14],['song-of-songs',1,1]])assert.equal(verse(book,ch,v).translationEditions.uk,'kavvanah-supplement-2026');
});

for(const [language,totals] of Object.entries({ru:{ashkenaz:213,edot:188},uk:{ashkenaz:209,edot:175}}))test(`${language} siddur biblical passages preserve exact complete source wording`,()=>{
 const normalized=s=>s.replace(/[^א-ת]/g,'');
 const tanakh=read('catalog').books.map(b=>read(b.id));
 for(const [nusach,total] of Object.entries(totals)){
  const additions=hydrateSiddur(nusach,[language]).sections.flatMap(s=>s.paragraphs).filter(p=>p[language]&&!p.translationEditions?.[language]);
  assert.equal(additions.length,total);
  for(const p of additions){
   assert.notEqual(p.kind,'instruction');const wanted=normalized(p.he);
   assert.ok(tanakh.some(b=>{const flat=b.text.flat();return flat.some((first,i)=>{if(!wanted.startsWith(normalized(first.he)))return false;let he='',translated=[];for(const part of flat.slice(i)){if(!part[language]||part.translationNotes?.[language])return false;he+=normalized(part.he);translated.push(part[language]);if(he===wanted)return translated.join(' ')===p[language];if(!wanted.startsWith(he))return false;}return false;});}),`Unverified biblical passage in ${nusach}`);
  }
 }
});

test('prayer corpora have unique sections, no literal placeholders, and no unsafe Kaveh pairing',()=>{
 for(const name of ['ashkenaz','edot']){const data=hydrateSiddur(name);assert.equal(new Set(data.sections.map(s=>s.id)).size,data.sections.length);for(const section of data.sections){assert.ok(section.paragraphs.length);for(const p of section.paragraphs){assert.ok(p.he);assert.notEqual(p.en,'[]');}}}
 const kaveh=hydrateSiddur('edot',['en']).sections.find(s=>s.path.join('/')==='Weekday Shacharit/Kaveh');
 assert.ok(kaveh);assert.ok(kaveh.paragraphs.every(p=>!p.en),'different source segmentation must never be positionally paired');
});

test('Toldot attribution remains attached to the Russian translation file',()=>{
 const data=hydrateSiddur('ashkenaz',['ru']);
 const toldot=data.sections.flatMap(s=>s.paragraphs).filter(p=>p.translationEditions?.ru==='toldot-siddur-2011');
 assert.ok(toldot.length>=8);
 assert.ok(toldot.every(p=>p.ru?.trim()&&p.translationRefs?.ru?.startsWith('https://toldot.com/')));
 assert.ok(data.sources.some(source=>source.id==='toldot-siddur-2011'&&source.language==='ru'));
});
