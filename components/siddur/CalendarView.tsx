'use client';
import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,Sunset,Repeat2} from 'lucide-react';
import {calendarEvents,HDate,localDate,localKey,dateKeyInZone,formatTime} from '@/lib/siddur/core';
import {hebrewDateLabel} from '@/lib/siddur/i18n';
import {calendarMonth,calendarDate,calendarParts,moveCalendarDate,type CalendarUnit} from '@/lib/siddur/calendar';
import {useUI} from '@/lib/siddur/i18n-context';
import {Choice} from './Controls';
import type {Settings,CalendarMode} from '@/lib/siddur/types';

export function CalendarView({settings,patch}:{settings:Settings;patch:(value:Partial<Settings>)=>void}){
 const {t,locale}=useUI();
 const today=dateKeyInZone(new Date(),settings.place.timeZone);
 const [selected,setSelected]=useState(today);
 const [unit,setUnit]=useState<CalendarUnit>('month');
 const month=localDate(selected);
 const {start:first,end:last,dates}=calendarMonth(month,settings.calendarMode);
 const firstYear=first.getFullYear(),lastYear=last.getFullYear();
 const events=useMemo(()=>[...new Set([firstYear,lastYear])].filter(year=>year>=1&&year<=9999).flatMap(year=>calendarEvents(year,settings.place,settings)),[firstYear,lastYear,settings]);
 const eventMap=useMemo(()=>{const map=new Map<string,typeof events>();for(const event of events){const key=localKey(event.getDate().greg());map.set(key,[...(map.get(key)??[]),event]);}return map;},[events]);
 const offset=first.getDay();
 const hdFirst=new HDate(first),hdLast=new HDate(last),selectedHebrew=new HDate(localDate(selected));
 const selectedEvents=eventMap.get(selected)??[];
 const adjacent=(delta:number)=>{try{return localKey(moveCalendarDate(month,settings.calendarMode,unit,delta));}catch{return null;}};
 const previous=adjacent(-1),next=adjacent(1);
 const previousLabel=unit==='day'?'Previous day':unit==='year'?'Previous year':'Previous month';
 const nextLabel=unit==='day'?'Next day':unit==='year'?'Next year':'Next month';
 const hebrewMonths=t(hdFirst.getMonthName())+(hdFirst.getFullYear()!==hdLast.getFullYear()?' '+hdFirst.getFullYear():'')+(hdFirst.getMonth()!==hdLast.getMonth()?' – '+t(hdLast.getMonthName()):'')+' '+hdLast.getFullYear();
 const gregorianMonth=first.toLocaleDateString(locale,{month:'long'})+(firstYear!==lastYear?' '+firstYear:'')+(first.getMonth()!==last.getMonth()?' – '+last.toLocaleDateString(locale,{month:'long'}):'')+' '+lastYear,hebrewFirst=settings.calendarMode==='hebrew';
 return <div className="calendar-view">
  <div className="view-heading"><div><p className="eyebrow">{t('DAYS WITH MEANING')}</p><h1>{t('Jewish calendar')} <span className="heading-hebrew" lang="he">לוח שנה</span></h1></div><button className="pill calendar-mode-toggle" aria-label={t(hebrewFirst?'Switch to Gregorian calendar':'Switch to Hebrew calendar')} onClick={()=>patch({calendarMode:hebrewFirst?'gregorian':'hebrew'})}>{t(hebrewFirst?'Hebrew calendar':'Gregorian calendar')}<Repeat2 size={15}/></button></div>
  <div className="calendar-layout"><section className="panel calendar-panel">
   <div className="month-heading"><div><h2>{hebrewFirst?hebrewMonths:gregorianMonth}</h2>{!hebrewFirst&&<p>{hebrewMonths}</p>}</div><div className="month-controls"><Choice label="Navigation step" value={unit} onChange={v=>setUnit(v as CalendarUnit)} options={[{value:'day',label:'Day'},{value:'month',label:'Month'},{value:'year',label:'Year'}]}/><button className="icon-button" aria-label={t(previousLabel)} disabled={!previous} onClick={()=>previous&&setSelected(previous)}><ArrowLeft className="directional-icon" size={18}/></button><button className="button subtle" onClick={()=>setSelected(today)}>{t('Today')}</button><button className="icon-button" aria-label={t(nextLabel)} disabled={!next} onClick={()=>next&&setSelected(next)}><ArrowRight className="directional-icon" size={18}/></button></div></div>
   <DateJump key={selected+settings.calendarMode} selected={month} mode={settings.calendarMode} onSelect={date=>setSelected(localKey(date))}/>
   <div className="calendar-grid weekdays">{Array.from({length:7},(_,i)=><span key={i}>{new Date(2026,8,20+i,12).toLocaleDateString(locale,{weekday:'short'})}</span>)}</div>
   <div className="calendar-grid days">{Array.from({length:offset},(_,i)=><div className="blank-day" key={'blank-'+i}/>)}{dates.map(date=>{
    const key=localKey(date),h=new HDate(date),es=eventMap.get(key)??[],titles=es.filter(e=>!e.getCategories().some(c=>['candles','havdalah','omer'].includes(c)));
    const civilDate=date.toLocaleDateString(locale,{month:'long',day:'numeric',year:'numeric'}),hebrewDate=hebrewDateLabel(h,settings.uiLanguage);
    return <button className={'calendar-day '+(hebrewFirst?'hebrew-first ':'gregorian-first ')+(key===today?'today ':'')+(key===selected?'selected ':'')+(date.getDay()===6?'shabbat':'')} key={key} disabled={date.getFullYear()<1||date.getFullYear()>9999} onClick={()=>setSelected(key)} aria-label={(hebrewFirst?hebrewDate+', '+civilDate:civilDate+', '+hebrewDate)+', '+titles.map(e=>settings.uiLanguage==='he'?e.render('he'):t(e.render('en'))).join(', ')} aria-pressed={key===selected}>
     <div className="calendar-date-pair"><strong>{hebrewFirst?h.getDate():date.getDate()}</strong><span>{hebrewFirst?date.getDate():h.getDate()}</span></div>{titles.slice(0,2).map((e,j)=><small key={j}>{settings.uiLanguage==='he'?e.render('he'):t(e.render('en'))}</small>)}{titles.length>2&&<small>{t('+{count} more',{count:titles.length-2})}</small>}
    </button>;
   })}</div>
   <p className="calendar-note"><Sunset size={15}/>{t('Dates in the grid refer to daytime. The next Hebrew date begins at sunset.')}</p>
  </section><aside className="calendar-detail"><div className="panel"><p className="eyebrow">{t('SELECTED DAY')}</p><h2>{hebrewFirst?hebrewDateLabel(selectedHebrew,settings.uiLanguage):localDate(selected).toLocaleDateString(locale,{month:'long',day:'numeric',year:'numeric'})}</h2><p className="selected-civil-date">{hebrewFirst?localDate(selected).toLocaleDateString(locale,{month:'long',day:'numeric',year:'numeric'}):hebrewDateLabel(selectedHebrew,settings.uiLanguage)}</p><p className="detail-hebrew" lang="he">{selectedHebrew.renderGematriya()}</p><div className="event-list">{selectedEvents.length?selectedEvents.map((event,i)=>{
   const time='eventTime' in event?(event as unknown as {eventTime:Date}).eventTime:null;
   return <div className="calendar-event" key={i}><span className="event-mark"/><div><strong>{settings.uiLanguage==='he'?event.render('he'):t(event.render('en'))}</strong>{settings.uiLanguage!=='he'&&<p lang="he" dir="rtl">{event.render('he')}</p>}{time&&<span className="event-time">{formatTime(time,settings.place.timeZone)} · {t(settings.place.name)}</span>}</div></div>;
  }):<div className="no-event"><CalendarDays size={30}/><p>{t('No special observance today.')}</p></div>}</div></div><p className="subtle-note">{t('Holiday dates, fasts, Rosh Chodesh, the Omer, and weekly Torah portions are included. Candle lighting uses your location and selected offset.')}</p></aside></div>
 </div>;
}

