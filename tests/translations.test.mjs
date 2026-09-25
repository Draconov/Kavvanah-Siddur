import test from 'node:test';
import assert from 'node:assert/strict';
import {applySiddurTranslation} from '../lib/siddur/translations.ts';

test('Siddur language bundle joins without mutating Hebrew structure',()=>{
 const base={title:'Fixture',nusach:'ashkenaz',sources:[{title:'Hebrew',version:'H',language:'he',license:'',url:'/'}],sections:[{id:'s1',title:'T',heTitle:'ה',category:'Other',service:'',path:['T'],ref:'Fixture, T',paragraphs:[{he:'א'},{he:'ב'}]}]};
 const bundle={schema:1,language:'ru',corpora:{ashkenaz:{sources:[{title:'Russian',version:'R',language:'ru',license:'',url:'/'}],sections:{s1:{sourceHash:'0123456789abcdef',paragraphs:['А',{text:'Б',ref:'KAV x',edition:'kav',note:'combined'}]}}}}};
 const merged=applySiddurTranslation(base,bundle);
 assert.equal(base.sections[0].paragraphs[0].ru,undefined);
 assert.equal(merged.sections[0].paragraphs[0].ru,'А');
 assert.equal(merged.sections[0].paragraphs[1].ru,'Б');
 assert.equal(merged.sections[0].paragraphs[1].translationRefs.ru,'KAV x');
 assert.equal(merged.sections[0].paragraphs[1].translationEditions.ru,'kav');
 assert.equal(merged.sections[0].paragraphs[1].translationNotes.ru,'combined');
 assert.equal(merged.sources.at(-1).language,'ru');
});

test('Siddur language bundle refuses positional drift',()=>{
 const base={title:'Fixture',nusach:'ashkenaz',sources:[],sections:[{id:'s1',title:'T',heTitle:'ה',category:'Other',service:'',path:['T'],ref:'Fixture, T',paragraphs:[{he:'א'}]}]};
 const bundle={schema:1,language:'en',corpora:{ashkenaz:{sources:[],sections:{s1:{sourceHash:'0123456789abcdef',paragraphs:['A','B']}}}}};
 assert.throws(()=>applySiddurTranslation(base,bundle),/paragraph count changed/);
});
