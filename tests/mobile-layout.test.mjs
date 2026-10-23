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

test('compact dialog and select controls honor the actual visual viewport',()=>{
 const component=read('components/ui/dialog.tsx');
 assert.match(css,/\[data-slot="dialog-content"\]\[data-state\]\{/);
 assert.match(css,/top:var\(--kav-visible-center-y,50dvh\)!important/);
 assert.match(css,/left:var\(--kav-visible-center-x,50vw\)!important/);
 assert.match(css,/transform:translate\(-50%,-50%\)!important/);
 assert.match(css,/max-height:max\(0px,calc\(var\(--kav-visible-height,100dvh\)/);
 assert.match(css,/width:min\(560px,calc\(var\(--kav-visible-width,100vw\)/);
 assert.match(css,/\[data-slot="dialog-content"\]\.preferences-dialog\{[\s\S]*?overflow:hidden!important/);
 assert.match(css,/\[data-slot="select-content"\]/);
 assert.match(css,/\.time-zone-panel\{position:relative!important/);
 assert.match(read('components/siddur/Controls.tsx'),/collisionPadding=\{12\}/);
 for(const v of ['--kav-visible-height','--kav-visible-width','--kav-visible-center-x','--kav-visible-center-y','viewport.offsetTop','viewport.offsetLeft']){
  assert.ok(component.includes(v),`viewport measurements missing ${v}`);
 }
});

test('tablet landscape and phone landscape use exactly the same responsive rail rules',()=>{
 const section=css.match(/\/\* Mobile phone and tablet LANDSCAPE[\s\S]*?\/\* Unified viewport-safe dialogs/);
 assert.ok(section,'shared phone/tablet rail missing');
 const rules=section[0];
 assert.match(rules,/@media \(orientation:landscape\)\{/);
 assert.match(rules,/html:is\(\[data-device-class="phone"\],\[data-device-class="tablet"\]\)/);
 assert.match(rules,/--handheld-rail-width:76px/);
 for(const name of ['.mobile-action-nav','.mobile-action-scroll','.mobile-action-item','.mobile-action-item[data-active=true]','.mobile-action-separator']){
  assert.ok(rules.includes(name),`shared ${name} missing`);
 }
 assert.match(rules,/overflow-y:auto;overflow-x:hidden/);
 assert.match(rules,/scroll-snap-type:y proximity/);
 assert.match(rules,/min-height:58px/);
 assert.match(rules,/\.kavvanah-layout>\[data-slot="sidebar"\]\{display:none!important\}/);
 assert.doesNotMatch(rules,/html\[data-device-class="tablet"\] \.mobile-action-(?:nav|scroll|item)/,'avoid tablet-only rail diverging again');
});

test('viewport-bounded preferences dialog stays scrollable when keyboard shrinks height',()=>{
 const component=read('components/ui/dialog.tsx');
 assert.match(component,/window\.visualViewport/);
 assert.match(component,/viewport\.addEventListener\('resize',update\)/);
 assert.match(component,/viewport\.addEventListener\('scroll',update\)/);
 assert.match(component,/viewport\.removeEventListener\('resize',update\)/);
 assert.match(component,/ref=\{contentRef\}/);
 assert.match(css,/height:min\(760px,max\(0px,calc\(var\(--kav-visible-height,100dvh\)/);
 assert.match(css,/\.preferences-dialog \.preferences-scroll\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/\[data-slot="dialog-content"\]\.preferences-dialog \.preferences-scroll\{[\s\S]*?overflow-y:auto/);
});

test('searchable prayer-selection sheet stays usable with the virtual keyboard',()=>{
 const component=read('components/ui/sheet.tsx');
 assert.match(component,/window\.visualViewport/);
 assert.match(component,/viewport\.addEventListener\('resize',update\)/);
 assert.match(component,/viewport\.removeEventListener\('scroll',update\)/);
 assert.match(css,/\[data-slot="sheet-content"\]\.mobile-prayer-sheet\{[\s\S]*?height:calc\(var\(--kav-visible-height,100dvh\)/);
 assert.match(css,/\.mobile-prayer-sheet \.mobile-prayer-results\{min-height:0;overflow-y:auto\}/);
});
