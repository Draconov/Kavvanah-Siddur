'use client';
import { memo,useDeferredValue,useEffect,useMemo,useState } from 'react';
import { ArrowLeft,ArrowRight,BookOpen,Search,LoaderCircle } from 'lucide-react';
import { useUI } from '@/lib/siddur/i18n-context';
import { prayerForTime } from '@/lib/siddur/navigation';
import { applySiddurTranslation } from '@/lib/siddur/translations';
import { loadReaderJson,siddurIndexPath,siddurCategoryPath,siddurTranslationCategoryPath }  from '@/lib/siddur/text-loading';
import { Reader } from './Reader';
import { Choice,EmptyState } from './Controls';
import { safeRead,safeWrite } from '@/lib/siddur/storage';
import type { Settings,SiddurData,PersonalTranslations } from '@/lib/siddur/types';
import type { SiddurTranslationFile } from '@/lib/siddur/translations';

export const PrayerView=memo(function PrayerView({settings,patch,personal,setPersonal,requestedTime}:{requestedTime?:string|null;settings:Settings;patch:(v:Partial<Settings>)=>void;personal:PersonalTranslations;setPersonal:(p:PersonalTranslations)=>void}){
 const {t}=useUI();
 const [catalog,setCatalog]=useState<SiddurData|null>(null),[data,setData]=useState<SiddurData|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState(''),[category,setCategory]=useState('Morning'),[query,setQuery]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  setCatalog(null);setData(null);setError('');
  loadReaderJson<SiddurData>(siddurIndexPath(settings.nusach)).then(index=>{
   if(!active)return;
   if(index.nusach!==settings.nusach||!Array.isArray(index.sections))throw Error('Invalid Siddur index');
   setCatalog(index);
   const old=safeRead<string>(`kavvanah.section.${settings.nusach}`,'');
   const first=index.sections.find(p=>p.id===old)??index.sections.find(p=>p.category==='Morning'&&p.title==='Shema')??index.sections.find(p=>p.category==='Morning'&&/shema/i.test(p.title))??index.sections[0];
   if(first){setSelected(first.id);setCategory(first.category);}
  }).catch(()=>{if(active)setError('This prayer edition could not be loaded. Connect to the internet or download it for offline reading.');});
  return()=>{active=false;};
 },[settings.nusach,retry]);
 const activeCategory=catalog?.sections.find(section=>section.id===selected)?.category??null;
 useEffect(()=>{
  if(!catalog||!activeCategory)return;
  let active=true;
  setData(null);setError('');
  Promise.all([
   loadReaderJson<SiddurData>(siddurCategoryPath(settings.nusach,activeCategory)),
   loadReaderJson<SiddurTranslationFile>(siddurTranslationCategoryPath(settings.translationLanguage,settings.nusach,activeCategory)),
  ]).then(([base,translations])=>{
   if(!active)return;
   if(base.nusach!==settings.nusach||base.sections.some(s=>s.category!==activeCategory))throw Error('Invalid Siddur category');
   setData(applySiddurTranslation(base,translations));
  }).catch(()=>{if(active)setError('This prayer category or translation could not be loaded. Connect to the internet or download it for offline reading.');});
  return()=>{active=false;};
 },[catalog,activeCategory,settings.nusach,settings.translationLanguage,retry]);
 // Prayer time shortcuts work from the small index: no full Siddur hydration.
 useEffect(()=>{
  if(!catalog||!requestedTime)return;
  const first=prayerForTime(requestedTime,catalog.sections);
  if(first){setSelected(first.id);setCategory(first.category);}
 },[requestedTime,catalog]);
 const deferredQuery=useDeferredValue(query.trim().toLowerCase());
 const searchIndex=useMemo(()=>new Map<string,string>(catalog?.sections.map(s=>[s.id,`${s.title} ${t(s.title)} ${s.heTitle} ${s.path.join(' ')} ${s.path.map(p=>t(p)).join(' ')}`.toLowerCase()] as const)??[]),[catalog,t]);
 const sections=useMemo(()=>catalog?.sections.filter(s=>(category==='All'||s.category===category)&&(!deferredQuery||searchIndex.get(s.id)?.includes(deferredQuery)))??[],[catalog,category,deferredQuery,searchIndex]);
 const prayer=data?.sections.find(p=>p.id===selected);
 const index=sections.findIndex(s=>s.id===selected);
 function select(id:string){setSelected(id);safeWrite(`kavvanah.section.${settings.nusach}`,id);}
 const categories=['Morning','Afternoon','Evening','Shabbat','Blessings','Festivals','Kaddish','Other','All'].filter(c=>c==='All'||catalog?.sections.some(s=>s.category===c));
 return <div className="prayer-view">
 <div className="view-heading"><div><p className="eyebrow">{t("YOUR PRAYER COMPANION")}</p><h1>{t("Siddur")} <span className="heading-hebrew" lang="he">סידור</span></h1></div><Choice label="Prayer tradition" value={settings.nusach} onChange={v=>patch({nusach:v as Settings['nusach']})} options={[{value:'ashkenaz',label:'Nusach Ashkenaz'},{value:'edot',label:'Edot HaMizrach · Sephardi'}]}/></div>
 <div className="category-tabs" aria-label={t("Prayer categories")}>{categories.map(c=><button className={category===c?'active':''} aria-pressed={category===c} key={c} onClick={()=>{setCategory(c);setQuery('');}}>{t(c)}</button>)}</div>
 {error?<EmptyState icon={<BookOpen/>} title={t("Your texts are out of reach")}>{t(error)}<button className="button primary" onClick={()=>setRetry(n=>n+1)}>{t("Try again")}</button></EmptyState>:!data?<div className="loading-state" role="status"><LoaderCircle className="spin"/>{t("Opening your siddur…")}</div>:<div className="prayer-workspace">
 <aside className="prayer-explorer"><div className="search-box"><Search size={16}/><input aria-label={t("Search prayers")} placeholder={t("Find a prayer…")} value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="explorer-heading"><span>{t(category==='All'?'ALL PRAYERS':category).toLocaleUpperCase()}</span><span>{sections.length}</span></div><div className="prayer-list" aria-label={t("Prayers")}>{sections.map(s=><button key={s.id} className={selected===s.id?'selected':''} onClick={()=>select(s.id)} aria-current={selected===s.id?'true':undefined}><span>{settings.uiLanguage==='he'?s.heTitle:t(s.title)}</span><small>{s.path.slice(1,-1).map(p=>t(p)).join(' · ')||t(s.path[0])}</small></button>)}{!sections.length&&<p className="muted">{t("No prayers match this search.")}</p>}</div></aside>
 <div className="prayer-content">{!data?<div className="loading-state" role="status"><LoaderCircle className="spin"/>{t('Opening your siddur…')}</div>:prayer&&<><div className="prayer-heading"><div><p className="eyebrow">{prayer.path.slice(0,-1).map(p=>t(p)).join(' / ')}</p><h2>{settings.uiLanguage==='he'?prayer.heTitle:t(prayer.title)}</h2><p className="prayer-subline">{t('{count} passages',{count:prayer.paragraphs.length})} <span>·</span> {t(settings.nusach==='ashkenaz'?'Ashkenaz':'Edot HaMizrach')}</p></div><div className="prayer-hebrew-title" lang="he" dir="rtl">{prayer.heTitle}</div></div><Reader id={`${settings.nusach}:${prayer.id}`} paragraphs={prayer.paragraphs} settings={settings} patch={patch} personal={personal} setPersonal={setPersonal} sources={data.sources}/><div className="reader-navigation"><button className="button subtle" disabled={index<=0} onClick={()=>select(sections[index-1].id)}><ArrowLeft className="directional-icon" size={16}/>{t("Previous prayer")}</button><span>{index>=0?t('{current} of {total}',{current:index+1,total:sections.length}):t('Selected prayer')}</span><button className="button subtle" disabled={index<0||index>=sections.length-1} onClick={()=>select(sections[index+1].id)}>{t("Next prayer")}<ArrowRight className="directional-icon" size={16}/></button></div></>}</div>
 </div>}
 </div>;
});
