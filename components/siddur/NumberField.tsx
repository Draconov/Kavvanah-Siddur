'use client';
import {ChevronDown,ChevronUp} from 'lucide-react';
import {useUI} from '@/lib/siddur/i18n-context';

/** One accessible, theme-owned spinner for all numeric fields, including dates. */
export function NumberField({id,label,value,min,max,step=1,precision=0,inputMode='decimal',required=false,onChange}:{
 id:string;label:string;value:number|string;min:number;max:number;step?:number;precision?:number;
 inputMode?:'decimal'|'numeric';required?:boolean;onChange:(raw:string)=>void;
}){
 const {t}=useUI();
 const numeric=typeof value==='number'?value:Number(value);
 const finite=value!==''&&Number.isFinite(numeric);
 const increment=(direction:1|-1)=>{
  // A blank/invalid draft starts at the respective boundary; always clamp.
  const start=finite?numeric:(direction===1?min-step:max+step);
  const next=Math.min(max,Math.max(min,Number((start+direction*step).toFixed(precision))));
  onChange(String(next));
 };
 return <div className="settings-number-field" dir="ltr">
  <input id={id} aria-label={t(label)} type="number" inputMode={inputMode}
   min={min} max={max} step={step} required={required}
   value={typeof value==='number'&&!finite?'':value}
   onChange={event=>onChange(event.target.value)}/>
  <div className="settings-number-steps">
   <button type="button" aria-label={`${t(label)} +`} title={`${t(label)} +`}
    disabled={finite&&numeric>=max} onClick={()=>increment(1)}><ChevronUp aria-hidden="true" size={15}/></button>
   <button type="button" aria-label={`${t(label)} −`} title={`${t(label)} −`}
    disabled={finite&&numeric<=min} onClick={()=>increment(-1)}><ChevronDown aria-hidden="true" size={15}/></button>
  </div>
 </div>;
}