function DateJump({selected,mode,onSelect}:{selected:Date;mode:CalendarMode;onSelect:(date:Date)=>void}){
 const {t,locale}=useUI();
 const initial=calendarParts(selected,mode);
 const [parts,setParts]=useState(initial),[year,setYear]=useState(String(initial.year));
 const [error,setError]=useState(false);
 const min=mode==='hebrew'?3761:1,max=mode==='hebrew'?13760:9999;
 const numericYear=Number(year),validYear=Number.isInteger(numericYear)&&numericYear>=min&&numericYear<=max;
 const safeYear=validYear?numericYear:initial.year;
 const month=mode==='hebrew'&&parts.month===13&&!HDate.isLeapYear(safeYear)?12:parts.month;
 const months=mode==='hebrew'?[7,8,9,10,11,12,...(HDate.isLeapYear(safeYear)?[13]:[]),1,2,3,4,5,6]:Array.from({length:12},(_,i)=>i+1);
 const last=mode==='hebrew'?HDate.daysInMonth(month,safeYear):calendarParts(calendarDate(mode,{year:safeYear,month,day:31}),mode).day;
 const day=Math.min(parts.day,last);
 return <form className="calendar-jump" onSubmit={e=>{e.preventDefault();if(!validYear){setError(true);return;}try{onSelect(calendarDate(mode,{year:numericYear,month,day}));setError(false);}catch{setError(true);}}}>
  <label><span>{t('Day')}</span><Choice label="Day" value={String(day)} onChange={v=>setParts({...parts,day:Number(v)})} options={Array.from({length:last},(_,i)=>({value:String(i+1),label:String(i+1)}))}/></label>
  <label><span>{t('Month')}</span><Choice label="Month" value={String(month)} onChange={v=>setParts({...parts,month:Number(v)})} options={months.map(m=>({value:String(m),label:mode==='hebrew'?new HDate(1,m,safeYear).getMonthName():new Date(2000,m-1,1).toLocaleDateString(locale,{month:'long'})}))}/></label>
  <label><span>{t('Year')}</span><input aria-label={t('Year')} type="number" inputMode="numeric" min={min} max={max} step={1} required value={year} onChange={e=>setYear(e.target.value)}/></label>
  <button className="button subtle" type="submit">{t('Go to date')}</button>
  {error&&<span role="alert">{t('Enter a valid year.')}</span>}
 </form>;
}
