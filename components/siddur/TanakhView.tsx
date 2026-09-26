'use client';
import { useUI } from '@/lib/siddur/i18n-context';
import { useEffect,useState } from 'react';
import { ArrowLeft,ArrowRight,BookOpen,Check,LoaderCircle } from 'lucide-react';
import { Reader } from './Reader';
import { Choice,EmptyState } from './Controls';
import { safeRead,safeWrite } from '@/lib/siddur/storage';
import { applyTanakhTranslation,resolveEditionForBook } from '@/lib/siddur/translation-editions';
import type { TanakhTranslationFile } from '@/lib/siddur/translation-editions';
import type { BookData,BookInfo,Settings,PersonalTranslations } from '@/lib/siddur/types';

export function TanakhView({settings,patch,personal,setPersonal}:{settings:Settings;patch:(v:Partial<Settings>)=>void;personal:PersonalTranslations;setPersonal:(p:PersonalTranslations)=>void}){
 const {t}=useUI();
 const [catalog,setCatalog]=useState<BookInfo[]>([]),[bookId,setBookId]=useState('genesis'),[chapter,setChapter]=useState(1),[book,setBook]=useState<BookData|null>(null),[error,setError]=useState(''),[saved,setSaved]=useState(false),[retry,setRetry]=useState(0),[editionNotice,setEditionNotice]=useState(''),[activeEdition,setActiveEdition]=useState('');
 useEffect(()=>{const ac=new AbortController();const old=safeRead<{book:string;chapter:number}>('kavvanah.tanakh',{book:'genesis',chapter:1});fetch('/texts/catalog.json',{signal:ac.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<{books:BookInfo[]}>;}).then(data=>{setCatalog(data.books);const info=data.books.find((b:BookInfo)=>b.id===old.book);if(info){setBookId(info.id);setChapter(Math.min(info.chapters,Math.max(1,old.chapter||1)));}}).catch(e=>{if(e.name!=='AbortError')setError('The book catalog could not be loaded. Please reconnect and try again.');});return()=>ac.abort();},[retry]);
 useEffect(()=>{
  const ac=new AbortController();setBook(null);setError('');setSaved(false);setEditionNotice('');
  const language=settings.translationLanguage;
  const requested=settings.translationEditions[language];
  fetch(`/texts/${bookId}.json`,{signal:ac.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<BookData>;}).then(async(data:BookData)=>{
   const resolution=resolveEditionForBook(language,requested,data.id,data.category);
   const {preferred,intended,effective,usedFallback}=resolution;
   setActiveEdition(preferred.composite?.length&&!usedFallback?`${preferred.label} · ${effective.label}`:effective.label);
   if(usedFallback)setEditionNotice(t('{preferred} is selected. This book temporarily uses {effective} because {intended} is not bundled yet.',{preferred:preferred.label,effective:effective.label,intended:intended.label}));
   if(effective.builtin||!effective.path)return data;
   const response=await fetch(effective.path,{signal:ac.signal});
   if(!response.ok)throw Error();
   const bundle=await response.json() as TanakhTranslationFile;
   if(bundle.language!==language||bundle.edition!==effective.id)throw Error('Translation edition metadata mismatch');
   return applyTanakhTranslation(data,bundle);
  }).then((data:BookData)=>{setBook(data);setChapter(c=>Math.min(c,data.chapters));}).catch(e=>{if(e.name!=='AbortError')setError('This book could not be opened. Connect to the internet, or download all texts for offline reading.');});
  return()=>ac.abort();
 },[bookId,retry,settings.translationLanguage,settings.translationEditions,t]);
 const selected=catalog.find(b=>b.id===bookId),index=catalog.findIndex(b=>b.id===bookId);
 function navigate(delta:number){setSaved(false);if(chapter+delta>=1&&chapter+delta<=(book?.chapters??1))setChapter(c=>c+delta);else{const next=catalog[index+delta];if(next){setBookId(next.id);setChapter(delta>0?1:next.chapters);}}}
 function saveNext(){let b=bookId,c=chapter+1;if(c>(book?.chapters??1)){b=catalog[index+1]?.id??'genesis';c=1;}const ok=safeWrite('kavvanah.tanakh',{book:b,chapter:c});if(ok)setSaved(true);else setError('Your browser could not save reading progress. Free some device storage and try again.');}
 return <div className="tanakh-view"><div className="view-heading"><div><p className="eyebrow">{t("ONE CHAPTER AT A TIME")}</p><h1>{t("Tanakh")} <span className="heading-hebrew" lang="he">תנ״ך</span></h1></div><span className="pill">{t("24 books · 929 chapters")}</span></div><div className="daily-reading-banner"><span className="reading-book-icon"><BookOpen size={26}/></span><div><strong>{t("Your daily reading")}</strong><p>{t(saved?'Progress saved. Your next visit will open the following chapter.':'Read at your own pace. Mark a chapter complete to save your next reading.')}</p></div><button className={`button ${saved?'subtle':'primary'}`} onClick={saveNext} disabled={!book||saved}><Check size={16}/>{t(saved?'Saved':'Mark chapter read')}</button></div><div className="tanakh-selectors"><div><label>{t("Book")}</label><Choice label="Tanakh book" value={bookId} onChange={v=>{setBookId(v);setChapter(1);}} options={catalog.length?catalog.map(b=>({value:b.id,label:settings.uiLanguage==='he'?b.heTitle:`${t(b.title)} · ${b.heTitle}`})):[{value:'genesis',label:'Genesis'}]}/></div><div><label>{t("Chapter")}</label><Choice label="Tanakh chapter" value={String(chapter)} onChange={v=>{setChapter(Number(v));setSaved(false);}} options={Array.from({length:selected?.chapters??1},(_,i)=>({value:String(i+1),label:t('Chapter {number}',{number:i+1})}))}/></div><span className="tanakh-category">{t(selected?.category==='Prophets'?'Nevi’im · Prophets':selected?.category==='Writings'?'Ketuvim · Writings':'Torah · Five Books of Moses')}</span></div>
 {editionNotice&&<p className="notice" role="status">{editionNotice}</p>}
 {error?<EmptyState title={t("Unable to open this text")}>{t(error)}<button className="button primary" onClick={()=>setRetry(n=>n+1)}>{t("Try again")}</button></EmptyState>:!book?<div className="loading-state" role="status"><LoaderCircle className="spin"/>{t('Opening {book}…',{book:t(selected?.title??'Tanakh')})}</div>:<><div className="prayer-heading"><div><p className="eyebrow">{t(book.category).toLocaleUpperCase()}</p><h2>{settings.uiLanguage==='he'?book.heTitle:t(book.title)} {chapter}</h2><p className="prayer-subline">{t('{count} verses',{count:book.text[chapter-1]?.length??0})} <span>·</span> {t('Current edition: {edition}',{edition:activeEdition})}</p></div><span className="prayer-hebrew-title" lang="he" dir="rtl">{book.heTitle}</span></div><Reader id={`tanakh:${book.id}:${chapter}`} paragraphs={book.text[chapter-1]??[]} settings={settings} patch={patch} personal={personal} setPersonal={setPersonal} sources={book.sources}/><div className="reader-navigation"><button className="button subtle" disabled={chapter===1&&index===0} onClick={()=>navigate(-1)}><ArrowLeft className="directional-icon" size={16}/>{t("Previous chapter")}</button><span>{chapter} / {book.chapters}</span><button className="button subtle" disabled={chapter===book.chapters&&index===catalog.length-1} onClick={()=>navigate(1)}>{t("Next chapter")}<ArrowRight className="directional-icon" size={16}/></button></div></>}
 </div>;
}
