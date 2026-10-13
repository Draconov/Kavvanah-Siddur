'use client';
import { useUI } from '@/lib/siddur/i18n-context';
import { hebrewDateLabel } from '@/lib/siddur/i18n';
import { PRAYER_SHORTCUTS } from '@/lib/siddur/navigation';
import { useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock3, Flame, MapPin, Sun, Sunrise, Sunset } from 'lucide-react';
import { calculateTimes, calendarEvents, dateKeyInZone, formatTime, HDate, localDate } from '@/lib/siddur/core';
import { chronologicalPrayerTimes, timedCalendarEventsForDate } from '@/lib/siddur/special-times';
import type { TimelineTime } from '@/lib/siddur/special-times';
import type { Settings } from '@/lib/siddur/types';

function timeIcon(time: TimelineTime) {
  if (time.kind === 'daily') return Clock3;
  if (/candle|chanukah/i.test(time.title)) return Flame;
  if (/havdalah|fast ends/i.test(time.title)) return Sunset;
  if (/fast begins/i.test(time.title)) return Sunrise;
  return Clock3;
}

export function TimesView({settings,openSettings,onOpenPrayer}:{settings:Settings;openSettings:()=>void;onOpenPrayer:(timeId:string)=>void}) {
  const {t}=useUI();
  const [date,setDate]=useState(()=>dateKeyInZone(new Date(),settings.place.timeZone));
  const dateInput=useRef<HTMLInputElement>(null);
  const calendarYear=Number(date.slice(0,4));
  const {place,candleMinutes,nightfall,useElevation}=settings;
  const calendar=useMemo(()=>calendarEvents(calendarYear,place,{candleMinutes,nightfall,useElevation}),[calendarYear,place,candleMinutes,nightfall,useElevation]);
  const specialTimes=useMemo(()=>timedCalendarEventsForDate(calendar,date),[calendar,date]);
  const times=useMemo(()=>calculateTimes(date,settings.place,settings),[date,settings]);
  const timeline=useMemo(()=>chronologicalPrayerTimes(times,specialTimes),[times,specialTimes]);
  const today=dateKeyInZone(new Date(),settings.place.timeZone);
  const now=new Date();
  const next=date===today?timeline.find(time=>time.time!==null&&time.time>now):undefined;
  const openCalendar=()=>{
    const input=dateInput.current;
    if(!input)return;
    try{if(typeof input.showPicker==='function'){input.showPicker();return;}}
    catch{/* Native picker may be unavailable in a WebView; retain keyboard access. */}
    input.focus();input.click();
  };

  return <div className="times-view">
    <div className="view-heading">
      <div><p className="eyebrow">{t('IN RHYTHM WITH THE DAY')}</p><h1>{t('Prayer times')} <span className="heading-hebrew" lang="he">זמנים</span></h1></div>
      <div className="prayer-date-picker" dir="ltr">
        <input ref={dateInput} className="date-input" aria-label={t('Prayer times date')} type="date" value={date} onChange={e=>{if(e.target.value&&/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))setDate(e.target.value);}}/>
        <button type="button" className="prayer-date-trigger" aria-label={t('Prayer times date')} title={t('Prayer times date')} onClick={openCalendar}><CalendarDays size={18} aria-hidden="true"/></button>
      </div>
    </div>
    <div className="location-banner">
      <MapPin size={21}/>
      <div><strong>{t(settings.place.name)}</strong><p className="location-coordinates">{settings.place.latitude.toFixed(4)}°, {settings.place.longitude.toFixed(4)}° · {settings.place.timeZone}</p></div>
      <button className="button subtle" onClick={openSettings}>{t('Change location')}</button>
    </div>
    <div className="time-highlights">
      {[times[2],times[5],times[9]].map((time,i)=>{
        const Icon=[Sunrise,Sun,Sunset][i];
        return <div className="panel time-highlight" key={time.id}><Icon size={25}/><span>{t(time.title)}</span><strong>{t(formatTime(time.time,settings.place.timeZone))}</strong><small lang="he">{time.he}</small></div>;
      })}
    </div>
    <section className="panel time-list">
      <div className="section-heading">
        <div><h2>{t('Daily zmanim')}</h2><p>{hebrewDateLabel(new HDate(localDate(date)),settings.uiLanguage,true)}</p></div>
        <span className="pill">{t(settings.zmanMethod==='gra'?'GRA':'MGA · 72 minutes')}</span>
      </div>
      {timeline.map(time=>{
        const special=time.kind==='special';
        const Icon=timeIcon(time);
        return <div className={`time-row${special?' special-time-row':''}${next?.id===time.id?' next-time':''}`} key={time.id}>
          <span className="time-row-icon"><Icon size={18}/></span>
          <div className="time-name">
            <strong>{special&&settings.uiLanguage==='he'?time.he:t(time.title)}{next?.id===time.id&&<span className="next-badge">{t('UP NEXT')}</span>}</strong>
            {!special&&<p>{t(time.detail)}</p>}
          </div>
          <span className="time-hebrew" lang="he">{time.he}</span>
          <div className="time-end">
            <strong className="time-value">{t(formatTime(time.time,settings.place.timeZone))}</strong>
            {!special&&settings.prayerLinks&&PRAYER_SHORTCUTS[time.id]&&<button className="prayer-time-link" onClick={()=>onOpenPrayer(time.id)}>{t('Open {prayer}',{prayer:t(PRAYER_SHORTCUTS[time.id].label)})} {settings.uiLanguage==='he'?'←':'→'}</button>}
          </div>
        </div>;
      })}
    </section>
    <p className="subtle-note">{t('Calculated by')} <a href="https://www.hebcal.com/home/developer-apis" target="_blank" rel="noreferrer">{t('Hebcal')}</a> {t('using NOAA solar calculations.')} {settings.useElevation?t('Elevation: {metres} m.',{metres:settings.place.elevation}):t('Sea-level calculations.')} {t('Times vary by local custom; confirm your community’s method. At extreme latitudes, some events cannot be calculated.')}</p>
  </div>;
}
