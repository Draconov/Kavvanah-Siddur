import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyDevice,readDeviceSignals,installDeviceProfile} from '../lib/siddur/device-profile.ts';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const signals=(overrides={})=>({
 viewportWidth:390,viewportHeight:844,screenWidth:390,screenHeight:844,
 primaryCoarse:true,primaryFine:false,anyCoarse:true,anyFine:false,maxTouchPoints:5,
 ...overrides,
});
test('portrait phone rotates without changing device class',()=>{
 assert.deepEqual(classifyDevice(signals()),{deviceClass:'phone',input:'touch',orientation:'portrait'});
 assert.deepEqual(classifyDevice(signals({viewportWidth:844,viewportHeight:390})),{deviceClass:'phone',input:'touch',orientation:'landscape'});
});
test('resized desktop stays desktop and compact CSS remains available',()=>{
 const d=signals({viewportWidth:900,viewportHeight:500,screenWidth:1920,screenHeight:1080,
  primaryCoarse:false,primaryFine:true,anyCoarse:false,anyFine:true,maxTouchPoints:0});
 assert.deepEqual(classifyDevice(d),{deviceClass:'desktop',input:'pointer',orientation:'landscape'});
 const css=read('app/mobile.css');
 assert.match(css,/data-device-class="desktop"\] \.mobile-action-nav\{display:none!important\}/);
 assert.match(css,/data-device-class="desktop"\] \.kavvanah-layout>\[data-slot="sidebar"\]\{display:flex!important\}/);
});
test('tablets, hybrids and touch laptops have sensible non-identifying classes',()=>{
 assert.equal(classifyDevice(signals({screenWidth:800,screenHeight:1280})).deviceClass,'tablet');
 assert.equal(classifyDevice(signals({screenWidth:800,screenHeight:1280})).input,'touch');
 assert.deepEqual(classifyDevice(signals({
  viewportWidth:1280,viewportHeight:720,screenWidth:1920,screenHeight:1080,
  primaryCoarse:false,primaryFine:true,anyCoarse:true,anyFine:true,maxTouchPoints:10,
 })),{deviceClass:'desktop',input:'hybrid',orientation:'landscape'});
 assert.equal(classifyDevice(signals({screenWidth:0,screenHeight:0,
  primaryCoarse:false,primaryFine:false,anyCoarse:false,anyFine:false,maxTouchPoints:0})).deviceClass,'unknown');
});
test('readDeviceSignals asks for media capabilities only',()=>{
 const requested=[];
 const fake={innerWidth:375,innerHeight:812,screen:{width:375,height:812},navigator:{maxTouchPoints:5},matchMedia:q=>{requested.push(q);return {matches:q.includes('coarse')}}};
 assert.deepEqual(readDeviceSignals(fake),signals({viewportWidth:375,viewportHeight:812,screenWidth:375,screenHeight:812,primaryCoarse:true,anyCoarse:true,maxTouchPoints:5}));
 assert.equal(requested.length,4);
});
test('profile watcher publishes categories, responds to rotation and cleans up',()=>{
 const listeners=new Map();
 const mediaListeners=new Map();
 const data={};let nextFrame=1;
 let orientationCalls=0;
 const queries=new Map();
 const matchMedia=q=>{
  if(!queries.has(q))queries.set(q,{matches:q.includes('coarse'),addEventListener:(type,callback)=>mediaListeners.set(q,callback),removeEventListener:(type,callback)=>{if(mediaListeners.get(q)===callback)mediaListeners.delete(q)}});
  return queries.get(q);
 };
 let scheduled;
 const fake={innerWidth:390,innerHeight:844,screen:{width:390,height:844,orientation:{addEventListener:()=>orientationCalls++,removeEventListener:()=>orientationCalls--}},navigator:{maxTouchPoints:5},document:{documentElement:{dataset:data}},matchMedia,
  addEventListener:(event,callback)=>listeners.set(event,callback),removeEventListener:(event,callback)=>{if(listeners.get(event)===callback)listeners.delete(event)},
  requestAnimationFrame:callback=>{scheduled=callback;return nextFrame++},cancelAnimationFrame:()=>{scheduled=null}};
 const dispose=installDeviceProfile(fake);
 assert.equal(data.deviceClass,'phone');assert.equal(data.deviceInput,'touch');assert.equal(data.deviceOrientation,'portrait');
 fake.innerWidth=844;fake.innerHeight=390;listeners.get('resize')();
 assert.equal(data.deviceOrientation,'portrait');scheduled();
 assert.equal(data.deviceOrientation,'landscape');
 assert.equal(orientationCalls,1);assert.equal(mediaListeners.size,4);
 dispose();
 assert.deepEqual(data,{});assert.equal(listeners.size,0);assert.equal(mediaListeners.size,0);assert.equal(orientationCalls,0);
});
test('no high-entropy model hints, hardware fingerprint or device-profile persistence',()=>{
 for(const path of ['lib/siddur/device-profile.ts','lib/siddur/storage.ts']){
  const source=read(path);
  assert.doesNotMatch(source,/getHighEntropyValues|hardwareConcurrency|deviceMemory|enumerateDevices|canvas\.toDataURL|webgl|sendBeacon|fetch\(/i,path);
 }
 const source=read('lib/siddur/device-profile.ts');
 assert.doesNotMatch(source,/\b(?:localStorage|sessionStorage|indexedDB|cookie|userAgent|serialNumber|analytics)\b|\.model\b/i);
 assert.match(read('app/page.tsx'),/installDeviceProfile\(\)/);
 assert.match(read('lib/siddur/storage.ts'),/einkMode/);
 assert.match(read('lib/siddur/eink.ts'),/EINK_DEVICE_PATTERN/);
});
