import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const number=read('components/siddur/NumberField.tsx');
const settings=read('components/siddur/SettingsView.tsx');
const calendar=read('components/siddur/CalendarView.tsx');
const css=read('app/globals.css');
const eink=read('app/eink.css');

function collectTsx(dir){return readdirSync(new URL(`../${dir}/`,import.meta.url),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?collectTsx(`${dir}/${entry.name}`):entry.name.endsWith('.tsx')?[[`${dir}/${entry.name}`,read(`${dir}/${entry.name}`)]]:[]);}

test('Only the shared themed NumberField creates numeric input spinners',()=>{
 const all=[...collectTsx('app'),...collectTsx('components')];
 assert.ok(all.length>8,'Expected a representative TSX source tree');
 for(const [path,content] of all){
  if(path==='components/siddur/NumberField.tsx')continue;
  assert.doesNotMatch(content,/<input\b[^>]*\btype\s*=\s*["']number["']/s,`${path} has a browser-native spinner; use NumberField`);
 }
 assert.match(number,/type="number"/);
 assert.match(settings,/import \{ NumberField \} from '\.\/NumberField'/);
 assert.match(calendar,/import \{NumberField\} from '\.\/NumberField'/);
});

test('Calendar uses the same chevrons and preserves validated manual year entry',()=>{
 assert.match(calendar,/<NumberField id="calendar-jump-year"[^>]*value=\{year\}[^>]*inputMode="numeric" required/);
 assert.match(calendar,/onChange=\{raw=>\{setYear\(raw\)/);
 assert.match(calendar,/Number\.isInteger\(numericYear\)&&numericYear>=min&&numericYear<=max/);
 assert.match(number,/<ChevronUp\b/);
 assert.match(number,/<ChevronDown\b/);
 assert.match(number,/type="button"/);
 assert.match(number,/Math\.min\(max,Math\.max\(min,/);
 assert.doesNotMatch(calendar,/<label>[^<]*<span>\{t\('(Day|Month)'\)\}<\/span><Choice/);
});

test('Numeric styles suppress native WebKit and Firefox arrows and are responsive',()=>{
 assert.match(css,/\.settings-number-field>input::-webkit-(?:outer|inner)-spin-button/);
 assert.match(css,/\.settings-number-field>input\[type=number\]\{appearance:textfield;-moz-appearance:textfield\}/);
 assert.match(css,/\.calendar-jump \.settings-number-field>input\{height:100%;padding-inline:8px;/);
 assert.match(css,/@media\(max-width:767px\)\{\.calendar-jump \.settings-number-field>input\{padding-inline:5px\}\}/);
 assert.match(css,/\.settings-number-field:focus-within\{outline:2px solid var\(--ring\)/);
 assert.match(eink,/html\[data-eink='true'\] :is\(\.time-zone-search,\.settings-number-field\) > input:is\(:focus,:focus-visible\)/);
 assert.match(eink,/html\[data-eink='true'\] \.settings-number-steps > button:focus-visible/);
});

test('Browser-native date picker controls follow the chosen theme',()=>{
 assert.match(css,/:root\{color-scheme:light\}/);
 assert.match(css,/:root\[data-theme=dark\].*color-scheme:dark/);
 assert.match(eink,/color-scheme: light/);
 const times=read('components/siddur/TimesView.tsx');
 assert.match(times,/type="date"/,'Keep the accessible native date picker and keyboard input');
});
