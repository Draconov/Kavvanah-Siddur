import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const readJson=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));
const catalog=readJson('public/texts/catalog.json');
const registry=readJson('lib/siddur/translation-editions.json');
const bundle=id=>readJson(`public/texts/translations/tanakh/${id}.json`);

function recordText(record){return typeof record==='string'?record:record?.text;}

for(const edition of ['uk-ohienko-1962','uk-kulish-puluj-1905']){
 test(`${edition} is a complete 23,206-verse Tanakh bundle matching Hebrew structure`,()=>{
  const data=bundle(edition);
  assert.equal(data.schema,1);
  assert.equal(data.language,'uk');
  assert.equal(data.edition,edition);
  assert.equal(Object.keys(data.books).length,catalog.books.length);
  assert.deepEqual(new Set(Object.keys(data.books)),new Set(catalog.books.map(book=>book.id)));
  let total=0;
  for(const book of catalog.books){
   const base=readJson(`public/texts/${book.id}.json`);
   const translated=data.books[book.id];
   assert.ok(translated,`missing ${book.id}`);
   assert.equal(translated.chapters.length,base.text.length,`${book.id} chapter count`);
   for(let c=0;c<base.text.length;c++){
    assert.equal(translated.chapters[c].length,base.text[c].length,`${book.id} ${c+1} verse count`);
    for(let v=0;v<translated.chapters[c].length;v++){
     assert.ok(recordText(translated.chapters[c][v])?.trim(),`empty ${book.id} ${c+1}:${v+1}`);
     total++;
    }
   }
  }
  assert.equal(total,23206);
 });
}

test('registry exposes real Ohiienko and Kulish bundles and pins YouVersion metadata',()=>{
 const byId=Object.fromEntries(registry.editions.map(edition=>[edition.id,edition]));
 assert.equal(byId['uk-ohienko-1962'].available,true);
 assert.equal(byId['uk-ohienko-1962'].path,'/texts/translations/tanakh/uk-ohienko-1962.json');
 assert.equal(byId['uk-ohienko-1962'].provider,'YouVersion');
 assert.equal(byId['uk-ohienko-1962'].providerVersionId,186);
 assert.equal(byId['uk-ohienko-1962'].abbreviation,'UBIO');
 assert.equal(byId['uk-ohienko-1962'].versificationSchemeId,4);
 assert.equal(byId['uk-kulish-puluj-1905'].available,true);
 assert.equal(byId['uk-kulish-puluj-1905'].path,'/texts/translations/tanakh/uk-kulish-puluj-1905.json');
 assert.equal(byId['uk-turkonjak-utt'].available,true);
 assert.equal(byId['uk-varda-torah'].available,false);
 assert.equal(byId['uk-varda-torah'].selectable,false);
 assert.deepEqual(byId['uk-jewish-modern'].composite,[
  {edition:'uk-varda-torah',categories:['Torah']},
  {edition:'uk-turkonjak-utt',categories:['Prophets','Writings']}
 ]);
});

test('reviewed Ohiienko versification joins/splits are recorded explicitly',()=>{
 const d=bundle('uk-ohienko-1962').books;
 const at=(book,ch,v)=>d[book].chapters[ch-1][v-1];
 assert.equal(at('exodus',20,13).ref,'EXO 20:13, EXO 20:14, EXO 20:15, EXO 20:16');
 assert.equal(at('exodus',20,13).note,'combined');
 assert.equal(at('numbers',26,1).ref,'NUM 25:19, NUM 26:1');
 assert.equal(at('psalms',10,1).ref,'PSA 9:22');
 assert.equal(at('psalms',116,1).ref,'PSA 114:1');
 assert.equal(at('isaiah',63,19).ref,'ISA 63:19, ISA 64:1');
 assert.equal(at('malachi',3,19).ref,'MAL 4:1');
 assert.equal(at('nehemiah',7,68).ref,'NEH 7:69');
 assert.equal(at('i-chronicles',12,4).ref,'1CH 12:4');
 assert.equal(at('i-chronicles',12,5).ref,'1CH 12:4');
});

test('Kulish bundle preserves the three reviewed Kavvanah omission supplements',()=>{
 const d=bundle('uk-kulish-puluj-1905').books;
 for(const [book,ch,v] of [['leviticus',21,24],['psalms',148,14],['song-of-songs',1,1]]){
  const record=d[book].chapters[ch-1][v-1];
  assert.equal(record.edition,'kavvanah-supplement-2026');
  assert.match(record.ref,/^KAV /);
 }
});

test('Turkonjak user-supplied bundle exposes only structurally exact books and falls back elsewhere',()=>{
 const data=bundle('uk-turkonjak-utt');
 const meta=registry.editions.find(x=>x.id==='uk-turkonjak-utt');
 assert.equal(data.edition,'uk-turkonjak-utt');
 assert.equal(Object.keys(data.books).length,meta.availableBooks.length);
 let total=0;
 for(const bookId of meta.availableBooks){
  const base=readJson(`public/texts/${bookId}.json`);
  const translated=data.books[bookId];
  assert.equal(translated.chapters.length,base.text.length);
  for(let c=0;c<base.text.length;c++){
   assert.equal(translated.chapters[c].length,base.text[c].length);
   for(const record of translated.chapters[c]){ assert.ok(recordText(record)?.trim()); total++; }
  }
 }
 assert.equal(total,4091);
});
