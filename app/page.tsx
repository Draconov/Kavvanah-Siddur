'use client';
import { lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { BookOpen,BookText,CalendarDays,Clock3,Compass,Download,MapPin,Moon,Settings2,Sun,Sunset } from 'lucide-react';
import { Sidebar,SidebarContent,SidebarFooter,SidebarHeader,SidebarMenu,SidebarMenuButton,SidebarMenuItem,SidebarProvider,SidebarTrigger,useSidebar } from '@/components/ui/sidebar';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { useSettings } from '@/lib/siddur/storage';
import { einkEnabled } from '@/lib/siddur/eink';
import { loadPersonalTranslations,savePersonalTranslations } from '@/lib/siddur/personal-store';
import { calculateTimes,currentHebrewDate,dateKeyInZone,formatTime } from '@/lib/siddur/core';
import { PrayerView } from '@/components/siddur/PrayerView';
import { HeaderClock } from '@/components/siddur/HeaderClock';
import { TanakhView } from '@/components/siddur/TanakhView';
const CalendarView=lazy(()=>import('@/components/siddur/CalendarView').then(module=>({default:module.CalendarView}))); 
const TimesView=lazy(()=>import('@/components/siddur/TimesView').then(module=>({default:module.TimesView}))); 
const CompassView=lazy(()=>import('@/components/siddur/CompassView').then(module=>({default:module.CompassView}))); 
const SettingsView=lazy(()=>import('@/components/siddur/SettingsView').then(module=>({default:module.SettingsView}))); 
import { I18nProvider } from '@/lib/siddur/i18n-context';
import { getUI,hebrewDateLabel } from '@/lib/siddur/i18n';
import type { PersonalTranslations } from '@/lib/siddur/types';

type View='siddur'|'tanakh'|'calendar'|'times'|'compass';
const NAV=[{id:'siddur',name:'Siddur',he:'סידור',icon:BookOpen},{id:'tanakh',name:'Tanakh',he:'תנ״ך',icon:BookText},{id:'calendar',name:'Calendar',he:'לוח שנה',icon:CalendarDays},{id:'times',name:'Prayer times',he:'זמנים',icon:Clock3},{id:'compass',name:'Mizrach',he:'מזרח',icon:Compass}] as const;
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};

