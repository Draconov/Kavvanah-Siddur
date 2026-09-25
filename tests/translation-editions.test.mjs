import test from 'node:test';
import assert from 'node:assert/strict';
import {TRANSLATION_EDITIONS,applyTanakhTranslation,effectiveEdition,editionsForLanguage} from '../lib/siddur/translation-editions.ts';

test('edition registry has independent defaults and four Ukrainian choices',()=>{
 assert.equal(TRANSLATION_EDITIONS.schema,1);
 assert.equal(TRANSLATION_EDITIONS.defaults.en,'en-jps-1917');
 assert.equal(TRANSLATION_EDITIONS.defaults.ru,'ru-synodal-1876');
 assert.equal(TRANSLATION_EDITIONS.defaults.uk,'uk-jewish-modern');
 assert.equal(editionsForLanguage('en').length,1);
 assert.equal(editionsForLanguage('ru').length,1);
 assert.deepEqual(editionsForLanguage('uk').map(x=>x.id),[
  'uk-jewish-modern','uk-ohienko-1962','uk-turkonjak-utt','uk-kulish-puluj-1905'
 ]);
});

test('unbundled preferred Ukrainian editions fall back without changing the preference',()=>{
 const resolved=effectiveEdition('uk','uk-jewish-modern');
 assert.equal(resolved.preferred.id,'uk-jewish-modern');
 assert.equal(resolved.effective.id,'uk-kulish-puluj-1905');
 assert.equal(resolved.preferred.available,false);
 assert.equal(resolved.effective.available,true);
 assert.equal(resolved.effective.builtin,false);
});

test('future edition files override only their language',()=>{
 const base={id:'genesis',title:'Genesis',heTitle:'בראשית',category:'Torah',chapters:1,sources:[{title:'Hebrew',version:'H',language:'he',license:'',url:'/'}],text:[[{he:'א',en:'Old EN',uk:'Old UK'},{he:'ב',en:'Second EN',uk:'Second UK'}]]};
 const bundle={schema:1,language:'uk',edition:'uk-future',sources:[{title:'Future',version:'F',language:'uk',license:'',url:'/future'}],books:{genesis:{chapters:[['Новий текст',null]]}}};
 const merged=applyTanakhTranslation(base,bundle);
 assert.equal(merged.text[0][0].uk,'Новий текст');
 assert.equal(merged.text[0][0].en,'Old EN');
 assert.equal(merged.text[0][1].uk,'Second UK');
 assert.equal(merged.text[0][0].translationEditions.uk,'uk-future');
 assert.equal(merged.sources.at(-1).version,'F');
});
