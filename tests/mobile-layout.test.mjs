import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('app/page.tsx'),mobile=read('components/siddur/MobileNavigation.tsx'),css=read('app/mobile.css');
const nav=read('lib/siddur/app-navigation.ts'),prayer=read('components/siddur/PrayerView.tsx');
const reader=read('components/siddur/Reader.tsx');

test('all five desktop destinations share a navigation source with the mobile bar',()=>{
 for(const id of ['siddur','tanakh','calendar','times','compass'])assert.match(nav,new RegExp("id:'"+id+"'"));
 assert.match(page,/APP_NAV as NAV/);
 assert.match(mobile,/APP_NAV/);
 assert.match(mobile,/aria-current=\{view===item.id\?'page'/);
});
test('mobile bar exposes all four desktop sidebar action buttons directly',()=>{
 for(const action of ['MapPin','Settings2','Moon','Sun','Download'])assert.match(mobile,new RegExp(action));
 for(const action of ['openSettings','toggleTheme','install'])assert.match(mobile,new RegExp('onClick=\{'+action+'\}'));
 assert.doesNotMatch(mobile,/More|overflow-menu|onClick=.*more/i);
 assert.match(css,/overflow-x:auto/);
 assert.match(css,/safe-area-inset-bottom/);
});
test('short landscape viewports never show the giant desktop sidebar',()=>{
 assert.match(css,/orientation:landscape/);
 assert.match(css,/max-height:650px/);
 assert.match(css,/kavvanah-layout>\[data-slot="sidebar"\]\{display:none!important\}/);
 assert.match(css,/flex-direction:column/);
 assert.match(css,/inset-inline-start:0/);
});
test('prayer selection uses a search-friendly accessible sheet',()=>{
 assert.match(prayer,/<Sheet open=\{pickerOpen\}/);
 assert.match(prayer,/className="mobile-prayer-picker-trigger"/);
 assert.match(prayer,/className="mobile-prayer-results"/);
 assert.match(prayer,/setPickerOpen\(false\)/);
 assert.match(css,/prayer-view>\.view-heading/);
});
test('landscape reading panels preserve three layers in their existing order',()=>{
 assert.match(reader,/data-mobile-panels=\{settings.layout===/);
 assert.match(css,/grid-template-columns:minmax\(0,1\.1fr\) minmax\(0,1fr\)!important/);
 assert.match(css,/verse-cell:nth-child\(4\)/);
});
test('mobile settings support a full-height scroller and native safe areas',()=>{
 assert.match(css,/height:100dvh/);
 assert.match(css,/preferences-dialog \.preferences-scroll/);
 assert.match(read('app/layout.tsx'),/viewportFit:'cover'/);
 assert.match(read('VERSION'),/^1\.1\.0\s*$/);
});

test('mobile navigation shares the themed desktop sidebar palette, including E Ink',()=>{
 for(const token of ['--sidebar','--sidebar-foreground','--sidebar-accent','--sidebar-accent-foreground','--sidebar-primary','--sidebar-border','--sidebar-ring']){
  assert.ok(css.includes(`var(${token})`),`missing shared sidebar variable ${token}`);
 }
 assert.match(css,/\.mobile-action-item\[data-active=true\]\{background:var\(--sidebar-accent\)/);
 assert.match(css,/html\[data-eink=true\] \.mobile-action-item\[data-active=true\]/);
});

test('reader tabs are scrollable horizontally without drawing native vertical scroll arrows',()=>{
 assert.match(css,/\.reader-tools \.reading-modes\{[^}]*overflow-x:auto;overflow-y:hidden;scrollbar-width:none/s);
 assert.match(css,/\.reader-tools \.reading-modes::-webkit-scrollbar\{display:none/);
 assert.match(css,/max-width:1100px/);
});

test('calendar renders actual event markers on narrow phone and tablet viewports',()=>{
 const calendar=read('components/siddur/CalendarView.tsx');
 assert.match(calendar,/titles\.length>0&&<span className="calendar-event-dot" aria-hidden="true"\/>/);
 assert.match(css,/\.calendar-grid\.days \.calendar-event-dot\{[\s\S]*?display:block;/);
 assert.doesNotMatch(read('app/globals.css'),/calendar-day:has\(small\)::after/);
});

test('popup uses its own visible-viewport centering host, not page-relative positioning',()=>{
 const component=read('components/ui/dialog.tsx');
 assert.match(component,/data-slot="dialog-viewport"/);
 assert.match(component,/ref=\{viewportRef\}/);
 assert.match(component,/window\.visualViewport/);
 for(const key of ['viewport?.offsetLeft','viewport?.offsetTop','viewport?.width','viewport?.height',
  'host.style.left','host.style.top','host.style.width','host.style.height']){
  assert.ok(component.includes(key),`missing live viewport positioning ${key}`);
 }
 assert.match(css,/\[data-slot="dialog-viewport"\]\{[\s\S]*?display:flex;align-items:center;/);
 assert.match(css,/\[data-slot="dialog-viewport"\]\{[\s\S]*?justify-content:center;/);
 assert.match(css,/\[data-slot="dialog-viewport"\]>\[data-slot="dialog-content"\]\{[\s\S]*?position:relative!important;/);
 assert.match(css,/\[data-slot="dialog-viewport"\]>\[data-slot="dialog-content"\]\{[\s\S]*?translate:none!important;transform:none!important;/);
 assert.match(css,/\[data-slot="dialog-viewport"\]>\[data-slot="dialog-content"\]\.preferences-dialog\{[\s\S]*?overflow:hidden!important;/);
 assert.match(css,/\.time-zone-panel\{position:relative!important/);
 assert.match(read('components/siddur/Controls.tsx'),/collisionPadding=\{12\}/);
 // No desktop-style 50% offset or translation remains in the component.
 assert.doesNotMatch(component,/top-\[50%\]|left-\[50%\]|translate-x-\[-50%\]|translate-y-\[-50%\]|zoom-in-95|zoom-out-95/);
});

test('phone and tablet landscape share one COMPLETE rail style across the 767px breakpoint',()=>{
 const section=css.match(/\/\* Compact landscape navigation is one visual component[\s\S]*?\/\* The portal owns dialog placement./);
 assert.ok(section,'one canonical landscape rail block required');
 const rules=section[0];
 assert.match(rules,/@media \(orientation:landscape\)\{/);
 assert.match(rules,/html:is\(\[data-device-class="phone"\],\[data-device-class="tablet"\]\)/);
 assert.match(rules,/--handheld-rail-width:76px/);
 assert.match(rules,/\.kavvanah-layout>\[data-slot="sidebar"\]\{display:none!important\}/);
 // Crucial regression: landscape at 774px must NOT depend on <=767px rules
 // for centering, rounded active tile, icon/label layout or focus indicator.
 const item=rules.match(/\n  \.mobile-action-item\{([^}]*)\}/)?.[1];
 assert.ok(item,'canonical rail item missing');
 for(const property of ['display:flex','align-items:center','justify-content:center','flex-direction:column',
   'gap:5px','min-height:58px','width:100%','border-radius:8px','font-size:10px',
   'text-align:center','color:var(--sidebar-muted)']){
   assert.ok(item.includes(property),`missing shared landscape button style ${property}`);
 }
 for(const selector of ['.mobile-action-nav{','.mobile-action-scroll{',
   '.mobile-action-item>span{','.mobile-action-item svg{',
   '.mobile-action-item[data-active=true]{','.mobile-action-item:focus-visible{',
   '.mobile-action-separator{']){
   assert.ok(rules.includes(selector),`missing shared rail selector ${selector}`);
 }
 assert.match(rules,/overflow-y:auto;overflow-x:hidden/);
 assert.match(rules,/scroll-snap-type:y proximity/);
 assert.match(rules,/background:var\(--sidebar-accent\);color:var\(--sidebar-accent-foreground\)/);
 assert.doesNotMatch(rules,/html\[data-device-class="tablet"\] \.mobile-action-(?:nav|scroll|item)/,
   'no alternate tablet rail style may be defined in the shared block');
});

test('the original short landscape fallback cannot override the common rail geometry',()=>{
 const fallback=css.match(/\/\* Small landscape phones:[\s\S]*?\/\* Three reading layers/);
 assert.ok(fallback,'existing short landscape fallback should remain');
 // The short-height selector must only TURN ON the common component, not
 // redefine its look with incomplete button properties.
 assert.match(fallback[0],/\.mobile-action-nav\{display:block\}/);
 assert.doesNotMatch(fallback[0],/\.mobile-action-item\{/);
 assert.doesNotMatch(fallback[0],/\.mobile-action-scroll\{/);
 assert.doesNotMatch(fallback[0],/border-radius:8px/);
});

test('settings use full visible phone space and keep a scrolling body when keyboard opens',()=>{
 const component=read('components/ui/dialog.tsx');
 assert.match(component,/viewport\?\.addEventListener\('resize',update\)/);
 assert.match(component,/viewport\?\.addEventListener\('scroll',update\)/);
 assert.match(component,/viewport\?\.removeEventListener\('resize',update\)/);
 assert.match(component,/window\.addEventListener\('resize',update\)/);
 assert.match(css,/@media \(max-width:800px\), \(max-height:600px\)\{/);
 assert.match(css,/\[data-slot="dialog-viewport"\]>\[data-slot="dialog-content"\]\.preferences-dialog\{\s*height:100%!important;/);
 assert.match(css,/\[data-slot="dialog-viewport"\] \.preferences-dialog \.preferences-scroll\{[\s\S]*?overflow-y:auto;/);
 assert.match(css,/\[data-slot="dialog-viewport"\] \.preferences-dialog>\[data-slot="dialog-header"\]\{[\s\S]*?flex:0 0 auto/);
});

test('searchable prayer-selection sheet stays usable with the virtual keyboard',()=>{
 const component=read('components/ui/sheet.tsx');
 assert.match(component,/window\.visualViewport/);
 assert.match(component,/viewport\.addEventListener\('resize',update\)/);
 assert.match(component,/viewport\.removeEventListener\('scroll',update\)/);
 assert.match(css,/\[data-slot="sheet-content"\]\.mobile-prayer-sheet\{[\s\S]*?height:calc\(var\(--kav-visible-height,100dvh\)/);
 assert.match(css,/\.mobile-prayer-sheet \.mobile-prayer-results\{min-height:0;overflow-y:auto\}/);
});

// Regression: the Samsung Galaxy A55 360px viewport must never show only
// half of Settings. Center with ONE parent flexbox, not multiple CSS shifts.
test('no duplicate centering or alternate dialog positioning survives',()=>{
 const component=read('components/ui/dialog.tsx');
 const block=css.split('/* The portal owns dialog placement.')[1]?.split('/* The prayer picker is a popup too.')[0];
 assert.ok(block,'canonical dialog viewport block missing');
 assert.equal((css.match(/\/\* The portal owns dialog placement\./g)||[]).length,1);
 assert.match(block,/pointer-events:none;/);
 assert.match(component,/fixed inset-0 z-50 pointer-events-auto bg-black\/50/);
 assert.match(component,/relative pointer-events-auto z-50/);
 assert.match(block,/margin:0!important/);
 assert.match(block,/inset:auto!important/);
 assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g,''),/left:50%|top:50%|transform:translate\(/);
 assert.doesNotMatch(component,/left-\[50%\]|top-\[50%\]|translate-x-\[-50%\]|translate-y-\[-50%\]/);
});
