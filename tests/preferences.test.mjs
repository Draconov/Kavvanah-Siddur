import test from 'node:test';
import assert from 'node:assert/strict';

const {DEFAULT_SETTINGS}=await import('../lib/siddur/core.ts');
const {translate,getUI,UI_LANGUAGES}=await import('../lib/siddur/i18n.ts');
const {HDate}=await import('@hebcal/core');
const {calendarMonth,moveCalendarMonth}=await import('../lib/siddur/calendar.ts');

test('Hebrew is an interface language without changing reader language choices',()=>{
 assert.equal(UI_LANGUAGES.he,'עברית');
 assert.equal(getUI('he').locale,'he-IL');
 assert.equal(translate('he','Settings'),'הגדרות');
 assert.equal(DEFAULT_SETTINGS.uiLanguage,'en');
 assert.equal(DEFAULT_SETTINGS.accent,'blue');
 assert.equal(DEFAULT_SETTINGS.calendarMode,'hebrew');
});

test('calendar modes use actual month boundaries through leap months and year changes',()=>{
 const date=new Date(2026,8,21,12);
 const hebrew=calendarMonth(date,'hebrew'),gregorian=calendarMonth(date,'gregorian');
 assert.equal(new HDate(hebrew.start).toString(),'1 Tishrei 5787');
 assert.equal(new HDate(hebrew.end).toString(),'30 Tishrei 5787');
 assert.equal(gregorian.start.getDate(),1);assert.equal(gregorian.start.getMonth(),8);
 assert.equal(gregorian.end.getDate(),30);assert.equal(gregorian.end.getMonth(),8);
 const adarI=new HDate(15,12,5784).greg();
 assert.equal(new HDate(moveCalendarMonth(adarI,'hebrew',1)).toString(),'1 Adar II 5784');
 const elul=new HDate(12,6,5786).greg();
 assert.equal(new HDate(moveCalendarMonth(elul,'hebrew',1)).toString(),'1 Tishrei 5787');
 assert.equal(new HDate(moveCalendarMonth(date,'hebrew',-1)).toString(),'1 Elul 5786');
 assert.equal(getUI('he').isRtl,true);assert.equal(getUI('en').isRtl,false);
 for(let month=1;month<=13;month++)assert.doesNotMatch(translate('he',new HDate(1,month,5784).getMonthName()),/[a-z]/i);
});

const calendar=await import('../lib/siddur/calendar.ts');
test('direct year jumps preserve Hebrew month and day and clamp leap dates',()=>{
 assert.equal(typeof calendar.calendarDate,'function');
 assert.equal(new HDate(calendar.calendarDate('hebrew',{day:10,month:7,year:5780})).toString(),'10 Tishrei 5780');
 assert.equal(new HDate(calendar.moveCalendarDate(new HDate(10,7,5787).greg(),'hebrew','year',-7)).toString(),'10 Tishrei 5780');
 assert.equal(new HDate(calendar.moveCalendarDate(new HDate(30,12,5784).greg(),'hebrew','year',1)).toString(),'29 Adar 5785');
 assert.equal(new HDate(calendar.moveCalendarDate(new HDate(15,13,5784).greg(),'hebrew','year',1)).toString(),'15 Adar 5785');
 assert.equal(calendar.calendarDate('gregorian',{day:29,month:2,year:2025}).getDate(),28);
 assert.throws(()=>calendar.calendarDate('gregorian',{day:1,month:1,year:NaN}),RangeError);
});
test('day and month navigation preserve selected dates across boundaries',()=>{
 assert.equal(typeof calendar.moveCalendarDate,'function');
 assert.equal(new HDate(calendar.moveCalendarDate(new HDate(29,6,5786).greg(),'hebrew','day',1)).toString(),'1 Tishrei 5787');
 assert.equal(new HDate(calendar.moveCalendarDate(new HDate(15,12,5784).greg(),'hebrew','month',1)).toString(),'15 Adar II 5784');
 const feb=calendar.moveCalendarDate(new Date(2026,0,31,12),'gregorian','month',1);
 assert.equal(feb.getMonth(),1);assert.equal(feb.getDate(),28);
});

test('early Gregorian years survive selection and month rendering without adding 1900',async()=>{
 const {localDate,localKey}=await import('../lib/siddur/core.ts');
 const ancient=calendar.calendarDate('gregorian',{year:50,month:2,day:15});
 assert.equal(localDate(localKey(ancient)).getFullYear(),50);
 assert.equal(calendarMonth(ancient,'gregorian').start.getFullYear(),50);
 assert.equal(moveCalendarMonth(ancient,'gregorian',1).getFullYear(),50);
});

test('calendar modes share supported boundary dates without render-range errors',()=>{
 for(const parts of [{year:1,month:1,day:1},{year:9999,month:12,day:1}]){
  const civil=calendar.calendarDate('gregorian',parts);
  const hebrew=calendar.calendarDate('hebrew',calendar.calendarParts(civil,'hebrew'));
  assert.equal(hebrew.getTime(),civil.getTime());
 }
});
