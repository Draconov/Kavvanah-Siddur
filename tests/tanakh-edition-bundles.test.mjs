import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const readJson=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));
const catalog=readJson('public/texts/catalog.json');
const registry=readJson('lib/siddur/translation-editions.json');
const vardaManifest=readJson('scripts/translations/varda-source-manifest.json');
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
 assert.equal(byId['uk-varda-torah'].available,true);
 assert.equal(byId['uk-varda-torah'].selectable,false);
 assert.deepEqual(byId['uk-jewish-modern'].composite,[
  {edition:'uk-varda-torah',categories:['Torah']},
  {edition:'uk-turkonjak-utt',categories:['Prophets','Writings']}
 ]);
});



test('Varda Torah component covers the complete supplied 386-page Pentateuch',()=>{
 assert.equal(vardaManifest.pageCount,386);
 assert.equal(vardaManifest.extractableTextLayer,true);
 assert.equal(vardaManifest.textLayerKind,'OCR');
 assert.equal(vardaManifest.firstVerse,'GEN 1:1');
 assert.equal(vardaManifest.lastVerse,'DEU 34:12');
 assert.equal(vardaManifest.displayedVardaVerses,5846);
 const data=bundle('uk-varda-torah');
 const torahIds=['genesis','exodus','leviticus','numbers','deuteronomy'];
 assert.equal(data.edition,'uk-varda-torah');
 assert.deepEqual(Object.keys(data.books),torahIds);
 let total=0,maxPage=0;
 for(const bookId of torahIds){
  const base=readJson(`public/texts/${bookId}.json`);
  const translated=data.books[bookId];
  assert.equal(translated.chapters.length,base.text.length,`${bookId} chapter count`);
  for(let c=0;c<base.text.length;c++){
   assert.equal(translated.chapters[c].length,base.text[c].length,`${bookId} ${c+1} verse count`);
   for(const record of translated.chapters[c]){
    assert.ok(recordText(record)?.trim());
    assert.equal(record.edition,'uk-varda-torah');
    assert.match(record.ref,/^Varda PDF (?:p\.|pp\.)\d+(?:–\d+)? · /);
    const match=record.ref.match(/^Varda PDF (?:p\.|pp\.)(\d+)(?:–(\d+))?/);
    maxPage=Math.max(maxPage,Number(match?.[2]??match?.[1]??0));
    total++;
   }
  }
 }
 assert.equal(total,5846);
 assert.equal(maxPage,386);
 assert.equal(data.books.genesis.chapters[0][0].edition,'uk-varda-torah');
 assert.equal(data.books.exodus.chapters[22][9].edition,'uk-varda-torah'); // Exodus 23:10
 assert.equal(data.books.leviticus.chapters[0][0].edition,'uk-varda-torah');
 assert.equal(data.books.numbers.chapters[0][0].edition,'uk-varda-torah');
 assert.equal(data.books.deuteronomy.chapters[33][11].edition,'uk-varda-torah'); // Deuteronomy 34:12
});