function App(){
 const {settings,ready,storageError,einkDetected,patch}=useSettings();
 const {t,locale}=getUI(settings.uiLanguage);
 const einkActive=einkEnabled(settings.einkMode,einkDetected);
 const isHebrew=settings.uiLanguage==='he';
 const [requestedTime,setRequestedTime]=useState<string|null>(null);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const settingsOpener=useRef<HTMLElement|null>(null);
 const personalEdited=useRef(false);
 const [view,setView]=useState<View>('siddur'),[now,setNow]=useState<Date|null>(null),[personal,setPersonalState]=useState<PersonalTranslations>({}),[personalError,setPersonalError]=useState(''),[installPrompt,setInstallPrompt]=useState<InstallPrompt|null>(null),[installHelp,setInstallHelp]=useState(false),[networkOnline,setNetworkOnline]=useState(true);
 const {setOpenMobile}=useSidebar();
 useEffect(()=>{setNow(new Date());const tick=setInterval(()=>setNow(new Date()),30000);void loadPersonalTranslations().then(loaded=>{if(!personalEdited.current)setPersonalState(loaded);});setNetworkOnline(navigator.onLine);const online=()=>setNetworkOnline(true),offline=()=>setNetworkOnline(false);window.addEventListener('online',online);window.addEventListener('offline',offline);const handle=(e:Event)=>{e.preventDefault();setInstallPrompt(e as InstallPrompt);};window.addEventListener('beforeinstallprompt',handle);if('serviceWorker' in navigator&&process.env.NODE_ENV==='production')navigator.serviceWorker.register('/sw.js').catch(()=>{});return()=>{clearInterval(tick);window.removeEventListener('online',online);window.removeEventListener('offline',offline);window.removeEventListener('beforeinstallprompt',handle);};},[]);
 function navigate(next:View){setRequestedTime(null);setView(next);setOpenMobile(false);window.scrollTo({top:0,behavior:'instant'});}
 function openSettings(){settingsOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setOpenMobile(false);setSettingsOpen(true);}
 function openPrayer(timeId:string){navigate('siddur');setRequestedTime(timeId);}
 const setPersonal=useCallback((value:PersonalTranslations)=>{
  personalEdited.current=true;
  setPersonalState(value);
  void savePersonalTranslations(value).then(ok=>{if(!ok)setPersonalError('Your browser could not save these translations. Export a backup in Settings before closing the app.');else setPersonalError('');});
 },[]);
 async function install(){if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null);}else setInstallHelp(true);}
 const key=now?dateKeyInZone(now,settings.place.timeZone):'';
 const times=useMemo(()=>key?calculateTimes(key,settings.place,settings):[],[key,settings]);
 const hd=now?currentHebrewDate(now,settings.place):null;
 const next=now?times.find(t=>t.time&&t.time>now):undefined;
 const sunset=times.find(t=>t.id==='sunset');
 return <I18nProvider language={settings.uiLanguage}>
  <a href="#main-content" className="skip-link">{t('Skip to reader')}</a>
  <Sidebar side={isHebrew?'right':'left'} className="kavvanah-sidebar">
   <SidebarHeader className="sidebar-header"><a className="sidebar-brand" href="#siddur" onClick={e=>{e.preventDefault();navigate('siddur');}}><svg className="brand-icon" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14"/><path className="mark-letter" d="M19 17h14c12 0 16 7 16 15S45 47 33 47H19" fill="none" strokeWidth="5"/><path className="mark-line" d="M15 51h34" strokeWidth="2"/></svg><span><strong>{t('Kavvanah')}</strong><small>{!isHebrew&&'כַּוָּנָה · '}{t('Siddur')}</small></span></a></SidebarHeader>
   <SidebarContent className="sidebar-scroll">
    <div className="sidebar-date"><p>{t('TODAY IN THE HEBREW CALENDAR')}</p><div className="sidebar-date-row"><strong>{hd?hebrewDateLabel(hd,settings.uiLanguage):t('Your Jewish day')}</strong><span>{hd?.getFullYear()??''}</span></div><small lang="he" dir="rtl">{hd?.renderGematriya()??''}</small></div>
    <SidebarMenu className="main-nav">{NAV.map(item=><SidebarMenuItem key={item.id}><SidebarMenuButton isActive={view===item.id} className="main-nav-button" onClick={()=>navigate(item.id)}><item.icon size={20}/><span>{t(item.name)}</span><span className="nav-hebrew" lang="he">{item.he}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>
   </SidebarContent>
   <SidebarFooter className="sidebar-footer"><button className="sidebar-location" onClick={openSettings}><MapPin size={17}/><span>{t(settings.place.name)}<small>{t(settings.place.israel?'Israel calendar':'Diaspora calendar')}</small></span></button><div className="sidebar-bottom"><button onClick={openSettings} className={settingsOpen?'active':''}><Settings2 size={18}/>{t('Settings')}</button><button className="theme-toggle" title={t('Toggle dark mode')} aria-label={t('Toggle dark mode')} onClick={()=>patch({theme:['dark','black','dark-paper'].includes(document.documentElement.dataset.theme??'')?'light':'dark'})}>{['dark','black','dark-paper'].includes(settings.theme)?<Sun size={18}/>:<Moon size={18}/>}</button></div><button className="sidebar-install" onClick={install}><Download size={15}/>{t('Install app')}</button></SidebarFooter>
  </Sidebar>
  <div className="app-shell"><header className="app-header"><div className="header-left"><SidebarTrigger className="mobile-menu" aria-label={t('Toggle navigation')}/><span className="header-section">{t(NAV.find(n=>n.id===view)?.name??'')}</span><span className="header-divider"/><span className="header-date">{now?now.toLocaleDateString(locale,{timeZone:settings.place.timeZone,weekday:'long',month:'long',day:'numeric'}):t('A little space for prayer')}</span><HeaderClock timeZone={settings.place.timeZone} format={settings.clockFormat} einkActive={einkActive}/></div><button className="header-location" onClick={openSettings}><MapPin size={15}/>{t(settings.place.name)}<span>{t("Change")}</span></button></header>
  <main id="main-content"><div className="day-strip"><div><span className="day-icon"><Sun size={19}/></span><span><strong>{hd?hebrewDateLabel(hd,settings.uiLanguage,true):t('Welcome to Kavvanah')}</strong><small>{t("The Hebrew day begins at sunset")}</small></span></div><div className="day-strip-times">{sunset&&<span><Sunset size={17}/><span>{t("Sunset")}<strong>{formatTime(sunset.time,settings.place.timeZone)}</strong></span></span>}{next&&<span><Clock3 size={17}/><span>{t(next.title)}<strong>{formatTime(next.time,settings.place.timeZone)}</strong></span></span>}</div></div>{!networkOnline&&<p className="notice offline-notice">{t("You’re offline. Downloaded texts, the calendar, prayer times, and saved settings are available.")}</p>}{(storageError||personalError)&&<p className="notice" role="alert">{t(personalError||'Your browser is not saving settings. They will reset when this session ends.')}</p>}
  {ready&&<Suspense fallback={<div className="loading-state" role="status">{t('Opening…')}</div>}>{(view==='siddur'?<PrayerView requestedTime={requestedTime} settings={settings} patch={patch} personal={personal} setPersonal={setPersonal}/>:view==='tanakh'?<TanakhView settings={settings} patch={patch} personal={personal} setPersonal={setPersonal}/>:view==='calendar'?<CalendarView settings={settings} patch={patch}/>:view==='times'?<TimesView settings={settings} onOpenPrayer={openPrayer} openSettings={openSettings}/>:<CompassView settings={settings} openSettings={openSettings}/>)}</Suspense>}
  <footer className="app-footer"><span>{t('Kavvanah')}{!isHebrew&&<span lang="he">כַּוָּנָה</span>}</span><span>{t("Text from")} <a href="https://www.sefaria.org" target="_blank" rel="noreferrer">{t('Sefaria')}</a> {t("· Calendar by")} <a href="https://www.hebcal.com" target="_blank" rel="noreferrer">{t('Hebcal')}</a></span></footer></main></div>
  <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="settings-dialog preferences-dialog" onCloseAutoFocus={e=>{e.preventDefault();const target=settingsOpener.current;if(target?.isConnected)target.focus();else document.querySelector<HTMLButtonElement>('.mobile-menu')?.focus();}}><DialogHeader><DialogTitle>{t('Settings')}</DialogTitle><DialogDescription>{t('Saved on this device')}</DialogDescription></DialogHeader><div className="preferences-scroll"><Suspense fallback={null}><SettingsView settings={settings} einkDetected={einkDetected} patch={patch} personal={personal} setPersonal={setPersonal} onInstall={install} installable={!!installPrompt}/></Suspense></div></DialogContent></Dialog>
  <Dialog open={installHelp} onOpenChange={setInstallHelp}><DialogContent className="settings-dialog"><DialogHeader><DialogTitle>{t("Your siddur, one tap away")}</DialogTitle><DialogDescription>{t("Install Kavvanah from your browser for its own app icon and window.")}</DialogDescription></DialogHeader><div className="install-instructions"><div><strong>{t("iPhone & iPad")}</strong><p>{t("Open in Safari, tap Share, then Add to Home Screen. Enable “Open as Web App” if offered.")}</p></div><div><strong>{t("Android")}</strong><p>{t("Open the browser menu and choose “Install app” or “Add to Home screen.”")}</p></div><div><strong>{t('Windows, macOS & Linux')}</strong><p>{t("Use your browser’s install icon or app menu. In Safari on Mac, choose File → Add to Dock.")}</p></div></div><p className="notice">{t("After installation, open Settings and download all texts to prepare for offline reading. Installation and live compass support depend on your browser.")}</p></DialogContent></Dialog>
 </I18nProvider>;
}
export default function Home(){return <SidebarProvider className="kavvanah-layout"><App/></SidebarProvider>;}
