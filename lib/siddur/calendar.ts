import {HDate} from '@hebcal/core';
import type {CalendarMode} from './types.ts';
function civilDate(year:number,month:number,day:number){const d=new Date(2000,0,1,12);d.setFullYear(year,month,day);return d;}

export function calendarMonth(anchor:Date,mode:CalendarMode){
 const hd=new HDate(anchor);
 const start=mode==='hebrew'?new HDate(1,hd.getMonth(),hd.getFullYear()).greg():civilDate(anchor.getFullYear(),anchor.getMonth(),1);
 start.setHours(12,0,0,0);
 const count=mode==='hebrew'?hd.daysInMonth():civilDate(start.getFullYear(),start.getMonth()+1,0).getDate();
 const dates=Array.from({length:count},(_,i)=>civilDate(start.getFullYear(),start.getMonth(),start.getDate()+i));
 return {start,end:dates[count-1],dates};
}

export function moveCalendarMonth(anchor:Date,mode:CalendarMode,delta:number){
 const {start}=calendarMonth(anchor,mode);
 if(!Number.isInteger(delta))throw new RangeError('Month offset must be an integer');
 let next:Date;
 if(mode==='hebrew'){
  let cursor=new HDate(start);
  for(let i=0;i<Math.abs(delta);i++){
   const adjacent=cursor.add(delta>0?cursor.daysInMonth():-1,'d');
   cursor=new HDate(1,adjacent.getMonth(),adjacent.getFullYear());
  }
  next=cursor.greg();
 }else next=civilDate(start.getFullYear(),start.getMonth()+delta,1);
 next.setHours(12,0,0,0);
 return next;
}

export type CalendarUnit='day'|'month'|'year';
export interface CalendarParts {day:number;month:number;year:number}
export function calendarParts(date:Date,mode:CalendarMode):CalendarParts{
 const h=new HDate(date);
 return mode==='hebrew'?{day:h.getDate(),month:h.getMonth(),year:h.getFullYear()}:{day:date.getDate(),month:date.getMonth()+1,year:date.getFullYear()};
}
export function calendarDate(mode:CalendarMode,{day,month,year}:CalendarParts):Date{
 const min=mode==='hebrew'?3761:1,max=mode==='hebrew'?13760:9999;
 if(![day,month,year].every(Number.isInteger)||year<min||year>max||day<1||day>31||month<1||month>(mode==='hebrew'?13:12))throw new RangeError('Invalid calendar date');
 let date:Date;
 if(mode==='hebrew'){
  if(month===13&&!HDate.isLeapYear(year))month=12;
  date=new HDate(Math.min(day,HDate.daysInMonth(month,year)),month,year).greg();
 }else{
  date=new Date(2000,0,1,12);
  // Construct the month's end in the target year (including February leap days).
  date.setFullYear(year,month,0);
  const last=date.getDate();date.setFullYear(year,month-1,Math.min(day,last));
 }
 if(date.getFullYear()<1||date.getFullYear()>9999)throw new RangeError('Date outside supported civil range');
 date.setHours(12,0,0,0);return date;
}
export function moveCalendarDate(anchor:Date,mode:CalendarMode,unit:CalendarUnit,delta:number):Date{
 if(!Number.isInteger(delta))throw new RangeError('Date offset must be an integer');
 const parts=calendarParts(anchor,mode);
 if(unit==='year')return calendarDate(mode,{...parts,year:parts.year+delta});
 if(unit==='month')return calendarDate(mode,{...calendarParts(moveCalendarMonth(anchor,mode,delta),mode),day:parts.day});
 const next=new Date(anchor);next.setDate(next.getDate()+delta);next.setHours(12,0,0,0);
 return calendarDate(mode,calendarParts(next,mode));
}