test('Batch 19 Varda proofreading keeps the Torah clean and source-checked',()=>{
 const data=bundle('uk-varda-torah');
 const torahIds=['genesis','exodus','leviticus','numbers','deuteronomy'];
 const records=[];
 for(const bookId of torahIds){
  for(const chapter of data.books[bookId].chapters){
   for(const record of chapter) records.push(record);
  }
 }
 assert.equal(records.length,5846);
 const texts=records.map(recordText);
 for(const text of texts){
  assert.doesNotMatch(text,/[A-Za-z]/,'Latin OCR glyph leaked into Varda Torah');
  assert.doesNotMatch(text,/\d/,'verse/page digit leaked into Varda Torah text');
  assert.doesNotMatch(text,/[|¦]/,'OCR bar leaked into Varda Torah text');
  assert.doesNotMatch(text,/[а-яіїєґ][А-ЯІЇЄҐ]/u,'lowercase-uppercase OCR collision remains');
  assert.doesNotMatch(text,/(?:^|[^А-Яа-яІіЇїЄєҐґʼ’'\-])(?:їі|ії|ІТ)(?=$|[^А-Яа-яІіЇїЄєҐґʼ’'\-])/u,'isolated OCR token remains');
  assert.doesNotMatch(text,/[,.;:]\?/,'OCR question mark leaked after punctuation');
  assert.doesNotMatch(text,/^!/,'OCR exclamation marker leaked at verse start');
  assert.equal((text.match(/\[/g)??[]).length,(text.match(/\]/g)??[]).length,'unbalanced editorial brackets');
 }
 const corpus=texts.join('\n');
 assert.doesNotMatch(corpus,/Дарон|Незнаю|незможуть|зкишить|володі тиму|ре тулярне|хліб-навко|святилище них|одноріяне|Шелумісля|Деусля|іп'ять|ізамість|ініж|івино|їстільки|бтільки|Ще\)|РИМІТКУ до нього|ляглаїі/,'known Batch 19 OCR residue returned');
 const at=(book,ch,v)=>recordText(data.books[book].chapters[ch-1][v-1]);
 assert.equal(at('genesis',7,12),'І лився дощ на землю сорок днів та сорок ночей.');
 assert.match(at('genesis',13,14),/і на захід;$/);
 assert.match(at('genesis',13,15),/^усю землю,/);
 assert.equal(at('genesis',50,12),'Сини [Ізраїля] зробили з ним те, що він заповів їм:');
 assert.match(at('genesis',50,13),/^вони віднесли його в землю Ханаанську/);
 assert.match(at('exodus',7,25),/зіпсував річку,$/);
 assert.match(at('exodus',7,26),/^і сказав Господь до Мойсея:/);
 assert.match(at('exodus',16,16),/скільки йому з'їсти;/);
 assert.equal(at('exodus',39,11),'другий ряд — бірюзи, сапфіру й аметисту;');
 assert.match(at('leviticus',1,13),/^нутрощі та гомілки \[тварини\].*\[Це\] — запашний дар їжі/u);
 assert.match(at('numbers',9,22),/тільки коли вона піднімалася, тоді вони піднімали свій табір\.$/);
 assert.match(at('numbers',9,23),/^За Господнім словом вони зупинялися/);
 assert.match(at('numbers',29,20),/^Третього дня:/);
 assert.match(at('deuteronomy',33,18),/^Про Зевулуна \[та Іссахара\] сказав:/);
});

test('Batch 20 semantic proofreading repairs Cyrillic OCR and verse-boundary residue',()=>{
 const data=bundle('uk-varda-torah');
 const at=(book,ch,v)=>recordText(data.books[book].chapters[ch-1][v-1]);
 const corpus=['genesis','exodus','leviticus','numbers','deuteronomy']
  .flatMap(book=>data.books[book].chapters.flat().map(recordText)).join('\n');
 assert.doesNotMatch(corpus,/Горен-Їаатаді|Мойсеся|коліена|Зустрічії|нечите|стови вогняний|\[голіві\]|шекеліві|У«Скажіть|Йосипаї|Ввони/,'known Batch 20 semantic OCR residue returned');
 assert.equal(at('genesis',27,15),'Взяла Ревекка найкращу одежу Ісава, свого старшого сина, що була в її домі, і дала Якову, своєму молодшому синові, щоб він одягнув її,');
 assert.equal(at('genesis',27,16),'а його руки та його гладку шию вона обклала козлячими шкірками.');
 assert.match(at('genesis',27,18),/^і ввійшов він до батька свого/);
 assert.match(at('genesis',34,31),/^А ті сказали:/);
 assert.match(at('genesis',37,14),/^— Ось я, — відповів Йосип\. І сказав Яків йому:/);
 assert.match(at('genesis',50,11),/Горен-Гаатаді/);
 assert.match(at('exodus',22,23),/^і спалахне гнів Мій/);
 assert.match(at('numbers',31,12),/^і доставили .* до Мойсея,/);
 assert.match(at('numbers',31,43),/\[голів\] дрібної худоби/);
 assert.match(at('deuteronomy',34,1),/^Зійшов Мойсей .* і всю \[землю\]$/);
});

test('Jewish modern composite uses Varda for all Torah and Turkonjak for Neviim/Ketuvim',()=>{
 const data=bundle('uk-jewish-modern');
 assert.equal(Object.keys(data.books).length,catalog.books.length);
 assert.equal(data.books.genesis.chapters[0][0].edition,'uk-varda-torah');
 assert.equal(data.books.exodus.chapters[39][37].edition,'uk-varda-torah');
 assert.equal(data.books.leviticus.chapters[0][0].edition,'uk-varda-torah');
 assert.equal(data.books.numbers.chapters[0][0].edition,'uk-varda-torah');
 assert.equal(data.books.deuteronomy.chapters[33][11].edition,'uk-varda-torah');
 assert.ok(['uk-turkonjak-utt','uk-ohienko-1962'].includes(data.books.joshua.chapters[0][0].edition));
 assert.ok(['uk-turkonjak-utt','uk-ohienko-1962'].includes(data.books.isaiah.chapters[0][0].edition));
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
 assert.equal(at('genesis',31,51).ref,'TUB GEN 31:48 [canonical 31:51 clause]');
 assert.equal(at('exodus',20,13).ref,'TUB EXO 20:13, TUB EXO 20:14, TUB EXO 20:15, TUB EXO 20:16');
 assert.equal(at('exodus',20,13).note,'combined');
 assert.equal(at('exodus',36,8).ref,'TUB EXO 37:1');
 assert.equal(at('exodus',37,18).ref,'TUB EXO 38:14, TUB EXO 38:15');
 assert.equal(at('exodus',38,4).ref,'TUB EXO 38:24 [altar network clause]');
 assert.equal(at('exodus',38,9).ref,'TUB EXO 37:7');
 assert.equal(at('exodus',38,30).ref,'TUB EXO 39:7, TUB EXO 39:9');
 assert.equal(at('exodus',39,1).ref,'TUB EXO 36:8');
 assert.equal(at('exodus',39,39).edition,'uk-ohienko-1962');
 assert.equal(at('exodus',40,7).ref,'TUB EXO 30:18 [canonical repeated 40:7 clause]');
 assert.equal(at('exodus',40,11).ref,'TUB EXO 30:28-29 [canonical repeated 40:11 basin/anointing clause]');
 assert.equal(at('exodus',40,31).ref,'TUB EXO 38:27 [canonical repeated 40:31 clause]');
 assert.equal(at('exodus',40,32).ref,'TUB EXO 38:27 [canonical repeated 40:32 clause]');
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
 assert.equal(at('psalms',116,14).ref,'TUB PSA 115:9 [canonical repeated 116:14 clause]');
 assert.equal(at('psalms',142,1).ref,'TUB PSA 141:1');
 assert.equal(at('song-of-songs',1,2).ref,'TUB SNG 1:1');
 assert.equal(at('song-of-songs',1,1).edition,'uk-ohienko-1962');
 assert.match(at('song-of-songs',1,1).ref,/Ohiienko fallback/);
 assert.equal(at('isaiah',8,23).ref,'TUB ISA 8:23, TUB ISA 8:24');
 assert.equal(at('isaiah',45,25).ref,'TUB ISA 45:24');
 assert.equal(at('isaiah',63,19).ref,'TUB ISA 63:19, TUB ISA 63:20');
 assert.equal(at('hosea',5,15).ref,'TUB HOS 5:15, TUB HOS 5:16');
 assert.equal(at('leviticus',19,29).ref,'TUB 19:28 [canonical 19:29 clause]');
 assert.equal(at('ii-samuel',16,2).ref,'TUB 16:1 [canonical 16:2 clause]');
 assert.equal(at('i-chronicles',11,9).ref,'TUB 11:8 [canonical 11:9 clause]');
 assert.equal(at('lamentations',4,5).ref,'TUB 4:4 [canonical 4:5 clause]');
 assert.equal(at('numbers',1,24).ref,'TUB NUM 1:36');
 assert.equal(at('numbers',10,34).ref,'TUB NUM 10:36');
 assert.equal(at('numbers',26,15).ref,'TUB NUM 26:24');
 assert.equal(at('numbers',26,23).ref,'TUB NUM 26:19 [Tola/Puvah families]');
 assert.equal(at('joshua',7,3).ref,'TUB JOS 7:2 [report clause]');
 assert.equal(at('joshua',8,12).ref,'TUB JOS 8:12');
 assert.equal(at('joshua',8,30).ref,'TUB JOS 9:3');
 assert.equal(at('joshua',20,4).edition,'uk-ohienko-1962');
 assert.equal(at('joshua',24,29).ref,'TUB JOS 24:30');
 assert.equal(at('i-samuel',17,12).edition,'uk-ohienko-1962');
 assert.equal(at('i-samuel',17,32).ref,'TUB 1SA 17:12');
 assert.equal(at('i-samuel',18,6).ref,'TUB 1SA 18:1');
 assert.equal(at('i-kings',2,35).ref,'TUB 1KI 2:35 [canonical clause]');
 assert.equal(at('i-kings',2,36).ref,'TUB 1KI 2:50');
 assert.equal(at('i-kings',3,1).ref,'TUB 1KI 2:38 [canonical 3:1 clause]');
 assert.equal(at('i-kings',3,2).ref,'TUB 1KI 3:1');
 assert.equal(at('i-kings',4,20).ref,'TUB 1KI 2:61 [canonical clause]');
 assert.equal(at('i-kings',5,5).ref,'TUB 1KI 2:67 [canonical clause]');
 assert.equal(at('i-kings',5,31).ref,'TUB 1KI 6:2');
 assert.equal(at('i-kings',5,32).ref,'TUB 1KI 6:3');
 assert.equal(at('i-kings',6,37).ref,'TUB 1KI 6:4');
 assert.equal(at('i-kings',7,13).ref,'TUB 1KI 7:1');
 assert.equal(at('i-kings',7,17).ref,'TUB 1KI 7:5');
 assert.equal(at('i-kings',7,22).edition,'uk-ohienko-1962');
 assert.equal(at('i-kings',7,25).ref,'TUB 1KI 7:13');
 assert.equal(at('i-kings',7,47).ref,'TUB 1KI 7:32');
 assert.equal(at('i-kings',7,51).ref,'TUB 1KI 7:37');
 assert.equal(at('i-kings',8,12).ref,'TUB 1KI 8:53 [canonical 8:12 poem clause]');
 assert.equal(at('i-kings',8,13).ref,'TUB 1KI 8:53 [canonical 8:13 poem clause]');
 assert.equal(at('i-kings',8,53).ref,'TUB 1KI 8:53 [canonical 8:53 clause]');
 assert.equal(at('i-kings',9,15).edition,'uk-ohienko-1962');
 assert.equal(at('i-kings',9,24).ref,'TUB 1KI 2:41');
 assert.equal(at('i-kings',9,25).ref,'TUB 1KI 2:42');
 assert.equal(at('i-kings',9,26).ref,'TUB 1KI 9:15');
 assert.equal(at('i-kings',11,3).ref,'TUB 1KI 11:1 [canonical 11:3 clause]');
 assert.equal(at('i-kings',12,2).ref,'TUB 1KI 11:43 [canonical 12:2 clause]');
 assert.equal(at('i-kings',12,25).ref,'TUB 1KI 12:48');
 assert.equal(at('i-kings',14,1).ref,'TUB 1KI 12:31 [canonical 14:1 clause]');
 assert.equal(at('i-kings',14,11).ref,'TUB 1KI 12:36 [canonical 14:11 clause]');
 assert.equal(at('i-kings',14,12).ref,'TUB 1KI 12:35 [canonical 14:12 clause]');
 assert.equal(at('i-kings',14,13).ref,'TUB 1KI 12:36 [canonical 14:13 clause]');
 assert.equal(at('i-kings',14,17).ref,'TUB 1KI 12:37 [canonical 14:17 event]');
 assert.equal(at('i-kings',16,28).ref,'TUB 1KI 16:27 [canonical 16:28 clause]');
 assert.equal(at('i-kings',13,27).ref,'TUB 1KI 13:13 [canonical repeated 13:27 clause]');
 assert.equal(at('i-kings',15,6).ref,'TUB 1KI 14:10 [canonical repeated 15:6 clause]');
 assert.equal(at('i-kings',15,32).ref,'TUB 1KI 15:16 [canonical repeated 15:32 clause]');
 assert.equal(at('i-kings',19,16).ref,'TUB 1KI 19:15 [Jehu/Elisha clause]');
 assert.equal(at('i-kings',14,21).ref,'TUB 1KI 14:1');
 assert.equal(at('i-kings',20,1).ref,'TUB 1KI 21:1');
 assert.equal(at('i-kings',21,1).ref,'TUB 1KI 20:1');
 assert.equal(at('i-kings',22,47).edition,'uk-ohienko-1962');
 assert.equal(at('i-kings',22,51).ref,'TUB 1KI 22:47');
 assert.equal(at('ii-chronicles',15,19).ref,'TUB 2CH 15:18 [final sentence]');
 assert.equal(at('ii-chronicles',27,8).ref,'TUB 2CH 27:1 [canonical repeated 27:8 clause]');
 assert.equal(at('ii-chronicles',36,23).ref,'TUB 2CH 36:27 [canonical clause only]');
 assert.equal(at('nehemiah',2,18).ref,'TUB NEH 2:17 [canonical 2:18 clause]');
 assert.equal(at('nehemiah',3,15).ref,'TUB NEH 3:14, TUB NEH 3:15');
 assert.equal(at('nehemiah',7,68).ref,'TUB NEH 7:69');
 assert.equal(at('nehemiah',11,36).ref,'TUB NEH 11:32');
 assert.equal(at('proverbs',16,1).edition,'uk-ohienko-1962');
 assert.equal(at('proverbs',16,4).ref,'TUB PRO 16:5');
 assert.equal(at('proverbs',16,17).ref,'TUB PRO 16:13 [canonical clauses]');
 assert.equal(at('proverbs',18,22).ref,'TUB PRO 18:22 [canonical clause]');
 assert.equal(at('proverbs',18,23).edition,'uk-ohienko-1962');
 assert.equal(at('proverbs',19,4).ref,'TUB PRO 19:1');
 assert.equal(at('proverbs',19,1).edition,'uk-ohienko-1962');
 assert.equal(at('proverbs',20,20).ref,'TUB PRO 20:9 [canonical 20:20 clause]');
 assert.equal(at('proverbs',20,23).ref,'TUB PRO 20:13 [canonical 20:23 clause]');
 assert.equal(at('proverbs',20,14).edition,'uk-ohienko-1962');
 assert.equal(at('proverbs',31,25).ref,'TUB PRO 31:26');
 assert.equal(at('proverbs',31,26).ref,'TUB PRO 31:25');
 assert.equal(at('ezekiel',1,28).ref,'TUB EZK 1:28, TUB EZK 1:29');
 assert.equal(at('ezekiel',7,3).ref,'TUB EZK 7:7');
 assert.equal(at('ezekiel',7,5).edition,'uk-ohienko-1962');
 assert.equal(at('ezekiel',7,6).ref,'TUB EZK 7:10 [end formula]');
 assert.equal(at('ezekiel',22,4).ref,'TUB EZK 22:3 [canonical 22:4 clause]');
 assert.equal(at('ezekiel',24,7).ref,'TUB EZK 24:6 [canonical 24:7 clause]');
 assert.equal(at('ezekiel',30,3).ref,'TUB EZK 30:2 [canonical 30:3 clause]');
 assert.equal(at('ezekiel',30,4).ref,'TUB EZK 30:2 [canonical 30:4 clause]');
 assert.equal(at('ezekiel',34,4).ref,'TUB EZK 34:3 [canonical 34:4 clause]');
 assert.equal(at('ezekiel',32,19).ref,'TUB EZK 32:21 [canonical 32:19 clause]');
 assert.equal(at('ezekiel',32,23).ref,'TUB EZK 32:22-23 [grave clause]');
 assert.equal(at('ezekiel',32,25).edition,'uk-ohienko-1962');
 assert.equal(at('esther',1,1).ref,'TUB EST 1:18');
 assert.equal(at('esther',3,13).ref,'TUB EST 3:13 [canonical clause]');
 assert.equal(at('esther',5,1).ref,'TUB EST 4:31, TUB EST 4:36 [canonical audience clauses]');
 assert.equal(at('esther',5,2).ref,'TUB EST 4:38, TUB EST 4:42 [canonical sceptre clauses]');
 assert.equal(at('esther',5,3).ref,'TUB EST 5:1');
 assert.equal(at('esther',8,9).ref,'TUB EST 8:9');
 assert.equal(at('esther',9,5).edition,'uk-ohienko-1962');
 assert.equal(at('esther',9,6).ref,'TUB EST 9:5');
 assert.equal(at('esther',10,3).ref,'TUB EST 10:3 [canonical clause]');
 assert.equal(at('daniel',3,24).ref,'TUB DAN 3:91');
 assert.equal(at('daniel',3,31).ref,'TUB DAN 4:1');
 assert.equal(at('daniel',4,1).ref,'TUB DAN 4:4');
 assert.equal(at('jeremiah',1,7).ref,'TUB JER 1:6 [canonical 1:7 clause]');
 assert.equal(at('jeremiah',2,8).ref,'TUB JER 2:7 [first clause]');
 assert.equal(at('jeremiah',2,9).ref,'TUB JER 2:7 [final clause]');
 assert.equal(at('jeremiah',7,2).ref,'TUB JER 7:1');
 assert.equal(at('jeremiah',17,5).ref,'TUB JER 17:1');
 assert.equal(at('jeremiah',8,11).ref,'TUB JER 6:14 [canonical repeated 8:11 clause]');
 assert.equal(at('jeremiah',8,12).ref,'TUB JER 6:15 [canonical repeated 8:12 clause]');
 assert.equal(at('jeremiah',14,14).ref,'TUB JER 14:13 [canonical 14:14 clause]');
 assert.equal(at('jeremiah',22,14).ref,'TUB JER 22:12-13 [canonical 22:14 clauses]');
 assert.equal(at('jeremiah',22,19).ref,'TUB JER 22:18 [canonical 22:19 clause]');
 assert.equal(at('jeremiah',30,10).ref,'TUB JER 46:27 [canonical repeated 30:10 clause]');
 assert.equal(at('jeremiah',30,11).ref,'TUB JER 46:28 [canonical repeated 30:11 clause]');
 assert.equal(at('jeremiah',30,22).ref,'TUB JER 32:38 [canonical repeated 30:22 clause]');
 assert.equal(at('jeremiah',23,7).ref,'TUB JER 23:41');
 assert.equal(at('jeremiah',23,27).ref,'TUB JER 23:26 [canonical 23:27 clause]');
 assert.equal(at('jeremiah',32,18).ref,'TUB JER 32:17 [canonical 32:18 clause]');
 assert.equal(at('jeremiah',34,7).ref,'TUB JER 34:5 [canonical 34:7 clause]');
 assert.equal(at('jeremiah',27,12).ref,'TUB JER 27:10-11 [canonical 27:12 address to Zedekiah]');
 assert.equal(at('jeremiah',31,35).ref,'TUB JER 31:36');
 assert.equal(at('jeremiah',33,14).edition,'uk-ohienko-1962');
 assert.equal(at('jeremiah',39,4).ref,'TUB JER 52:7 [canonical repeated 39:4 event]');
 assert.equal(at('jeremiah',39,5).ref,'TUB JER 52:8-9 [canonical repeated 39:5 event]');
 assert.equal(at('jeremiah',39,6).ref,'TUB JER 52:10 [canonical repeated 39:6 event]');
 assert.equal(at('jeremiah',39,7).ref,'TUB JER 52:11 [canonical repeated 39:7 event]');
 assert.equal(at('jeremiah',39,8).ref,'TUB JER 52:13-14 [canonical repeated 39:8 event]');
 assert.equal(at('jeremiah',39,10).ref,'TUB JER 52:16 [canonical repeated 39:10 event]');
 assert.equal(at('jeremiah',39,9).edition,'uk-ohienko-1962');
 assert.equal(at('jeremiah',39,14).ref,'TUB JER 39:4');
 assert.equal(at('jeremiah',49,7).ref,'TUB JER 49:6');
 let fallbacks=0;
 for(const book of Object.values(d)) for(const chapter of book.chapters) for(const record of chapter)
  if(record?.edition==='uk-ohienko-1962') fallbacks++;
 assert.equal(fallbacks,286);
});

test('Varda proofreading removes high-confidence OCR glyph noise and stays synced into Jewish modern',()=>{
 const varda=bundle('uk-varda-torah');
 const modern=bundle('uk-jewish-modern');
 for(const [bookId,book] of Object.entries(varda.books)){
  assert.deepEqual(modern.books[bookId],book,`${bookId} differs in Jewish modern`);
  for(const chapter of book.chapters){
   for(const record of chapter){
    const text=recordText(record);
    assert.doesNotMatch(text,/[A-Za-z|0-9]/);
    assert.equal(/[\u201c\u201d\u201e"]/.test(text),false);
    let editorialDepth=0;
    for(const ch of text){
     if(ch==='[') editorialDepth++;
     else if(ch===']'){
      editorialDepth--;
      assert.ok(editorialDepth>=0,`closing editorial bracket before opening in ${bookId}: ${text}`);
     }
    }
    assert.equal(editorialDepth,0,`unbalanced editorial brackets in ${bookId}: ${text}`);
   }
  }

 const at=(book,ch,v)=>recordText(varda.books[book].chapters[ch-1][v-1]);
 assert.equal(at('genesis',32,25),'він залишився один. І боровся з ним хтось до появи зорі;');
 assert.equal(at('exodus',16,36),'(Омер дорівнює десятій частині ейфи.)');
 assert.equal(at('leviticus',5,1),"якщо хтось, почувши заклик з'явитися на суд, не захоче стати свідком — незважаючи на те що він може дати свідчення, бо бачив [те, що сталося], або має [непрямі] відомості, — то має понести своє покарання;");
 assert.equal(at('leviticus',24,8),'щосуботи, регулярно, нехай [священники] розкладають їх перед Господом; це — вічно належне від народу Ізраїля.');
 assert.equal(at('deuteronomy',31,3),'Господь, Бог твій, Сам піде перед тобою; Він вигубить народи ці, що на шляху твоїм, і ти оволодієш [землею]. — Ісус, він проведе тебе [через Йордан], як говорив Господь.');
 }
});

test('Batch 21 repairs OCR verse-number plus initial-letter artifacts',()=>{
 const data=bundle('uk-varda-torah');
 const at=(book,ch,v)=>recordText(data.books[book].chapters[ch-1][v-1]);
 const corpus=['genesis','exodus','leviticus','numbers','deuteronomy']
  .flatMap(book=>data.books[book].chapters.flat().map(recordText)).join('\n');
 assert.doesNotMatch(corpus,/^(?:Т|Г|М) /m,'verse-number OCR initial residue returned');
 assert.doesNotMatch(corpus,/ЗЗЇ|Уто той|\[Священники\]\)|\[Червоного\]\)/,'known Batch 21 embedded OCR residue returned');
 assert.match(at('genesis',11,5),/^І зійшов Господь/);
 assert.match(at('exodus',14,19),/^І рушив ангел Бога/);
 assert.match(at('deuteronomy',31,30),/^І промовив Мойсей/);
});

test('Batch 22 repairs embedded verse-marker spills and neighboring verse boundaries',()=>{
 const data=bundle('uk-varda-torah');
 const at=(book,ch,v)=>recordText(data.books[book].chapters[ch-1][v-1]);
 assert.equal(at('genesis',7,10),'На сьомий день води Потопу прийшли на землю.');
 assert.match(at('genesis',7,11),/^У шестисотий рік життя Ноя/);
 assert.match(at('genesis',19,24),/^І напустив Господь/);
 assert.match(at('genesis',43,14),/Веніаміна\. А я\? Якщо/);
 assert.match(at('genesis',48,16),/батьків моїх; І нехай буде/);
 assert.equal(at('exodus',15,3),"Господь — Чоловік лайки, יהוה — ім'я Йому!");
 assert.match(at('exodus',16,7),/Славу יהוה.+на יהוה;/);
 assert.match(at('exodus',33,7),/^Це тоді Мойсей взяв свій намет/);
 assert.match(at('leviticus',18,23),/^Не лягай із худобою/);
 assert.match(at('numbers',18,11),/^І це для тебе:/);
 assert.equal(at('numbers',28,22),'і одного козла, як очисну жертву, щоб очистити вас;');
 assert.match(at('numbers',31,1),/^І сказав Господь до Мойсея/);
 assert.match(at('deuteronomy',2,12),/^А на Сеїрі жили раніше Хорреї/);
 assert.match(at('deuteronomy',9,22),/^І біля Тавери, і біля Масси, і в Ківрот-Гаттааві/);
 assert.match(at('deuteronomy',14,22),/^Із року в рік відокремлюй/);
 const corpus=['genesis','exodus','leviticus','numbers','deuteronomy']
  .flatMap(book=>data.books[book].chapters.flat().map(recordText)).join('\n');
 assert.doesNotMatch(corpus,/І Але |І Якщо |І Повісь |І Довжина |І Насадиш |І Так /);
});
