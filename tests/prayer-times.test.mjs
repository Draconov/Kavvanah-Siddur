import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {timedCalendarEventsForDate} from '../lib/siddur/special-times.ts';

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
 assert.match(times,/specialTimes\.length>0/);
 assert.match(core,/candlelighting:true,candleLightingMins:settings\.candleMinutes/);
 assert.match(core,/havdalahMins:settings\.nightfall==='72'/);
 assert.match(translation,/'Additional times':\['Особые времена','Особливі часи'\]/);
 assert.match(translation,/'Additional times':'זמנים מיוחדים'/);
});
