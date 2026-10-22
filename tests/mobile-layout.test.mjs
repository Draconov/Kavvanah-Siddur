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
