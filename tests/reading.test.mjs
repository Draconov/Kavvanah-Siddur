import test from 'node:test';
import assert from 'node:assert/strict';
let reading={};try{reading=await import('../lib/siddur/reading.ts');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
test('pronunciation changes the reading while preserving the Hebrew source',()=>{
 assert.equal(typeof reading.transcription,'function');
 assert.equal(reading.transcription('שַׁבָּת','en','sephardi'),'shabat');
 assert.equal(reading.transcription('שַׁבָּת','en','ashkenazi'),'shabos');
 assert.equal(reading.transcription('שַׁבָּת','ru','sephardi'),'шабат');
});
test('selected translation never silently falls back to another language',()=>{
 assert.equal(typeof reading.translationFor,'function');
 assert.equal(reading.translationFor({he:'שלום',en:'Peace'},'ru','test',{}),null);
 assert.equal(reading.translationFor({he:'שלום',en:'Peace'},'ru','test',{'test:ru':'Мир'}),'Мир');
});
test('layer reordering preserves all layers and boundary moves',()=>{
 assert.equal(typeof reading.moveLayer,'function');
 assert.deepEqual(reading.moveLayer(['hebrew','transliteration','translation'],'translation',-1),['hebrew','translation','transliteration']);
 assert.deepEqual(reading.moveLayer(['hebrew'],'hebrew',-1),['hebrew']);
});
