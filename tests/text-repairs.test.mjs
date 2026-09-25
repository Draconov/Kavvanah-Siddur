import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as reading from '../lib/siddur/reading.ts';
import {applySiddurTranslation} from '../lib/siddur/translations.ts';
const base=n=>JSON.parse(fs.readFileSync(new URL(`../public/texts/${n}.json`,import.meta.url)));
const translation=lang=>JSON.parse(fs.readFileSync(new URL(`../public/texts/translations/${lang}.json`,import.meta.url)));
const corpus=(name,lang)=>lang?applySiddurTranslation(base(name),translation(lang)):base(name);
test('spoken small-print passages receive reading aids while rubrics remain instructions',()=>{
 assert.equal(typeof reading.isReadingInstruction,'function');
 const s=corpus('ashkenaz').sections.find(s=>s.ref==='Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema');
 assert.equal(reading.isReadingInstruction(s.paragraphs[4]),false);
 assert.equal(reading.isReadingInstruction(s.paragraphs[0]),true);
 for(const lang of ['en','ru','uk'])assert.doesNotMatch(reading.transcription(s.paragraphs[4].he,lang,'sephardi'),/[א-ת]/);
 const edot=corpus('edot');
 for(const s of edot.sections)for(const p of s.paragraphs)if(p.he==='כֹּהֲנִים:')assert.equal(reading.isReadingInstruction(p),true);
});
test('Edot Mincha English aligns with Hebrew in the canonical language file',()=>{
 const p=corpus('edot','en').sections.find(s=>s.ref==='Siddur Edot HaMizrach, Weekday Mincha, Amida').paragraphs;
 assert.match(p[15].en??'',/^Heal us/);
 assert.equal(p[16].en,'[In Summer]');
 assert.match(p[17].en,/Bless us/);
 assert.equal(p[18].en,'[In Winter]');
 assert.match(p[23].en,/Upon the righteous/);
 assert.match(p[24].en,/Dwell within Jerusalem/);
 assert.match(p[25].en,/Tisha B/);
});
test('English translation file has no punctuation-only placeholders',()=>{
 for(const name of ['ashkenaz','edot'])for(const s of corpus(name,'en').sections)for(const p of s.paragraphs)if(p.en)assert.match(p.en,/[A-Za-z]/,s.ref);
});
