#!/usr/bin/env python3
"""Apply Kavvanah header clock feature to a local repository checkout."""
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
paths = [
    'lib/siddur/types.ts', 'lib/siddur/core.ts', 'lib/siddur/storage.ts',
    'components/siddur/SettingsView.tsx', 'app/page.tsx',
    'app/globals.css', 'lib/siddur/i18n.ts',
]
contents = {p: (root / p).read_text(encoding='utf-8') for p in paths}
if (root / 'components/siddur/HeaderClock.tsx').exists():
    raise SystemExit('HeaderClock.tsx already exists: this patch may already have been applied. No files changed.')

def replace(path: str, old: str, new: str):
    value = contents[path]
    occurrences = value.count(old)
    if occurrences != 1:
        raise SystemExit(f'Cannot safely patch {path}: expected one matching section, found {occurrences}. No files changed.')
    contents[path] = value.replace(old, new, 1)

replace('lib/siddur/types.ts',
        "  accent:Accent; calendarMode:CalendarMode;",
        "  accent:Accent; calendarMode:CalendarMode; clockFormat:'24h'|'12h';")
replace('lib/siddur/core.ts',
        "accent:'blue',calendarMode:'hebrew',theme:",
        "accent:'blue',calendarMode:'hebrew',clockFormat:'24h',theme:")
replace('lib/siddur/storage.ts',
        "calendarMode:['hebrew','gregorian'],theme:",
        "calendarMode:['hebrew','gregorian'],clockFormat:['24h','12h'],theme:")
replace('app/page.tsx',
        "import { PrayerView } from '@/components/siddur/PrayerView';",
        "import { PrayerView } from '@/components/siddur/PrayerView';\nimport { HeaderClock } from '@/components/siddur/HeaderClock';")
replace('app/page.tsx',
        "</span></div><button className=\"header-location\" onClick={openSettings}>",
        "</span><HeaderClock timeZone={settings.place.timeZone} format={settings.clockFormat}/></div><button className=\"header-location\" onClick={openSettings}>")

# Select the browser's time zone only when the user explicitly asks for it.
# Picking a city already populates its IANA time zone through PLACES.
replace('components/siddur/SettingsView.tsx',
        '<div className="field"><label htmlFor="timezone">{t("Time zone")}</label><input id="timezone" dir="ltr" placeholder={t("Asia/Jerusalem")} value={place.timeZone} onChange={e=>setPlace({...place,timeZone:e.target.value})}/></div>',
        '<div className="field"><label htmlFor="timezone">{t("Time zone")}</label><input id="timezone" dir="ltr" placeholder={t("Asia/Jerusalem")} value={place.timeZone} onChange={e=>setPlace({...place,timeZone:e.target.value})}/><p className="field-hint">{t("Choose the time zone of the selected location. The clock uses your device time.")}</p></div><button className="button subtle" type="button" onClick={()=>setPlace({...place,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone})}>{t("Use device time zone")}</button>')
replace('components/siddur/SettingsView.tsx',
        '<div className="field"><label>{t("App language")}</label><Choice label="App language" value={settings.uiLanguage} onChange={v=>patch({uiLanguage:v as Settings[\'uiLanguage\']})} options={Object.entries(UI_LANGUAGES).map(([value,label])=>({value,label}))}/></div>',
        '<div className="field"><label>{t("App language")}</label><Choice label="App language" value={settings.uiLanguage} onChange={v=>patch({uiLanguage:v as Settings[\'uiLanguage\']})} options={Object.entries(UI_LANGUAGES).map(([value,label])=>({value,label}))}/></div><div className="field"><label>{t("Clock format")}</label><Choice label="Clock format" value={settings.clockFormat} onChange={v=>patch({clockFormat:v as Settings[\'clockFormat\']})} options={[{value:\'24h\',label:\'24-hour\'},{value:\'12h\',label:\'12-hour (AM/PM)\'}]}/></div>')
replace('app/globals.css',
        '.header-date{color:var(--muted-foreground)}',
        '.header-date{color:var(--muted-foreground)}.header-clock{color:var(--muted-foreground);font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums;unicode-bidi:isolate;flex-shrink:0}')
# Mobile date is hidden by existing styles; keep the new clock visible after section title.
contents['app/globals.css'] += '\n@media(max-width:767px){.header-clock{font-size:12px}.header-left{min-width:0}.header-section{white-space:nowrap}}\n'
replace('lib/siddur/i18n.ts',
        'const words:Record<string,[string,string]>={',
        "const words:Record<string,[string,string]>={\n 'Clock format':['Формат часов','Формат годинника'],\n '24-hour':['24-часовой','24-годинний'],\n '12-hour (AM/PM)':['12-часовой (AM/PM)','12-годинний (AM/PM)'],\n 'Current local time':['Текущее местное время','Поточний місцевий час'],\n 'Use device time zone':['Использовать часовой пояс устройства','Використати часовий пояс пристрою'],\n 'Choose the time zone of the selected location. The clock uses your device time.':['Укажите часовой пояс выбранного места. Часы используют время вашего устройства.','Укажіть часовий пояс вибраного місця. Годинник використовує час вашого пристрою.'],")
replace('lib/siddur/i18n.ts',
        'const hebrewWords:Record<string,string>={',
        "const hebrewWords:Record<string,string>={\n 'Clock format':'תבנית השעון','24-hour':'24 שעות','12-hour (AM/PM)':'12 שעות (AM/PM)','Current local time':'השעה המקומית הנוכחית','Use device time zone':'השתמש באזור הזמן של המכשיר','Choose the time zone of the selected location. The clock uses your device time.':'בחר את אזור הזמן של המיקום שנבחר. השעון משתמש בזמן המכשיר.',")

new_component = (Path(__file__).resolve().parent.parent / 'components/siddur/HeaderClock.tsx').read_text(encoding='utf-8')

# All expected original snippets were checked above before writing anything.
for p, content in contents.items():
    (root / p).write_text(content, encoding='utf-8')
(root / 'components/siddur/HeaderClock.tsx').write_text(new_component, encoding='utf-8')
print('Applied clock changes to existing sources plus HeaderClock.tsx.')
