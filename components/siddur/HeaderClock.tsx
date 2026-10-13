'use client';
import {useEffect, useMemo, useState} from 'react';
import {useUI} from '@/lib/siddur/i18n-context';
import type {Settings} from '@/lib/siddur/types';

/** Re-renders only the clock once a second, not the entire siddur reader. */
export function HeaderClock({timeZone,format,einkActive=false}:{timeZone:string;format:Settings['clockFormat'];einkActive?:boolean}){
 const {t}=useUI();
 const [now,setNow]=useState<Date|null>(null);
 useEffect(()=>{
  const update=()=>setNow(new Date());
  update();
  const interval=window.setInterval(update,einkActive?30_000:1000);
  window.addEventListener('visibilitychange',update);
  return ()=>{window.clearInterval(interval);window.removeEventListener('visibilitychange',update);};
 },[einkActive]);
 const formatter=useMemo(()=>new Intl.DateTimeFormat(format==='12h'?'en-US':'en-GB',{
  timeZone,hour:'2-digit',minute:'2-digit',...(einkActive?{}:{second:'2-digit' as const}),hour12:format==='12h'
 }),[timeZone,format,einkActive]);
 return <time className="header-clock" dir="ltr" aria-label={t('Current local time')}>{now?formatter.format(now):(einkActive?'--:--':'--:--:--')}</time>;
}
