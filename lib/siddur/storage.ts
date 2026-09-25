'use client';
import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS,validateLocation } from './core';
import type { Language,Layer,Settings } from './types';
import { preferredEdition } from './translation-editions';

export function safeRead<T>(key:string,fallback:T):T {try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
export function safeWrite(key:string,value:unknown):boolean {try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}

export function sanitizeSettings(raw:Partial<Settings>):Settings{
 const out={...DEFAULT_SETTINGS,...raw};
 const choices:Record<string,string[]>={uiLanguage:['en','ru','uk','he'],accent:['blue','gold','teal','plum','terracotta','green','amber','rose','violet','slate','olive','cyan'],calendarMode:['hebrew','gregorian'],clockFormat:['24h','12h'],theme:['light','dark','black','paper','dark-paper','system'],nusach:['ashkenaz','edot'],pronunciation:['sephardi','ashkenazi'],transliterationLanguage:['en','ru','uk'],translationLanguage:['en','ru','uk'],layout:['columns','stacked'],font:['serif','sans'],zmanMethod:['gra','mga'],nightfall:['8.5','7.083','72']};
 for(const [key,options] of Object.entries(choices))if(!options.includes(String(out[key as keyof Settings])))(out as unknown as Record<string,unknown>)[key]=DEFAULT_SETTINGS[key as keyof Settings];
 const rawEditions=raw.translationEditions&&typeof raw.translationEditions==='object'&&!Array.isArray(raw.translationEditions)?raw.translationEditions:{};
 out.translationEditions={...DEFAULT_SETTINGS.translationEditions};
 for(const language of ['en','ru','uk'] as Language[]){
  const candidate=String((rawEditions as Partial<Record<Language,string>>)[language]??out.translationEditions[language]);
  out.translationEditions[language]=preferredEdition(language,candidate).id;
 }
 out.layers=Array.isArray(raw.layers)?[...new Set(raw.layers.filter(l=>['hebrew','transliteration','translation'].includes(l)))]:DEFAULT_SETTINGS.layers;
 if(!out.layers.includes('hebrew'))out.layers.unshift('hebrew' as Layer);
 out.textSize=Number.isFinite(out.textSize)?Math.min(44,Math.max(20,out.textSize)):26;
 out.candleMinutes=Number.isFinite(out.candleMinutes)?Math.min(90,Math.max(0,out.candleMinutes)):18;
 out.vowels=typeof out.vowels==='boolean'?out.vowels:true;
 out.useElevation=!!out.useElevation;
 out.prayerLinks=typeof out.prayerLinks==='boolean'?out.prayerLinks:true;
 if(!out.place||validateLocation(out.place))out.place=DEFAULT_SETTINGS.place;
 return out;
}

export function useSettings(){
 const [settings,setSettings]=useState<Settings>(DEFAULT_SETTINGS),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false);
 useEffect(()=>{const raw=safeRead<Partial<Settings>>('kavvanah.settings',{});setSettings(sanitizeSettings(raw??{}));setReady(true);},[]);
 useEffect(()=>{if(ready)setStorageError(!safeWrite('kavvanah.settings',settings));},[settings,ready]);
 useEffect(()=>{document.documentElement.lang=settings.uiLanguage==='he'?'he':settings.uiLanguage;document.documentElement.dir=settings.uiLanguage==='he'?'rtl':'ltr';},[settings.uiLanguage]);
 useEffect(()=>{document.documentElement.dataset.accent=settings.accent;},[settings.accent]);
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=settings.theme==='system'?(media.matches?'dark':'light'):settings.theme;};apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[settings.theme]);
 return {settings,ready,storageError,patch:(value:Partial<Settings>)=>setSettings(current=>sanitizeSettings({...current,...value}))};
}
