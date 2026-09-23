import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
let navigation={};try{navigation=await import('../lib/siddur/navigation.ts');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
test('prayer-time shortcuts resolve to the selected tradition and service',()=>{
 assert.equal(typeof navigation.prayerForTime,'function');
 for(const nusach of ['ashkenaz','edot']){
  const {sections}=JSON.parse(readFileSync(`public/texts/${nusach}.json`,'utf8'));
  const shema=navigation.prayerForTime('shema',sections);assert.match(shema.title,/Shema/i);assert.equal(shema.category,'Morning');
  const mincha=navigation.prayerForTime('mincha',sections);assert.equal(mincha.category,'Afternoon');
  const shacharit=navigation.prayerForTime('shacharit',sections);assert.match(shacharit.title,/^(Patriarchs|Amidah?)$/);
  assert.match(mincha.title,/^(Ashrei|Amidah?)$/);
  const evening=navigation.prayerForTime('nightfall',sections);assert.equal(evening.category,'Evening');
  assert.equal(navigation.prayerForTime('midday',sections),null);
 }
});
