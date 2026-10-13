import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chronologicalPrayerTimes,timedCalendarEventsForDate} from '../lib/siddur/special-times.ts';

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const calendar=read('components/siddur/CalendarView.tsx');
const times=read('components/siddur/TimesView.tsx');
const css=read('app/globals.css');
const eink=read('app/eink.css');
const core=read('lib/siddur/core.ts');
const translation=read('lib/siddur/i18n.ts');

const event=(day,desc,time,he='אירוע')=>({
 getDate:()=>({greg:()=>new Date(`${day}T12:00:00`)}),
 render:lang=>lang==='he'?he:desc,
 ...(time===undefined?{}:{eventTime:new Date(time)}),
});

test('Special times appear only on the civil date Hebcal associates with the observance',()=>{
 const events=[
  event('2026-10-16','Candle lighting','2026-10-16T15:54:00Z','הדלקת נרות'),
  event('2026-10-17','Havdalah','2026-10-17T16:55:00Z','הבדלה'),
  event('2026-10-16','Parashat Noach',undefined),
 ];
 assert.deepEqual(timedCalendarEventsForDate(events,'2026-10-15'),[],'ordinary Thursday must not display Friday candles');
 assert.deepEqual(timedCalendarEventsForDate(events,'2026-10-16').map(x=>x.title),['Candle lighting']);
 assert.deepEqual(timedCalendarEventsForDate(events,'2026-10-17').map(x=>x.title),['Havdalah']);
});

test('Festival candles, Havdalah and minor/major fast boundaries are all eligible',()=>{
 const events=[
  event('2026-09-22','Fast ends','2026-09-22T17:55:00Z'),
  event('2026-09-22','Fast begins','2026-09-22T02:00:00Z'),
  event('2026-09-22','Candle lighting','2026-09-22T16:00:00Z'),
 ];
 assert.deepEqual(timedCalendarEventsForDate(events,'2026-09-22').map(x=>x.title),['Fast begins','Candle lighting','Fast ends']);
});

test('Exclude non-timed events, invalid timestamps and events assigned to other days',()=>{
 const events=[event('2026-12-31','Havdalah','2026-12-31T17:00:00Z'),event('2027-01-01','Candle lighting','bad'),event('2027-01-01','Holiday',undefined)];
 assert.equal(timedCalendarEventsForDate(events,'2026-12-31').length,1);
 assert.deepEqual(timedCalendarEventsForDate(events,'2027-01-01'),[]);
});

