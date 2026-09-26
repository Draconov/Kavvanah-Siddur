import test from 'node:test';
import assert from 'node:assert/strict';
import {TRANSLATION_EDITIONS,applyTanakhTranslation,effectiveEdition,editionsForLanguage,resolveEditionForBook,translationEdition,editionHasMissingComponents} from '../lib/siddur/translation-editions.ts';

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
 assert.equal(translationEdition('uk-varda-torah','uk').selectable,false);
});

test('Jewish modern is a real per-book composite preset, not one global fallback',()=>{
 const settingsResolution=effectiveEdition('uk','uk-jewish-modern');
 assert.equal(settingsResolution.preferred.id,'uk-jewish-modern');
 assert.equal(settingsResolution.effective.id,'uk-jewish-modern');
 assert.equal(editionHasMissingComponents(settingsResolution.preferred),true);

 const torah=resolveEditionForBook('uk','uk-jewish-modern','genesis','Torah');
 assert.equal(torah.intended.id,'uk-varda-torah');
 assert.equal(torah.effective.id,'uk-ohienko-1962');
 assert.equal(torah.usedFallback,true);

 const prophets=resolveEditionForBook('uk','uk-jewish-modern','isaiah','Prophets');
 assert.equal(prophets.intended.id,'uk-turkonjak-utt');
 assert.equal(prophets.effective.id,'uk-ohienko-1962');
 assert.equal(prophets.usedFallback,true);

 const amos=resolveEditionForBook('uk','uk-jewish-modern','amos','Prophets');
 assert.equal(amos.effective.id,'uk-turkonjak-utt');
 assert.equal(amos.usedFallback,false);

 const writings=resolveEditionForBook('uk','uk-jewish-modern','psalms','Writings');
 assert.equal(writings.intended.id,'uk-turkonjak-utt');
 assert.equal(writings.effective.id,'uk-ohienko-1962');
 assert.equal(writings.usedFallback,true);
});

test('partial Turkonjak edition stays preferred and resolves fallback per book',()=>{
 const resolved=effectiveEdition('uk','uk-turkonjak-utt');
 assert.equal(resolved.preferred.id,'uk-turkonjak-utt');
 assert.equal(resolved.effective.id,'uk-turkonjak-utt');
 assert.equal(resolveEditionForBook('uk','uk-turkonjak-utt','amos','Prophets').effective.id,'uk-turkonjak-utt');
 assert.equal(resolveEditionForBook('uk','uk-turkonjak-utt','isaiah','Prophets').effective.id,'uk-ohienko-1962');
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
