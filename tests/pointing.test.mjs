import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {readingCorrectionKey,restorePointing,ukrainianIotation} from '../lib/siddur/pointing.ts';
import {wordCorrections as corrections} from '../lib/siddur/reading-corrections.ts';
const marks=s=>s.normalize('NFKD').match(/[\u0591-\u05AF\u05BD\u05BF\u05C4\u05C5]/gu)??[];
test('restores Shema omissions with original cantillation/stress retained',()=>{
 for(const [from,to] of [['משֶׁה','מֹשֶׁה'],['קְדשִׁים','קְדֹשִׁים'],['וְתִירשְׁ֒ךָ','וְתִירֹשְׁ֒ךָ'],['אֱלֽהֵינוּ','אֱלֹֽהֵינוּ']]){
  assert.equal(restorePointing(from,corrections),to.normalize('NFKD'));
  assert.deepEqual(marks(restorePointing(from,corrections)),marks(from));
 }
});
test('key retains sheva, vowels, dagesh, and shin distinction',()=>{
 assert.equal(readingCorrectionKey('בְּרָכָֽה'),'בְּרָכָה'.normalize('NFKD'));
 assert.notEqual(readingCorrectionKey('בָרוּךְ'),readingCorrectionKey('בָּרוּךְ'));
 assert.notEqual(readingCorrectionKey('שׂ'),readingCorrectionKey('שׁ'));
});
test('all generated corrections preserve supplied marks and consonants',()=>{
 for(const [from,to]of Object.entries(corrections)){
  const result=restorePointing(from,corrections);
  assert.equal(result.replace(/[^א-ת]/g,''),from.replace(/[^א-ת]/g,''));
  assert.equal(readingCorrectionKey(result),readingCorrectionKey(to),from);
 }
});
test('source instructions and genuinely ambiguous words stay untouched',()=>{
 for(const w of ['יאמר','כאן','פלוני','שכָר','נַעֲשה','בָרוּךְ','בָּרוּךְ'])assert.equal(restorePointing(w,corrections),w.normalize('NFKD'));
});
test('Ukrainian iotation renders supported yod vowels without changing йо',()=>{
 for(const [from,to]of [['йісраел','їсраел'],['хайім','хаїм'],['йегі','єгі'],['йааков','яаков'],['йуда','юда'],['Йісраел','Їсраел'],['гайом','гайом'],['адонай','адонай']])assert.equal(ukrainianIotation(from),to);
});

test('consonant plus yod retains the sound rather than softening the consonant',()=>{assert.equal(ukrainianIotation('бйа мйі'),'б’я м’ї');});

test('every restored form exists in the bundled Hebrew source corpus',()=>{
 const forms=new Set();
 for(const file of fs.readdirSync(new URL('../public/texts/',import.meta.url)).filter(f=>f.endsWith('.json')&&f!=='catalog.json')){
  const d=JSON.parse(fs.readFileSync(new URL('../public/texts/'+file,import.meta.url)));
  const paragraphs=d.sections?d.sections.flatMap(s=>s.paragraphs):d.text.flat();
  for(const p of paragraphs)for(const word of p.he.match(/[א-ת][א-ת\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*/gu)??[])forms.add(readingCorrectionKey(word));
 }
 for(const word of Object.values(corrections))assert.ok(forms.has(readingCorrectionKey(word)),word);
});