test('Calendar continues to show the day/sunset hint for Gregorian only',()=>{
 assert.match(calendar,/\{!hebrewFirst&&<p className="calendar-note"/);
 assert.match(calendar,/Dates in the grid refer to daytime/);
});

test('Date picker uses the same CalendarDays icon as sidebar, preserves native input and keyboard access',()=>{
 const app=read('app/page.tsx');
 assert.match(app,/id:'calendar'[^\n]+icon:CalendarDays/);
 assert.match(times,/<CalendarDays size=\{18\}/);
 assert.match(times,/type="date"/);
 assert.match(times,/\.showPicker\(\)/);
 assert.match(times,/input\.focus\(\);input\.click\(\)/);
 assert.match(css,/\.prayer-date-picker \.date-input::-webkit-calendar-picker-indicator\{display:none\}/);
 assert.match(css,/\.prayer-date-picker:focus-within/);
 assert.match(eink,/html\[data-eink='true'\] \.prayer-date-picker:focus-within/);
});

test('Prayer Times uses exactly the existing Hebcal calendar settings; no daily candle estimate',()=>{
 assert.match(times,/calendarEvents\(calendarYear,place,\{candleMinutes,nightfall,useElevation\}\)/);
 assert.match(times,/timedCalendarEventsForDate\(calendar,date\)/);
 assert.match(times,/chronologicalPrayerTimes\(times,specialTimes\)/);
 assert.doesNotMatch(times,/specialTimes\.length>0/,'do not render separate additional-times panel');
 assert.match(core,/candlelighting:true,candleLightingMins:settings\.candleMinutes/);
 assert.match(core,/havdalahMins:settings\.nightfall==='72'/);
 assert.match(translation,/'Additional times':\['Особые времена','Особливі часи'\]/);
 assert.match(translation,/'Additional times':'זמנים מיוחדים'/);
});


test('Regular zmanim and timed observances interleave in one chronological list',()=>{
 const at=(minute)=>new Date(`2026-10-16T${minute}:00Z`);
 const daily=[
  {id:'sunset',title:'Sunset',he:'שקיעה',detail:'Shkiah',time:at('18:00')},
  {id:'plag',title:'Plag hamincha',he:'פלג המנחה',detail:'Plag',time:at('16:20')},
  {id:'nightfall',title:'Nightfall',he:'צאת הכוכבים',detail:'Tzeit',time:at('18:38')},
 ];
 const special=[{id:'candles',title:'Candle lighting',he:'הדלקת נרות',time:at('17:42')}];
 const merged=chronologicalPrayerTimes(daily,special);
 assert.deepEqual(merged.map(item=>item.id),['plag','candles','sunset','nightfall']);
 assert.deepEqual(merged.map(item=>item.kind),['daily','special','daily','daily']);
 assert.deepEqual(daily.map(item=>item.id),['sunset','plag','nightfall'],'input array must not be mutated');
 assert.equal(merged[1].title,'Candle lighting');
});

test('Fast boundaries and Havdalah interleave using actual timestamps',()=>{
 const date=(minute)=>new Date(`2026-10-17T${minute}:00Z`);
 const merged=chronologicalPrayerTimes([
  {id:'sunrise',title:'Sunrise',he:'',detail:'',time:date('05:25')},
  {id:'sunset',title:'Sunset',he:'',detail:'',time:date('16:31')},
  {id:'nightfall',title:'Nightfall',he:'',detail:'',time:date('17:10')},
 ],[
  {id:'fast-start',title:'Fast begins',he:'',time:date('02:15')},
  {id:'fast-end',title:'Fast ends',he:'',time:date('17:00')},
  {id:'havdalah',title:'Havdalah',he:'',time:date('17:18')},
 ]);
 assert.deepEqual(merged.map(e=>e.id),['fast-start','sunrise','sunset','fast-end','nightfall','havdalah']);
});

test('Unavailable daily times go last and equal instants keep deterministic priority',()=>{
 const now=new Date('2026-10-16T16:00:00Z');
 const merged=chronologicalPrayerTimes([
  {id:'missing',title:'Unavailable',he:'',detail:'',time:null},
  {id:'daily1',title:'First',he:'',detail:'',time:now},
  {id:'daily2',title:'Second',he:'',detail:'',time:now},
 ],[
  {id:'special1',title:'Candle lighting',he:'',time:now},
  {id:'special2',title:'Havdalah',he:'',time:now},
 ]);
 assert.deepEqual(merged.map(e=>e.id),['daily1','daily2','special1','special2','missing']);
 assert.deepEqual(chronologicalPrayerTimes([],[]),[]);
});

test('Prayer Times renders one list, with icons and next-time badge for either type',()=>{
 assert.match(times,/timeline\.map\(time=>/);
 assert.match(times,/className=\{`time-row\$\{special\?' special-time-row'/);
 assert.match(times,/const next=date===today\?timeline\.find/);
 assert.match(times,/next\?\.id===time\.id/);
 assert.match(times,/!special&&settings\.prayerLinks/,'ordinary prayer shortcuts remain');
 assert.match(times,/special&&settings\.uiLanguage==='he'\?time\.he:t\(time\.title\)/);
 assert.doesNotMatch(times,/special-time-list/);
 assert.match(css,/\.time-row\.special-time-row\{border-inline-start:/);
 assert.match(css,/\.time-row\.special-time-row\.next-time/);
});
