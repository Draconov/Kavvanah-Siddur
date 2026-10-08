import test from 'node:test';
import assert from 'node:assert/strict';
import {getUI} from '../lib/siddur/i18n.ts';

// TanakhView includes the translator in its fetch-effect dependencies. A new
// translator on every render aborts the active request and resets the book.
test('translator stays referentially stable across renders in the same UI language',()=>{
 for(const language of ['en','ru','uk','he']){
  const first=getUI(language);
  const second=getUI(language);
  assert.strictEqual(second,first,`UI context for ${language} must be stable`);
  assert.strictEqual(second.t,first.t,`translator for ${language} must be stable`);
 }
});

test('switching language changes translator without losing the previous language',()=>{
 const ru=getUI('ru');
 const uk=getUI('uk');
 assert.notStrictEqual(ru.t,uk.t);
 assert.equal(ru.t('Tanakh'),'Танах');
 assert.equal(uk.t('Tanakh'),'Танах');
 assert.strictEqual(getUI('ru').t,ru.t);
});
