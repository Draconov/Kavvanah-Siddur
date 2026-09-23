'use client';
import { useUI } from '@/lib/siddur/i18n-context';
import type { ReactNode } from 'react';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export function Choice({label,value,onChange,options,className=''}:{label:string;value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];className?:string}){
 const {t}=useUI();
 return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={t(label)} className={`choice ${className}`}><SelectValue/></SelectTrigger><SelectContent position="popper">{options.map(o=><SelectItem value={o.value} key={o.value}>{t(o.label)}</SelectItem>)}</SelectContent></Select>;
}
export function ToggleRow({label,description,checked,onChange}:{label:string;description?:string;checked:boolean;onChange:(value:boolean)=>void}){
 const {t}=useUI();
 return <div className="toggle-row"><div><span>{t(label)}</span>{description&&<p>{t(description)}</p>}</div><Switch aria-label={t(label)} checked={checked} onCheckedChange={onChange}/></div>;
}
export function EmptyState({icon,title,children}:{icon?:ReactNode;title:string;children?:ReactNode}){const {t}=useUI();return <div className="empty-state">{icon}<h3>{t(title)}</h3><p>{children}</p></div>;}
