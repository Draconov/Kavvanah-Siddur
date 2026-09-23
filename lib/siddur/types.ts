export type Layer = 'hebrew' | 'transliteration' | 'translation';
export type Language = 'en' | 'ru' | 'uk';
export type UiLanguage = Language | 'he';
export type Accent = 'blue' | 'gold' | 'teal' | 'plum' | 'terracotta' | 'green' | 'amber' | 'rose' | 'violet' | 'slate' | 'olive' | 'cyan';
export type CalendarMode = 'hebrew' | 'gregorian';
export type Nusach = 'ashkenaz' | 'edot';
export interface Place { name:string; latitude:number; longitude:number; timeZone:string; elevation:number; israel:boolean }
export interface Settings {
  uiLanguage:UiLanguage; prayerLinks:boolean;
  accent:Accent; calendarMode:CalendarMode;
  theme:'light'|'dark'|'black'|'paper'|'dark-paper'|'system'; nusach:Nusach; pronunciation:'sephardi'|'ashkenazi';
  transliterationLanguage:Language; translationLanguage:Language; layers:Layer[]; layout:'columns'|'stacked';
  textSize:number; font:'serif'|'sans'; vowels:boolean; place:Place;
  zmanMethod:'gra'|'mga'; nightfall:'8.5'|'7.083'|'72'; candleMinutes:number; useElevation:boolean;
}
export interface Source { id?:string; title:string; version:string; language:string; license:string; url:string; }
export interface Paragraph { kind?:'instruction'; spoken?:boolean; he:string; en?:string; ru?:string; uk?:string; translationRefs?:Partial<Record<Language,string>>; translationEditions?:Partial<Record<Language,string>>; translationNotes?:Partial<Record<Language,'combined'>>; }
export interface PrayerSection { id:string; title:string; heTitle:string; category:string; service:string; path:string[]; ref:string; paragraphs:Paragraph[]; }
export interface SiddurData { title:string; nusach:Nusach; sources:Source[]; sections:PrayerSection[]; }
export interface BookInfo { id:string; title:string; heTitle:string; category:string; chapters:number; }
export interface BookData extends BookInfo { sources:Source[]; text:Paragraph[][]; }
export type PersonalTranslations = Record<string,string>;
