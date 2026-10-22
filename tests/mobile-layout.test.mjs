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

test('all compact modal dialogs and selects honor viewport bounds',()=>{
 assert.match(css,/\[data-slot="dialog-content"\]:not\(\.preferences-dialog\)/);
 assert.match(css,/max-height:calc\(100dvh - 24px - env\(safe-area-inset-top/);
 assert.match(css,/\.preferences-dialog\{[\s\S]*?top:50%!important;left:50%!important;/);
 assert.match(css,/\[data-slot="select-content"\]/);
 assert.match(css,/\.time-zone-panel\{position:relative!important/);
 assert.match(read('components/siddur/Controls.tsx'),/collisionPadding=\{12\}/);
});
