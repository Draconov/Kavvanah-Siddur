import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceAccents,parseWlc} from '../scripts/prepare-tanakh-cantillation.mjs';
import {applyCantillationAccents,displayHebrewMarks,HAS_CANTILLATION} from '../lib/siddur/hebrew-marks.ts';

test('niqqud and te’amim are independent display choices',()=>{
 const original='בְּרֵאשִׁ֖ית';
 assert.equal(displayHebrewMarks(original,true,true),original);
 assert.equal(displayHebrewMarks(original,true,false),'בְּרֵאשִׁית');
 assert.equal(displayHebrewMarks(original,false,true),'בראש֖ית');
 assert.equal(displayHebrewMarks(original,false,false),'בראשית');
});
test('can overlay only verified te’amim without changing consonants or vowel content',()=>{
 const canonical='בְּרֵאשִׁית בָּרָא';
 const source='בְּרֵאשִׁ֖ית בָּרָ֣א';
 const marks=sourceAccents(source,canonical);
 assert.deepEqual(marks,[[3,'֖'],[7,'֣']]);
 const rendered=applyCantillationAccents(canonical,marks);
 assert.equal(rendered.replace(/[\u0591-\u05AF]/gu,''),canonical.normalize('NFD'));
 assert.equal([...rendered.matchAll(/[\u0591-\u05AF]/gu)].length,2);
 assert.ok(HAS_CANTILLATION.test(rendered));
});
test('source mismatches cannot inject cantillation at wrong positions',()=>{
 const target='בְּרֵאשִׁית בָּרָא';
 assert.equal(sourceAccents('בְּרֵאשִׁ֖ית שָׁמַ֣ר',target),null);
 assert.equal(applyCantillationAccents(target,null),target);
});
test('source OSIS words retain morphologically split syllables',()=>{
 const xml='<verse osisID="Gen.1.1"><w id="1">בְּ/רֵאשִׁ֖ית</w><w id="2">בָּרָ֣א</w><seg type="x-sof-pasuq">׃</seg></verse>';
 assert.equal(parseWlc(xml).get('1.1'),'בְּרֵאשִׁ֖ית בָּרָ֣א');
});
test('both new font choices are reader scoped and old options remain',()=>{
 const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 const storage=readFileSync(new URL('../lib/siddur/storage.ts',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../components/siddur/SettingsView.tsx',import.meta.url),'utf8');
 for(const item of ['font-alef','font-rashi','Kavvanah Alef','Kavvanah Noto Rashi Hebrew'])assert.ok(css.includes(item));
 for(const item of ['serif','sans','alef','rashi'])assert.ok(storage.includes(`'${item}'`));
 assert.match(ui,/settings.cantillation/);
 assert.match(ui,/Noto Rashi Hebrew/);
});
test('holy-text sources are outside importer write destinations',()=>{
 const importer=readFileSync(new URL('../scripts/prepare-tanakh-cantillation.mjs',import.meta.url),'utf8');
 assert.match(importer,/public\/texts\/optimized\/cantillation/);
 assert.match(importer,/readFile\(join\(sourceDir,/);
 assert.doesNotMatch(importer,/writeFile\(join\(sourceDir,/);
});
