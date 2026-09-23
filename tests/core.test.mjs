import test from 'node:test';
import assert from 'node:assert/strict';
let core = {};
try { core = await import('../lib/siddur/core.ts'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const ashkelon = {name:'Ashkelon',latitude:31.6688,longitude:34.5743,timeZone:'Asia/Jerusalem',elevation:0,israel:true};

test('Jerusalem bearing points northeast from Ashkelon and stays normalized', () => {
  assert.equal(typeof core.jerusalemDirection,'function');
  const result=core.jerusalemDirection(ashkelon.latitude,ashkelon.longitude);
  assert.ok(result.bearing > 75 && result.bearing < 83);
  assert.ok(result.distanceKm > 60 && result.distanceKm < 65);
  assert.ok(core.jerusalemDirection(40.7128,-74.006).bearing > 50);
  assert.ok(core.jerusalemDirection(40.7128,-74.006).bearing < 60);
});

test('location validation rejects impossible coordinates and unknown timezones', () => {
  assert.equal(typeof core.validateLocation,'function');
  assert.equal(core.validateLocation(ashkelon),null);
  assert.ok(core.validateLocation({...ashkelon,latitude:91}));
  assert.ok(core.validateLocation({...ashkelon,longitude:NaN}));
  assert.ok(core.validateLocation({...ashkelon,timeZone:'Israel/Nowhere'}));
});

test('location day is independent of the browser day', () => {
  assert.equal(typeof core.dateKeyInZone,'function');
  assert.equal(core.dateKeyInZone(new Date('2026-09-20T22:30:00Z'),'Asia/Jerusalem'),'2026-09-21');
  assert.equal(core.dateKeyInZone(new Date('2026-09-20T02:30:00Z'),'America/New_York'),'2026-09-19');
});

test('current Hebrew date advances at sunset in the configured location', () => {
  assert.equal(typeof core.currentHebrewDate,'function');
  assert.equal(core.currentHebrewDate(new Date('2026-09-20T10:00:00Z'),ashkelon).getDate(),9);
  assert.equal(core.currentHebrewDate(new Date('2026-09-20T20:00:00Z'),ashkelon).getDate(),10);
});

test('polar sunrise and sunset are unavailable rather than invalid date strings', () => {
  assert.equal(typeof core.calculateTimes,'function');
  const times=core.calculateTimes('2026-06-21',{...ashkelon,name:'Tromso',latitude:69.6492,longitude:18.9553,timeZone:'Europe/Oslo',israel:false},{});
  assert.equal(times.find(t=>t.id==='sunrise').time,null);
  assert.equal(times.find(t=>t.id==='sunset').time,null);
});

test('explicit candle-lighting offset is honored even for Jerusalem',()=>{
 const candle=mins=>core.calendarEvents(2026,core.PLACES[0],{candleMinutes:mins}).find(e=>e.getDate().greg().getMonth()===8&&e.getDate().greg().getDate()===18&&e.getCategories().includes('candles'));
 const first=candle(18),second=candle(40);
 assert.ok(first&&second);
 assert.equal(first.eventTime.getTime()-second.eventTime.getTime(),22*60*1000);
});

test('Israel calendar selection remains independent of explicit candle offset',()=>{
 const israel=core.calendarEvents(2026,core.PLACES[0],{candleMinutes:18});
 const diaspora=core.calendarEvents(2026,{...core.PLACES[0],israel:false},{candleMinutes:18});
 assert.ok(israel.some(e=>e.getDesc()==="Sukkot II (CH''M)"));
 assert.ok(diaspora.some(e=>e.getDesc()==='Sukkot II'));
 assert.ok(!israel.some(e=>e.getDesc()==='Sukkot II'));
});

test('GPS identifies Ashkelon while preserving the measured coordinates',()=>{
 assert.equal(typeof core.placeFromCoordinates,'function');
 const p=core.placeFromCoordinates(31.676,34.571,'Asia/Jerusalem',null);
 assert.equal(p.name,'Ashkelon');assert.equal(p.latitude,31.676);assert.equal(p.longitude,34.571);
 assert.equal(p.timeZone,'Asia/Jerusalem');assert.equal(p.israel,true);
 assert.equal(core.placeFromCoordinates(31.805,34.657,'Asia/Jerusalem',12).name,'Ashdod');
 assert.equal(core.placeFromCoordinates(0,0,'Etc/UTC',null).name,'My location');
});
test('nearby cities do not override a conflicting device time zone or cross a border',()=>{
 const p=core.placeFromCoordinates(29.5321,35.0063,'Asia/Amman',null);
 assert.equal(p.timeZone,'Asia/Amman');assert.equal(p.israel,false);assert.equal(p.name,'My location');
});
