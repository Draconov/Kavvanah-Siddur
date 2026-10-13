import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { EINK_BOOTSTRAP,einkEnabled,isEinkDevice } from '../lib/siddur/eink.ts';
import { translate } from '../lib/siddur/i18n.ts';

const ordinaryAndroid='Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Mobile Safari/537.36';

function bootstrap({mode,ua=ordinaryAndroid,mono=false,corrupt=false}={}){
 const root={dataset:{}};
 const store=corrupt?'{invalid':JSON.stringify(mode===undefined?{}:{einkMode:mode});
 runInNewContext(EINK_BOOTSTRAP,{
  localStorage:{getItem:()=>store},navigator:{userAgent:ua},
  matchMedia:()=>({matches:mono}),document:{documentElement:root},
 });
 return root.dataset.eink;
}

test('E Ink Auto defaults to on only for known readers or monochrome media',()=>{
 const core=readFileSync(new URL('../lib/siddur/core.ts',import.meta.url),'utf8');
 assert.match(core,/einkMode:'auto'/);
 const storage=readFileSync(new URL('../lib/siddur/storage.ts',import.meta.url),'utf8');
 assert.match(storage,/einkMode:\['auto','on','off'\]/);
 for(const ua of [ordinaryAndroid,'iPhone AppleWebKit','Android 14; Chrome; width 375']){
  assert.equal(isEinkDevice({userAgent:ua}),false);
  assert.equal(bootstrap({ua}),'false');
 }
 for(const ua of ['Mudita Kompakt','Mozilla/5.0 (Linux; Android 13; BOOX Palma)','Kobo eReader','PocketBook Reader']){
  assert.equal(isEinkDevice({userAgent:ua}),true,ua);
  assert.equal(bootstrap({ua}),'true',ua);
 }
 assert.equal(bootstrap({mono:true}),'true');
 assert.equal(isEinkDevice({model:'Onyx Tab Ultra C'}),true);
 assert.equal(isEinkDevice({model:'Pixel 9',monochrome:false}),false);
});

test('Explicit On and Off always override device signals before first paint',()=>{
 assert.equal(einkEnabled('on',false),true);
 assert.equal(einkEnabled('off',true),false);
 assert.equal(einkEnabled('auto',true),true);
 assert.equal(einkEnabled('auto',false),false);
 assert.equal(bootstrap({mode:'on'}),'true');
 assert.equal(bootstrap({mode:'off',ua:'Mudita Kompakt',mono:true}),'false');
 assert.equal(bootstrap({mode:'invalid'}),'false');
 assert.equal(bootstrap({corrupt:true,ua:'Mudita Kompakt'}),'false');
});

test('All UI languages contain the E Ink display controls',()=>{
 const keys=['E Ink display','Automatic detection','Always on','Always off','Device not recognized as E Ink. You can enable it manually.'];
 for(const locale of ['ru','uk','he'])for(const key of keys)
  assert.notEqual(translate(locale,key),key,`${locale}: ${key}`);
});

test('E Ink theme is scoped and does not remove PWA metadata',()=>{
 const css=readFileSync(new URL('../app/eink.css',import.meta.url),'utf8');
 const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');
 assert.match(css, /data-eink='true'/);
 assert.match(css, /prefers-reduced-motion|animation:none/);
 assert.match(layout, /EINK_BOOTSTRAP/);
 assert.match(layout, /manifest\.webmanifest/);
 assert.match(layout, /appleWebApp/);
});


test('Switching E Ink inside Settings does not cancel Radix modal/select lifecycles',()=>{
 const css=readFileSync(new URL('../app/eink.css',import.meta.url),'utf8');
 const dialog=readFileSync(new URL('../components/ui/dialog.tsx',import.meta.url),'utf8');
 const select=readFileSync(new URL('../components/ui/select.tsx',import.meta.url),'utf8');
 // The drop-down can be midway through closing when its onValueChange
 // changes data-eink. Radix Presence must still receive animationend.
 assert.match(dialog,/data-\[state=closed\]:animate-out/);
 assert.match(select,/data-\[state=closed\]:animate-out/);
 // Catch accidental reintroduction of global animation/transition resets.
 // In particular do not use `html[data-eink] *` or `*::before/after`.
 const uncommented=css.replace(/\/\*[\s\S]*?\*\//g,'');
 const resetRules=[...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, ,body])=>/\b(?:animation|transition)(?:-\w+)?\s*:\s*none\s*!important/i.test(body));
 assert.ok(resetRules.length>0,'Decorative motion should still be disabled');
 for(const [, selector] of resetRules){
  assert.doesNotMatch(selector,/\*/,`Global animation/transition reset can freeze Radix: ${selector}`);
  assert.doesNotMatch(selector,/data-slot|dialog|select|popover|portal/i,`Do not disable portal lifecycle animations: ${selector}`);
 }
 // A plain E Ink CSS/theme flip should not unmount Settings or its Select.
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 assert.match(page,/<Dialog open=\{settingsOpen\}/);
 assert.match(page,/einkDetected=\{einkDetected\}/);
});
