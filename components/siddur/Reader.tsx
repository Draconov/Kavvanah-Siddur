'use client';
import { useUI } from '@/lib/siddur/i18n-context';
import { memo,useEffect,useMemo,useState } from 'react';
import { ArrowLeft,ArrowRight,Columns2,Rows3,SlidersHorizontal,Pencil,Check,BookOpen } from 'lucide-react';
import { Tabs,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Choice } from './Controls';
import { LANGUAGES,LAYER_LABELS,moveLayer,transcription,isReadingInstruction,translationFor } from '@/lib/siddur/reading';
import { HAS_CANTILLATION,applyCantillationAccents,displayHebrewMarks,type CantillationChapter } from '@/lib/siddur/hebrew-marks';
import { loadReaderJson } from '@/lib/siddur/text-loading';
import type { Layer,Paragraph,PersonalTranslations,Settings,Source } from '@/lib/siddur/types';

interface Props {id:string;paragraphs:Paragraph[];settings:Settings;patch:(value:Partial<Settings>)=>void;personal:PersonalTranslations;setPersonal:(next:PersonalTranslations)=>void;sources:Source[];}
const langOptions=Object.entries(LANGUAGES).map(([value,label])=>({value,label}));

export const Reader=memo(function Reader({id,paragraphs,settings,patch,personal,setPersonal,sources}:Props){
 const {t}=useUI();
 const [appearance,setAppearance]=useState(false),[edit,setEdit]=useState<number|null>(null),[draft,setDraft]=useState('');
 const [cantillationState,setCantillationState]=useState<{id:string;data:CantillationChapter}|null>(null);
 const cantillationData=cantillationState?.id===id?cantillationState.data:null;
 // Load optional offline supplementary data only when the user wants te'amim.
 // The canonical Tanakh JSON, its verse IDs, and every translation remain intact.
 useEffect(()=>{
  let active=true;
  setCantillationState(null);
  if(!settings.cantillation || !id.startsWith('tanakh:'))return()=>{active=false;};
  const [,book,chapter]=id.split(':');
  loadReaderJson<{books:Record<string,number[]>}>('/texts/optimized/cantillation/index.json')
   .then(index=>{
    if(!active || !index.books?.[book]?.includes(Number(chapter)))return null;
    return loadReaderJson<CantillationChapter>(`/texts/optimized/cantillation/${book}/${chapter}.json`);
   }).then(data=>{if(active&&data){setCantillationState({id,data});}})
   .catch(()=>{/* An optional data layer must never block reading. */});
  return()=>{active=false;};
 },[id,settings.cantillation]);
 const displayParagraph=useMemo(()=>paragraphs.map((p,i)=>{
   const supplied=cantillationData?.verses[i];
   return supplied?applyCantillationAccents(p.he,supplied):p.he;
 }),[paragraphs,cantillationData]);
 const containsTrope=useMemo(()=>displayParagraph.some(s=>HAS_CANTILLATION.test(s)),[displayParagraph]);
 const {layers}=settings;
 const marking=id.startsWith('tanakh:')?'tanakh':'siddur';
 const trans=useMemo(()=>layers.includes('transliteration')?paragraphs.map(p=>isReadingInstruction(p)?'Reading instruction':transcription(p.he,settings.transliterationLanguage,settings.pronunciation,marking)):[],[paragraphs,settings.transliterationLanguage,settings.pronunciation,layers,marking]);
 const unpointed=trans.some(text=>/[א-ת]/.test(text));
 const mode=layers.length===3?'all':layers.includes('transliteration')?'reading':layers.includes('translation')?'meaning':'hebrew';
 const setMode=(value:string)=>{const wanted:Layer[]=value==='all'?['hebrew','transliteration','translation']:value==='reading'?['hebrew','transliteration']:value==='meaning'?['hebrew','translation']:['hebrew'];patch({layers:[...layers.filter(l=>wanted.includes(l)),...wanted.filter(l=>!layers.includes(l))]});};
 const missing=layers.includes('translation')&&paragraphs.some((p,i)=>!translationFor(p,settings.translationLanguage,`${id}:${i}`,personal));
 function editTranslation(index:number){setEdit(index);setDraft(translationFor(paragraphs[index],settings.translationLanguage,`${id}:${index}`,personal)??'');}
 return <section className="reader-wrap" aria-label={t("Prayer reader")}>
  <div className="reader-tools">
   <Tabs value={mode} onValueChange={setMode}><TabsList className="reading-modes"><TabsTrigger value="hebrew">{t("Hebrew")}</TabsTrigger><TabsTrigger value="reading">{t("+ Reading")}</TabsTrigger><TabsTrigger value="meaning">{t("+ Meaning")}</TabsTrigger><TabsTrigger value="all">{t("All")}</TabsTrigger></TabsList></Tabs>
   <div className="tool-actions"><button className="icon-button" aria-label={t(settings.layout==='columns'?'Use stacked reading':'Use parallel columns')} title={t(settings.layout==='columns'?'Use stacked reading':'Use parallel columns')} onClick={()=>patch({layout:settings.layout==='columns'?'stacked':'columns'})}>{settings.layout==='columns'?<Rows3 size={19}/>:<Columns2 size={19}/>}</button><button className="icon-button" aria-label={t("Text appearance")} onClick={()=>setAppearance(true)}><SlidersHorizontal size={19}/></button></div>
  </div>
  <div className="reader-sheet">
   <div className="layer-headings" style={{gridTemplateColumns:`repeat(${layers.length},minmax(0,1fr))`}}>
    {layers.map((layer,index)=><div className={`layer-heading ${layer}`} key={layer}><div><strong>{t(LAYER_LABELS[layer])}</strong></div><div className="layer-detail">{layer==='hebrew'?<span>{settings.uiLanguage!=='he'&&'עברית'}</span>:<Choice label={`${LAYER_LABELS[layer]} language`} value={layer==='transliteration'?settings.transliterationLanguage:settings.translationLanguage} onChange={v=>patch(layer==='transliteration'?{transliterationLanguage:v as Settings['transliterationLanguage']}:{translationLanguage:v as Settings['translationLanguage']})} options={langOptions} className="language-choice"/>}<span className="layer-order"><button aria-label={t('Move {layer} earlier',{layer:t(LAYER_LABELS[layer])})} title={t("Move earlier")} disabled={index===0} onClick={()=>patch({layers:moveLayer(layers,layer,-1)})}><ArrowLeft className="directional-icon" size={13}/></button><button aria-label={t('Move {layer} later',{layer:t(LAYER_LABELS[layer])})} title={t("Move later")} disabled={index===layers.length-1} onClick={()=>patch({layers:moveLayer(layers,layer,1)})}><ArrowRight className="directional-icon" size={13}/></button></span></div></div>)}
   </div>
   <div className={`reader-body ${settings.layout} font-${settings.font}`} data-mobile-panels={settings.layout==='columns'&&layers.length===3?'true':undefined} style={{'--hebrew-size':`${settings.textSize/16}rem`,'--reading-size':`${Math.max(16,settings.textSize*.68)/16}rem`,'--layer-count':layers.length} as React.CSSProperties}>
   {paragraphs.map((paragraph,index)=><div className={`verse-row ${isReadingInstruction(paragraph)?'instruction-row':''}`} key={`${id}:${index}`}>
    <span className="verse-number">{String(index+1).padStart(2,'0')}</span>
    {layers.map(layer=><div key={layer} className={`verse-cell ${layer}`} dir={layer==='hebrew'?'rtl':'ltr'} lang={layer==='hebrew'?'he':layer==='translation'?settings.translationLanguage:settings.transliterationLanguage}>
     <span className="mobile-layer-label">{t(LAYER_LABELS[layer])}</span>
     {layer==='hebrew'?<p>{displayHebrewMarks(displayParagraph[index],settings.vowels,settings.cantillation)}</p>:layer==='transliteration'?<p>{isReadingInstruction(paragraph)?(translationFor(paragraph,settings.transliterationLanguage,`${id}:${index}`,personal)??t('Reading instruction')):trans[index]}</p>:<>{paragraph.translationNotes?.[settings.translationLanguage]==='combined'&&!personal[`${id}:${index}:${settings.translationLanguage}`]&&<small className="translation-note" title={t('This source passage covers several Hebrew verses and is repeated in full.')}>{t('Combined source passage')}</small>}<p className={translationFor(paragraph,settings.translationLanguage,`${id}:${index}`,personal)?'':'unavailable'}>{translationFor(paragraph,settings.translationLanguage,`${id}:${index}`,personal)??t('No translation in this language yet.')}</p>{settings.translationLanguage==='ru'&&paragraph.translationEditions?.ru==='toldot-siddur-2011'&&!personal[`${id}:${index}:ru`]&&<a className="translation-attribution" href={paragraph.translationRefs?.ru} target="_blank" rel="noreferrer" lang="ru">© Толдот Йешурун · Toldot.com</a>}<button className="edit-translation" aria-label={t('Edit {language} translation for paragraph {number}',{language:t(LANGUAGES[settings.translationLanguage]),number:index+1})} onClick={()=>editTranslation(index)}><Pencil size={12}/>{t(personal[`${id}:${index}:${settings.translationLanguage}`]?'Your translation':'Add or edit')}</button></>}
    </div>)}
   </div>)}
   </div>
   <div className="reader-footnote"><BookOpen size={15}/><span>{settings.cantillation&&!containsTrope&&t("No cantillation marks are available for this passage. The original text is unchanged.")} {layers.includes('transliteration')&&t('Transliteration is an automatic reading aid; pronunciation may vary by community. ')}{unpointed&&<>{t('Words with missing or unclear vowel marks are kept in Hebrew.')} </>}{missing&&t('Translations are shown only where available. You can add your own.')}</span></div>
  </div>
  <details className="sources"><summary>{t("Text editions & attribution")}</summary>{cantillationData&&cantillationData.verses.some(Boolean)&&<p><a href="https://github.com/openscriptures/morphhb" target="_blank" rel="noreferrer">{t("Cantillation source: Open Scriptures Hebrew Bible (CC BY 4.0)")}</a></p>}<p>{t("Paragraphs follow the source, including instructions and alternative passages. Seasonal passages are not automatically selected.")}</p>{sources.map((source,i)=><p key={i}><a href={source.url} target="_blank" rel="noreferrer">{t(source.version)}</a> · {t(({he:'Hebrew',en:'English',ru:'Russian',uk:'Ukrainian'} as Record<string,string>)[source.language]??source.language)}{source.license&&<> · {t(source.license)}</>}</p>)}</details>
  <Dialog open={appearance} onOpenChange={setAppearance}><DialogContent className="settings-dialog"><DialogHeader><DialogTitle>{t("Make yourself comfortable")}</DialogTitle><DialogDescription>{t("Your reading preferences stay on this device.")}</DialogDescription></DialogHeader><div className="field"><label>{t("Hebrew text size")} <span>{settings.textSize}{t("px")}</span></label><Slider aria-label={t("Hebrew text size")} min={20} max={44} step={1} value={[settings.textSize]} onValueChange={v=>patch({textSize:v[0]})}/></div><div className="field"><label>{t("Type style")}</label><Choice label="Type style" value={settings.font} onChange={v=>patch({font:v as Settings['font']})} options={[{value:'serif',label:t('Book · Hebrew serif')},{value:'sans',label:t('Clean · Sans serif')},{value:'alef',label:'Alef'},{value:'rashi',label:'Noto Rashi Hebrew'}]}/></div><div className="field"><label>{t("Vowel marks")}</label><Choice label="Vowel marks" value={settings.vowels?'on':'off'} onChange={v=>patch({vowels:v==='on'})} options={[{value:'on',label:'Show nikkud'},{value:'off',label:'Hide nikkud'}]}/></div><div className="field"><label>{t("Cantillation marks (te’amim)")}</label><Choice label={t("Cantillation marks (te’amim)")} value={settings.cantillation?'on':'off'} onChange={v=>patch({cantillation:v==='on'})} options={[{value:'on',label:t('Show te’amim')},{value:'off',label:t('Hide te’amim')}]}/></div><div className="field"><label>{t("Pronunciation")}</label><Choice label="Pronunciation" value={settings.pronunciation} onChange={v=>patch({pronunciation:v as Settings['pronunciation']})} options={[{value:'sephardi',label:'Sephardi / Israeli reading aid'},{value:'ashkenazi',label:'Ashkenazi reading aid'}]}/></div></DialogContent></Dialog>
  <Dialog open={edit!==null} onOpenChange={open=>{if(!open)setEdit(null);}}><DialogContent className="settings-dialog"><DialogHeader><DialogTitle>{t('Your {language} translation',{language:t(LANGUAGES[settings.translationLanguage])})}</DialogTitle><DialogDescription>{t("Saved privately on this device. The Hebrew source stays intact.")}</DialogDescription></DialogHeader>{edit!==null&&<p className="edit-source" dir="rtl" lang="he">{paragraphs[edit]?.he}</p>}<textarea dir="ltr" aria-label={t("Personal translation")} value={draft} onChange={e=>setDraft(e.target.value)} rows={6}/><DialogFooter><button className="button subtle" onClick={()=>{if(edit!==null){const next={...personal};delete next[`${id}:${edit}:${settings.translationLanguage}`];setPersonal(next);setEdit(null);}}}>{t("Use source translation")}</button><button className="button primary" onClick={()=>{if(edit!==null){const next={...personal};if(draft.trim())next[`${id}:${edit}:${settings.translationLanguage}`]=draft.trim();else delete next[`${id}:${edit}:${settings.translationLanguage}`];setPersonal(next);setEdit(null);}}}><Check size={16}/>{t("Save translation")}</button></DialogFooter></DialogContent></Dialog>
 </section>;
});
