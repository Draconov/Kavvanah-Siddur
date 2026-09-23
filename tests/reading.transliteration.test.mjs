import test from 'node:test';
import assert from 'node:assert/strict';
const modulePath = process.env.READING_MODULE || '../lib/siddur/reading.ts';
const { transcription, translationFor, moveLayer, withoutVowels, unpointedWords } = await import(modulePath);
const read = (he,lang='ru',pronunciation='sephardi') => transcription(he,lang,pronunciation);

test('pointed bet, kaf and pe distinguish dagesh without changing other consonants',()=>{
 assert.equal(read('בָּבָבָּ בַבַּבַ כַּכַכַּ פַּפַפַּ'),'баваба вабава кахака пафапа');
 assert.equal(read('בָּבָבָּ בַבַּבַ כַּכַכַּ פַּפַפַּ','uk'),'баваба вабава кахака пафапа');
 assert.equal(read('בָּ בָ כָּ כָ פָּ פָ שָׁ שָׂ'),'ба ва ка ха па фа ша са');
});
test('letter boundaries survive Cyrillic rendering of qof-he and tav-shin',()=>{
 assert.equal(read('וַיַּקְהֵל הִתְשַׁחֲווּ'),'вайакхел хитшахаву');
 assert.equal(read('וַיַּקְהֵל הִתְשַׁחֲווּ','uk'),'ваякгел гітшахаву');
});
test('maqaf context preserves qamats qatan and silent final he',()=>{
 assert.equal(read('חָק־לְךָ רָב־חֶסֶד תָם־ מָר־'),'хок-леха ров-хесед том- мор-');
 assert.equal(read('מַה־טֹּבוּ אֵיפֹה־אַתָּה הֱיֵה־ בָּהּ־'),'ма-тову ейфо-ата хейе- бах-');
 assert.equal(read('חָק־לְךָ רָב־חֶסֶד','uk'),'хок-леха ров-хесед');
});
test('silent final he is omitted but mappiq and consonantal he remain audible',()=>{
 assert.equal(read('אַתָּה מוֹדֶה פַּרְעֹה בָּהּ הוּא'),'ата моде паро бах ху');
 assert.equal(read('אַתָּה מוֹדֶה פַּרְעֹה בָּהּ הוּא','uk'),'ата моде паро баг гу');
});
test('vocal and silent sheva, shuruq, hiriq-yod, matres and furtive patah',()=>{
 assert.equal(read('שְׁמַע יִשְׂרָאֵל מַלְכֵּנוּ בִּי רוּחַ כָּל חָכְמָה'),'шема йисраел малкену би руах кол хохма');
 assert.equal(read('שְׁמַע יִשְׂרָאֵל מַלְכֵּנוּ בִּי רוּחַ כָּל חָכְמָה','uk'),'шема їсраел малкену бі руах кол хохма');
});
test('siddur stress marks do not create an extra vowel after a short vowel',()=>{
 assert.equal(read('שֶׁהֶחֱזַֽרְתָּ'),'шехехезарта');
 assert.equal(read('שֶׁהֶחֱזַֽרְתָּ','uk'),'шегехезарта');
 assert.equal(transcription('שֶׁהֶחֱזַֽרְתָּ','ru','sephardi','tanakh'),'шехехезарета');
 assert.equal(read('שֶׁהֶחֱזַֽרְתָּ'),'шехехезарта');
});
test('Ashkenazi distinguishes tav without dagesh, qamats, tsere, holam and suffix av',()=>{
 assert.equal(read('שַׁבָּת תּוֹרָה מֶלֶךְ אֱלֹהֵינוּ דְּבָרָיו','en','ashkenazi'),'shabos toyro melekh eloyheynu devorov');
 assert.equal(read('שַׁבָּת תּוֹרָה מֶלֶךְ אֱלֹהֵינוּ דְּבָרָיו','ru','ashkenazi'),'шабос тойро мелех елойхейну деворов');
});
test('divine-name readings and exact abbreviations are mapped before transliteration',()=>{
 assert.equal(read('יהוה יְהֹוִה יְיָ יי ײַ ה׳ לַיהוָה'),'Адонай Елохим Адонай Адонай Адонай Адонай ла-Адонай');
 assert.equal(read('יהוה יְהֹוִה יְיָ יי ײַ ה׳ לַיהוָה','uk','ashkenazi'),'Адоной Елойгім Адоной Адоной Адоной Адоной ла-Адоной');
});
test('pointed prefixes on double-yod names keep their supplied vowels',()=>{
 assert.equal(read('לַייָ לַיְיָ בַּיי וּלַייָ'),'ла-Адонай ла-Адонай ба-Адонай ула-Адонай');
 assert.equal(read('לַייָ','uk','ashkenazi'),'ла-Адоной');
 assert.equal(read("לה' ליי אייר"),"לה' ליי אייר");
});
test('quotation marks and paseq do not merge words or enter sound parsing',()=>{
 assert.equal(read('בָּרוּךְ׀אַתָּה'),'барух|ата');
 assert.equal(read('"יְיָ" יְיָ״ אַתָּה׳'),'"Адонай" Адонай״ ата׳');
 assert.equal(read('הֵ"א יוּ"ד וָא"ו וְתַרְיַ"ג'),'хе йуд вав ветарйаг');
});
test('the Lulav source typo is corrected only for reading; other malformed marks remain intact',()=>{
 const source='בָּרוּךְ בְּמִצְוׂתָיו אַתָּה';
 assert.equal(read(source),'барух бемицвотав ата');
 assert.equal(read(source,'uk'),'барух беміцвотав ата');
 assert.equal(source,'בָּרוּךְ בְּמִצְוׂתָיו אַתָּה');
 assert.equal(read('בָּרוּךְ מִצְׂוָה אַתָּה'),'барух מִצְׂוָה ата');
});
test('unpointed words are preserved and identified instead of assigning invented vowels',()=>{
 assert.equal(read('ברוך אתה מלך בָּרוּךְ אַתָּה'),'ברוך אתה מלך барух ата');
 assert.deepEqual(unpointedWords('ברוך אתה מלך בָּרוּךְ אַתָּה הוּא יי יהוה'),['ברוך','אתה','מלך']);
 assert.deepEqual(unpointedWords('הוּא צוּר שׁוּב בִּי'),[]);
 assert.deepEqual(unpointedWords('משֶׁה קְדשִׁים שׁוֹמֵר רוּחַ'),[]);
 assert.equal(read('אֶל־משֶׁה קְדשִׁים'),'ел-моше кедошим');
});
test('source Hebrew is immutable and external non-Hebrew text is preserved',()=>{
 const he='בָּרוּךְ אַתָּה';const copy=he;
 assert.equal(read(he+' (repeat 2x)'),'барух ата (repeat 2x)');
 assert.equal(he,copy);
 assert.equal(read(he.normalize('NFC')),read(he.normalize('NFD')));
 assert.equal(withoutVowels('שַׁבָּת'),'שבת');
 assert.equal(withoutVowels('שַׁבָּת׀'),'שבת׀');
});
test('translationFor and moveLayer retain existing behavior',()=>{
 assert.equal(translationFor({he:'שלום',en:'Peace'},'ru','test',{}),null);
 assert.equal(translationFor({he:'שלום',en:'Peace'},'ru','test',{'test:ru':'Мир'}),'Мир');
 assert.deepEqual(moveLayer(['hebrew','transliteration','translation'],'translation',-1),['hebrew','translation','transliteration']);
 assert.deepEqual(moveLayer(['hebrew'],'hebrew',-1),['hebrew']);
});

test('corpus-backed pointing recovers missing readings without changing source',()=>{
 const he='אֶל־משֶׁה קְדשִׁים וְתִירשְׁ֒ךָ';
 assert.equal(read(he,'uk'),'ел-моше кедошім ветірошеха');
 assert.equal(he,'אֶל־משֶׁה קְדשִׁים וְתִירשְׁ֒ךָ');
 assert.equal(read('יִשְׂרָאֵל חַיִּים יֶלֶד יוּד','uk'),'їсраел хаїм єлед юд');
 assert.equal(read('Бйа external text','uk'),'Бйа external text');
});
