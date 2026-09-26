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

test('Turkonjak bundle exposes all reviewed Tanakh books with narrow per-verse fallback',()=>{
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
 assert.equal(total,23206);
});

test('Turkonjak reviewed LXX mappings preserve per-book provenance',()=>{
 const d=bundle('uk-turkonjak-utt').books;
 const at=(book,ch,v)=>d[book].chapters[ch-1][v-1];
 assert.equal(at('genesis',32,1).ref,'TUB GEN 31:55');
 assert.equal(at('genesis',33,7).ref,'TUB GEN 33:6');
 assert.equal(at('genesis',33,7).note,'combined');
 assert.equal(at('genesis',31,51).edition,'uk-ohienko-1962');
 assert.equal(at('exodus',20,13).ref,'TUB EXO 20:13, TUB EXO 20:14, TUB EXO 20:15, TUB EXO 20:16');
 assert.equal(at('exodus',20,13).note,'combined');
 assert.equal(at('exodus',36,8).edition,'uk-ohienko-1962');
 assert.equal(at('exodus',38,9).ref,'TUB EXO 37:7');
 assert.equal(at('exodus',38,30).ref,'TUB EXO 39:7, TUB EXO 39:9');
 assert.equal(at('exodus',39,1).ref,'TUB EXO 36:8');
 assert.equal(at('exodus',39,39).edition,'uk-ohienko-1962');
 assert.equal(at('deuteronomy',5,17).ref,'TUB DEU 5:17, TUB DEU 5:18, TUB DEU 5:19, TUB DEU 5:20');
 assert.equal(at('deuteronomy',5,18).ref,'TUB DEU 5:21');
 assert.equal(at('deuteronomy',2,14).ref,'TUB DEU 2:13');
 assert.equal(at('judges',4,1).ref,'TUB 5:1 → JDG 4:1');
 assert.equal(at('judges',11,1).ref,'TUB 13:1 → JDG 11:1');
 assert.equal(at('ii-kings',18,21).ref,'TUB 2KI 18:20');
 assert.equal(at('ii-kings',18,21).note,'combined');
 assert.equal(at('job',21,31).ref,'TUB JOB 21:30');
 assert.equal(at('job',40,5).ref,'TUB JOB 40:4');
 assert.equal(at('psalms',10,1).ref,'TUB PSA 9:22');
 assert.equal(at('psalms',116,9).ref,'TUB PSA 114:9');
 assert.equal(at('psalms',142,1).ref,'TUB PSA 141:1');
 assert.equal(at('song-of-songs',1,2).ref,'TUB SNG 1:1');
 assert.equal(at('song-of-songs',1,1).edition,'uk-ohienko-1962');
 assert.match(at('song-of-songs',1,1).ref,/Ohiienko fallback/);
 assert.equal(at('isaiah',8,23).ref,'TUB ISA 8:23, TUB ISA 8:24');
 assert.equal(at('isaiah',45,25).ref,'TUB ISA 45:24');
 assert.equal(at('isaiah',63,19).ref,'TUB ISA 63:19, TUB ISA 63:20');
 assert.equal(at('hosea',5,15).ref,'TUB HOS 5:15, TUB HOS 5:16');
 assert.equal(at('numbers',1,24).ref,'TUB NUM 1:36');
 assert.equal(at('numbers',10,34).ref,'TUB NUM 10:36');
 assert.equal(at('numbers',26,15).ref,'TUB NUM 26:24');
 assert.equal(at('numbers',26,23).ref,'TUB NUM 26:19 [Tola/Puvah families]');
 assert.equal(at('joshua',8,30).ref,'TUB JOS 9:3');
 assert.equal(at('joshua',20,4).edition,'uk-ohienko-1962');
 assert.equal(at('joshua',24,29).ref,'TUB JOS 24:30');
 assert.equal(at('i-samuel',17,12).edition,'uk-ohienko-1962');
 assert.equal(at('i-samuel',17,32).ref,'TUB 1SA 17:12');
 assert.equal(at('i-samuel',18,6).ref,'TUB 1SA 18:1');
 assert.equal(at('i-kings',2,35).ref,'TUB 1KI 2:35 [canonical clause]');
 assert.equal(at('i-kings',2,36).ref,'TUB 1KI 2:50');
 assert.equal(at('i-kings',3,1).edition,'uk-ohienko-1962');
 assert.equal(at('i-kings',3,2).ref,'TUB 1KI 3:1');
 assert.equal(at('i-kings',4,20).ref,'TUB 1KI 2:61 [canonical clause]');
 assert.equal(at('i-kings',5,5).ref,'TUB 1KI 2:67 [canonical clause]');
 assert.equal(at('i-kings',6,37).ref,'TUB 1KI 6:4');
 assert.equal(at('i-kings',7,13).ref,'TUB 1KI 7:1');
 assert.equal(at('i-kings',7,17).edition,'uk-ohienko-1962');
 assert.equal(at('i-kings',7,51).ref,'TUB 1KI 7:37');
 assert.equal(at('i-kings',9,15).edition,'uk-ohienko-1962');
 assert.equal(at('i-kings',9,26).ref,'TUB 1KI 9:15');
 assert.equal(at('i-kings',12,25).ref,'TUB 1KI 12:48');
 assert.equal(at('i-kings',14,21).ref,'TUB 1KI 14:1');
 assert.equal(at('i-kings',20,1).ref,'TUB 1KI 21:1');
 assert.equal(at('i-kings',21,1).ref,'TUB 1KI 20:1');
 assert.equal(at('i-kings',22,47).edition,'uk-ohienko-1962');
 assert.equal(at('i-kings',22,51).ref,'TUB 1KI 22:47');
 assert.equal(at('ii-chronicles',15,19).ref,'TUB 2CH 15:18 [final sentence]');
 assert.equal(at('ii-chronicles',27,8).edition,'uk-ohienko-1962');
 assert.equal(at('ii-chronicles',36,23).ref,'TUB 2CH 36:27 [canonical clause only]');
 assert.equal(at('nehemiah',3,15).ref,'TUB NEH 3:14, TUB NEH 3:15');
 assert.equal(at('nehemiah',7,68).ref,'TUB NEH 7:69');
 assert.equal(at('nehemiah',11,36).ref,'TUB NEH 11:32');
 assert.equal(at('proverbs',16,1).edition,'uk-ohienko-1962');
 assert.equal(at('proverbs',31,25).ref,'TUB PRO 31:26');
 assert.equal(at('proverbs',31,26).ref,'TUB PRO 31:25');
 assert.equal(at('ezekiel',1,28).ref,'TUB EZK 1:28, TUB EZK 1:29');
 assert.equal(at('ezekiel',7,1).edition,'uk-ohienko-1962');
 assert.equal(at('ezekiel',32,1).edition,'uk-ohienko-1962');
 assert.equal(at('esther',1,1).ref,'TUB EST 1:18');
 assert.equal(at('esther',3,13).ref,'TUB EST 3:13 [canonical clause]');
 assert.equal(at('esther',5,3).ref,'TUB EST 5:1');
 assert.equal(at('esther',9,5).edition,'uk-ohienko-1962');
 assert.equal(at('esther',9,6).ref,'TUB EST 9:5');
 assert.equal(at('esther',10,3).ref,'TUB EST 10:3 [canonical clause]');
 assert.equal(at('daniel',3,24).ref,'TUB DAN 3:91');
 assert.equal(at('daniel',3,31).ref,'TUB DAN 4:1');
 assert.equal(at('daniel',4,1).ref,'TUB DAN 4:4');
 assert.equal(at('jeremiah',2,8).ref,'TUB JER 2:7 [first clause]');
 assert.equal(at('jeremiah',2,9).ref,'TUB JER 2:7 [final clause]');
 assert.equal(at('jeremiah',7,2).ref,'TUB JER 7:1');
 assert.equal(at('jeremiah',17,5).ref,'TUB JER 17:1');
 assert.equal(at('jeremiah',23,7).ref,'TUB JER 23:41');
 assert.equal(at('jeremiah',31,35).ref,'TUB JER 31:36');
 assert.equal(at('jeremiah',33,14).edition,'uk-ohienko-1962');
 assert.equal(at('jeremiah',39,14).ref,'TUB JER 39:4');
 assert.equal(at('jeremiah',49,7).ref,'TUB JER 49:6');
 let fallbacks=0;
 for(const book of Object.values(d)) for(const chapter of book.chapters) for(const record of chapter)
  if(record?.edition==='uk-ohienko-1962') fallbacks++;
 assert.equal(fallbacks,532);
});
