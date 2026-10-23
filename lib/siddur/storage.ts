'use client';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS,validateLocation } from './core';
import type { Language,Layer,Settings } from './types';
import { preferredEdition } from './translation-editions';
import {translate} from './i18n';
import { einkEnabled,isEinkDevice } from './eink';

export function safeRead<T>(key:string,fallback:T):T {try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
export function safeWrite(key:string,value:unknown):boolean {try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}

export function sanitizeSettings(raw:Partial<Settings>):Settings{
 const out={...DEFAULT_SETTINGS,...raw};
 const choices:Record<string,string[]>={uiLanguage:['en','ru','uk','he'],accent:['blue','gold','teal','plum','terracotta','green','amber','rose','violet','slate','olive','cyan'],calendarMode:['hebrew','gregorian'],clockFormat:['24h','12h'],theme:['light','dark','black','paper','dark-paper','system'],einkMode:['auto','on','off'],nusach:['ashkenaz','edot'],pronunciation:['sephardi','ashkenazi'],transliterationLanguage:['en','ru','uk'],translationLanguage:['en','ru','uk'],layout:['columns','stacked'],font:['serif','sans','alef','rashi'],zmanMethod:['gra','mga'],nightfall:['8.5','7.083','72']};
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
 out.cantillation=typeof out.cantillation==='boolean'?out.cantillation:true;
 out.useElevation=!!out.useElevation;
 out.prayerLinks=typeof out.prayerLinks==='boolean'?out.prayerLinks:true;
 if(!out.place||validateLocation(out.place))out.place=DEFAULT_SETTINGS.place;
 return out;
}

export function useSettings(){
 const [settings,setSettings]=useState<Settings>(DEFAULT_SETTINGS),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false);
 const [einkDetected,setEinkDetected]=useState(()=>typeof document!=='undefined'&&document.documentElement.dataset.eink==='true');
 useEffect(()=>{const raw=safeRead<Partial<Settings>>('kavvanah.settings',{});setSettings(sanitizeSettings(raw??{}));setReady(true);},[]);
 useEffect(()=>{if(ready)setStorageError(!safeWrite('kavvanah.settings',settings));},[settings,ready]);
 // E Ink detection is entirely local. Do not request high-entropy model
 // hints: some browsers treat them as fingerprinting-sensitive information.
 useEffect(()=>{
  const monochrome=window.matchMedia('(monochrome)');
  const detect=()=>setEinkDetected(isEinkDevice({userAgent:navigator.userAgent,monochrome:monochrome.matches}));
  detect();
  monochrome.addEventListener?.('change',detect);
  return()=>monochrome.removeEventListener?.('change',detect);
 },[]);
 useEffect(()=>{document.documentElement.dataset.eink=einkEnabled(settings.einkMode,einkDetected)?'true':'false';},[settings.einkMode,einkDetected]);
 useEffect(()=>{document.documentElement.lang=settings.uiLanguage==='he'?'he':settings.uiLanguage;document.documentElement.dir=settings.uiLanguage==='he'?'rtl':'ltr';},[settings.uiLanguage]);
 useEffect(()=>{
  document.title=translate(settings.uiLanguage,'Kavvanah · Your daily siddur');
  document.querySelector('meta[name="description"]')?.setAttribute('content',translate(settings.uiLanguage,'Your multilingual siddur, Jewish calendar, prayer times, Jerusalem compass, and complete Tanakh. Read in Hebrew, with transliteration and translation.'));
  const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if(manifest){
   // Resolve relative to the existing href to support GitHub project Pages and native assets.
   const basename=settings.uiLanguage==='en'?'manifest.webmanifest':`manifest.${settings.uiLanguage}.webmanifest`;
   manifest.href=new URL(basename,manifest.href).href;
  }
 },[settings.uiLanguage]);
 useEffect(()=>{document.documentElement.dataset.accent=settings.accent;},[settings.accent]);
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=settings.theme==='system'?(media.matches?'dark':'light'):settings.theme;};apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[settings.theme]);
 const patch=useCallback((value:Partial<Settings>)=>setSettings(current=>sanitizeSettings({...current,...value})),[]);
 return {settings,ready,storageError,einkDetected,patch};
}
