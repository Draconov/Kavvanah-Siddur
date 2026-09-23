'use client';
import { useEffect,useMemo,useState } from 'react';
import { ArrowLeft,ArrowRight,BookOpen,Search,LoaderCircle } from 'lucide-react';
import { useUI } from '@/lib/siddur/i18n-context';
import { prayerForTime } from '@/lib/siddur/navigation';
import { Reader } from './Reader';
import { Choice,EmptyState } from './Controls';
import { safeRead,safeWrite } from '@/lib/siddur/storage';
import type { Settings,SiddurData,PersonalTranslations } from '@/lib/siddur/types';

export function PrayerView({settings,patch,personal,setPersonal,requestedTime}:{requestedTime?:string|null;settings:Settings;patch:(v:Partial<Settings>)=>void;personal:PersonalTranslations;setPersonal:(p:PersonalTranslations)=>void}){
 const {t}=useUI();
 const [data,setData]=useState<SiddurData|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState(''),[category,setCategory]=useState('Morning'),[query,setQuery]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const ac=new AbortController();setData(null);setError('');fetch(`/texts/${settings.nusach}.json`,{signal:ac.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<SiddurData>;}).then((next:SiddurData)=>{setData(next);const old=safeRead<string>(`kavvanah.section.${settings.nusach}`,'');const first=(requestedTime?prayerForTime(requestedTime,next.sections):null)??next.sections.find(p=>p.id===old)??next.sections.find(p=>p.category==='Morning'&&p.title==='Shema')??next.sections.find(p=>p.category==='Morning'&&/shema/i.test(p.title))??next.sections[0];setSelected(first.id);setCategory(first.category);}).catch(e=>{if(e.name!=='AbortError')setError('This prayer edition could not be loaded. Connect to the internet or download it for offline reading.');});return()=>ac.abort();},[settings.nusach,retry,requestedTime]);
 const sections=useMemo(()=>data?.sections.filter(s=>(category==='All'||s.category===category)&&(!query||`${s.title} ${t(s.title)} ${s.heTitle} ${s.path.join(' ')} ${s.path.map(p=>t(p)).join(' ')}`.toLowerCase().includes(query.toLowerCase())))??[],[data,category,query,settings.uiLanguage]);
 const prayer=data?.sections.find(p=>p.id===selected);
 const index=sections.findIndex(s=>s.id===selected);
 function select(id:string){setSelected(id);safeWrite(`kavvanah.section.${settings.nusach}`,id);}
 const categories=['Morning','Afternoon','Evening','Shabbat','Blessings','Festivals','Kaddish','Other','All'].filter(c=>c==='All'||data?.sections.some(s=>s.category===c));
 return <div className="prayer-view">
 <div className="view-heading"><div><p className="eyebrow">{t("YOUR PRAYER COMPANION")}</p><h1>{t("Siddur")} <span className="heading-hebrew" lang="he">סידור</span></h1></div><Choice label="Prayer tradition" value={settings.nusach} onChange={v=>patch({nusach:v as Settings['nusach']})} options={[{value:'ashkenaz',label:'Nusach Ashkenaz'},{value:'edot',label:'Edot HaMizrach · Sephardi'}]}/></div>
 <div className="category-tabs" aria-label={t("Prayer categories")}>{categories.map(c=><button className={category===c?'active':''} aria-pressed={category===c} key={c} onClick={()=>{setCategory(c);setQuery('');}}>{t(c)}</button>)}</div>
 {error?<EmptyState icon={<BookOpen/>} title={t("Your texts are out of reach")}>{t(error)}<button className="button primary" onClick={()=>setRetry(n=>n+1)}>{t("Try again")}</button></EmptyState>:!data?<div className="loading-state" role="status"><LoaderCircle className="spin"/>{t("Opening your siddur…")}</div>:<div className="prayer-workspace">
 <aside className="prayer-explorer"><div className="search-box"><Search size={16}/><input aria-label={t("Search prayers")} placeholder={t("Find a prayer…")} value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="explorer-heading"><span>{t(category==='All'?'ALL PRAYERS':category).toLocaleUpperCase()}</span><span>{sections.length}</span></div><div className="prayer-list" aria-label={t("Prayers")}>{sections.map(s=><button key={s.id} className={selected===s.id?'selected':''} onClick={()=>select(s.id)} aria-current={selected===s.id?'true':undefined}><span>{settings.uiLanguage==='he'?s.heTitle:t(s.title)}</span><small>{s.path.slice(1,-1).map(p=>t(p)).join(' · ')||t(s.path[0])}</small></button>)}{!sections.length&&<p className="muted">{t("No prayers match this search.")}</p>}</div></aside>
 <div className="prayer-content">{prayer&&<><div className="prayer-heading"><div><p className="eyebrow">{prayer.path.slice(0,-1).map(p=>t(p)).join(' / ')}</p><h2>{settings.uiLanguage==='he'?prayer.heTitle:t(prayer.title)}</h2><p className="prayer-subline">{t('{count} passages',{count:prayer.paragraphs.length})} <span>·</span> {t(settings.nusach==='ashkenaz'?'Ashkenaz':'Edot HaMizrach')}</p></div><div className="prayer-hebrew-title" lang="he" dir="rtl">{prayer.heTitle}</div></div><Reader id={`${settings.nusach}:${prayer.id}`} paragraphs={prayer.paragraphs} settings={settings} patch={patch} personal={personal} setPersonal={setPersonal} sources={data.sources}/><div className="reader-navigation"><button className="button subtle" disabled={index<=0} onClick={()=>select(sections[index-1].id)}><ArrowLeft className="directional-icon" size={16}/>{t("Previous prayer")}</button><span>{index>=0?t('{current} of {total}',{current:index+1,total:sections.length}):t('Selected prayer')}</span><button className="button subtle" disabled={index<0||index>=sections.length-1} onClick={()=>select(sections[index+1].id)}>{t("Next prayer")}<ArrowRight className="directional-icon" size={16}/></button></div></>}</div>
 </div>}
 </div>;
}
